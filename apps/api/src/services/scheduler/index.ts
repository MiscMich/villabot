/**
 * Scheduler service
 * Handles periodic sync jobs and cleanup tasks
 */

import cron from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { incrementalSync, fullSync } from '../google-drive/sync.js';
import { closeInactiveSessions } from '../slack/threads.js';
import { isDriveClientInitialized } from '../google-drive/client.js';
import { supabase } from '../supabase/client.js';

interface ScheduledJob {
  name: string;
  task: cron.ScheduledTask;
  schedule: string;
  lastRun?: Date;
  isRunning: boolean;
}

const jobs: Map<string, ScheduledJob> = new Map();

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler(): void {
  logger.info('Initializing scheduler');

  // Drive sync - runs every 5 minutes (or configured interval)
  const syncIntervalMs = env.DRIVE_POLL_INTERVAL_MS ?? 300000;
  const syncMinutes = Math.max(1, Math.round(syncIntervalMs / 60000));
  scheduleJob('drive-sync', `*/${syncMinutes} * * * *`, runDriveSync);

  // Session cleanup - runs every hour
  scheduleJob('session-cleanup', '0 * * * *', runSessionCleanup);

  // Analytics aggregation - runs daily at midnight
  scheduleJob('analytics-daily', '0 0 * * *', runDailyAnalytics);

  // Full sync - runs weekly on Sunday at 2 AM
  scheduleJob('full-sync', '0 2 * * 0', runFullSync);

  logger.info(`Scheduler initialized with ${jobs.size} jobs`);
}

/**
 * Schedule a job
 */
function scheduleJob(
  name: string,
  schedule: string,
  handler: () => Promise<void>
): void {
  const task = cron.schedule(schedule, async () => {
    const job = jobs.get(name);
    if (!job || job.isRunning) {
      logger.debug(`Skipping ${name} - already running`);
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();

    try {
      logger.debug(`Running scheduled job: ${name}`);
      await handler();
      logger.debug(`Completed scheduled job: ${name}`);
    } catch (error) {
      logger.error(`Scheduled job failed: ${name}`, { error });
    } finally {
      job.isRunning = false;
    }
  });

  jobs.set(name, {
    name,
    task,
    schedule,
    isRunning: false,
  });
}

/**
 * Run incremental Drive sync
 */
async function runDriveSync(): Promise<void> {
  if (!isDriveClientInitialized()) {
    logger.debug('Drive client not initialized, skipping sync');
    return;
  }

  try {
    const result = await incrementalSync();

    if (result.added > 0 || result.updated > 0 || result.removed > 0) {
      logger.info('Drive sync completed', result);

      // Log to analytics
      await supabase.from('analytics').insert({
        event_type: 'drive_sync',
        event_data: result,
      });
    }
  } catch (error) {
    logger.error('Drive sync failed', { error });
  }
}

/**
 * Run full Drive sync
 */
async function runFullSync(): Promise<void> {
  if (!isDriveClientInitialized()) {
    logger.debug('Drive client not initialized, skipping full sync');
    return;
  }

  try {
    const result = await fullSync();
    logger.info('Full sync completed', result);

    await supabase.from('analytics').insert({
      event_type: 'full_sync',
      event_data: result,
    });
  } catch (error) {
    logger.error('Full sync failed', { error });
  }
}

/**
 * Run session cleanup
 */
async function runSessionCleanup(): Promise<void> {
  try {
    const closedCount = await closeInactiveSessions();

    if (closedCount > 0) {
      await supabase.from('analytics').insert({
        event_type: 'session_cleanup',
        event_data: { closed_sessions: closedCount },
      });
    }
  } catch (error) {
    logger.error('Session cleanup failed', { error });
  }
}

/**
 * Run daily analytics aggregation
 */
async function runDailyAnalytics(): Promise<void> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999));

    // Count messages
    const { count: messageCount } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'message_received')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    // Count responses
    const { count: responseCount } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'response_sent')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    // Count feedback
    const { data: feedback } = await supabase
      .from('thread_messages')
      .select('feedback_rating')
      .not('feedback_rating', 'is', null)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    const positiveCount = feedback?.filter(f => f.feedback_rating > 0).length ?? 0;
    const negativeCount = feedback?.filter(f => f.feedback_rating < 0).length ?? 0;

    // Store daily summary
    await supabase.from('analytics').insert({
      event_type: 'daily_summary',
      event_data: {
        date: startOfDay.toISOString().split('T')[0],
        messages_received: messageCount ?? 0,
        responses_sent: responseCount ?? 0,
        positive_feedback: positiveCount,
        negative_feedback: negativeCount,
      },
    });

    logger.info('Daily analytics aggregation complete');
  } catch (error) {
    logger.error('Daily analytics failed', { error });
  }
}

/**
 * Trigger an immediate sync
 */
export async function triggerImmediateSync(): Promise<{
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}> {
  logger.info('Triggering immediate sync');
  return incrementalSync();
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): Array<{
  name: string;
  schedule: string;
  lastRun?: string;
  isRunning: boolean;
}> {
  return Array.from(jobs.values()).map(job => ({
    name: job.name,
    schedule: job.schedule,
    lastRun: job.lastRun?.toISOString(),
    isRunning: job.isRunning,
  }));
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  for (const job of jobs.values()) {
    job.task.stop();
  }
  jobs.clear();
  logger.info('Scheduler stopped');
}
