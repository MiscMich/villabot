/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when external services are down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, fail fast without calling
 * - HALF_OPEN: Testing if service recovered
 */

import { logger } from './logger.js';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;                      // Service name for logging
  failureThreshold: number;          // Failures before opening (default: 5)
  resetTimeoutMs: number;            // Time in OPEN state before trying (default: 30s)
  successThreshold: number;          // Successes in HALF_OPEN to close (default: 2)
  halfOpenMaxAttempts: number;       // Max concurrent requests in HALF_OPEN (default: 1)
  monitorWindowMs: number;           // Window for counting failures (default: 60s)
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreakerError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly state: CircuitState,
    public readonly resetAt?: Date
  ) {
    const resetMsg = resetAt ? ` (retry after ${resetAt.toISOString()})` : '';
    super(`Circuit breaker OPEN for ${serviceName}${resetMsg}`);
    this.name = 'CircuitBreakerError';
  }
}

interface FailureRecord {
  timestamp: number;
  error: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      name: config.name,
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      successThreshold: config.successThreshold ?? 2,
      halfOpenMaxAttempts: config.halfOpenMaxAttempts ?? 1,
      monitorWindowMs: config.monitorWindowMs ?? 60000,
      onStateChange: config.onStateChange ?? (() => {}),
    };
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Clean old failures outside monitor window
    this.cleanOldFailures();

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        const resetAt = new Date(this.lastFailureTime + this.config.resetTimeoutMs);
        throw new CircuitBreakerError(this.config.name, this.state, resetAt);
      }
    }

    // Check half-open attempt limit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        const resetAt = new Date(this.lastFailureTime + this.config.resetTimeoutMs);
        throw new CircuitBreakerError(this.config.name, CircuitState.OPEN, resetAt);
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      this.halfOpenAttempts--;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = [];
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.failures.push({
      timestamp: this.lastFailureTime,
      error: error.message,
    });

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.halfOpenAttempts--;
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold exceeded
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }

    logger.warn('Circuit breaker recorded failure', {
      service: this.config.name,
      state: this.state,
      failureCount: this.failures.length,
      threshold: this.config.failureThreshold,
      error: error.message,
    });
  }

  /**
   * Clean failures outside the monitor window
   */
  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitorWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Check if we should attempt to reset (transition to HALF_OPEN)
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failures = [];
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }

    logger.info('Circuit breaker state change', {
      service: this.config.name,
      from: oldState,
      to: newState,
    });

    this.config.onStateChange(oldState, newState);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit health metrics
   */
  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime || null,
    };
  }

  /**
   * Force circuit to close (for admin/testing purposes)
   */
  forceClose(): void {
    logger.warn('Circuit breaker force closed', { service: this.config.name });
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Force circuit to open (for admin/testing purposes)
   */
  forceOpen(): void {
    logger.warn('Circuit breaker force opened', { service: this.config.name });
    this.lastFailureTime = Date.now();
    this.transitionTo(CircuitState.OPEN);
  }
}

// ============================================
// PRE-CONFIGURED CIRCUIT BREAKERS FOR SERVICES
// ============================================

/**
 * Circuit breaker for OpenAI API
 * More lenient since it's critical for core functionality
 */
export const openaiCircuitBreaker = new CircuitBreaker({
  name: 'openai',
  failureThreshold: 5,           // 5 failures to open
  resetTimeoutMs: 30000,         // Wait 30s before retry
  successThreshold: 2,           // 2 successes to close
  halfOpenMaxAttempts: 1,        // 1 test request at a time
  monitorWindowMs: 60000,        // 1 minute window
  onStateChange: (from, to) => {
    if (to === CircuitState.OPEN) {
      logger.error('OpenAI circuit breaker OPENED - API appears down', { from, to });
    } else if (to === CircuitState.CLOSED) {
      logger.info('OpenAI circuit breaker CLOSED - API recovered', { from, to });
    }
  },
});

/**
 * Circuit breaker for Slack API
 * Per-workspace, more aggressive since we have multiple bots
 */
export function createSlackCircuitBreaker(botId: string): CircuitBreaker {
  return new CircuitBreaker({
    name: `slack:${botId}`,
    failureThreshold: 3,           // 3 failures to open (faster response)
    resetTimeoutMs: 60000,         // Wait 1 minute before retry
    successThreshold: 1,           // 1 success to close
    halfOpenMaxAttempts: 1,        // 1 test request at a time
    monitorWindowMs: 30000,        // 30 second window
    onStateChange: (from, to) => {
      if (to === CircuitState.OPEN) {
        logger.error('Slack circuit breaker OPENED', { botId, from, to });
      }
    },
  });
}

/**
 * Circuit breaker for Google Drive API
 */
export const googleDriveCircuitBreaker = new CircuitBreaker({
  name: 'google-drive',
  failureThreshold: 5,
  resetTimeoutMs: 60000,         // Wait 1 minute
  successThreshold: 2,
  halfOpenMaxAttempts: 1,
  monitorWindowMs: 120000,       // 2 minute window (sync operations are slower)
  onStateChange: (from, to) => {
    if (to === CircuitState.OPEN) {
      logger.error('Google Drive circuit breaker OPENED', { from, to });
    }
  },
});

/**
 * Wrap an async operation with circuit breaker
 * Convenience function for one-off usage
 */
export async function withCircuitBreaker<T>(
  circuitBreaker: CircuitBreaker,
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T> {
  try {
    return await circuitBreaker.execute(operation);
  } catch (error) {
    if (error instanceof CircuitBreakerError && fallback) {
      logger.warn('Circuit breaker triggered fallback', {
        service: error.serviceName,
        state: error.state,
      });
      return fallback();
    }
    throw error;
  }
}

/**
 * Get health status of all circuit breakers
 */
export function getCircuitBreakerHealth(): Record<string, {
  state: CircuitState;
  failureCount: number;
  healthy: boolean;
}> {
  return {
    openai: {
      ...openaiCircuitBreaker.getMetrics(),
      healthy: openaiCircuitBreaker.getState() === CircuitState.CLOSED,
    },
    googleDrive: {
      ...googleDriveCircuitBreaker.getMetrics(),
      healthy: googleDriveCircuitBreaker.getState() === CircuitState.CLOSED,
    },
  };
}
