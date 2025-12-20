/**
 * Embedding generation service
 * Uses Google Gemini text-embedding-004 model
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { EMBEDDING_CONFIG } from '@villa-paraiso/shared';
import { embeddingCache, generateCacheKey } from '../../utils/cache.js';
import { withTimeout, withRetry } from '../../utils/timeout.js';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_CONFIG.model });

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
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

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      // Process batch concurrently
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const result = await embeddingModel.embedContent(text);
          return result.embedding.values;
        })
      );

      embeddings.push(...batchResults);

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
          const result = await embeddingModel.embedContent(text);
          embeddings.push(result.embedding.values);
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
 * Uses task_type 'RETRIEVAL_QUERY' for better search performance
 * Includes caching, timeout, and retry logic
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
    // Use timeout and retry for resilience
    const embedding = await withRetry(
      async () => {
        return withTimeout(
          (async () => {
            const result = await embeddingModel.embedContent({
              content: { role: 'user', parts: [{ text: query }] },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              taskType: 'RETRIEVAL_QUERY' as any,
            });
            return result.embedding.values;
          })(),
          EMBEDDING_TIMEOUT_MS,
          'generateQueryEmbedding'
        );
      },
      { maxRetries: 2, initialDelayMs: 500 }
    );

    // Cache the result
    embeddingCache.set(cacheKey, embedding);
    logger.debug('Embedding generated and cached', { query: query.substring(0, 50) });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate query embedding', { error });
    throw error;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
