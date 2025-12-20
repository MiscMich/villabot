/**
 * In-memory LRU cache for embeddings and responses
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

interface CacheConfig {
  maxSize: number;
  ttlMs: number;
}

class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hits and move to end (most recently used)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }
}

// Embedding cache: 500 entries, 1 hour TTL
export const embeddingCache = new LRUCache<number[]>({
  maxSize: 500,
  ttlMs: 60 * 60 * 1000, // 1 hour
});

// Response cache: 100 entries, 30 minute TTL
export const responseCache = new LRUCache<{
  content: string;
  sources: string[];
  confidence: number;
}>({
  maxSize: 100,
  ttlMs: 30 * 60 * 1000, // 30 minutes
});

// Search results cache: 200 entries, 15 minute TTL
export const searchCache = new LRUCache<Array<{
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
}>>({
  maxSize: 200,
  ttlMs: 15 * 60 * 1000, // 15 minutes
});

/**
 * Generate a cache key from a query
 * Includes workspace_id to prevent cross-tenant cache pollution
 */
export function generateCacheKey(query: string, botId?: string, workspaceId?: string): string {
  // Normalize query for better cache hits
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const parts = [workspaceId, botId, normalizedQuery].filter(Boolean);
  return parts.join(':');
}

export { LRUCache };
