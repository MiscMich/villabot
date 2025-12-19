import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter, updateServiceStatus } from './routes/health.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter, initializeDriveFromStoredTokens } from './routes/auth.js';
import { testSupabaseConnection } from './services/supabase/client.js';
import { initializeSlackBot, isSlackBotRunning, shutdownSlackBot } from './services/slack/bot.js';
import { initializeScheduler, stopScheduler } from './services/scheduler/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// API Routes
app.use('/health', healthRouter);
app.use('/api/config', configRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/auth', authRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Villa Paraiso Bot API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      config: '/api/config',
      documents: '/api/documents',
      analytics: '/api/analytics',
      auth: '/auth',
    },
  });
});

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start(): Promise<void> {
  logger.info('Starting Villa Paraiso Bot API...');

  // Test database connection
  const dbOk = await testSupabaseConnection();
  updateServiceStatus('supabase', dbOk);

  if (dbOk) {
    logger.info('✓ Supabase connection established');
  } else {
    logger.warn('✗ Supabase connection failed - running in degraded mode');
  }

  // Initialize Google Drive from stored tokens
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const driveOk = await initializeDriveFromStoredTokens();
    updateServiceStatus('google_drive', driveOk);
    if (driveOk) {
      logger.info('✓ Google Drive connection established');
    } else {
      logger.info('○ Google Drive not connected - use /auth/google to connect');
    }
  } else {
    logger.info('○ Google Drive credentials not configured');
  }

  // Initialize Slack bot
  if (env.SLACK_BOT_TOKEN && env.SLACK_APP_TOKEN) {
    try {
      await initializeSlackBot();
      updateServiceStatus('slack', true);
      logger.info('✓ Slack bot connected');
    } catch (error) {
      logger.error('✗ Slack bot failed to connect', { error });
      updateServiceStatus('slack', false);
    }
  } else {
    logger.info('○ Slack credentials not configured');
  }

  // Initialize scheduler
  initializeScheduler();
  logger.info('✓ Scheduler initialized');

  // Start HTTP server
  app.listen(env.PORT, () => {
    logger.info(`✓ Server running on http://localhost:${env.PORT}`);
    logger.info(`  Environment: ${env.NODE_ENV}`);
    logger.info(`  Health check: http://localhost:${env.PORT}/health`);
    logger.info(`  API docs: http://localhost:${env.PORT}/`);
  });
}

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  stopScheduler();

  if (isSlackBotRunning()) {
    await shutdownSlackBot();
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
