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
import dns from 'dns/promises';
import net from 'net';
import { syncProgressEmitter } from '../sync/index.js';

// Configuration defaults
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_RATE_LIMIT_MS = 1000; // 1 second between requests
const DEFAULT_PAGE_TIMEOUT_MS = 30000;

// =============================================================================
// SECURITY: SSRF Protection
// =============================================================================

/**
 * Check if an IP address is in a private/internal range
 * Blocks: localhost, private ranges, link-local, cloud metadata
 */
function isPrivateIP(ip: string): boolean {
  // Handle IPv4
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);

    // Validate we have 4 octets
    if (parts.length !== 4) return false;
    const [octet0, octet1] = parts as [number, number, number, number];

    // Localhost
    if (octet0 === 127) return true;

    // Private ranges (RFC 1918)
    if (octet0 === 10) return true;                                    // 10.0.0.0/8
    if (octet0 === 172 && octet1 >= 16 && octet1 <= 31) return true;   // 172.16.0.0/12
    if (octet0 === 192 && octet1 === 168) return true;                 // 192.168.0.0/16

    // Link-local (including AWS metadata)
    if (octet0 === 169 && octet1 === 254) return true;                 // 169.254.0.0/16

    // Loopback
    if (octet0 === 0) return true;                                     // 0.0.0.0/8

    // Broadcast
    if (ip === '255.255.255.255') return true;

    return false;
  }

  // Handle IPv6
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // Localhost
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // Link-local
    if (normalized.startsWith('fe80:')) return true;

    // Unique local (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // IPv4-mapped IPv6 addresses
    if (normalized.startsWith('::ffff:')) {
      const ipv4Part = normalized.substring(7);
      return isPrivateIP(ipv4Part);
    }

    return false;
  }

  return false;
}

/**
 * Blocked hostnames (cloud metadata, internal services)
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
  'instance-data',
  '169.254.169.254',  // AWS/GCP/Azure metadata endpoint
  '169.254.170.2',    // AWS ECS metadata
  'fd00:ec2::254',    // AWS IPv6 metadata
];

/**
 * SECURITY: Validate URL is safe to scrape (prevents SSRF attacks)
 * Checks:
 * 1. Valid URL format
 * 2. HTTPS only (in production)
 * 3. No private/internal IPs
 * 4. No cloud metadata endpoints
 * 5. DNS resolution doesn't point to private IPs
 */
