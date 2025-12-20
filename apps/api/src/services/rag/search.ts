/**
 * Hybrid search service
 * Combines vector similarity and keyword (BM25) search using Reciprocal Rank Fusion
 */

import { supabase } from '../supabase/client.js';
import { generateQueryEmbedding } from './embeddings.js';
import { logger } from '../../utils/logger.js';
import { RAG_CONFIG } from '@villa-paraiso/shared';
import type { DocumentCategory } from '@villa-paraiso/shared';
import { searchCache, generateCacheKey } from '../../utils/cache.js';
import { withTimeout } from '../../utils/timeout.js';
import { errorTracker } from '../../utils/error-tracker.js';
import { rerankResults } from '../../utils/rerank.js';
import { expandQuery } from '../../utils/query-expansion.js';

// Search timeout (15 seconds)
const SEARCH_TIMEOUT_MS = 15000;

export interface SearchResult {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
  rankScore: number;
  sourceUrl?: string;
  category?: DocumentCategory;  // For source attribution
}

export interface SearchOptions {
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  minSimilarity?: number;
  includeLearnedFacts?: boolean;
  enableReranking?: boolean;
  enableQueryExpansion?: boolean;
  // Multi-tenant + multi-bot filtering
  workspaceId: string;  // Required for tenant isolation
  botId?: string;
  includeShared?: boolean;
}

/**
 * Perform hybrid search using both vector similarity and keyword matching
 * Includes caching, timeout, and fallback to vector-only search
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    workspaceId,
    topK = RAG_CONFIG.topK,
    vectorWeight = RAG_CONFIG.vectorWeight,
    keywordWeight = RAG_CONFIG.keywordWeight,
    minSimilarity = RAG_CONFIG.minSimilarity,
    includeLearnedFacts = true,
    enableReranking = true, // Enable reranking by default
    enableQueryExpansion = true, // Enable query expansion by default
    botId = undefined,
    includeShared = true,
  } = options;

  // Check cache first (include workspaceId + botId in cache key for tenant isolation)
  const cacheKey = generateCacheKey(`hybrid:${query}:${topK}:${botId ?? 'all'}`, botId, workspaceId);
  const cached = searchCache.get(cacheKey);
  if (cached) {
    logger.debug('Search cache hit', { query: query.substring(0, 50) });
    // Reconstruct full SearchResult from cached data
    return cached.map(c => ({
      ...c,
      documentId: '',
      rankScore: c.similarity,
    }));
  }

  // Expand query with synonyms if enabled
  const searchQuery = enableQueryExpansion ? expandQuery(query) : query;
  if (enableQueryExpansion && searchQuery !== query) {
    logger.debug('Query expanded', { original: query, expanded: searchQuery });
  }

  logger.debug('Performing hybrid search', { query: searchQuery, topK });

  try {
    // Generate query embedding with timeout (use original query for embedding)
    const queryEmbedding = await withTimeout(
      generateQueryEmbedding(query),
      SEARCH_TIMEOUT_MS,
      'generateQueryEmbedding'
    );

    // Call the hybrid_search database function with timeout
    // Use expanded query for text search, original embedding for vector search
    const rpcParams: Record<string, unknown> = {
      query_text: searchQuery, // Expanded query for BM25 keyword matching
      query_embedding: queryEmbedding,
      match_count: topK,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
      p_workspace_id: workspaceId,  // Required for tenant isolation
    };

    // Add bot filtering parameters if provided
    if (botId) {
      rpcParams.p_bot_id = botId;
      rpcParams.include_shared = includeShared;
    }

    const rpcResult = await withTimeout(
      (async () => {
        return supabase.rpc('hybrid_search', rpcParams);
      })(),
      SEARCH_TIMEOUT_MS,
      'hybridSearch'
    );

    const { data: chunks, error } = rpcResult;

    if (error) {
      logger.error('Hybrid search failed, falling back to vector search', { error });
      // Fallback to vector-only search
      return await vectorSearchFallback(query, queryEmbedding, topK, minSimilarity, workspaceId);
    }

    // Fetch document metadata for results (source_url not returned by new function)
    const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
    const { data: documents } = await supabase
      .from('documents')
      .select('id, source_url')
      .in('id', documentIds);

    const docMap = new Map(documents?.map(d => [d.id, d]) ?? []);

    // Build results with document info
    // The new hybrid_search function returns category and source_title directly
    let results: SearchResult[] = chunks
      .filter((chunk: any) => chunk.similarity >= minSimilarity)
      .map((chunk: any) => {
        const doc = docMap.get(chunk.document_id);
        return {
          id: chunk.id,
          content: chunk.content,
          documentId: chunk.document_id,
          documentTitle: chunk.source_title ?? 'Unknown',
          similarity: chunk.similarity,
          rankScore: chunk.rank_score,
          sourceUrl: doc?.source_url,
          category: chunk.category as DocumentCategory | undefined,
        };
      });

    // Include learned facts if enabled
    if (includeLearnedFacts) {
      const learnedResults = await searchLearnedFacts(queryEmbedding, Math.ceil(topK / 2), workspaceId);
      results = [...results, ...learnedResults].sort((a, b) => b.rankScore - a.rankScore).slice(0, topK);
    }

    // Apply reranking if enabled
    if (enableReranking && results.length > 1) {
      results = rerankResults(results, query, { topK });
      logger.debug('Applied reranking to results');
    }

    // Cache successful results
    searchCache.set(cacheKey, results.map(r => ({
      id: r.id,
      content: r.content,
      documentTitle: r.documentTitle,
      similarity: r.similarity,
    })));

    logger.debug(`Found ${results.length} search results`);
    return results;
  } catch (error) {
    const err = error as Error;
    logger.error('Search failed', { error: err.message });

    // Track the error
    await errorTracker.track(err, 'rag', 'high', { query, operation: 'hybridSearch' });

    // Try vector-only search as fallback
    try {
      logger.info('Attempting vector-only search fallback');
      const queryEmbedding = await generateQueryEmbedding(query);
      return await vectorSearchFallback(query, queryEmbedding, topK, minSimilarity, workspaceId);
    } catch (fallbackError) {
      logger.error('Vector search fallback also failed', { error: fallbackError });
      // Return empty results rather than crashing
      return [];
    }
  }
}

/**
 * Vector-only search fallback when hybrid search fails
 */
