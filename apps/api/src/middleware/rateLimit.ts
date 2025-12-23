/**
 * Rate Limiting Middleware
 * Implements tier-based and endpoint-specific rate limiting
 *
 * IMPORTANT: Current Implementation Uses In-Memory Storage
 * =========================================================
 * This implementation uses an LRU cache for rate limit tracking.
 * This works well for single-server deployments but has limitations:
 *
 * - Rate limits reset when the server restarts
 * - Does not sync across multiple server instances (load balancing)
 * - Memory usage increases with unique workspace/user count
 *
 * For production with multiple instances, consider:
 * 1. Set REDIS_URL environment variable
 * 2. Update initializeRedis() to connect to Redis
 * 3. Update incrementRateLimit() to use Redis INCR with TTL
 *
 * The current in-memory approach is acceptable for:
 * - Single-server deployments
 * - Development/staging environments
 * - MVP launch with expected low-medium traffic
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Redis } from 'ioredis';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { LRUCache } from '../utils/cache.js';

// ============================================
// TYPES
// ============================================

interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests per window
  skipInternalWorkspaces: boolean;
  keyPrefix: string;       // Redis/cache key prefix
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetAt: Date;
}

// ============================================
// IN-MEMORY RATE LIMIT STORAGE (Fallback)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: LRUCache<RateLimitEntry>;

  constructor() {
    // Store up to 10,000 rate limit entries
    this.store = new LRUCache<RateLimitEntry>({
      maxSize: 10000,
      ttlMs: 60 * 60 * 1000, // 1 hour max TTL
    });
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const entry = this.store.get(key);

    // If no entry or window expired, create new
    if (!entry || now >= entry.resetAt) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, newEntry);

      return {
        limit: -1, // Will be set by caller
        current: 1,
        remaining: -1,
        resetAt: new Date(newEntry.resetAt),
      };
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);

    return {
      limit: -1,
      current: entry.count,
      remaining: -1,
      resetAt: new Date(entry.resetAt),
    };
  }

  async reset(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      this.store.set(key, { count: 0, resetAt: entry.resetAt });
    }
  }

  clear(): void {
    this.store.clear();
  }
}

// Global in-memory rate limiter instance
const inMemoryLimiter = new InMemoryRateLimiter();

// ============================================
// REDIS INTEGRATION
// ============================================

let redisClient: Redis | null = null;
let redisAvailable = false;

/**
 * Redis-based rate limiter for multi-instance deployments
 */
class RedisRateLimiter {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    // windowSec could be used for EXPIRE command, but we use pexpire with ms instead
    // const windowSec = Math.ceil(windowMs / 1000);

    try {
      // Use Redis MULTI for atomic increment + TTL
      const pipeline = this.client.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);
      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline returned null');
      }

      const [[incrErr, count], [ttlErr, ttl]] = results as [[Error | null, number], [Error | null, number]];

      if (incrErr) throw incrErr;
      if (ttlErr) throw ttlErr;

      // Set TTL if this is a new key (TTL returns -1 for no expiry, -2 for non-existent)
      if (ttl === -1 || ttl === -2) {
        await this.client.pexpire(key, windowMs);
      }

      const resetAt = ttl > 0 ? now + ttl : now + windowMs;

      return {
        limit: -1, // Will be set by caller
        current: count,
        remaining: -1,
        resetAt: new Date(resetAt),
      };
    } catch (error) {
      logger.error('Redis rate limit increment failed, falling back to in-memory', { error, key });
      // Fall back to in-memory on Redis error
      return inMemoryLimiter.increment(key, windowMs);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis rate limit reset failed', { error, key });
    }
  }
}

let redisLimiter: RedisRateLimiter | null = null;

/**
 * Initialize Redis connection if REDIS_URL is provided
 * Falls back to in-memory storage if Redis is unavailable
 */
