import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter, updateServiceStatus } from './routes/health.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter, initializeDriveFromStoredTokens } from './routes/auth.js';
import { usersAuthRouter } from './routes/users-auth.js';
import { workspacesRouter } from './routes/workspaces.js';
import { teamRouter } from './routes/team.js';
import errorsRouter from './routes/errors.js';
import conversationsRouter from './routes/conversations.js';
import { botsRouter } from './routes/bots.js';
import { feedbackRouter } from './routes/feedback.js';
import { setupRouter } from './routes/setup.js';
import billingRouter from './routes/billing.js';
import webhooksRouter from './routes/webhooks.js';
import adminRouter from './routes/admin.js';
import { testSupabaseConnection } from './services/supabase/client.js';
import { isStripeConfigured } from './services/billing/stripe.js';
import { initializeSlackBots, isSlackBotRunning, shutdownSlackBots, botManager } from './services/slack/manager.js';
// Legacy import for backwards compatibility during transition
import { initializeSlackBot as initializeLegacyBot, shutdownSlackBot as shutdownLegacyBot, isSlackBotRunning as isLegacyBotRunning } from './services/slack/bot.js';
import { initializeScheduler, stopScheduler } from './services/scheduler/index.js';
import {
  documentSyncRateLimiter,
  generalApiRateLimiter,
  isPlatformAdmin,
} from './middleware/rateLimit.js';

const app = express();

// Middleware

// IMPORTANT: Raw body parsing for Stripe webhooks MUST come before JSON parsing
// This captures the raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Standard middleware for all other routes
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

// Platform admin check (for rate limit bypassing)
app.use(isPlatformAdmin);

// API Routes
app.use('/health', healthRouter);

// Auth routes (public)
app.use('/api/auth', usersAuthRouter);
app.use('/auth', authRouter); // Google Drive OAuth (legacy path)

// Protected routes (with rate limiting)
// Note: Rate limiters require authenticate + resolveWorkspace middleware on routes
app.use('/api/workspaces', generalApiRateLimiter, workspacesRouter);
app.use('/api/team', generalApiRateLimiter, teamRouter);
app.use('/api/config', generalApiRateLimiter, configRouter);
app.use('/api/documents', documentSyncRateLimiter, documentsRouter);
app.use('/api/analytics', generalApiRateLimiter, analyticsRouter);
app.use('/api/errors', generalApiRateLimiter, errorsRouter);
app.use('/api/conversations', generalApiRateLimiter, conversationsRouter);
app.use('/api/bots', generalApiRateLimiter, botsRouter);
app.use('/api/feedback', generalApiRateLimiter, feedbackRouter);
app.use('/api/setup', generalApiRateLimiter, setupRouter);
app.use('/api/billing', generalApiRateLimiter, billingRouter);

// Platform admin routes - NO rate limiting (platform admins bypass limits)
app.use('/api/admin', adminRouter);

// Webhooks - NO rate limiting (external services like Stripe)
app.use('/api/webhooks', webhooksRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'TeamBrain AI API',
    version: '0.3.0',
    endpoints: {
      health: '/health',
      // Auth (public)
      auth: '/api/auth',
      google_oauth: '/auth',
      // Workspace management
      workspaces: '/api/workspaces',
      team: '/api/team',
      // Core functionality
      config: '/api/config',
      documents: '/api/documents',
      analytics: '/api/analytics',
      conversations: '/api/conversations',
      bots: '/api/bots',
      feedback: '/api/feedback',
      setup: '/api/setup',
      // Billing
      billing: '/api/billing',
      webhooks: '/api/webhooks',
      // Platform admin
      admin: '/api/admin',
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
  logger.info('Starting TeamBrain AI API...');

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
    updateServiceStatus('googleDrive', driveOk);
    if (driveOk) {
      logger.info('✓ Google Drive connection established');
    } else {
      logger.info('○ Google Drive not connected - use /auth/google to connect');
    }
  } else {
    logger.info('○ Google Drive credentials not configured');
  }

  // Initialize Slack bots
  try {
    // Try multi-bot system first (loads active bots from database)
    await initializeSlackBots();

    if (isSlackBotRunning()) {
      const runningCount = botManager.getRunningCount();
      updateServiceStatus('slack', true);
      logger.info(`✓ Slack bots connected (${runningCount} bot(s))`);
    } else if (env.SLACK_BOT_TOKEN && env.SLACK_APP_TOKEN) {
      // Fall back to legacy single bot if no bots in database
      logger.info('No bots in database, using legacy single-bot mode');
      await initializeLegacyBot();
      updateServiceStatus('slack', isLegacyBotRunning());
      if (isLegacyBotRunning()) {
        logger.info('✓ Slack bot connected (legacy mode)');
      }
    } else {
      logger.info('○ Slack credentials not configured');
    }
  } catch (error) {
    logger.error('✗ Slack bot(s) failed to connect', { error });
    updateServiceStatus('slack', false);
  }

  // Check Gemini API
  if (env.GEMINI_API_KEY) {
    updateServiceStatus('gemini', true);
    logger.info('✓ Gemini API configured');
  } else {
    logger.info('○ Gemini API key not configured');
  }

  // Check Stripe billing
  if (isStripeConfigured()) {
    logger.info('✓ Stripe billing configured');
  } else {
    logger.info('○ Stripe billing not configured');
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

  // Shutdown multi-bot manager
  if (isSlackBotRunning()) {
    await shutdownSlackBots();
  }

  // Also shutdown legacy bot if running
  if (isLegacyBotRunning()) {
    await shutdownLegacyBot();
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
