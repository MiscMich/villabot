/**
 * Unit tests for document chunking service
 */

import { describe, it, expect, vi } from 'vitest';
import { chunkDocument, estimateTokens, validateChunkSize } from './chunking.js';

// Mock the logger to avoid console output during tests
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('chunkDocument', () => {
  it('should return empty array for empty content', async () => {
    const result = await chunkDocument('');
    expect(result).toEqual([]);
  });

  it('should return empty array for whitespace-only content', async () => {
    const result = await chunkDocument('   \n\t  ');
    expect(result).toEqual([]);
  });

  it('should chunk content into pieces with metadata', async () => {
    const content = 'This is a test document. '.repeat(100); // ~2500 chars
    const metadata = { title: 'Test Document', fileType: 'text/plain' };

    const chunks = await chunkDocument(content, metadata);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('content');
    expect(chunks[0]).toHaveProperty('contextualContent');
    expect(chunks[0]).toHaveProperty('metadata');
  });

  it('should include document title in contextual content', async () => {
    const content = 'This is some test content that should be chunked.';
    const metadata = { title: 'My Important Document' };

    const chunks = await chunkDocument(content, metadata);

    expect(chunks[0]?.contextualContent).toContain('Document: My Important Document');
  });

  it('should include file type label in contextual content for PDF', async () => {
    const content = 'This is PDF content for testing.';
    const metadata = { title: 'Test PDF', fileType: 'application/pdf' };

    const chunks = await chunkDocument(content, metadata);

    expect(chunks[0]?.contextualContent).toContain('Type: PDF Document');
  });

  it('should include file type label for Word documents', async () => {
    const content = 'This is Word content for testing.';
    const metadata = {
      title: 'Test Doc',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const chunks = await chunkDocument(content, metadata);

    expect(chunks[0]?.contextualContent).toContain('Type: Word Document');
  });

  it('should include file type label for Google Docs', async () => {
    const content = 'This is Google Doc content for testing.';
    const metadata = { title: 'Test GDoc', fileType: 'application/vnd.google-apps.document' };

    const chunks = await chunkDocument(content, metadata);

    expect(chunks[0]?.contextualContent).toContain('Type: Google Doc');
  });

  it('should include chunk index in metadata', async () => {
    const content = 'This is a test document with enough content. '.repeat(50);
    const chunks = await chunkDocument(content);

    expect(chunks[0]?.metadata.chunkIndex).toBe(0);
    if (chunks.length > 1) {
      expect(chunks[1]?.metadata.chunkIndex).toBe(1);
    }
  });

  it('should include total chunks in metadata', async () => {
    const content = 'This is a test document with enough content. '.repeat(50);
    const chunks = await chunkDocument(content);

    chunks.forEach((chunk) => {
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
    });
  });

  it('should include section info in contextual content', async () => {
    const content = 'This is a test document with enough content to create multiple chunks. '.repeat(
      100
    );
    const chunks = await chunkDocument(content, { title: 'Test' });

    expect(chunks[0]?.contextualContent).toContain('Section 1 of');
    if (chunks.length > 1) {
      expect(chunks[1]?.contextualContent).toContain('Section 2 of');
    }
  });
});

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate tokens based on character count', () => {
    // Roughly 4 characters per token
    const text = 'abcd'; // 4 chars = 1 token
    expect(estimateTokens(text)).toBe(1);
  });

  it('should round up token estimates', () => {
    const text = 'abcde'; // 5 chars = ~1.25 tokens, should round to 2
    expect(estimateTokens(text)).toBe(2);
  });

  it('should handle longer text correctly', () => {
    const text = 'a'.repeat(100); // 100 chars = 25 tokens
    expect(estimateTokens(text)).toBe(25);
  });

  it('should handle text with spaces', () => {
    const text = 'hello world test'; // 16 chars = 4 tokens
    expect(estimateTokens(text)).toBe(4);
  });
});

describe('validateChunkSize', () => {
  it('should return true for small chunks', () => {
    const smallChunk = 'This is a small chunk.';
    expect(validateChunkSize(smallChunk)).toBe(true);
  });

  it('should return true for chunks within limit', () => {
    // Create a chunk that's at the limit (512 tokens * 4 chars = 2048 chars)
    const chunk = 'a'.repeat(2000);
    expect(validateChunkSize(chunk)).toBe(true);
  });

  it('should return true for chunks up to 50% over limit', () => {
    // 512 * 1.5 = 768 tokens max = 3072 chars
    const chunk = 'a'.repeat(3000);
    expect(validateChunkSize(chunk)).toBe(true);
  });

  it('should return false for chunks way over limit', () => {
    // Way over 768 token limit
    const hugeChunk = 'a'.repeat(10000);
    expect(validateChunkSize(hugeChunk)).toBe(false);
  });
});