export function initializeRedis(): void {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    redisAvailable = false;
    logger.info('Rate limiter using in-memory storage (REDIS_URL not set)');
    return;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 10000,
    });

    client.on('connect', () => {
      logger.info('Redis connected for rate limiting');
      redisAvailable = true;
    });

    client.on('error', (error: Error) => {
      logger.error('Redis connection error', { error: error.message });
      redisAvailable = false;
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
      redisAvailable = false;
    });

    // Store in module-level variable
    redisClient = client;

    // Attempt connection
    client.connect().then(() => {
      redisLimiter = new RedisRateLimiter(client);
      redisAvailable = true;
      logger.info('Rate limiter using Redis storage');
    }).catch((error: Error) => {
      logger.error('Failed to connect to Redis, using in-memory fallback', { error: error.message });
      redisAvailable = false;
    });
  } catch (error) {
    logger.error('Failed to initialize Redis client', { error });
    redisAvailable = false;
    logger.info('Rate limiter using in-memory storage (Redis initialization failed)');
  }
}

/**
 * Gracefully shutdown Redis connection
 */
export async function shutdownRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection', { error });
    }
  }
}

/**
 * Check if Redis is currently available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redisLimiter !== null;
}

/**
 * Increment rate limit counter
 * Uses Redis if available, falls back to in-memory
 */
async function incrementRateLimit(
  key: string,
  windowMs: number
): Promise<RateLimitInfo> {
  if (redisAvailable && redisLimiter) {
    return redisLimiter.increment(key, windowMs);
  }

  return inMemoryLimiter.increment(key, windowMs);
}

// ============================================
// RATE LIMIT CONFIGURATIONS
// ============================================

const RATE_LIMIT_CONFIGS = {
  // Document sync operations
  documentSync: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    skipInternalWorkspaces: true,
    keyPrefix: 'rl:doc-sync',
  } as RateLimitConfig,

  // General API requests
  generalApi: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    skipInternalWorkspaces: true,
    keyPrefix: 'rl:api',
  } as RateLimitConfig,

  // Query rate limiting (based on tier monthly limits)
  // This is handled specially in checkQueryRateLimit
} as const;

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Check if workspace is internal (bypasses rate limiting)
 */
async function isInternalWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('is_internal')
      .eq('id', workspaceId)
      .single();

    return data?.is_internal === true;
  } catch (error) {
    logger.error('Failed to check internal workspace status', { error, workspaceId });
    return false;
  }
}

/**
 * Add rate limit headers to response
 */
function setRateLimitHeaders(
  res: Response,
  info: RateLimitInfo
): void {
  res.setHeader('X-RateLimit-Limit', info.limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, info.remaining).toString());
  res.setHeader('X-RateLimit-Reset', info.resetAt.toISOString());
}

/**
 * Generic rate limiter for specific endpoints
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Require workspace context
      if (!req.workspace) {
        res.status(401).json({
          error: 'Workspace context required',
          code: 'NO_WORKSPACE_CONTEXT',
        });
        return;
      }

      const workspaceId = req.workspace.id;

      // Skip rate limiting for internal workspaces if configured
      if (config.skipInternalWorkspaces && await isInternalWorkspace(workspaceId)) {
        logger.debug('Skipping rate limit for internal workspace', { workspaceId });
        next();
        return;
      }

      // Generate rate limit key
      const key = `${config.keyPrefix}:${workspaceId}`;

      // Increment and check rate limit
      const info = await incrementRateLimit(key, config.windowMs);
      info.limit = config.maxRequests;
      info.remaining = info.limit - info.current;

      // Set headers
      setRateLimitHeaders(res, info);

      // Check if limit exceeded
      if (info.current > info.limit) {
        const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);

        logger.warn('Rate limit exceeded', {
          workspaceId,
          endpoint: req.path,
          limit: info.limit,
          current: info.current,
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          limit: info.limit,
          current: info.current,
          remaining: 0,
          resetAt: info.resetAt.toISOString(),
          retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limit check error', { error });
      // On error, allow request to proceed (fail open)
      next();
    }
  };
}

/**
 * Rate limiter for document sync operations
 * Limit: 10 requests per minute per workspace
 */
export const documentSyncRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.documentSync);

/**
 * Rate limiter for general API operations
 * Limit: 100 requests per minute per workspace
 */
export const generalApiRateLimiter = createRateLimiter(RATE_LIMIT_CONFIGS.generalApi);

