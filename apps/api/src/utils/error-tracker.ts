/**
 * Error Tracking Service
 *
 * Comprehensive error tracking for multi-tenant SaaS:
 * - Logs to Supabase for dashboard visibility (per-workspace)
 * - Sends to Sentry for centralized monitoring
 * - Alerts via Slack webhook for critical errors
 * - Tracks performance and slow operations
 */

import { supabase } from '../services/supabase/client.js';
import { logger } from './logger.js';
import { env } from '../config/env.js';
import {
  captureException,
  captureMessage,
  addBreadcrumb,
  withPerformanceTracking,
  type TenantContext,
} from '../config/sentry.js';

export interface TrackedError {
  id?: string;
  workspace_id?: string;
  bot_id?: string;
  error_type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  service: 'slack' | 'rag' | 'google_drive' | 'openai' | 'supabase' | 'api' | 'webhook';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  resolved: boolean;
  created_at?: string;
}

export interface ErrorContext {
  workspaceId?: string;
  workspaceName?: string;
  botId?: string;
  botName?: string;
  userId?: string;
  channelId?: string;
  operation?: string;
  [key: string]: unknown;
}

// Slack webhook payload
interface SlackAlertPayload {
  text: string;
  blocks: Array<{
    type: string;
    text?: { type: string; text: string };
    fields?: Array<{ type: string; text: string }>;
  }>;
}

class ErrorTracker {
  private errorQueue: TrackedError[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize the error tracker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Flush errors every 10 seconds
    this.flushInterval = setInterval(() => this.flush(), 10000);
    this.isInitialized = true;
    logger.info('Error tracker initialized');
  }

  /**
   * Track an error with full multi-tenant context
   */
  async track(
    error: Error | string,
    service: TrackedError['service'],
    severity: TrackedError['severity'] = 'medium',
    context?: ErrorContext
  ): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Build tenant context for Sentry
    const tenantContext: TenantContext = {
      workspaceId: context?.workspaceId,
      workspaceName: context?.workspaceName,
      botId: context?.botId,
      botName: context?.botName,
      userId: context?.userId,
      channelId: context?.channelId,
    };

