/**
 * Sentry Error Tracking & Performance Monitoring Configuration
 *
 * Provides centralized error tracking across all tenant instances with:
 * - Multi-tenant context (workspace_id, bot_id)
 * - Performance monitoring (APM)
 * - Automatic error capture
 * - Custom tagging and breadcrumbs
 */

import * as Sentry from '@sentry/node';
import { env } from './env.js';
import type { Express } from 'express';

// Multi-tenant context interface
export interface TenantContext {
  workspaceId?: string;
  workspaceName?: string;
  botId?: string;
  botName?: string;
  userId?: string;
  channelId?: string;
}

/**
 * Initialize Sentry SDK
 * Call this early in your application startup
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.APP_VERSION || '1.0.0',

    // Performance monitoring - higher rate for agent monitoring
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.5 : 1.0,
    profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0.5,

    // Capture 100% of errors
    sampleRate: 1.0,

    // Send PII for better debugging (user IDs, etc.)
    sendDefaultPii: true,

    // Integrations
    integrations: [
      // HTTP integration for outgoing requests
      Sentry.httpIntegration(),
      // Express integration
      Sentry.expressIntegration(),
      // Capture unhandled promise rejections
      Sentry.onUnhandledRejectionIntegration(),
      // OpenAI integration for agent monitoring
      Sentry.openAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
    ],

    // Before sending, add default tags
    beforeSend(event) {
      // Filter out non-critical events in production to reduce noise
      if (env.NODE_ENV === 'production') {
        // Skip low-severity events unless they're errors
        if (event.level === 'info' || event.level === 'debug') {
          return null;
        }
      }
      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Ignore network errors that are expected
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      // Ignore rate limit errors (we track these separately)
      'Rate limit exceeded',
      // Ignore user-caused validation errors
      'ValidationError',
    ],
  });

  console.log(`Sentry initialized for ${env.NODE_ENV} environment`);
}

/**
 * Set up Sentry request handlers for Express
 */
export function setupSentryMiddleware(app: Express): void {
  if (!env.SENTRY_DSN) return;

  // Request handler creates a separate execution context
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Set multi-tenant context for the current scope
 * Call this at the start of each request/operation
 */
export function setTenantContext(context: TenantContext): void {
  if (!env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context.workspaceId) {
      scope.setTag('workspace_id', context.workspaceId);
      scope.setContext('workspace', {
        id: context.workspaceId,
        name: context.workspaceName,
      });
    }

    if (context.botId) {
      scope.setTag('bot_id', context.botId);
      scope.setContext('bot', {
        id: context.botId,
        name: context.botName,
      });
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    if (context.channelId) {
      scope.setTag('channel_id', context.channelId);
    }
  });
}

/**
 * Configure the current scope with tenant context
 * Returns a function to use with Sentry.withScope
 */
export function configureTenantScope(context: TenantContext): (scope: Sentry.Scope) => void {
  return (scope: Sentry.Scope) => {
    if (context.workspaceId) {
      scope.setTag('workspace_id', context.workspaceId);
      scope.setContext('workspace', {
        id: context.workspaceId,
        name: context.workspaceName,
      });
    }

    if (context.botId) {
      scope.setTag('bot_id', context.botId);
      scope.setContext('bot', {
        id: context.botId,
        name: context.botName,
      });
    }

    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    if (context.channelId) {
      scope.setTag('channel_id', context.channelId);
    }
  };
}

/**
 * Capture an exception with tenant context
 */
export function captureException(
  error: Error | string,
  context?: TenantContext,
  extras?: Record<string, unknown>
): string | undefined {
  if (!env.SENTRY_DSN) return undefined;

  return Sentry.withScope((scope) => {
    if (context) {
      configureTenantScope(context)(scope);
    }

    if (extras) {
      scope.setExtras(extras);
    }

    const errorObj = error instanceof Error ? error : new Error(String(error));
    return Sentry.captureException(errorObj);
  });
}

/**
 * Capture a message with tenant context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: TenantContext,
  extras?: Record<string, unknown>
): string | undefined {
  if (!env.SENTRY_DSN) return undefined;

  return Sentry.withScope((scope) => {
    if (context) {
      configureTenantScope(context)(scope);
    }

    if (extras) {
      scope.setExtras(extras);
    }

    return Sentry.captureMessage(message, level);
  });
}

/**
 * Add a breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  if (!env.SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string,
  context?: TenantContext
): Sentry.Span | undefined {
  if (!env.SENTRY_DSN) return undefined;

  return Sentry.startInactiveSpan({
    name,
    op,
    attributes: context ? {
      'tenant.workspace_id': context.workspaceId,
      'tenant.bot_id': context.botId,
    } : undefined,
  });
}

/**
 * Wrap an async function with performance tracking
 */
export async function withPerformanceTracking<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  context?: TenantContext
): Promise<T> {
  if (!env.SENTRY_DSN) {
    return fn();
  }

  return Sentry.startSpan(
    {
      name,
      op,
      attributes: context ? {
        'tenant.workspace_id': context.workspaceId,
        'tenant.bot_id': context.botId,
      } : undefined,
    },
    async () => {
      return fn();
    }
  );
}

/**
 * Flush pending events before shutdown
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!env.SENTRY_DSN) return true;
  return Sentry.flush(timeout);
}

// Re-export Sentry for direct access when needed
export { Sentry };
