/**
 * One-off script to trigger website scrape
 * Run with: npx tsx scripts/trigger-scrape.ts
 *
 * Must use dynamic imports to avoid env validation running before dotenv loads
 */

// Load environment variables FIRST (before any other imports)
import { config } from 'dotenv';
import { resolve } from 'path';

// Load from project root .env
const envPath = resolve(process.cwd(), '../../.env');
console.log('Loading env from:', envPath);
const result = config({ path: envPath });

if (result.error) {
  console.error('Failed to load .env file:', result.error);
  process.exit(1);
}

// Verify critical env vars are loaded
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing required env vars:', missing);
  process.exit(1);
}
console.log('Environment loaded successfully');

// Now use dynamic imports for modules that depend on env.ts
async function main() {
  const WORKSPACE_ID = 'd3dd014a-caab-4963-8121-f256e54fefd9';
  const WEBSITE_URL = 'https://paraisovacationrentals.com';

  console.log('\n=== Starting Website Scrape ===');
  console.log('Workspace:', WORKSPACE_ID);
  console.log('Website:', WEBSITE_URL);

  // Dynamic import to avoid static import chain triggering env validation
  const { scrapeWebsite } = await import('../src/services/scraper/website.js');
  const { logger } = await import('../src/utils/logger.js');

  logger.info('Starting manual website scrape trigger');

  try {
    const result = await scrapeWebsite({
      workspaceId: WORKSPACE_ID,
      websiteUrl: WEBSITE_URL,
      maxPages: 50,  // Start with 50 for testing
      rateLimitMs: 1500,  // 1.5s between requests to be gentle
    });

    logger.info('Scrape completed', result);
    console.log('\n=== Scrape Results ===');
    console.log('Pages scraped:', result.pagesScraped);
    console.log('Chunks created:', result.chunksCreated);
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors.join(', '));
    }
  } catch (error) {
    logger.error('Scrape failed', { error });
    console.error('Scrape failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
