/**
 * Website scraper service
 * Scrapes company website content for the knowledge base
 * Supports configurable limits, rate limiting, URL filtering, and sitemap-based change detection
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../supabase/client.js';
import { chunkDocument } from '../rag/chunking.js';
import { generateEmbeddings } from '../rag/embeddings.js';
import crypto from 'crypto';

// Configuration defaults
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_RATE_LIMIT_MS = 1000; // 1 second between requests
const DEFAULT_PAGE_TIMEOUT_MS = 30000;

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
}

interface SitemapEntry {
  url: string;
  lastmod?: Date;
}

interface ScrapeOptions {
  workspaceId: string;  // Required for tenant isolation
  websiteUrl?: string;  // URL to scrape (from setup config or env var fallback)
  botId?: string;  // Optional bot-specific scraping
  maxPages?: number;
  rateLimitMs?: number;
  pageTimeoutMs?: number;
  includePatterns?: RegExp[];  // Only scrape URLs matching these patterns
  excludePatterns?: RegExp[];  // Skip URLs matching these patterns
  respectRobotsTxt?: boolean;
  useSitemapDetection?: boolean;  // Use sitemap.xml for incremental scraping (default: true)
}

/**
 * Scrape the company website
 */
export async function scrapeWebsite(options: ScrapeOptions): Promise<{
  pagesScraped: number;
  chunksCreated: number;
  errors: string[];
}> {
  const { workspaceId, botId, websiteUrl: configuredUrl } = options;

  // Use URL from options (setup config), fall back to env var for backwards compatibility
  const websiteUrl = configuredUrl || env.COMPANY_WEBSITE_URL;
  if (!websiteUrl) {
    logger.warn('No website URL configured, skipping scrape', { workspaceId });
    return { pagesScraped: 0, chunksCreated: 0, errors: ['No website URL configured'] };
  }

  const {
    maxPages = DEFAULT_MAX_PAGES,
    rateLimitMs = DEFAULT_RATE_LIMIT_MS,
    pageTimeoutMs = DEFAULT_PAGE_TIMEOUT_MS,
    includePatterns = [],
    excludePatterns = [
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|jpg|jpeg|png|gif|svg|mp4|mp3|wav)$/i,
      /\/wp-admin\//,
      /\/cart\//,
      /\/checkout\//,
      /\?/,  // Skip URLs with query parameters by default
    ],
    respectRobotsTxt = true,
    useSitemapDetection = true,
  } = options;

  logger.info('Starting website scrape', {
    url: websiteUrl,
    maxPages,
    rateLimitMs,
    workspaceId,
    useSitemapDetection,
  });

  const errors: string[] = [];
  const scrapedPages: ScrapedPage[] = [];
  let disallowedPaths: string[] = [];
  let usingSitemap = false;
  let unchangedCount = 0;

  // Try sitemap-based incremental scraping first
  let sitemapUrls: Set<string> = new Set();
  if (useSitemapDetection) {
    const sitemapEntries = await fetchSitemap(websiteUrl);

    if (sitemapEntries.length > 0) {
      // Get stored document dates for comparison
      const storedDates = await getStoredDocumentDates(workspaceId, botId);

      // Filter to only changed pages
      const { toScrape, unchanged } = filterChangedPages(sitemapEntries, storedDates);
      unchangedCount = unchanged;

      if (toScrape.length === 0) {
        logger.info('Sitemap check: No pages have changed', { totalInSitemap: sitemapEntries.length, unchanged });
        return { pagesScraped: 0, chunksCreated: 0, errors: [] };
      }

      // Use sitemap URLs for scraping
      sitemapUrls = new Set(toScrape.map(e => e.url));
      usingSitemap = true;

      logger.info('Sitemap-based incremental scrape', {
        totalInSitemap: sitemapEntries.length,
        toScrape: toScrape.length,
        unchanged,
        newPages: toScrape.filter(e => !storedDates.has(e.url)).length,
        modifiedPages: toScrape.filter(e => storedDates.has(e.url) && e.lastmod).length,
      });
    } else {
      logger.info('No sitemap found, falling back to full crawl');
    }
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('TeamBrainBot/1.0 (Knowledge Base Crawler)');

    // Fetch and parse robots.txt if enabled
    if (respectRobotsTxt) {
      disallowedPaths = await fetchRobotsTxt(websiteUrl);
      if (disallowedPaths.length > 0) {
        logger.info('Respecting robots.txt disallow rules', { count: disallowedPaths.length });
      }
    }

    // Determine starting URLs based on whether we're using sitemap
    const urlsToScrape = usingSitemap ? sitemapUrls : new Set([websiteUrl]);
    const scrapedUrls = new Set<string>();

    while (urlsToScrape.size > 0 && scrapedUrls.size < maxPages) {
      const currentUrl = urlsToScrape.values().next().value as string | undefined;
      if (!currentUrl) break;
      urlsToScrape.delete(currentUrl);

      if (scrapedUrls.has(currentUrl)) continue;

      // Check URL against filters
      if (!shouldScrapeUrl(currentUrl, websiteUrl, includePatterns, excludePatterns, disallowedPaths)) {
        continue;
      }

      scrapedUrls.add(currentUrl);

      try {
        const scrapedPage = await scrapePage(page, currentUrl, pageTimeoutMs);
        if (scrapedPage) {
          scrapedPages.push(scrapedPage);

          // Only discover new links if NOT using sitemap mode
          // (sitemap mode should stick to known URLs from sitemap)
          if (!usingSitemap) {
            const links = await findInternalLinks(page, websiteUrl);
            for (const link of links) {
              if (!scrapedUrls.has(link) && !urlsToScrape.has(link)) {
                urlsToScrape.add(link);
              }
            }
          }
        }

        // Rate limiting - be a good citizen
        if (rateLimitMs > 0) {
          await sleep(rateLimitMs);
        }
      } catch (error) {
        const message = `Failed to scrape ${currentUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.warn(message);
        errors.push(message);
      }

      // Log progress periodically
      if (scrapedUrls.size % 50 === 0) {
        logger.info('Scrape progress', {
          scraped: scrapedUrls.size,
          queued: urlsToScrape.size,
          maxPages,
          mode: usingSitemap ? 'sitemap' : 'crawl',
        });
      }
    }

    await browser.close();
  } catch (error) {
    logger.error('Browser launch failed', { error });
    if (browser) await browser.close();
    throw error;
  }

  // Process scraped content
  let totalChunks = 0;

  for (const scrapedPage of scrapedPages) {
    try {
      const chunks = await processScrapedPage(scrapedPage, workspaceId, botId);
      totalChunks += chunks;
    } catch (error) {
      const message = `Failed to process ${scrapedPage.url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message);
      errors.push(message);
    }
  }

  logger.info('Website scrape complete', {
    pagesScraped: scrapedPages.length,
    chunksCreated: totalChunks,
    errorCount: errors.length,
    mode: usingSitemap ? 'sitemap-incremental' : 'full-crawl',
    unchangedPages: unchangedCount,
  });

  // Log to analytics with workspace context
  await supabase.from('analytics').insert({
    workspace_id: workspaceId,
    event_type: 'website_scrape',
    event_data: {
      pages_scraped: scrapedPages.length,
      chunks_created: totalChunks,
      errors: errors.length,
      bot_id: botId,
      mode: usingSitemap ? 'sitemap-incremental' : 'full-crawl',
      unchanged_pages: unchangedCount,
    },
  });

  return {
    pagesScraped: scrapedPages.length,
    chunksCreated: totalChunks,
    errors,
  };
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch and parse robots.txt
 */
async function fetchRobotsTxt(baseUrl: string): Promise<string[]> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl);
    if (!response.ok) return [];

    const text = await response.text();
    const disallowedPaths: string[] = [];

    // Parse robots.txt - look for Disallow rules for our user agent or *
    const lines = text.split('\n');
    let relevantSection = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.substring('user-agent:'.length).trim();
        relevantSection = agent === '*' || agent.includes('teambrain');
      } else if (relevantSection && trimmed.startsWith('disallow:')) {
        const path = line.trim().substring('disallow:'.length).trim();
        if (path) {
          disallowedPaths.push(path);
        }
      }
    }

    return disallowedPaths;
  } catch {
    return [];
  }
}

