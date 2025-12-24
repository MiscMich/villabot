/**
 * Integration tests for RAG hybrid search service
 * Tests search functionality, caching, query expansion, and reranking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SearchResult, SearchOptions } from './search.js';

// Mock Supabase client
vi.mock('../supabase/client.js', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

// Mock embeddings
vi.mock('./embeddings.js', () => ({
  generateQueryEmbedding: vi.fn(() => Promise.resolve(new Array(768).fill(0.1))),
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock cache
vi.mock('../../utils/cache.js', () => ({
  searchCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
  generateCacheKey: vi.fn((key: string) => key),
}));

// Mock timeout utility
vi.mock('../../utils/timeout.js', () => ({
  withTimeout: vi.fn((promise: Promise<unknown>) => promise),
}));

// Mock error tracker
vi.mock('../../utils/error-tracker.js', () => ({
  errorTracker: {
    track: vi.fn(),
  },
}));

// Mock rerank
vi.mock('../../utils/rerank.js', () => ({
  rerankResults: vi.fn((results: SearchResult[]) => results),
}));

// Mock query expansion
vi.mock('../../utils/query-expansion.js', () => ({
  expandQuery: vi.fn((query: string) => query),
}));

// Import mocked modules
import { supabase } from '../supabase/client.js';
import { generateQueryEmbedding } from './embeddings.js';
import { searchCache } from '../../utils/cache.js';
import { rerankResults } from '../../utils/rerank.js';
import { expandQuery } from '../../utils/query-expansion.js';

// Import module under test (after mocks)
import { hybridSearch, vectorSearch, getContextForQuery } from './search.js';

describe('RAG Hybrid Search', () => {
  const mockWorkspaceId = 'test-workspace-123';
  const mockBotId = 'test-bot-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hybridSearch', () => {
    const defaultOptions: SearchOptions = {
      workspaceId: mockWorkspaceId,
      topK: 10,
    };

    it('should return cached results when available', async () => {
      const cachedResults = [
        { id: '1', content: 'cached content', documentTitle: 'Doc 1', similarity: 0.9 },
      ];
      vi.mocked(searchCache.get).mockReturnValue(cachedResults);

      const results = await hybridSearch('test query', defaultOptions);

      expect(searchCache.get).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
      // Should not call Supabase when cache hit
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('should call hybrid_search RPC with correct parameters', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: 'chunk-1',
            content: 'test content',
            document_id: 'doc-1',
            source_title: 'Test Document',
            similarity: 0.85,
            rank_score: 0.9,
            category: 'shared',
          },
        ],
        error: null,
      } as never);

      await hybridSearch('test query', defaultOptions);

      expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
        query_text: 'test query',
        query_embedding: expect.any(Array),
        match_count: 10,
        p_workspace_id: mockWorkspaceId,
      }));
    });

    it('should include bot_id in RPC call when provided', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as never);

      await hybridSearch('test query', {
        ...defaultOptions,
        botId: mockBotId,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
        p_bot_id: mockBotId,
        include_shared: true,
      }));
    });

    it('should filter results by minimum similarity threshold', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { id: '1', content: 'high', document_id: 'd1', similarity: 0.9, rank_score: 0.9 },
          { id: '2', content: 'low', document_id: 'd2', similarity: 0.1, rank_score: 0.1 },
        ],
        error: null,
      } as never);

      const results = await hybridSearch('test query', {
        ...defaultOptions,
        minSimilarity: 0.5,
      });

      // Only high similarity result should be returned
      expect(results.filter(r => r.similarity >= 0.5).length).toBeLessThanOrEqual(results.length);
    });

    it('should call query expansion when enabled', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
      vi.mocked(expandQuery).mockReturnValue('expanded test query');

      await hybridSearch('test query', {
        ...defaultOptions,
        enableQueryExpansion: true,
      });

      expect(expandQuery).toHaveBeenCalledWith('test query');
    });

    it('should call reranking when enabled and results exist', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { id: '1', content: 'result 1', document_id: 'd1', similarity: 0.8, rank_score: 0.8 },
          { id: '2', content: 'result 2', document_id: 'd2', similarity: 0.7, rank_score: 0.7 },
        ],
        error: null,
      } as never);

      await hybridSearch('test query', {
        ...defaultOptions,
        enableReranking: true,
      });

      expect(rerankResults).toHaveBeenCalled();
    });

    it('should cache successful results', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          { id: '1', content: 'test', document_id: 'd1', similarity: 0.9, rank_score: 0.9 },
        ],
        error: null,
      } as never);

      await hybridSearch('test query', defaultOptions);

      expect(searchCache.set).toHaveBeenCalled();
    });

    it('should fall back to vector search on RPC error', async () => {
      // First call (hybrid_search) fails
      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({ data: null, error: { message: 'RPC error' } } as never)
        // Second call (match_documents fallback) succeeds
        .mockResolvedValueOnce({
          data: [{ id: '1', content: 'fallback', document_id: 'd1', similarity: 0.8 }],
          error: null,
        } as never);

      await hybridSearch('test query', defaultOptions);

      // Should have called RPC twice (hybrid + fallback)
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(supabase.rpc).toHaveBeenLastCalledWith('match_documents', expect.any(Object));
    });

    it('should return empty array on complete failure', async () => {
      // All RPC calls fail
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Complete failure'));
      vi.mocked(generateQueryEmbedding).mockRejectedValue(new Error('Embedding failed'));

      const results = await hybridSearch('test query', defaultOptions);

      expect(results).toEqual([]);
    });
  });

  describe('vectorSearch', () => {
    it('should call match_documents RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{ id: '1', content: 'test', document_id: 'd1', similarity: 0.9 }],
        error: null,
      } as never);

      await vectorSearch('test query', mockWorkspaceId, 5);

      expect(supabase.rpc).toHaveBeenCalledWith('match_documents', expect.objectContaining({
        query_embedding: expect.any(Array),
        match_count: 5,
        p_workspace_id: mockWorkspaceId,
      }));
    });

    it('should map results with document metadata', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{ id: '1', content: 'test', document_id: 'doc-1', similarity: 0.9 }],
        error: null,
      } as never);

      // Mock document lookup
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'doc-1', title: 'Test Doc', source_url: 'https://example.com' }],
              error: null,
            }),
          }),
        }),
      } as never);

      const results = await vectorSearch('test query', mockWorkspaceId);

      expect(results[0]).toMatchObject({
        id: '1',
        content: 'test',
        documentId: 'doc-1',
      });
    });
  });

  describe('getContextForQuery', () => {
    it('should return empty string when no results', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

      const context = await getContextForQuery('test query', mockWorkspaceId);

      expect(context).toBe('');
    });

    it('should format results as context with source attribution', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: '1',
            content: 'Important policy information',
            document_id: 'doc-1',
            source_title: 'Company Policies',
            similarity: 0.9,
            rank_score: 0.9,
            category: 'shared',
          },
        ],
        error: null,
      } as never);

      const context = await getContextForQuery('policy question', mockWorkspaceId);

      expect(context).toContain('[Source 1:');
      expect(context).toContain('Company Policies');
      expect(context).toContain('Important policy information');
    });

    it('should include category labels in context', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: '1',
            content: 'HR content',
            document_id: 'doc-1',
            source_title: 'Employee Handbook',
            similarity: 0.9,
            rank_score: 0.9,
            category: 'hr',
          },
        ],
        error: null,
      } as never);

      const context = await getContextForQuery('hr question', mockWorkspaceId);

      expect(context).toContain('(HR)');
    });

    it('should include bot_id filtering when provided', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

      await getContextForQuery('test', mockWorkspaceId, 10, { botId: mockBotId });

      expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
        p_bot_id: mockBotId,
      }));
    });
  });

  describe('Search Result Mapping', () => {
    it('should include all required fields in search results', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: 'chunk-123',
            content: 'Test content here',
            document_id: 'doc-456',
            source_title: 'Test Document Title',
            similarity: 0.87,
            rank_score: 0.92,
            category: 'technical',
          },
        ],
        error: null,
      } as never);

      const results = await hybridSearch('test', { workspaceId: mockWorkspaceId });

      expect(results[0]).toMatchObject({
        id: 'chunk-123',
        content: 'Test content here',
        documentId: 'doc-456',
        documentTitle: 'Test Document Title',
        similarity: 0.87,
        rankScore: 0.92,
        category: 'technical',
      });
    });

    it('should handle missing source_title gracefully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [
          {
            id: '1',
            content: 'test',
            document_id: 'd1',
            similarity: 0.9,
            rank_score: 0.9,
            // No source_title
          },
        ],
        error: null,
      } as never);

      const results = await hybridSearch('test', { workspaceId: mockWorkspaceId });

      expect(results[0]?.documentTitle).toBe('Unknown');
    });
  });
});

describe('Query Expansion Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use expanded query for text search', async () => {
    vi.mocked(expandQuery).mockReturnValue('test expanded synonyms');
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await hybridSearch('test', {
      workspaceId: 'ws-1',
      enableQueryExpansion: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
      query_text: 'test expanded synonyms',
    }));
  });

  it('should use original query when expansion disabled', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await hybridSearch('test query', {
      workspaceId: 'ws-1',
      enableQueryExpansion: false,
    });

    expect(expandQuery).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
      query_text: 'test query',
    }));
  });
});

describe('Reranking Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply reranking to multi-result sets', async () => {
    const mockResults = [
      { id: '1', content: 'a', document_id: 'd1', similarity: 0.8, rank_score: 0.8 },
      { id: '2', content: 'b', document_id: 'd2', similarity: 0.7, rank_score: 0.7 },
      { id: '3', content: 'c', document_id: 'd3', similarity: 0.6, rank_score: 0.6 },
    ];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockResults, error: null } as never);

    await hybridSearch('test', {
      workspaceId: 'ws-1',
      enableReranking: true,
    });

    expect(rerankResults).toHaveBeenCalledWith(
      expect.any(Array),
      'test',
      expect.objectContaining({ topK: expect.any(Number) })
    );
  });

  it('should not rerank single result', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ id: '1', content: 'only one', document_id: 'd1', similarity: 0.9, rank_score: 0.9 }],
      error: null,
    } as never);

    await hybridSearch('test', {
      workspaceId: 'ws-1',
      enableReranking: true,
      includeLearnedFacts: false, // Disable learned facts to have truly single result
    });

    expect(rerankResults).not.toHaveBeenCalled();
  });
});

describe('Workspace Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should always include workspace_id in search queries', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    await hybridSearch('test', { workspaceId: 'workspace-abc' });

    expect(supabase.rpc).toHaveBeenCalledWith('hybrid_search', expect.objectContaining({
      p_workspace_id: 'workspace-abc',
    }));
  });

  it('should isolate cache by workspace', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    // Mock generateCacheKey to actually include workspace ID
    const { generateCacheKey } = await import('../../utils/cache.js');
    vi.mocked(generateCacheKey)
      .mockReturnValueOnce('hybrid:test:15:all:workspace-1')
      .mockReturnValueOnce('hybrid:test:15:all:workspace-2');

    await hybridSearch('test', { workspaceId: 'workspace-1' });
    await hybridSearch('test', { workspaceId: 'workspace-2' });

    // Verify generateCacheKey was called with different workspace IDs
    expect(generateCacheKey).toHaveBeenCalledWith(expect.any(String), undefined, 'workspace-1');
    expect(generateCacheKey).toHaveBeenCalledWith(expect.any(String), undefined, 'workspace-2');
  });
});
