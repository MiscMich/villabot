/**
 * Slack Bot Manager
 * Manages multiple bot instances, loading from database and handling lifecycle
 * Includes health monitoring and auto-restart capabilities
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import { errorTracker } from '../../utils/error-tracker.js';
import { BotInstance, BotInstanceConfig } from './instance.js';
import type { Bot, DocumentCategory } from '@cluebase/shared';

// Health monitoring configuration
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds
const MAX_CONSECUTIVE_FAILURES = 3;
const RESTART_COOLDOWN_MS = 60_000; // 1 minute between restart attempts
const MAX_RESTART_ATTEMPTS = 5; // Circuit breaker: give up after this many failed restarts

interface BotHealthStatus {
  botId: string;
  botName: string;
  isHealthy: boolean;
  isRunning: boolean;
  lastCheckAt: Date;
  consecutiveFailures: number;
  lastRestartAt: Date | null;
  errorMessage: string | null;
  totalRestartAttempts: number; // Track total restart attempts for circuit breaker
  permanentlyDisabled: boolean; // Circuit breaker tripped - stop trying
}

class BotManager {
  private instances: Map<string, BotInstance> = new Map();
  private healthStatus: Map<string, BotHealthStatus> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /**
   * Initialize all active bots from the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('BotManager already initialized');
      return;
    }

    logger.info('Initializing BotManager...');

    try {
      // Load all active bots from database
      const { data: bots, error: botsError } = await supabase
        .from('bots')
        .select('*')
        .eq('status', 'active');

      if (botsError) {
        throw botsError;
      }

      if (!bots || bots.length === 0) {
        logger.info('No active bots found in database');
        this.initialized = true;
        return;
      }

      // Load channel assignments for each bot
      for (const botRow of bots) {
        const bot = this.mapBotFromRow(botRow);

        // Skip bots without credentials and auto-fix their status
        if (!bot.slackBotToken || !bot.slackAppToken) {
          logger.warn(`Bot ${bot.name} has no Slack credentials, marking as inactive`, {
            botId: bot.id,
            hasBotToken: !!bot.slackBotToken,
            hasAppToken: !!bot.slackAppToken,
          });

          // Auto-fix: mark bot as inactive since it can't run
          await supabase
            .from('bots')
            .update({ status: 'inactive', updated_at: new Date().toISOString() })
            .eq('id', bot.id);

          continue;
        }

        // Get assigned channels
        const { data: channels } = await supabase
          .from('bot_channels')
          .select('slack_channel_id')
          .eq('bot_id', bot.id);

        const assignedChannels = channels?.map(c => c.slack_channel_id) ?? [];

        const config: BotInstanceConfig = {
          bot,
          assignedChannels,
        };

        const instance = new BotInstance(config);

        try {
          await instance.start();
          this.instances.set(bot.id, instance);
          logger.info(`Bot ${bot.name} started successfully`, {
            botId: bot.id,
            channels: assignedChannels.length,
          });
        } catch (error) {
          logger.error(`Failed to start bot ${bot.name}`, { error, botId: bot.id });
          // Continue with other bots
        }
      }

      // Initialize error tracker
      await errorTracker.initialize();

      // Start health monitoring
      this.startHealthMonitoring();

      this.initialized = true;
      logger.info(`BotManager initialized with ${this.instances.size} bot(s)`);
    } catch (error) {
      logger.error('Failed to initialize BotManager', { error });
      throw error;
    }
  }

  /**
   * Start a specific bot by ID
   */
  async startBot(botId: string): Promise<boolean> {
    // Check if already running
    if (this.instances.has(botId)) {
      logger.warn(`Bot ${botId} is already running`);
      return true;
    }

    try {
      // Load bot from database
      const { data: botRow, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .single();

      if (botError || !botRow) {
        logger.error(`Bot ${botId} not found`, { error: botError });
        return false;
      }

      const bot = this.mapBotFromRow(botRow);

      // Get assigned channels
      const { data: channels } = await supabase
        .from('bot_channels')
        .select('slack_channel_id')
        .eq('bot_id', botId);

      const assignedChannels = channels?.map(c => c.slack_channel_id) ?? [];

      const config: BotInstanceConfig = {
        bot,
        assignedChannels,
      };

      const instance = new BotInstance(config);
      await instance.start();
      this.instances.set(botId, instance);

      logger.info(`Bot ${bot.name} started`, { botId, channels: assignedChannels.length });
      return true;
    } catch (error) {
      logger.error(`Failed to start bot ${botId}`, { error });
      return false;
    }
  }

  /**
   * Stop a specific bot by ID
   */
  async stopBot(botId: string): Promise<boolean> {
    const instance = this.instances.get(botId);
    if (!instance) {
      logger.warn(`Bot ${botId} is not running`);
      return false;
    }

    try {
      await instance.stop();
      this.instances.delete(botId);
      logger.info(`Bot ${botId} stopped`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop bot ${botId}`, { error });
      return false;
    }
  }

  /**
   * Restart a specific bot (reload configuration)
   */
  async restartBot(botId: string): Promise<boolean> {
    await this.stopBot(botId);
    return this.startBot(botId);
  }

  /**
   * Shutdown all bots
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all bots...');

    // Stop health monitoring
    this.stopHealthMonitoring();

    const stopPromises = Array.from(this.instances.values()).map(instance =>
      instance.stop().catch(error => {
        logger.error(`Error stopping bot ${instance.id}`, { error });
      })
    );

    await Promise.all(stopPromises);
    this.instances.clear();
    this.healthStatus.clear();
    this.initialized = false;

    logger.info('All bots stopped');
  }

  /**
   * Get status of all bots
   */
  getStatus(): { id: string; name: string; slug: string; running: boolean; channels: string[] }[] {
    return Array.from(this.instances.values()).map(instance => ({
      id: instance.id,
      name: instance.name,
      slug: instance.slug,
      running: instance.running,
      channels: instance.channels,
    }));
  }

  /**
   * Check if any bots are running
   */
  isRunning(): boolean {
    return this.instances.size > 0 && Array.from(this.instances.values()).some(i => i.running);
  }

  /**
   * Get count of running bots
   */
  getRunningCount(): number {
    return Array.from(this.instances.values()).filter(i => i.running).length;
  }

  /**
   * Get health status of all bots
   */
  getHealthStatus(): BotHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get health status of a specific bot
   */
  getBotHealth(botId: string): BotHealthStatus | undefined {
    return this.healthStatus.get(botId);
  }

  /**
   * Start health monitoring interval
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    logger.info('Starting bot health monitoring', {
      intervalMs: HEALTH_CHECK_INTERVAL_MS,
      maxFailures: MAX_CONSECUTIVE_FAILURES,
    });

    // Initialize health status for all bots
    for (const instance of this.instances.values()) {
      this.healthStatus.set(instance.id, {
        botId: instance.id,
        botName: instance.name,
        isHealthy: instance.running,
        isRunning: instance.running,
        lastCheckAt: new Date(),
        consecutiveFailures: 0,
        lastRestartAt: null,
        errorMessage: null,
        totalRestartAttempts: 0,
        permanentlyDisabled: false,
      });
    }

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error('Health check cycle failed', { error });
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop health monitoring interval
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Bot health monitoring stopped');
    }
  }

  /**
   * Perform health checks on all bots
   */
  private async performHealthChecks(): Promise<void> {
    const now = new Date();

    for (const instance of this.instances.values()) {
      const status = this.healthStatus.get(instance.id) ?? {
        botId: instance.id,
        botName: instance.name,
        isHealthy: false,
        isRunning: false,
        lastCheckAt: now,
        consecutiveFailures: 0,
        lastRestartAt: null,
        errorMessage: null,
        totalRestartAttempts: 0,
        permanentlyDisabled: false,
      };

      // Skip permanently disabled bots
      if (status.permanentlyDisabled) {
        logger.debug(`Skipping health check for permanently disabled bot ${status.botName}`);
        continue;
      }

      try {
        // Check if bot is still running
        const isRunning = instance.running;

        if (isRunning) {
          // Bot is healthy
          status.isHealthy = true;
          status.isRunning = true;
          status.consecutiveFailures = 0;
          status.errorMessage = null;
        } else {
          // Bot has stopped unexpectedly
          status.isHealthy = false;
          status.isRunning = false;
          status.consecutiveFailures += 1;
          status.errorMessage = 'Bot stopped unexpectedly';

          logger.warn(`Bot ${instance.name} health check failed`, {
            botId: instance.id,
            consecutiveFailures: status.consecutiveFailures,
          });

          // Check if we should auto-restart
          await this.tryAutoRestart(instance.id, status, now);
        }
      } catch (error) {
        status.isHealthy = false;
        status.consecutiveFailures += 1;
        status.errorMessage = error instanceof Error ? error.message : 'Unknown error';

        logger.error(`Bot ${instance.name} health check error`, {
          botId: instance.id,
          error,
          consecutiveFailures: status.consecutiveFailures,
        });

        // Check if we should auto-restart
        await this.tryAutoRestart(instance.id, status, now);
      }

      status.lastCheckAt = now;
      this.healthStatus.set(instance.id, status);
    }

    // Update health status in database for monitoring
    await this.updateHealthStatusInDatabase();
  }

  /**
   * Try to auto-restart a failed bot
   * Implements circuit breaker pattern - gives up after MAX_RESTART_ATTEMPTS
   */
  private async tryAutoRestart(
    botId: string,
    status: BotHealthStatus,
    now: Date
  ): Promise<void> {
    // Circuit breaker: if permanently disabled, don't try to restart
    if (status.permanentlyDisabled) {
      return;
    }

    // Check if we've exceeded max failures threshold for this check cycle
    if (status.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
      return;
    }

    // Circuit breaker: check if we've exceeded max restart attempts
    if (status.totalRestartAttempts >= MAX_RESTART_ATTEMPTS) {
      logger.error(`🚨 CIRCUIT BREAKER TRIPPED: Bot ${status.botName} permanently disabled after ${MAX_RESTART_ATTEMPTS} failed restart attempts`, {
        botId,
        totalRestartAttempts: status.totalRestartAttempts,
        lastError: status.errorMessage,
      });

      // Mark as permanently disabled
      status.permanentlyDisabled = true;
      status.errorMessage = `Permanently disabled: exceeded ${MAX_RESTART_ATTEMPTS} restart attempts`;

      // Update database status to disabled (not just error)
      await supabase
        .from('bots')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('id', botId);

      // Remove from instances and health monitoring to stop the loop
      this.instances.delete(botId);

      // Track critical error for alerting
      await errorTracker.track(
        new Error(`CIRCUIT BREAKER: Bot ${status.botName} permanently disabled - requires manual intervention`),
        'slack',
        'critical',
        {
          botId,
          action: 'circuit_breaker_tripped',
          totalRestartAttempts: status.totalRestartAttempts,
          reason: 'Max restart attempts exceeded',
        }
      );

      return;
    }

    // Check cooldown period
    if (status.lastRestartAt) {
      const timeSinceRestart = now.getTime() - status.lastRestartAt.getTime();
      if (timeSinceRestart < RESTART_COOLDOWN_MS) {
        logger.debug(`Bot ${status.botName} in restart cooldown`, {
          botId,
          cooldownRemaining: RESTART_COOLDOWN_MS - timeSinceRestart,
        });
        return;
      }
    }

    // Increment restart attempt counter
    status.totalRestartAttempts += 1;

    logger.info(`Auto-restarting bot ${status.botName} (attempt ${status.totalRestartAttempts}/${MAX_RESTART_ATTEMPTS})`, {
      botId,
      consecutiveFailures: status.consecutiveFailures,
      totalRestartAttempts: status.totalRestartAttempts,
    });

    try {
      // Remove from instances to force reload
      this.instances.delete(botId);

      // Try to restart
      const success = await this.startBot(botId);

      if (success) {
        status.isHealthy = true;
        status.isRunning = true;
        status.consecutiveFailures = 0;
        status.totalRestartAttempts = 0; // Reset on successful restart
        status.lastRestartAt = now;
        status.errorMessage = null;
        status.permanentlyDisabled = false;

        logger.info(`Bot ${status.botName} auto-restarted successfully`, { botId });

        // Track successful restart
        await errorTracker.track(
          new Error(`Bot ${status.botName} auto-restarted after ${MAX_CONSECUTIVE_FAILURES} failures`),
          'slack',
          'medium',
          { botId, action: 'auto_restart', success: true }
        );
      } else {
        status.lastRestartAt = now;
        status.errorMessage = `Auto-restart failed (attempt ${status.totalRestartAttempts}/${MAX_RESTART_ATTEMPTS})`;

        logger.error(`Failed to auto-restart bot ${status.botName}`, {
          botId,
          attempt: status.totalRestartAttempts,
          maxAttempts: MAX_RESTART_ATTEMPTS,
        });

        // Update database status to error
        await supabase
          .from('bots')
          .update({ status: 'error' })
          .eq('id', botId);

        // Track failed restart
        await errorTracker.track(
          new Error(`Bot ${status.botName} auto-restart failed (attempt ${status.totalRestartAttempts})`),
          'slack',
          'high',
          { botId, action: 'auto_restart', success: false, attempt: status.totalRestartAttempts }
        );
      }
    } catch (error) {
      status.lastRestartAt = now;
      status.errorMessage = error instanceof Error ? error.message : 'Restart error';

      logger.error(`Error during auto-restart of bot ${status.botName}`, {
        botId,
        error,
        attempt: status.totalRestartAttempts,
      });
    }
  }

  /**
   * Update health status in database for external monitoring
   */
  private async updateHealthStatusInDatabase(): Promise<void> {
    try {
      const healthRecords = Array.from(this.healthStatus.values()).map(status => ({
        bot_id: status.botId,
        is_healthy: status.isHealthy,
        is_running: status.isRunning,
        last_check_at: status.lastCheckAt.toISOString(),
        consecutive_failures: status.consecutiveFailures,
        last_restart_at: status.lastRestartAt?.toISOString() ?? null,
        error_message: status.errorMessage,
        checked_at: new Date().toISOString(),
        total_restart_attempts: status.totalRestartAttempts,
        permanently_disabled: status.permanentlyDisabled,
      }));

      // Upsert health records (if table exists)
      for (const record of healthRecords) {
        await supabase
          .from('bot_health')
          .upsert(record, { onConflict: 'bot_id' })
          .then(({ error }) => {
            // Silently ignore if table doesn't exist
            if (error && !error.message.includes('does not exist')) {
              logger.debug('Failed to update bot health record', { error, botId: record.bot_id });
            }
          });
      }
    } catch {
      // Health tracking is non-critical, don't throw
    }
  }

  /**
   * Send notification to all bots in a workspace
   * Used for system-level alerts like sync failures
   */
  async notifyWorkspace(workspaceId: string, message: string, blocks?: object[]): Promise<void> {
    const workspaceBots = Array.from(this.instances.values())
      .filter(instance => instance.workspaceId === workspaceId && instance.running);

    if (workspaceBots.length === 0) {
      logger.warn(`No running bots found for workspace ${workspaceId} to send notification`);
      return;
    }

    logger.info(`Sending notification to ${workspaceBots.length} bot(s) in workspace ${workspaceId}`);

    for (const bot of workspaceBots) {
      await bot.sendNotification(message, blocks);
    }
  }

  /**
   * Map database row to Bot type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapBotFromRow(row: any): Bot {
    return {
      id: row.id,
      workspaceId: row.workspace_id,  // Required for tenant isolation
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      avatarUrl: row.avatar_url ?? null,
      botType: row.bot_type ?? 'general',
      slackBotToken: row.slack_bot_token ?? null,
      slackAppToken: row.slack_app_token ?? null,
      slackSigningSecret: row.slack_signing_secret ?? null,
      slackBotUserId: row.slack_bot_user_id ?? null,
      systemInstructions: row.system_instructions ?? '',
      personality: row.personality ?? '',
      temperature: row.temperature ?? 0.3,
      maxResponseLength: row.max_response_length ?? 4000,
      includeSharedKnowledge: row.include_shared_knowledge ?? true,
      categories: (row.categories ?? []) as DocumentCategory[],
      status: row.status,
      isDefault: row.is_default ?? false,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
export const botManager = new BotManager();

// Convenience exports for backwards compatibility
export async function initializeSlackBots(): Promise<void> {
  await botManager.initialize();
}

export function isSlackBotRunning(): boolean {
  return botManager.isRunning();
}

export async function shutdownSlackBots(): Promise<void> {
  await botManager.shutdown();
}