    // Extract extra context (non-tenant fields for storage in context column)
    const tenantFields = ['workspaceId', 'workspaceName', 'botId', 'botName', 'userId', 'channelId'];
    const extras: Record<string, unknown> = {};
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (!tenantFields.includes(key)) {
          extras[key] = value;
        }
      }
    }

    // Create tracked error for Supabase
    const trackedError: TrackedError = {
      workspace_id: context?.workspaceId,
      bot_id: context?.botId,
      error_type: errorObj.name || 'Error',
      message: errorObj.message,
      stack: errorObj.stack,
      context: Object.keys(extras).length > 0 ? extras : undefined,
      service,
      severity,
      user_id: context?.userId,
      resolved: false,
    };

    // Log to console
    logger.error(`[${service.toUpperCase()}] ${errorObj.message}`, {
      severity,
      workspaceId: context?.workspaceId,
      botId: context?.botId,
      ...extras,
    });

    // Send to Sentry
    captureException(errorObj, tenantContext, {
      service,
      severity,
      ...extras,
    });

    // Add to queue for batch insert to Supabase
    this.errorQueue.push(trackedError);

    // Alert and flush critical errors immediately
    if (severity === 'critical') {
      await this.sendCriticalAlert(trackedError);
      await this.flush();
    }
  }

  /**
   * Track a Slack bot error
   */
  async trackSlackError(
    error: Error | string,
    workspaceId: string,
    botId: string,
    severity: TrackedError['severity'] = 'medium',
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track(error, 'slack', severity, {
      workspaceId,
      botId,
      ...context,
    });
  }

  /**
   * Track a RAG/AI error
   */
  async trackRAGError(
    error: Error | string,
    workspaceId: string,
    severity: TrackedError['severity'] = 'medium',
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track(error, 'rag', severity, {
      workspaceId,
      ...context,
    });
  }

  /**
   * Track an OpenAI API error
   */
  async trackOpenAIError(
    error: Error | string,
    workspaceId?: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track(error, 'openai', 'high', {
      workspaceId,
      ...context,
    });
  }

  /**
   * Track a Google Drive sync error
   */
  async trackDriveError(
    error: Error | string,
    workspaceId: string,
    botId?: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track(error, 'google_drive', 'medium', {
      workspaceId,
      botId,
      ...context,
    });
  }

  /**
   * Track a rate limit event
   */
  async trackRateLimit(
    userId: string,
    resetIn: number,
    workspaceId?: string
  ): Promise<void> {
    await this.track(
      `Rate limit exceeded for user ${userId}`,
      'api',
      'low',
      { workspaceId, userId, resetIn }
    );
  }

  /**
   * Track a timeout event
   */
  async trackTimeout(
    operation: string,
    timeoutMs: number,
    context?: ErrorContext
  ): Promise<void> {
    await this.track(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      'api',
      'high',
      { operation, timeoutMs, ...context }
    );
  }

  /**
   * Track API failure with service-specific handling
   */
  async trackApiFailure(
    api: 'openai' | 'slack' | 'google_drive' | 'supabase',
    error: Error,
    context?: ErrorContext
  ): Promise<void> {
    const severity = api === 'openai' ? 'high' : 'medium';
    await this.track(error, api as TrackedError['service'], severity, context);
  }

  /**
   * Add a breadcrumb for debugging context
   */
  addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, unknown>
  ): void {
    addBreadcrumb(message, category, data);
  }

  /**
   * Wrap an async operation with performance tracking
   */
  async withPerformance<T>(
    name: string,
    op: string,
    fn: () => Promise<T>,
    context?: TenantContext
  ): Promise<T> {
    return withPerformanceTracking(name, op, fn, context);
  }

  /**
   * Track a slow operation (threshold-based)
   */
  async trackSlowOperation(
    operation: string,
    durationMs: number,
    thresholdMs: number,
    context?: ErrorContext
  ): Promise<void> {
    if (durationMs > thresholdMs) {
      const tenantContext: TenantContext = {
        workspaceId: context?.workspaceId,
        botId: context?.botId,
      };

      captureMessage(
        `Slow operation: ${operation} took ${durationMs}ms (threshold: ${thresholdMs}ms)`,
        'warning',
        tenantContext,
        { operation, durationMs, thresholdMs, ...context }
      );

      logger.warn(`Slow operation detected: ${operation}`, {
        durationMs,
        thresholdMs,
        ...context,
      });
    }
  }

  /**
   * Send critical error alert via Slack webhook
   */
  private async sendCriticalAlert(error: TrackedError): Promise<void> {
    if (!env.ALERT_SLACK_WEBHOOK_URL) return;

    const payload: SlackAlertPayload = {
      text: `🚨 Critical Error in ${error.service.toUpperCase()}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Critical Error Alert`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Service:*\n${error.service}`,
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${error.severity}`,
            },
            {
              type: 'mrkdwn',
              text: `*Workspace:*\n${error.workspace_id || 'N/A'}`,
            },
            {
              type: 'mrkdwn',
              text: `*Bot:*\n${error.bot_id || 'N/A'}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:*\n\`\`\`${error.message.slice(0, 500)}\`\`\``,
          },
        },
      ],
    };

    try {
      await fetch(env.ALERT_SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      logger.debug('Critical alert sent to Slack');
    } catch (err) {
      logger.error('Failed to send critical alert', { err });
    }
  }

  /**
   * Flush errors to database
   */
  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToFlush = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const { error } = await supabase.from('error_logs').insert(
        errorsToFlush.map(e => ({
          workspace_id: e.workspace_id,
          bot_id: e.bot_id,
          error_type: e.error_type,
          message: e.message,
          stack: e.stack,
          context: e.context,
          service: e.service,
          severity: e.severity,
          user_id: e.user_id,
          resolved: e.resolved,
        }))
      );

      if (error) {
        // Don't use track() here to avoid infinite loop
        logger.error('Failed to flush errors to database', { error, count: errorsToFlush.length });
        // Re-add to queue for retry (limit to avoid memory issues)
        if (this.errorQueue.length < 100) {
          this.errorQueue.push(...errorsToFlush);
        }
      } else {
        logger.debug(`Flushed ${errorsToFlush.length} errors to database`);
      }
    } catch (err) {
      logger.error('Error flushing to database', { err });
    }
  }

  /**
   * Get error statistics for a workspace
   */
  async getStats(
    workspaceId?: string,
    hours: number = 24
  ): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
    recentErrors: TrackedError[];
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: errors, error } = await query;

    if (error || !errors) {
      return { total: 0, bySeverity: {}, byService: {}, recentErrors: [] };
    }

    const bySeverity: Record<string, number> = {};
    const byService: Record<string, number> = {};

    for (const e of errors) {
      bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
      byService[e.service] = (byService[e.service] || 0) + 1;
    }

    return {
      total: errors.length,
      bySeverity,
      byService,
      recentErrors: errors.slice(0, 20) as TrackedError[],
    };
  }

  /**
   * Get workspace-specific error summary
   */
  async getWorkspaceSummary(workspaceId: string): Promise<{
    last24h: number;
    last7d: number;
    criticalCount: number;
    unresolvedCount: number;
  }> {
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [last24h, last7d, critical, unresolved] = await Promise.all([
      supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', day),
      supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', week),
      supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('severity', 'critical')
        .gte('created_at', week),
      supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('resolved', false),
    ]);

    return {
      last24h: last24h.count || 0,
      last7d: last7d.count || 0,
      criticalCount: critical.count || 0,
      unresolvedCount: unresolved.count || 0,
    };
  }

  /**
   * Mark an error as resolved
   */
  async resolve(errorId: string): Promise<void> {
    await supabase
      .from('error_logs')
      .update({ resolved: true })
      .eq('id', errorId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flush();
  }
}

export const errorTracker = new ErrorTracker();
