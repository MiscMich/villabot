/**
 * TeamBrain AI - Background Worker
 *
 * Runs scheduled background jobs independently from the API server:
 * - Google Drive sync (incremental every 5 min, full weekly)
 * - Website scraping (configurable, default weekly)
 * - Session cleanup (hourly)
 * - Analytics aggregation (daily)
 *
 * Usage:
 *   WORKER_MODE=true node dist/worker.js
 *
 * In production, run alongside the API service in a separate container.
 */

import 'dotenv/config';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { testSupabaseConnection } from './services/supabase/client.js';
import { initializeScheduler, stopScheduler, getSchedulerStatus } from './services/scheduler/index.js';
import { initializeDriveFromStoredTokens } from './routes/auth.js';

const HEALTH_CHECK_INTERVAL = 60000; // 1 minute

/**
 * Start the background worker
 */
async function startWorker(): Promise<void> {
  logger.info('Starting TeamBrain AI Worker...');
  logger.info(`  Environment: ${env.NODE_ENV}`);
  logger.info(`  Worker Mode: true`);

  // Test database connection
  const dbOk = await testSupabaseConnection();
  if (dbOk) {
    logger.info('✓ Supabase connection established');
  } else {
    logger.error('✗ Supabase connection failed');
    process.exit(1);
  }

  // Initialize Google Drive if configured
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const driveOk = await initializeDriveFromStoredTokens();
    if (driveOk) {
      logger.info('✓ Google Drive connection established');
    } else {
      logger.info('○ Google Drive not connected - Drive sync jobs will be skipped');
    }
  } else {
    logger.info('○ Google Drive credentials not configured');
  }

  // Initialize scheduler with all background jobs
  initializeScheduler();

  const jobs = getSchedulerStatus();
  logger.info(`✓ Scheduler initialized with ${jobs.length} jobs:`);
  for (const job of jobs) {
    logger.info(`  - ${job.name}: ${job.schedule}`);
  }

  // Periodic health check logging
  setInterval(() => {
    const status = getSchedulerStatus();
    const runningJobs = status.filter(j => j.isRunning);

    if (runningJobs.length > 0) {
      logger.debug('Worker health check', {
        runningJobs: runningJobs.map(j => j.name),
        totalJobs: status.length
      });
    }
  }, HEALTH_CHECK_INTERVAL);

  logger.info('✓ Worker is running');
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down worker gracefully...');

  // Wait for any running jobs to complete (with timeout)
  const status = getSchedulerStatus();
  const runningJobs = status.filter(j => j.isRunning);

  if (runningJobs.length > 0) {
    logger.info(`Waiting for ${runningJobs.length} running job(s) to complete...`);

    // Wait up to 30 seconds for jobs to complete
    const maxWait = 30000;
    const checkInterval = 1000;
    let waited = 0;

    while (waited < maxWait) {
      const current = getSchedulerStatus().filter(j => j.isRunning);
      if (current.length === 0) break;

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
  }

  stopScheduler();
  logger.info('Worker stopped');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker', { error: error.message, stack: error.stack });
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection in worker', { reason });
});

// Start the worker
startWorker().catch((error) => {
  logger.error('Failed to start worker', { error });
  process.exit(1);
});
