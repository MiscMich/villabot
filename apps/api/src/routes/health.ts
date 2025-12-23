import { Router, Request, Response } from 'express';
import { testSupabaseConnection, supabase } from '../services/supabase/client.js';
import { generateQueryEmbedding } from '../services/rag/embeddings.js';
import { embeddingCache, searchCache, responseCache } from '../utils/cache.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    supabase: 'connected' | 'disconnected';
    gemini: 'connected' | 'disconnected';
  };
  // Per-workspace integrations - informational only, don't affect platform health
  integrations: {
    activeSlackBots: number;
    workspacesWithGoogleDrive: number;
  };
  version: string;
}

// Track PLATFORM-LEVEL service status only
// Slack and Google Drive are per-workspace OAuth integrations, not platform services
const serviceStatus = {
  supabase: false,
  gemini: false,
};

// Track workspace integration counts (informational)
const integrationCounts = {
  activeSlackBots: 0,
  workspacesWithGoogleDrive: 0,
};

export function updateServiceStatus(service: keyof typeof serviceStatus, status: boolean): void {
  serviceStatus[service] = status;
}

export function updateIntegrationCounts(counts: Partial<typeof integrationCounts>): void {
  Object.assign(integrationCounts, counts);
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  const supabaseOk = await testSupabaseConnection();
  updateServiceStatus('supabase', supabaseOk);

  // Platform health is based on core services only (Supabase + Gemini)
  // Slack/Drive are per-workspace integrations - they don't affect platform health
  const allHealthy = Object.values(serviceStatus).every(Boolean);
  const anyHealthy = Object.values(serviceStatus).some(Boolean);

  const health: HealthStatus = {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      supabase: serviceStatus.supabase ? 'connected' : 'disconnected',
      gemini: serviceStatus.gemini ? 'connected' : 'disconnected',
    },
    // Per-workspace integrations (informational - doesn't affect platform status)
    integrations: {
      activeSlackBots: integrationCounts.activeSlackBots,
      workspacesWithGoogleDrive: integrationCounts.workspacesWithGoogleDrive,
    },
    version: process.env.npm_package_version ?? '0.1.0',
  };

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const supabaseOk = await testSupabaseConnection();

  if (supabaseOk) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not available' });
  }
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

/**
 * Deep health check - comprehensive service testing
 * Tests actual functionality of each service
 */
healthRouter.get('/deep', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, {
    status: 'pass' | 'fail';
    latency?: number;
    details?: Record<string, unknown>;
    error?: string;
  }> = {};

  // 1. Database connectivity and data check
  try {
    const dbStart = Date.now();
    const dbOk = await testSupabaseConnection();

    if (dbOk) {
      // Get document and chunk counts
      const [{ count: docCount }, { count: chunkCount }, { count: factCount }] = await Promise.all([
        supabase.from('documents').select('*', { count: 'exact', head: true }),
        supabase.from('chunks').select('*', { count: 'exact', head: true }),
        supabase.from('learned_facts').select('*', { count: 'exact', head: true }),
      ]);

      checks.database = {
        status: 'pass',
        latency: Date.now() - dbStart,
        details: {
          documents: docCount ?? 0,
          chunks: chunkCount ?? 0,
          learnedFacts: factCount ?? 0,
        },
      };
    } else {
      checks.database = { status: 'fail', error: 'Connection failed' };
    }
  } catch (error) {
    checks.database = { status: 'fail', error: (error as Error).message };
  }

  // 2. Gemini API check (embedding generation)
  if (env.GEMINI_API_KEY) {
    try {
      const geminiStart = Date.now();
      const embedding = await generateQueryEmbedding('health check test');
      checks.gemini = {
        status: embedding.length > 0 ? 'pass' : 'fail',
        latency: Date.now() - geminiStart,
        details: {
          embeddingDimensions: embedding.length,
        },
      };
    } catch (error) {
      checks.gemini = { status: 'fail', error: (error as Error).message };
    }
  } else {
    checks.gemini = { status: 'fail', error: 'API key not configured' };
  }

  // 3. Vector search function check
  try {
    const searchStart = Date.now();
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_text: 'test',
      query_embedding: new Array(768).fill(0.1),
      match_count: 1,
      vector_weight: 0.5,
      keyword_weight: 0.5,
    });

    checks.vectorSearch = {
      status: error ? 'fail' : 'pass',
      latency: Date.now() - searchStart,
      details: {
        resultsReturned: data?.length ?? 0,
      },
      error: error?.message,
    };
  } catch (error) {
    checks.vectorSearch = { status: 'fail', error: (error as Error).message };
  }

  // 4. Cache status
  const embeddingStats = embeddingCache.stats();
  const searchStats = searchCache.stats();
  const responseStats = responseCache.stats();

  checks.cache = {
    status: 'pass',
    details: {
      embedding: {
        size: embeddingStats.size,
        maxSize: embeddingStats.maxSize,
        hitRate: embeddingStats.hitRate.toFixed(2),
      },
      search: {
        size: searchStats.size,
        maxSize: searchStats.maxSize,
        hitRate: searchStats.hitRate.toFixed(2),
      },
      response: {
        size: responseStats.size,
        maxSize: responseStats.maxSize,
        hitRate: responseStats.hitRate.toFixed(2),
      },
    },
  };

  // 5. Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    status: memUsage.heapUsed / memUsage.heapTotal < 0.9 ? 'pass' : 'fail',
    details: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      heapUsagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
  };

  // Calculate overall status
  const allPassing = Object.values(checks).every(c => c.status === 'pass');
  const criticalFailing = checks.database?.status === 'fail' || checks.gemini?.status === 'fail';

  const overallStatus = allPassing ? 'healthy' : criticalFailing ? 'unhealthy' : 'degraded';

  logger.info('Deep health check completed', {
    status: overallStatus,
    totalLatency: Date.now() - startTime,
    checks: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.status])),
  });

  res.status(overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.1.0',
    checks,
  });
});