/**
 * Fetch and parse sitemap.xml (and sitemap index files)
 * Returns URLs with their lastmod dates for incremental scraping
 */
async function fetchSitemap(baseUrl: string): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const processedSitemaps = new Set<string>();

  async function parseSitemapUrl(sitemapUrl: string): Promise<void> {
    if (processedSitemaps.has(sitemapUrl)) return;
    processedSitemaps.add(sitemapUrl);

    try {
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'TeamBrainBot/1.0 (Knowledge Base Crawler)' },
      });

      if (!response.ok) {
        logger.debug('Sitemap not found or inaccessible', { url: sitemapUrl, status: response.status });
        return;
      }

      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      // Check if this is a sitemap index (contains other sitemaps)
      const sitemapLocations = $('sitemap > loc').map((_, el) => $(el).text().trim()).get();

      if (sitemapLocations.length > 0) {
        logger.info('Found sitemap index', { sitemapCount: sitemapLocations.length });
        for (const loc of sitemapLocations) {
          await parseSitemapUrl(loc);
        }
        return;
      }

      // Parse regular sitemap entries
      $('url').each((_, urlEl) => {
        const loc = $(urlEl).find('loc').text().trim();
        const lastmodText = $(urlEl).find('lastmod').text().trim();

        if (loc) {
          const entry: SitemapEntry = { url: loc };

          if (lastmodText) {
            const lastmod = new Date(lastmodText);
            if (!isNaN(lastmod.getTime())) {
              entry.lastmod = lastmod;
            }
          }

          entries.push(entry);
        }
      });

      logger.debug('Parsed sitemap', { url: sitemapUrl, entries: entries.length });
    } catch (error) {
      logger.debug('Failed to parse sitemap', { url: sitemapUrl, error: error instanceof Error ? error.message : 'Unknown' });
    }
  }

  // Try common sitemap locations
  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).href,
    new URL('/sitemap_index.xml', baseUrl).href,
    new URL('/sitemap-index.xml', baseUrl).href,
  ];

  for (const sitemapUrl of sitemapUrls) {
    await parseSitemapUrl(sitemapUrl);
    if (entries.length > 0) break; // Stop once we find a working sitemap
  }

  if (entries.length > 0) {
    logger.info('Sitemap parsing complete', { totalUrls: entries.length, withLastmod: entries.filter(e => e.lastmod).length });
  }

  return entries;
}

