/**
 * Reranking utility for search results
 * Uses keyword matching, term frequency, and contextual scoring
 */

import { logger } from './logger.js';

export interface RerankableResult {
  id: string;
  content: string;
  documentTitle: string;
  similarity: number;
  rankScore: number;
  sourceUrl?: string;
}

/**
 * Result with additional rerank score added by rerankResults
 */
export type WithRerankScore<T> = T & { rerankScore: number };

/**
 * Rerank search results based on query relevance
 * Combines initial similarity with keyword matching and contextual scoring
 */
export function rerankResults<T extends RerankableResult>(
  results: T[],
  query: string,
  options: {
    topK?: number;
    similarityWeight?: number;
    keywordWeight?: number;
    titleWeight?: number;
  } = {}
): WithRerankScore<T>[] {
  const {
    topK = results.length,
    similarityWeight = 0.4,
    keywordWeight = 0.4,
    titleWeight = 0.2,
  } = options;

  if (results.length === 0) return [];

  const queryTerms = extractTerms(query);

  const scored: WithRerankScore<T>[] = results.map(result => {
    // 1. Keyword match score (how many query terms appear in content)
    const contentTerms = extractTerms(result.content);
    const keywordScore = calculateTermOverlap(queryTerms, contentTerms);

    // 2. Title match score (bonus for query terms in document title)
    const titleTerms = extractTerms(result.documentTitle);
    const titleScore = calculateTermOverlap(queryTerms, titleTerms);

    // 3. Position bonus (exact phrase matches score higher)
    const phraseScore = calculatePhraseScore(query, result.content);

    // 4. Combine scores
    const rerankScore =
      (result.similarity * similarityWeight) +
      ((keywordScore + phraseScore) * keywordWeight) +
      (titleScore * titleWeight);

    return {
      ...result,
      rerankScore,
    };
  });

  // Sort by rerank score and return top K
  scored.sort((a, b) => b.rerankScore - a.rerankScore);

  logger.debug('Reranked results', {
    originalTop: results[0]?.id,
    newTop: scored[0]?.id,
    queryTerms: Array.from(queryTerms).slice(0, 5),
  });

  return scored.slice(0, topK);
}

/**
 * Extract normalized terms from text
 */
function extractTerms(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'i', 'me', 'my',
    'what', 'how', 'when', 'where', 'why', 'which', 'who', 'whom',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Calculate term overlap score (Jaccard-like)
 */
function calculateTermOverlap(queryTerms: Set<string>, contentTerms: Set<string>): number {
  if (queryTerms.size === 0) return 0;

  let matchCount = 0;
  for (const term of queryTerms) {
    if (contentTerms.has(term)) {
      matchCount++;
    } else {
      // Partial match (prefix matching)
      for (const contentTerm of contentTerms) {
        if (contentTerm.startsWith(term) || term.startsWith(contentTerm)) {
          matchCount += 0.5;
          break;
        }
      }
    }
  }

  return matchCount / queryTerms.size;
}

/**
 * Calculate phrase match score (bonus for consecutive term matches)
 */
function calculatePhraseScore(query: string, content: string): number {
  const normalizedQuery = query.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const normalizedContent = content.toLowerCase();

  // Exact phrase match (huge bonus)
  if (normalizedContent.includes(normalizedQuery)) {
    return 0.5;
  }

  // Check for partial phrase matches (3+ consecutive words)
  const queryWords = normalizedQuery.split(/\s+/);
  if (queryWords.length >= 3) {
    for (let len = queryWords.length; len >= 3; len--) {
      for (let start = 0; start <= queryWords.length - len; start++) {
        const phrase = queryWords.slice(start, start + len).join(' ');
        if (normalizedContent.includes(phrase)) {
          return 0.3 * (len / queryWords.length);
        }
      }
    }
  }

  return 0;
}

/**
 * Filter results by minimum score threshold
 */
export function filterByScore<T extends RerankableResult>(
  results: T[],
  minScore: number
): T[] {
  return results.filter(r => r.rankScore >= minScore || r.similarity >= minScore);
}