async function isUrlSafeToScrape(url: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}` };
    }

    // In production, prefer HTTPS
    if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      logger.warn('Non-HTTPS URL in production', { url });
      // Don't block, just warn - some sites still use HTTP
    }

    // Check for blocked hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { safe: false, reason: `Blocked hostname: ${hostname}` };
    }

    // Check if hostname is an IP address
    if (net.isIP(hostname)) {
      if (isPrivateIP(hostname)) {
        return { safe: false, reason: `Private IP address: ${hostname}` };
      }
    } else {
      // Resolve hostname and check all IPs
      try {
        const addresses = await dns.resolve4(hostname).catch(() => []);
        const addresses6 = await dns.resolve6(hostname).catch(() => []);
        const allAddresses = [...addresses, ...addresses6];

        for (const ip of allAddresses) {
          if (isPrivateIP(ip)) {
            return {
              safe: false,
              reason: `Hostname ${hostname} resolves to private IP: ${ip}`,
            };
          }
        }
      } catch {
        // DNS resolution failed - hostname might not exist
        return { safe: false, reason: `DNS resolution failed for: ${hostname}` };
      }
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, reason: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

// =============================================================================

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

  // SECURITY: Validate URL is safe to scrape (SSRF protection)
  const urlSafety = await isUrlSafeToScrape(websiteUrl);
  if (!urlSafety.safe) {
    logger.error('SSRF protection: Blocked unsafe URL', {
      workspaceId,
      url: websiteUrl,
      reason: urlSafety.reason,
    });
    return {
      pagesScraped: 0,
      chunksCreated: 0,
      errors: [`Security: URL blocked - ${urlSafety.reason}`],
    };
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

  // Create sync operation for progress tracking
  let operationId: string | null = null;
  try {
    operationId = await syncProgressEmitter.createOperation(workspaceId, 'website_scrape');
  } catch (opError) {
    logger.warn('Failed to create sync operation record', { error: opError });
  }

  // Emit initial progress
  if (operationId) {
    syncProgressEmitter.emitProgress({
      operationId,
      workspaceId,
      type: 'website_scrape',
      status: 'running',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      currentItem: 'Initializing scraper...',
    });
  }

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
    const totalUrlsToScrape = usingSitemap ? sitemapUrls.size : maxPages;

    // Update progress with known URL count
    if (operationId && usingSitemap) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'website_scrape',
        status: 'running',
        progress: 0,
        totalItems: sitemapUrls.size,
        processedItems: 0,
        currentItem: `Found ${sitemapUrls.size} pages to scrape`,
      });
    }

    while (urlsToScrape.size > 0 && scrapedUrls.size < maxPages) {
      const currentUrl = urlsToScrape.values().next().value as string | undefined;
      if (!currentUrl) break;
      urlsToScrape.delete(currentUrl);

      if (scrapedUrls.has(currentUrl)) continue;

      // Check URL against filters
      if (!shouldScrapeUrl(currentUrl, websiteUrl, includePatterns, excludePatterns, disallowedPaths)) {
        continue;
      }

      // SECURITY: SSRF check for each URL (in case of malicious sitemap entries)
      const pageSafety = await isUrlSafeToScrape(currentUrl);
      if (!pageSafety.safe) {
        logger.warn('SSRF protection: Blocked URL in scrape queue', {
          url: currentUrl,
          reason: pageSafety.reason,
        });
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

        // Emit progress after each page
        if (operationId) {
          const estimatedTotal = usingSitemap ? totalUrlsToScrape : Math.max(scrapedUrls.size + urlsToScrape.size, scrapedUrls.size);
          syncProgressEmitter.emitProgress({
            operationId,
            workspaceId,
            type: 'website_scrape',
            status: 'running',
            progress: estimatedTotal > 0 ? Math.round((scrapedUrls.size / estimatedTotal) * 50) : 0, // 50% for scraping phase
            totalItems: estimatedTotal,
            processedItems: scrapedUrls.size,
            currentItem: currentUrl,
          });
        }
      } catch (error) {
        const message = `Failed to scrape ${currentUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.warn(message);
        errors.push(message);
        // Emit error progress
        if (operationId) {
          syncProgressEmitter.emitProgress({
            operationId,
            workspaceId,
            type: 'website_scrape',
            status: 'running',
            progress: Math.round((scrapedUrls.size / totalUrlsToScrape) * 50),
            totalItems: totalUrlsToScrape,
            processedItems: scrapedUrls.size,
            currentItem: `Error: ${currentUrl}`,
          });
        }
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

    // Emit failure event
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'website_scrape',
        status: 'failed',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        error: error instanceof Error ? error.message : 'Browser launch failed',
      });
    }

    throw error;
  }

  // Process scraped content
  let totalChunks = 0;
  let processedPages = 0;

  // Emit progress for processing phase
  if (operationId) {
    syncProgressEmitter.emitProgress({
      operationId,
      workspaceId,
      type: 'website_scrape',
      status: 'running',
      progress: 50,
      totalItems: scrapedPages.length,
      processedItems: 0,
      currentItem: 'Processing scraped content...',
    });
  }

  for (const scrapedPage of scrapedPages) {
    try {
      const chunks = await processScrapedPage(scrapedPage, workspaceId, botId);
      totalChunks += chunks;
      processedPages++;

      // Emit progress during processing phase (50-100%)
      if (operationId) {
        syncProgressEmitter.emitProgress({
          operationId,
          workspaceId,
          type: 'website_scrape',
          status: 'running',
          progress: 50 + Math.round((processedPages / scrapedPages.length) * 50),
          totalItems: scrapedPages.length,
          processedItems: processedPages,
          currentItem: `Processing: ${scrapedPage.title}`,
        });
      }
    } catch (error) {
      const message = `Failed to process ${scrapedPage.url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(message);
      errors.push(message);
      processedPages++;
    }
  }

  // Emit completion event
  if (operationId) {
    syncProgressEmitter.emitProgress({
      operationId,
      workspaceId,
      type: 'website_scrape',
      status: 'completed',
      progress: 100,
      totalItems: scrapedPages.length,
      processedItems: processedPages,
      result: {
        added: scrapedPages.length,
        updated: 0,
        removed: 0,
        errors,
      },
    });
  }

  logger.info('Website scrape complete', {
    pagesScraped: scrapedPages.length,
    chunksCreated: totalChunks,
    errorCount: errors.length,
    mode: usingSitemap ? 'sitemap-incremental' : 'full-crawl',
    unchangedPages: unchangedCount,
  });

  // Log to analytics with workspace context
  // Use camelCase to match frontend expectations (lastScrapeResult.chunksCreated)
  await supabase.from('analytics').insert({
    workspace_id: workspaceId,
    event_type: 'website_scrape',
    event_data: {
      pagesScraped: scrapedPages.length,
      chunksCreated: totalChunks,
      errors: errors.length,
      botId: botId,
      mode: usingSitemap ? 'sitemap-incremental' : 'full-crawl',
      unchangedPages: unchangedCount,
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
 * Clean up a page title by removing site name suffixes
 * Examples:
 *   "How to Guide | Company Name" → "How to Guide"
 *   "Getting Started - Documentation - Site" → "Getting Started"
 *   "Page Title :: Site Name" → "Page Title"
 */
function cleanPageTitle(rawTitle: string, url: string): string {
  if (!rawTitle) return url;

  // Common separators used to append site names
  const separators = [' | ', ' - ', ' · ', ' — ', ' :: ', ' » ', ' // '];

  let title = rawTitle;

  // Find the first separator and take everything before it
  for (const sep of separators) {
    const sepIndex = title.indexOf(sep);
    if (sepIndex > 0) {
      // Only take the part before the separator if it's meaningful (> 3 chars)
      const beforeSep = title.substring(0, sepIndex).trim();
      if (beforeSep.length > 3) {
        title = beforeSep;
        break;
      }
    }
  }

  // Clean up any extra whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // If title is still too short or empty, use URL path as fallback
  if (title.length < 3) {
    try {
      const urlPath = new URL(url).pathname;
      // Convert path to title: /about-us → "About Us"
      const pathTitle = urlPath
        .split('/')
        .pop()
        ?.replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '') // Remove file extension
        .trim();
      if (pathTitle && pathTitle.length > 0) {
        // Capitalize first letter of each word
        title = pathTitle
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    } catch {
      // Keep original title if URL parsing fails
    }
  }

  return title || url;
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

  // Get raw title from multiple sources
  const rawTitle = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Clean up the title (remove site name suffixes)
  const title = cleanPageTitle(rawTitle, url);

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
