import winston from 'winston';
import Transport from 'winston-transport';
import * as Sentry from '@sentry/node';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

/**
 * Custom Winston transport for Sentry integration
 * - Sends error/warn logs to Sentry
 * - Adds breadcrumbs for info/debug logs
 */
class SentryTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: { level: string; message: string; stack?: string; [key: string]: unknown }, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    // Skip if Sentry is not configured
    if (!env.SENTRY_DSN) {
      callback();
      return;
    }

    const { level, message, stack, ...metadata } = info;

    // Map Winston levels to Sentry severity
    const sentryLevel = this.mapLevel(level);

    if (level === 'error') {
      // Send errors to Sentry
      Sentry.withScope((scope) => {
        // Add metadata as extras
        if (Object.keys(metadata).length > 0) {
          scope.setExtras(metadata as Record<string, unknown>);
        }

        // Add workspace/bot context if available
        if (metadata.workspaceId) {
          scope.setTag('workspace_id', String(metadata.workspaceId));
        }
        if (metadata.botId) {
          scope.setTag('bot_id', String(metadata.botId));
        }

        if (stack) {
          const error = new Error(message);
          error.stack = stack;
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(message, sentryLevel);
        }
      });
    } else if (level === 'warn') {
      // Send warnings as messages
      Sentry.withScope((scope) => {
        if (Object.keys(metadata).length > 0) {
          scope.setExtras(metadata as Record<string, unknown>);
        }
        Sentry.captureMessage(message, 'warning');
      });
    } else {
      // Add info/debug as breadcrumbs for context
      Sentry.addBreadcrumb({
        message,
        level: sentryLevel,
        category: 'log',
        data: Object.keys(metadata).length > 0 ? metadata as Record<string, unknown> : undefined,
        timestamp: Date.now() / 1000,
      });
    }

    callback();
  }

  private mapLevel(level: string): Sentry.SeverityLevel {
    switch (level) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'debug';
      default:
        return 'log';
    }
  }
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    // Add Sentry transport
    new SentryTransport(),
  ],
});

// Add file transport in production
if (env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}
