/**
 * Error Tracking Utility
 * Centralized error tracking with Sentry-like interface
 * Can be swapped to actual Sentry with minimal changes
 */

import { logger } from './logger.js';
import { env } from '../config/env.js';

// Error context for rich error reports
export interface ErrorContext {
  userId?: string;
  workspaceId?: string;
  operation?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

// Error severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

// Simulated Sentry-like interface
interface ErrorTracker {
  captureException(error: Error, context?: ErrorContext): string;
  captureMessage(message: string, severity?: ErrorSeverity, context?: ErrorContext): string;
  setUser(user: { id: string; email?: string }): void;
  setTag(key: string, value: string): void;
  setExtra(key: string, value: unknown): void;
  addBreadcrumb(breadcrumb: { category: string; message: string; level?: string }): void;
}

// In-memory error storage for debugging (replace with Sentry in production)
const errorStore: Array<{
  id: string;
  timestamp: Date;
  type: 'exception' | 'message';
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
}> = [];

const MAX_STORED_ERRORS = 1000;

// Generate a unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Current context (like Sentry's scope)
let currentUser: { id: string; email?: string } | null = null;
const globalTags: Record<string, string> = {};
const globalExtra: Record<string, unknown> = {};
const breadcrumbs: Array<{ category: string; message: string; level?: string; timestamp: Date }> = [];
const MAX_BREADCRUMBS = 100;

/**
 * Error tracker implementation
 * In production, replace this with actual Sentry SDK:
 *
 * import * as Sentry from '@sentry/node';
 * Sentry.init({ dsn: env.SENTRY_DSN });
 */
export const errorTracker: ErrorTracker = {
  captureException(error: Error, context: ErrorContext = {}): string {
    const errorId = generateErrorId();

    const errorRecord = {
      id: errorId,
      timestamp: new Date(),
      type: 'exception' as const,
      severity: 'error' as ErrorSeverity,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        tags: { ...globalTags, ...context.tags },
        extra: { ...globalExtra, ...context.extra },
      },
    };

    // Store error
    errorStore.unshift(errorRecord);
    if (errorStore.length > MAX_STORED_ERRORS) {
      errorStore.pop();
    }

    // Log with structured data
    logger.error('Captured exception', {
      errorId,
      message: error.message,
      stack: error.stack,
      user: currentUser,
      ...context,
      breadcrumbs: breadcrumbs.slice(-10),
    });

    // In production with Sentry:
    // return Sentry.captureException(error, { ...context, user: currentUser });

    return errorId;
  },

  captureMessage(message: string, severity: ErrorSeverity = 'info', context: ErrorContext = {}): string {
    const errorId = generateErrorId();

    const messageRecord = {
      id: errorId,
      timestamp: new Date(),
      type: 'message' as const,
      severity,
      message,
      context: {
        ...context,
        tags: { ...globalTags, ...context.tags },
        extra: { ...globalExtra, ...context.extra },
      },
    };

    errorStore.unshift(messageRecord);
    if (errorStore.length > MAX_STORED_ERRORS) {
      errorStore.pop();
    }

    const logFn = severity === 'fatal' || severity === 'error'
      ? logger.error
      : severity === 'warning'
        ? logger.warn
        : logger.info;

    logFn(message, {
      errorId,
      severity,
      user: currentUser,
      ...context,
    });

    return errorId;
  },

  setUser(user: { id: string; email?: string }): void {
    currentUser = user;
    // Sentry: Sentry.setUser(user);
  },

  setTag(key: string, value: string): void {
    globalTags[key] = value;
    // Sentry: Sentry.setTag(key, value);
  },

  setExtra(key: string, value: unknown): void {
    globalExtra[key] = value;
    // Sentry: Sentry.setExtra(key, value);
  },

  addBreadcrumb(breadcrumb: { category: string; message: string; level?: string }): void {
    breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date(),
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) {
      breadcrumbs.shift();
    }
    // Sentry: Sentry.addBreadcrumb(breadcrumb);
  },
};

/**
 * Get stored errors (for debugging dashboard)
 */
export function getStoredErrors(limit = 50): typeof errorStore {
  return errorStore.slice(0, limit);
}

/**
 * Clear stored errors
 */
export function clearStoredErrors(): void {
  errorStore.length = 0;
}

/**
 * Express error handler middleware
 */
export function errorHandlerMiddleware(
  error: Error,
  req: import('express').Request,
  res: import('express').Response,
  _next: import('express').NextFunction
): void {
  const errorId = errorTracker.captureException(error, {
    operation: `${req.method} ${req.path}`,
    userId: (req as any).user?.id,
    workspaceId: (req as any).workspace?.id,
    extra: {
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.get('user-agent'),
        'content-type': req.get('content-type'),
      },
    },
  });

  // Don't expose internal errors to client
  const statusCode = (error as any).statusCode || 500;
  const isProduction = env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: isProduction ? 'Internal server error' : error.message,
    errorId,
    ...(isProduction ? {} : { stack: error.stack }),
  });
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler<T extends import('express').RequestHandler>(fn: T): T {
  return ((req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  }) as T;
}

/**
 * Initialize error tracking (call on app startup)
 */
export function initErrorTracking(): void {
  errorTracker.setTag('environment', env.NODE_ENV);
  errorTracker.setTag('service', 'teambrain-api');

  logger.info('Error tracking initialized', {
    mode: 'in-memory', // Change to 'sentry' when SENTRY_DSN is configured
    environment: env.NODE_ENV,
  });

  // In production with Sentry:
  // if (env.SENTRY_DSN) {
  //   Sentry.init({
  //     dsn: env.SENTRY_DSN,
  //     environment: env.NODE_ENV,
  //     tracesSampleRate: 0.1,
  //   });
  //   logger.info('Sentry error tracking initialized');
  // }
}

/**
 * Flush error tracking (call on graceful shutdown)
 */
export async function flushErrorTracking(): Promise<void> {
  // In production with Sentry:
  // await Sentry.flush(2000);
  logger.info('Error tracking flushed');
}

// Export singleton instance
export default errorTracker;
