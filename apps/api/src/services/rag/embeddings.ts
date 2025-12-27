/**
 * Embedding generation service
 * Uses OpenAI text-embedding-3-small model
 */

import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { EMBEDDING_CONFIG } from '@cluebase/shared';
import { embeddingCache, generateCacheKey } from '../../utils/cache.js';
import { withTimeout, withRetry } from '../../utils/timeout.js';
import { openaiCircuitBreaker, CircuitBreakerError } from '../../utils/circuit-breaker.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Generate embedding for a single text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_CONFIG.model,
      input: text,
      dimensions: EMBEDDING_CONFIG.dimensions,
    });
    return response.data[0]?.embedding ?? [];
  } catch (error) {
    logger.error('Failed to generate embedding', { error, textLength: text.length });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts with batching
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings: number[][] = [];
  const batchSize = EMBEDDING_CONFIG.batchSize;

  logger.debug(`Generating embeddings for ${texts.length} texts`);

  // Process in batches (OpenAI supports multiple inputs in one request)
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_CONFIG.model,
        input: batch,
        dimensions: EMBEDDING_CONFIG.dimensions,
      });

      // Extract embeddings in order
      const batchEmbeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);

      embeddings.push(...batchEmbeddings);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await sleep(100);
      }
    } catch (error) {
      logger.error('Failed to generate batch embeddings', {
        error,
        batchStart: i,
        batchSize: batch.length,
      });

      // Retry individual items on batch failure
      for (const text of batch) {
        try {
          const response = await openai.embeddings.create({
            model: EMBEDDING_CONFIG.model,
            input: text,
            dimensions: EMBEDDING_CONFIG.dimensions,
          });
          embeddings.push(response.data[0]?.embedding ?? []);
        } catch (retryError) {
          logger.error('Failed to generate embedding after retry', { retryError });
          // Push zero vector as fallback
          embeddings.push(new Array(EMBEDDING_CONFIG.dimensions).fill(0));
        }
      }
    }
  }

  logger.debug(`Generated ${embeddings.length} embeddings`);
  return embeddings;
}

// Embedding generation timeout (10 seconds)
const EMBEDDING_TIMEOUT_MS = 10000;

/**
 * Generate embedding for a search query
 * Includes caching, timeout, retry, and circuit breaker for resilience
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = generateCacheKey(query);

  // Check cache first
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    logger.debug('Embedding cache hit', { query: query.substring(0, 50) });
    return cached;
  }

  try {
    // Use circuit breaker + timeout + retry for resilience
    const embedding = await openaiCircuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          return withTimeout(
            (async () => {
              const response = await openai.embeddings.create({
                model: EMBEDDING_CONFIG.model,
                input: query,
                dimensions: EMBEDDING_CONFIG.dimensions,
              });
              return response.data[0]?.embedding ?? [];
            })(),
            EMBEDDING_TIMEOUT_MS,
            'generateQueryEmbedding'
          );
        },
        { maxRetries: 2, initialDelayMs: 500 }
      );
    });

    // Cache the result
    embeddingCache.set(cacheKey, embedding);
    logger.debug('Embedding generated and cached', { query: query.substring(0, 50) });

    return embedding;
  } catch (error) {
    // Provide clearer error message for circuit breaker failures
    if (error instanceof CircuitBreakerError) {
      logger.error('OpenAI circuit breaker open - embedding generation blocked', {
        query: query.substring(0, 50),
        resetAt: error.resetAt?.toISOString(),
      });
    } else {
      logger.error('Failed to generate query embedding', { error });
    }
    throw error;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