/**
 * Query rate limiter - based on tier monthly limits
 * Checks against usage_tracking table for monthly query limits
 */
export async function checkQueryRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.workspace) {
      res.status(401).json({
        error: 'Workspace context required',
        code: 'NO_WORKSPACE_CONTEXT',
      });
      return;
    }

    const workspaceId = req.workspace.id;

    // Skip for internal workspaces
    if (await isInternalWorkspace(workspaceId)) {
      logger.debug('Skipping query rate limit for internal workspace', { workspaceId });
      next();
      return;
    }

    // Get current month's usage tracking
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_or_create_usage_tracking', {
        p_workspace_id: workspaceId,
      });

    if (usageError) {
      logger.error('Failed to get usage tracking', { error: usageError, workspaceId });
      // Fail open - allow request
      next();
      return;
    }

    const usage = usageData as {
      queries_count: number;
      queries_limit: number;
      period_end: string;
    };

    // Calculate remaining queries
    const remaining = Math.max(0, usage.queries_limit - usage.queries_count);
    const resetAt = new Date(usage.period_end);
    resetAt.setHours(23, 59, 59, 999); // End of period day

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', usage.queries_limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetAt.toISOString());

    // Check if limit exceeded
    if (usage.queries_count >= usage.queries_limit) {
      const daysUntilReset = Math.ceil(
        (resetAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      logger.warn('Monthly query limit exceeded', {
        workspaceId,
        tier: req.workspace.tier,
        limit: usage.queries_limit,
        current: usage.queries_count,
      });

      res.status(429).json({
        error: 'Monthly query limit exceeded',
        code: 'MONTHLY_LIMIT_EXCEEDED',
        limit: usage.queries_limit,
        current: usage.queries_count,
        remaining: 0,
        resetAt: resetAt.toISOString(),
        retryAfter: daysUntilReset * 24 * 60 * 60, // seconds until reset
        upgrade_url: '/billing',
      });
      return;
    }

    // Attach usage info to request for handlers
    req.usage = {
      queries_used: usage.queries_count,
      queries_limit: usage.queries_limit,
      documents_used: 0,
      documents_limit: 0,
    };

    next();
  } catch (error) {
    logger.error('Query rate limit check error', { error });
    // Fail open - allow request
    next();
  }
}

/**
 * Track query usage after successful operation
 * Should be called after RAG query completes successfully
 */
export async function trackQueryUsage(workspaceId: string): Promise<void> {
  try {
    // Increment query count in usage_tracking
    const { data: success, error } = await supabase.rpc('increment_query_count', {
      p_workspace_id: workspaceId,
    });

    if (error) {
      logger.error('Failed to track query usage', { error, workspaceId });
      return;
    }

    if (!success) {
      logger.warn('Query tracking returned false (limit may have been exceeded)', {
        workspaceId,
      });
    }

    logger.debug('Query usage tracked', { workspaceId });
  } catch (error) {
    logger.error('Query usage tracking error', { error, workspaceId });
    // Don't throw - tracking failure should not block operations
  }
}

/**
 * Check if workspace is a platform admin (bypasses all limits)
 */
export async function isPlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    const { data: adminRole } = await supabase
      .from('platform_admins')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    // Store admin status for use in rate limiting
    if (adminRole) {
      (req as Request & { isPlatformAdmin?: boolean }).isPlatformAdmin = true;
      logger.debug('Request from platform admin - bypassing rate limits', {
        userId: req.user.id,
      });
    }

    next();
  } catch (error) {
    logger.error('Platform admin check error', { error });
    next();
  }
}

/**
 * Skip rate limiting for platform admins
 */
export function skipRateLimitForAdmins(middleware: RequestHandler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if platform admin
    if ((req as Request & { isPlatformAdmin?: boolean }).isPlatformAdmin) {
      next();
      return;
    }

    // Otherwise, apply rate limiting
    middleware(req, res, next);
  };
}

/**
 * Clear all rate limit data (for testing/admin purposes)
 */
export function clearRateLimits(): void {
  inMemoryLimiter.clear();
  logger.info('Rate limit cache cleared');
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize rate limiter on module load
initializeRedis();
