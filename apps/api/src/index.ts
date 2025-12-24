import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter, updateServiceStatus, updateIntegrationCounts } from './routes/health.js';
import { configRouter } from './routes/config.js';
import { documentsRouter } from './routes/documents.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { usersAuthRouter } from './routes/users-auth.js';
import { workspacesRouter } from './routes/workspaces.js';
import { teamRouter } from './routes/team.js';
import errorsRouter from './routes/errors.js';
import conversationsRouter from './routes/conversations.js';
import { botsRouter } from './routes/bots.js';
import { driveRouter } from './routes/drive.js';
import { feedbackRouter } from './routes/feedback.js';
import { setupRouter } from './routes/setup.js';
import billingRouter from './routes/billing.js';
import webhooksRouter from './routes/webhooks.js';
import adminRouter from './routes/admin.js';
import { testSupabaseConnection, supabase } from './services/supabase/client.js';
import { isStripeConfigured } from './services/billing/stripe.js';
import { initializeSlackBots, isSlackBotRunning, shutdownSlackBots, botManager } from './services/slack/manager.js';
import { initializeScheduler, stopScheduler } from './services/scheduler/index.js';
import { isPlatformAdmin, isRedisAvailable } from './middleware/rateLimit.js';

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

// Protected routes
// Note: Rate limiters are now applied INSIDE routers, AFTER authenticate + resolveWorkspace
// This ensures req.workspace is set before rate limiting checks
// Workspaces router doesn't use resolveWorkspace (it manages workspaces directly)
app.use('/api/workspaces', workspacesRouter);
app.use('/api/team', teamRouter);
app.use('/api/config', configRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/errors', errorsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/bots', botsRouter);
app.use('/api/drive', driveRouter);
app.use('/api/feedback', feedbackRouter);
// Setup router doesn't use resolveWorkspace (used during initial setup before workspace exists)
app.use('/api/setup', setupRouter);
// Billing routes handle their own auth per-route (some need workspace, some don't)
app.use('/api/billing', billingRouter);

// Platform admin routes - NO rate limiting (platform admins bypass limits)
app.use('/api/admin', adminRouter);

// Webhooks - NO rate limiting (external services like Stripe)
app.use('/api/webhooks', webhooksRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Cluebase AI API',
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
      drive: '/api/drive',
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
  logger.info('Starting Cluebase AI API...');

  // Test database connection
  const dbOk = await testSupabaseConnection();
  updateServiceStatus('supabase', dbOk);

  if (dbOk) {
    logger.info('✓ Supabase connection established');
  } else {
    logger.warn('✗ Supabase connection failed - running in degraded mode');
  }

  // Google Drive OAuth is configured at platform level (client credentials)
  // but connections are per-workspace - this just verifies OAuth is available
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    logger.info('✓ Google Drive OAuth available (per-workspace integration)');
    // Count will be updated dynamically when workspaces connect Drive
  } else {
    logger.info('○ Google Drive OAuth credentials not configured');
  }

  // Initialize Slack bots (per-workspace integration)
  // Slack is NOT a platform service - each workspace configures their own bot
  try {
    // Try multi-bot system first (loads active bots from database)
    await initializeSlackBots();

    if (isSlackBotRunning()) {
      const runningCount = botManager.getRunningCount();
      updateIntegrationCounts({ activeSlackBots: runningCount });
      logger.info(`✓ Slack bots running (${runningCount} active from workspaces)`);
    } else if (env.SLACK_BOT_TOKEN && env.SLACK_APP_TOKEN) {
      // No bots in database but env vars exist - create a default bot
      logger.info('No bots in database, creating default bot from env vars');

      // Find or create a default workspace
      const { data: existingWorkspace } = await supabase
        .from('workspaces')
        .select('id')
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (existingWorkspace) {
        // Check if a bot with this token already exists
        const { data: existingBot } = await supabase
          .from('bots')
          .select('id')
          .eq('slack_bot_token', env.SLACK_BOT_TOKEN)
          .single();

        if (!existingBot) {
          // Create a default bot in the database
          const { error: createError } = await supabase
            .from('bots')
            .insert({
              workspace_id: existingWorkspace.id,
              name: 'Default Bot',
              slug: 'default-bot',
              slack_bot_token: env.SLACK_BOT_TOKEN,
              slack_app_token: env.SLACK_APP_TOKEN,
              status: 'active',
              is_default: true,
            });

          if (createError) {
            logger.error('Failed to create default bot', { error: createError });
          } else {
            logger.info('Created default bot in database from env vars');
            // Re-initialize to pick up the new bot
            await initializeSlackBots();
            if (isSlackBotRunning()) {
              updateIntegrationCounts({ activeSlackBots: botManager.getRunningCount() });
              logger.info('✓ Default Slack bot started from env vars');
            }
          }
        } else {
          logger.info('Bot with env token already exists, starting via manager');
          await botManager.startBot(existingBot.id);
          if (isSlackBotRunning()) {
            updateIntegrationCounts({ activeSlackBots: botManager.getRunningCount() });
            logger.info('✓ Slack bot started');
          }
        }
      } else {
        logger.info('○ No workspace exists yet - bot will start after setup');
      }
    } else {
      logger.info('○ No Slack bots configured by any workspace yet');
    }
  } catch (error) {
    logger.error('✗ Slack bot initialization failed', { error });
    updateIntegrationCounts({ activeSlackBots: 0 });
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

  // Check Redis for production rate limiting
  if (env.NODE_ENV === 'production') {
    if (isRedisAvailable()) {
      logger.info('✓ Redis connected for rate limiting');
    } else {
      logger.warn('⚠ Redis not available in production - rate limits use in-memory storage');
      logger.warn('  • Rate limits reset on server restart');
      logger.warn('  • Rate limits not shared across instances');
      logger.warn('  → Set REDIS_URL environment variable for persistent rate limiting');
    }
  }

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

  // Shutdown all bots via manager
  if (isSlackBotRunning()) {
    await shutdownSlackBots();
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
