/**
 * Unit tests for reranking utility
 */

import { describe, it, expect, vi } from 'vitest';
import { rerankResults, filterByScore, type RerankableResult } from './rerank.js';

// Mock the logger to avoid console output during tests
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockResult = (
  id: string,
  content: string,
  title: string,
  similarity: number
): RerankableResult => ({
  id,
  content,
  documentTitle: title,
  similarity,
  rankScore: similarity,
});

describe('rerankResults', () => {
  it('should return empty array for empty input', () => {
    const result = rerankResults([], 'test query');
    expect(result).toEqual([]);
  });

  it('should return single result unchanged in order', () => {
    const results = [createMockResult('1', 'test content', 'Test Doc', 0.8)];
    const reranked = rerankResults(results, 'test');

    expect(reranked.length).toBe(1);
    expect(reranked[0]?.id).toBe('1');
  });

  it('should boost results with query terms in content', () => {
    const results = [
      createMockResult('1', 'unrelated content here', 'Doc A', 0.8),
      createMockResult('2', 'guest complaint handling procedure', 'Doc B', 0.7),
    ];

    const reranked = rerankResults(results, 'guest complaint');

    // Result with matching terms should be ranked higher
    expect(reranked[0]?.id).toBe('2');
  });

  it('should boost results with query terms in title', () => {
    const results = [
      createMockResult('1', 'some content', 'Unrelated Title', 0.8),
      createMockResult('2', 'some content', 'Guest Complaint Policy', 0.7),
    ];

    const reranked = rerankResults(results, 'guest complaint');

    // Result with matching title should be ranked higher
    expect(reranked[0]?.id).toBe('2');
  });

  it('should handle exact phrase matches with bonus', () => {
    const results = [
      createMockResult('1', 'complaint from guest about cleaning', 'Doc A', 0.8),
      createMockResult('2', 'the guest complaint was resolved quickly', 'Doc B', 0.7),
    ];

    const reranked = rerankResults(results, 'guest complaint');

    // Exact phrase match should get bonus
    expect(reranked[0]?.id).toBe('2');
  });

  it('should respect topK parameter', () => {
    const results = [
      createMockResult('1', 'content one', 'Doc A', 0.8),
      createMockResult('2', 'content two', 'Doc B', 0.7),
      createMockResult('3', 'content three', 'Doc C', 0.6),
      createMockResult('4', 'content four', 'Doc D', 0.5),
    ];

    const reranked = rerankResults(results, 'content', { topK: 2 });

    expect(reranked.length).toBe(2);
  });

  it('should handle custom weights', () => {
    const results = [
      createMockResult('1', 'pool maintenance', 'Random Title', 0.5),
      createMockResult('2', 'unrelated content', 'Pool Cleaning', 0.9),
    ];

    // High title weight should boost result with pool in title
    const reranked = rerankResults(results, 'pool', {
      similarityWeight: 0.2,
      keywordWeight: 0.2,
      titleWeight: 0.6,
    });

    expect(reranked[0]?.id).toBe('2');
  });

  it('should preserve result properties', () => {
    const original = {
      id: '1',
      content: 'test content',
      documentTitle: 'Test',
      similarity: 0.8,
      rankScore: 0.8,
      sourceUrl: 'https://example.com',
    };

    const reranked = rerankResults([original], 'test');

    expect(reranked[0]).toHaveProperty('id', '1');
    expect(reranked[0]).toHaveProperty('content', 'test content');
    expect(reranked[0]).toHaveProperty('documentTitle', 'Test');
    expect(reranked[0]).toHaveProperty('sourceUrl', 'https://example.com');
  });

  it('should handle partial word matches', () => {
    const results = [
      createMockResult('1', 'cleaning procedures', 'Doc A', 0.7),
      createMockResult('2', 'clean the room thoroughly', 'Doc B', 0.7),
    ];

    // Both should match "clean" query through partial matching
    const reranked = rerankResults(results, 'clean');

    expect(reranked.length).toBe(2);
    // Both have similar base similarity, partial matching should apply
  });

  it('should filter stop words from query', () => {
    const results = [
      createMockResult('1', 'the pool is clean', 'Doc A', 0.7),
      createMockResult('2', 'pool maintenance guide', 'Doc B', 0.7),
    ];

    // "the" should be filtered, "pool" should match
    const reranked = rerankResults(results, 'the pool');

    expect(reranked.length).toBe(2);
  });
});

describe('filterByScore', () => {
  it('should filter results below minimum score', () => {
    const results = [
      createMockResult('1', 'content', 'Doc A', 0.8),
      createMockResult('2', 'content', 'Doc B', 0.5),
      createMockResult('3', 'content', 'Doc C', 0.3),
    ];

    const filtered = filterByScore(results, 0.6);

    expect(filtered.length).toBe(1);
    expect(filtered[0]?.id).toBe('1');
  });

  it('should return all results if all pass threshold', () => {
    const results = [
      createMockResult('1', 'content', 'Doc A', 0.9),
      createMockResult('2', 'content', 'Doc B', 0.8),
    ];

    const filtered = filterByScore(results, 0.5);

    expect(filtered.length).toBe(2);
  });

  it('should return empty array if none pass threshold', () => {
    const results = [
      createMockResult('1', 'content', 'Doc A', 0.3),
      createMockResult('2', 'content', 'Doc B', 0.2),
    ];

    const filtered = filterByScore(results, 0.9);

    expect(filtered.length).toBe(0);
  });

  it('should include results at exactly the threshold', () => {
    const results = [createMockResult('1', 'content', 'Doc A', 0.5)];

    const filtered = filterByScore(results, 0.5);

    expect(filtered.length).toBe(1);
  });

  it('should handle results with different rankScore vs similarity', () => {
    const result = {
      id: '1',
      content: 'content',
      documentTitle: 'Doc',
      similarity: 0.3,
      rankScore: 0.8, // High rank score but low similarity
    };

    // Should pass because rankScore >= minScore
    const filtered = filterByScore([result], 0.5);
    expect(filtered.length).toBe(1);
  });
});
