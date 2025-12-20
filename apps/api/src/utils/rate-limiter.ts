/**
 * In-memory rate limiter for Slack messages
 * Tracks requests per user with sliding window
 */

import { logger } from './logger.js';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a user is rate limited
   * Returns { allowed: boolean, remaining: number, resetIn: number }
   */
  check(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.limits.get(userId);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      // New window
      this.limits.set(userId, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetIn: this.config.windowMs,
      };
    }

    if (entry.count >= this.config.maxRequests) {
      const resetIn = this.config.windowMs - (now - entry.windowStart);
      logger.warn('Rate limit exceeded', { userId, count: entry.count, resetIn });
      return {
        allowed: false,
        remaining: 0,
        resetIn,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetIn: this.config.windowMs - (now - entry.windowStart),
    };
  }

  /**
   * Reset rate limit for a user
   */
  reset(userId: string): void {
    this.limits.delete(userId);
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [userId, entry] of this.limits.entries()) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.limits.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} entries`);
    }
  }

  /**
   * Stop the cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Default rate limiter: 5 messages per minute per user
export const messageRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 5,
});

// Stricter rate limiter for API endpoints: 30 requests per minute
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

export { RateLimiter };