/**
 * Get stored document dates for comparison with sitemap lastmod
 */
async function getStoredDocumentDates(workspaceId: string, botId?: string): Promise<Map<string, Date>> {
  let query = supabase
    .from('documents')
    .select('source_url, last_modified')
    .eq('workspace_id', workspaceId)
    .eq('source_type', 'website');

  if (botId) {
    query = query.eq('bot_id', botId);
  }

  const { data } = await query;

  const dateMap = new Map<string, Date>();
  for (const doc of data ?? []) {
    if (doc.source_url && doc.last_modified) {
      dateMap.set(doc.source_url, new Date(doc.last_modified));
    }
  }

  return dateMap;
}

/**
 * Filter sitemap entries to only include pages that need updating
 */
function filterChangedPages(
  sitemapEntries: SitemapEntry[],
  storedDates: Map<string, Date>
): { toScrape: SitemapEntry[]; unchanged: number } {
  const toScrape: SitemapEntry[] = [];
  let unchanged = 0;

  for (const entry of sitemapEntries) {
    const storedDate = storedDates.get(entry.url);

    if (!storedDate) {
      // New page - needs scraping
      toScrape.push(entry);
    } else if (!entry.lastmod) {
      // No lastmod in sitemap - scrape to be safe (but lower priority)
      toScrape.push(entry);
    } else if (entry.lastmod > storedDate) {
      // Page has been modified - needs re-scraping
      toScrape.push(entry);
    } else {
      // Page unchanged
      unchanged++;
    }
  }

  return { toScrape, unchanged };
}

/**
 * Check if a URL should be scraped based on filters
 */
