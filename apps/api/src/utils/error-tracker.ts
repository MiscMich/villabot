/**
 * Error tracking service
 * Logs errors to Supabase for dashboard visibility
 */

import { supabase } from '../services/supabase/client.js';
import { logger } from './logger.js';

export interface TrackedError {
  id?: string;
  error_type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  service: 'slack' | 'rag' | 'google_drive' | 'gemini' | 'supabase' | 'api';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  resolved: boolean;
  created_at?: string;
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
   * Track an error
   */
  async track(
    error: Error | string,
    service: TrackedError['service'],
    severity: TrackedError['severity'] = 'medium',
    context?: Record<string, unknown>,
    userId?: string
  ): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    const trackedError: TrackedError = {
      error_type: errorObj.name || 'Error',
      message: errorObj.message,
      stack: errorObj.stack,
      context,
      service,
      severity,
      user_id: userId,
      resolved: false,
    };

    // Log to console as well
    logger.error(`[${service.toUpperCase()}] ${errorObj.message}`, {
      severity,
      context,
      stack: errorObj.stack,
    });

    // Add to queue for batch insert
    this.errorQueue.push(trackedError);

    // Immediately flush critical errors
    if (severity === 'critical') {
      await this.flush();
    }
  }

  /**
   * Track a rate limit event
   */
  async trackRateLimit(userId: string, resetIn: number): Promise<void> {
    await this.track(
      `Rate limit exceeded for user ${userId}`,
      'slack',
      'low',
      { userId, resetIn },
      userId
    );
  }

  /**
   * Track a timeout event
   */
  async trackTimeout(operation: string, timeoutMs: number, context?: Record<string, unknown>): Promise<void> {
    await this.track(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      'api',
      'high',
      { operation, timeoutMs, ...context }
    );
  }

  /**
   * Track API failure
   */
  async trackApiFailure(
    api: 'gemini' | 'slack' | 'google_drive' | 'supabase',
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    const severity = api === 'gemini' ? 'high' : 'medium';
    await this.track(error, api as TrackedError['service'], severity, context);
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
   * Get error statistics
   */
  async getStats(hours: number = 24): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
    recentErrors: TrackedError[];
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: errors, error } = await supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

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