async function vectorSearchFallback(
  query: string,
  queryEmbedding: number[],
  topK: number,
  minSimilarity: number,
  workspaceId: string
): Promise<SearchResult[]> {
  logger.debug('Performing vector search fallback', { query, topK, workspaceId });

  const { data: chunks, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: topK,
    p_workspace_id: workspaceId,
  });

  if (error) {
    logger.error('Vector search fallback failed', { error });
    throw error;
  }

  const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, source_url')
    .eq('workspace_id', workspaceId)
    .in('id', documentIds);

  const docMap = new Map(documents?.map(d => [d.id, d]) ?? []);

  return chunks
    .filter((chunk: any) => chunk.similarity >= minSimilarity)
    .map((chunk: any) => {
      const doc = docMap.get(chunk.document_id);
      return {
        id: chunk.id,
        content: chunk.content,
        documentId: chunk.document_id,
        documentTitle: doc?.title ?? 'Unknown',
        similarity: chunk.similarity,
        rankScore: chunk.similarity,
        sourceUrl: doc?.source_url,
      };
    });
}

/**
 * Search learned facts
 */
async function searchLearnedFacts(
  queryEmbedding: number[],
  limit: number,
  workspaceId: string
): Promise<SearchResult[]> {
  try {
    const { data: facts, error } = await supabase.rpc('match_learned_facts', {
      query_embedding: queryEmbedding,
      match_count: limit,
      p_workspace_id: workspaceId,
    });

    if (error) {
      // Function might not exist yet, silently fail
      logger.debug('Learned facts search not available', { error });
      return [];
    }

    return (facts ?? []).map((fact: any) => ({
      id: fact.id,
      content: fact.fact,
      documentId: 'learned',
      documentTitle: 'Learned from User',
      similarity: fact.similarity,
      rankScore: fact.similarity * 0.8, // Slightly lower weight for learned facts
      sourceUrl: undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Perform vector-only search (fallback)
 */
export async function vectorSearch(
  query: string,
  workspaceId: string,
  topK: number = RAG_CONFIG.topK
): Promise<SearchResult[]> {
  logger.debug('Performing vector search', { query, topK, workspaceId });

  const queryEmbedding = await generateQueryEmbedding(query);

  const { data: chunks, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: topK,
    p_workspace_id: workspaceId,
  });

  if (error) {
    logger.error('Vector search failed', { error });
    throw error;
  }

  const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, source_url')
    .eq('workspace_id', workspaceId)
    .in('id', documentIds);

  const docMap = new Map(documents?.map(d => [d.id, d]) ?? []);

  return chunks.map((chunk: any) => {
    const doc = docMap.get(chunk.document_id);
    return {
      id: chunk.id,
      content: chunk.content,
      documentId: chunk.document_id,
      documentTitle: doc?.title ?? 'Unknown',
      similarity: chunk.similarity,
      rankScore: chunk.similarity,
      sourceUrl: doc?.source_url,
    };
  });
}

/**
 * Get context for a query (formatted for LLM)
 * Supports bot-specific filtering and category attribution
 */
export async function getContextForQuery(
  query: string,
  workspaceId: string,
  maxChunks: number = RAG_CONFIG.topK,
  options: { botId?: string; includeShared?: boolean } = {}
): Promise<string> {
  const results = await hybridSearch(query, {
    workspaceId,
    topK: maxChunks,
    botId: options.botId,
    includeShared: options.includeShared ?? true,
  });

  if (results.length === 0) {
    return '';
  }

  // Format results as context with category attribution
  const contextParts = results.map((result, index) => {
    const categoryLabel = getCategoryLabel(result.category);
    return `[Source ${index + 1}: ${result.documentTitle}${categoryLabel}]\n${result.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}

/**
 * Get human-readable label for document category
 */
function getCategoryLabel(category?: DocumentCategory): string {
  if (!category) return '';

  const labels: Record<DocumentCategory, string> = {
    shared: ' (Company Knowledge)',
    operations: ' (Operations)',
    marketing: ' (Marketing)',
    sales: ' (Sales)',
    hr: ' (HR)',
    technical: ' (Technical)',
    custom: '',
  };

  return labels[category] ?? '';
}
