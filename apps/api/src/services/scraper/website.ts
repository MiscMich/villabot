/**
 * Website scraper service
 * Scrapes company website content for the knowledge base
 * Supports configurable limits, rate limiting, and URL filtering
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

interface ScrapeOptions {
  workspaceId: string;  // Required for tenant isolation
  botId?: string;  // Optional bot-specific scraping
  maxPages?: number;
  rateLimitMs?: number;
  pageTimeoutMs?: number;
  includePatterns?: RegExp[];  // Only scrape URLs matching these patterns
  excludePatterns?: RegExp[];  // Skip URLs matching these patterns
  respectRobotsTxt?: boolean;
}

/**
 * Scrape the company website
 */
export async function scrapeWebsite(options: ScrapeOptions): Promise<{
  pagesScraped: number;
  chunksCreated: number;
  errors: string[];
}> {
  const { workspaceId, botId } = options;

  const websiteUrl = env.COMPANY_WEBSITE_URL;
  if (!websiteUrl) {
    logger.warn('No website URL configured, skipping scrape');
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
  } = options;

  logger.info('Starting website scrape', {
    url: websiteUrl,
    maxPages,
    rateLimitMs,
    workspaceId,
  });

  const errors: string[] = [];
  const scrapedPages: ScrapedPage[] = [];
  let disallowedPaths: string[] = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('VillaParaisoBot/1.0 (Knowledge Base Crawler)');

    // Fetch and parse robots.txt if enabled
    if (respectRobotsTxt) {
      disallowedPaths = await fetchRobotsTxt(websiteUrl);
      if (disallowedPaths.length > 0) {
        logger.info('Respecting robots.txt disallow rules', { count: disallowedPaths.length });
      }
    }

    // Start with main page
    const urlsToScrape = new Set([websiteUrl]);
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

          // Find more links on the same domain
          const links = await findInternalLinks(page, websiteUrl);
          for (const link of links) {
            if (!scrapedUrls.has(link) && !urlsToScrape.has(link)) {
              urlsToScrape.add(link);
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
        relevantSection = agent === '*' || agent.includes('villaparaiso');
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const insertData: Record<string, unknown> = {
    workspace_id: workspaceId,
    title: page.title,
    file_type: 'text/html',
    source_type: 'website',
    source_url: page.url,
    content_hash: contentHash,
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