function shouldScrapeUrl(
  url: string,
  baseUrl: string,
  includePatterns: RegExp[],
  excludePatterns: RegExp[],
  disallowedPaths: string[]
): boolean {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);

    // Must be same host
    if (urlObj.host !== baseObj.host) return false;

    const path = urlObj.pathname;

    // Check robots.txt disallow rules
    for (const disallowed of disallowedPaths) {
      if (path.startsWith(disallowed)) {
        return false;
      }
    }

    // Check exclude patterns
    for (const pattern of excludePatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }

    // If include patterns specified, URL must match at least one
    if (includePatterns.length > 0) {
      const matchesInclude = includePatterns.some(pattern => pattern.test(url));
      if (!matchesInclude) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Scrape a single page
 */
async function scrapePage(
  page: puppeteer.Page,
  url: string,
  timeoutMs: number = DEFAULT_PAGE_TIMEOUT_MS
): Promise<ScrapedPage | null> {
  logger.debug('Scraping page', { url });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

  const html = await page.content();
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation').remove();

  // Get title
  const title = $('title').text().trim() || $('h1').first().text().trim() || url;

  // Get main content
  const mainContent = $('main, article, .content, #content, .main').first();
  const content = (mainContent.length > 0 ? mainContent : $('body'))
    .text()
    .replace(/\s+/g, ' ')
    .trim();

  // Skip if content is too short
  if (content.length < 100) {
    logger.debug('Skipping page with insufficient content', { url, length: content.length });
    return null;
  }

  return { url, title, content };
}

/**
 * Find internal links on a page
 */
async function findInternalLinks(
  page: puppeteer.Page,
  baseUrl: string
): Promise<string[]> {
  const baseHost = new URL(baseUrl).host;

  // This function runs in browser context via Puppeteer
   
  const links: string[] = await page.evaluate((() => {
    // Browser context - document and HTMLAnchorElement are available
    const anchors = document.querySelectorAll('a[href]');
    const hrefs: string[] = [];
    anchors.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (href.startsWith('http')) {
        hrefs.push(href);
      }
    });
    return hrefs;
  }) as () => string[]);

  return links.filter(link => {
    try {
      const linkHost = new URL(link).host;
      return linkHost === baseHost;
    } catch {
      return false;
    }
  });
}

/**
 * Process a scraped page into chunks
 */
async function processScrapedPage(
  page: ScrapedPage,
  workspaceId: string,
  botId?: string
): Promise<number> {
  const contentHash = crypto.createHash('sha256').update(page.content).digest('hex');

  // Check if we already have this content for this workspace
  let query = supabase
    .from('documents')
    .select('id, content_hash')
    .eq('workspace_id', workspaceId)
    .eq('source_url', page.url)
    .eq('source_type', 'website');

  if (botId) {
    query = query.eq('bot_id', botId);
  }

  const { data: existing } = await query.single();

  if (existing?.content_hash === contentHash) {
    logger.debug('Page unchanged, skipping', { url: page.url });
    return 0;
  }

  // Delete old chunks if updating
  if (existing) {
    await supabase.from('document_chunks').delete().eq('document_id', existing.id);
    await supabase.from('documents').delete().eq('id', existing.id);
  }

  // Create document record with workspace context
  // last_modified is set to now for sitemap-based change detection in future runs
  const insertData: Record<string, unknown> = {
    workspace_id: workspaceId,
    title: page.title,
    file_type: 'text/html',
    source_type: 'website',
    source_url: page.url,
    content_hash: contentHash,
    last_modified: new Date().toISOString(),
  };

  if (botId) {
    insertData.bot_id = botId;
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert(insertData)
    .select('id')
    .single();

  if (docError) throw docError;

  // Chunk the content
  const chunks = await chunkDocument(page.content, {
    title: page.title,
    fileType: 'text/html',
    sourceUrl: page.url,
  });

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.contextualContent));

  // Insert chunks
  const chunkRows = chunks.map((chunk, index) => ({
    document_id: doc.id,
    chunk_index: index,
    content: chunk.content,
    embedding: embeddings[index],
    metadata: chunk.metadata,
  }));

  await supabase.from('document_chunks').insert(chunkRows);

  return chunks.length;
}
