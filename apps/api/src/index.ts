import express from 'express';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRouter, updateServiceStatus } from './routes/health.js';
import { testSupabaseConnection } from './services/supabase/client.js';

const app = express();

// Middleware
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

// Routes
app.use('/health', healthRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Villa Paraiso Bot API',
    version: '0.1.0',
    docs: '/health',
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

  // Start HTTP server
  app.listen(env.PORT, () => {
    logger.info(`✓ Server running on http://localhost:${env.PORT}`);
    logger.info(`  Environment: ${env.NODE_ENV}`);
    logger.info(`  Health check: http://localhost:${env.PORT}/health`);
  });
}

start().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
