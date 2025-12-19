/**
 * Website scraper service
 * Scrapes company website content for the knowledge base
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../supabase/client.js';
import { chunkDocument } from '../rag/chunking.js';
import { generateEmbeddings } from '../rag/embeddings.js';
import crypto from 'crypto';

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
}

/**
 * Scrape the company website
 */
export async function scrapeWebsite(): Promise<{
  pagesScraped: number;
  chunksCreated: number;
  errors: string[];
}> {
  const websiteUrl = env.COMPANY_WEBSITE_URL;
  if (!websiteUrl) {
    logger.warn('No website URL configured, skipping scrape');
    return { pagesScraped: 0, chunksCreated: 0, errors: ['No website URL configured'] };
  }

  logger.info('Starting website scrape', { url: websiteUrl });

  const errors: string[] = [];
  const scrapedPages: ScrapedPage[] = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('VillaParaisoBot/1.0 (Knowledge Base Crawler)');

    // Start with main page
    const urlsToScrape = new Set([websiteUrl]);
    const scrapedUrls = new Set<string>();

    while (urlsToScrape.size > 0 && scrapedUrls.size < 50) { // Limit to 50 pages
      const currentUrl = urlsToScrape.values().next().value;
      urlsToScrape.delete(currentUrl);

      if (scrapedUrls.has(currentUrl)) continue;
      scrapedUrls.add(currentUrl);

      try {
        const scrapedPage = await scrapePage(page, currentUrl);
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
      } catch (error) {
        const message = `Failed to scrape ${currentUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.warn(message);
        errors.push(message);
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
      const chunks = await processScrapedPage(scrapedPage);
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

  // Log to analytics
  await supabase.from('analytics').insert({
    event_type: 'website_scrape',
    event_data: {
      pages_scraped: scrapedPages.length,
      chunks_created: totalChunks,
      errors: errors.length,
    },
  });

  return {
    pagesScraped: scrapedPages.length,
    chunksCreated: totalChunks,
    errors,
  };
}

/**
 * Scrape a single page
 */
async function scrapePage(
  page: puppeteer.Page,
  url: string
): Promise<ScrapedPage | null> {
  logger.debug('Scraping page', { url });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

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

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => href.startsWith('http'));
  });

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
async function processScrapedPage(page: ScrapedPage): Promise<number> {
  const contentHash = crypto.createHash('sha256').update(page.content).digest('hex');

  // Check if we already have this content
  const { data: existing } = await supabase
    .from('documents')
    .select('id, content_hash')
    .eq('source_url', page.url)
    .eq('source_type', 'website')
    .single();

  if (existing?.content_hash === contentHash) {
    logger.debug('Page unchanged, skipping', { url: page.url });
    return 0;
  }

  // Delete old chunks if updating
  if (existing) {
    await supabase.from('document_chunks').delete().eq('document_id', existing.id);
    await supabase.from('documents').delete().eq('id', existing.id);
  }

  // Create document record
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      title: page.title,
      file_type: 'text/html',
      source_type: 'website',
      source_url: page.url,
      content_hash: contentHash,
    })
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
