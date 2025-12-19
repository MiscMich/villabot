/**
 * Hybrid search service
 * Combines vector similarity and keyword (BM25) search using Reciprocal Rank Fusion
 */

import { supabase } from '../supabase/client.js';
import { generateQueryEmbedding } from './embeddings.js';
import { logger } from '../../utils/logger.js';
import { RAG_CONFIG } from '@villa-paraiso/shared';

export interface SearchResult {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
  rankScore: number;
  sourceUrl?: string;
}

export interface SearchOptions {
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  minSimilarity?: number;
  includeLearnedFacts?: boolean;
}

/**
 * Perform hybrid search using both vector similarity and keyword matching
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = RAG_CONFIG.topK,
    vectorWeight = RAG_CONFIG.vectorWeight,
    keywordWeight = RAG_CONFIG.keywordWeight,
    minSimilarity = RAG_CONFIG.minSimilarity,
    includeLearnedFacts = true,
  } = options;

  logger.debug('Performing hybrid search', { query, topK });

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Call the hybrid_search database function
    const { data: chunks, error } = await supabase.rpc('hybrid_search', {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: topK,
      vector_weight: vectorWeight,
      keyword_weight: keywordWeight,
    });

    if (error) {
      logger.error('Hybrid search failed', { error });
      throw error;
    }

    // Fetch document metadata for results
    const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title, source_url')
      .in('id', documentIds);

    const docMap = new Map(documents?.map(d => [d.id, d]) ?? []);

    // Build results with document info
    let results: SearchResult[] = chunks
      .filter((chunk: any) => chunk.similarity >= minSimilarity)
      .map((chunk: any) => {
        const doc = docMap.get(chunk.document_id);
        return {
          id: chunk.id,
          content: chunk.content,
          documentId: chunk.document_id,
          documentTitle: doc?.title ?? 'Unknown',
          similarity: chunk.similarity,
          rankScore: chunk.rank_score,
          sourceUrl: doc?.source_url,
        };
      });

    // Include learned facts if enabled
    if (includeLearnedFacts) {
      const learnedResults = await searchLearnedFacts(queryEmbedding, Math.ceil(topK / 2));
      results = [...results, ...learnedResults].sort((a, b) => b.rankScore - a.rankScore).slice(0, topK);
    }

    logger.debug(`Found ${results.length} search results`);
    return results;
  } catch (error) {
    logger.error('Search failed', { error });
    throw error;
  }
}

/**
 * Search learned facts
 */
async function searchLearnedFacts(
  queryEmbedding: number[],
  limit: number
): Promise<SearchResult[]> {
  try {
    const { data: facts, error } = await supabase.rpc('match_learned_facts', {
      query_embedding: queryEmbedding,
      match_count: limit,
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
  topK: number = RAG_CONFIG.topK
): Promise<SearchResult[]> {
  logger.debug('Performing vector search', { query, topK });

  const queryEmbedding = await generateQueryEmbedding(query);

  const { data: chunks, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    logger.error('Vector search failed', { error });
    throw error;
  }

  const documentIds = [...new Set(chunks.map((c: any) => c.document_id))];
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, source_url')
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
 */
export async function getContextForQuery(
  query: string,
  maxChunks: number = RAG_CONFIG.topK
): Promise<string> {
  const results = await hybridSearch(query, { topK: maxChunks });

  if (results.length === 0) {
    return '';
  }

  // Format results as context
  const contextParts = results.map((result, index) => {
    return `[Source ${index + 1}: ${result.documentTitle}]\n${result.content}`;
  });

  return contextParts.join('\n\n---\n\n');
}
