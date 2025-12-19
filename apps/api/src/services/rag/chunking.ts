/**
 * Document chunking service
 * Implements contextual chunking with metadata prepending
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { CHUNK_CONFIG } from '@villa-paraiso/shared';
import { logger } from '../../utils/logger.js';

export interface ChunkMetadata {
  title?: string;
  fileType?: string;
  sourceUrl?: string;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

export interface DocumentChunk {
  content: string;
  contextualContent: string; // Content with metadata prepended for embedding
  metadata: ChunkMetadata;
}

/**
 * Chunk a document into smaller pieces with contextual metadata
 * Uses Anthropic's contextual embedding approach
 */
export async function chunkDocument(
  content: string,
  metadata: ChunkMetadata = {}
): Promise<DocumentChunk[]> {
  if (!content || content.trim().length === 0) {
    logger.warn('Empty content provided for chunking');
    return [];
  }

  // Create splitter with configured settings
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_CONFIG.chunkSize,
    chunkOverlap: CHUNK_CONFIG.chunkOverlap,
    separators: [...CHUNK_CONFIG.separators],
  });

  // Split the document
  const chunks = await splitter.splitText(content);

  logger.debug(`Split document into ${chunks.length} chunks`, {
    title: metadata.title,
    avgChunkSize: Math.round(content.length / chunks.length),
  });

  // Create contextual chunks with metadata prepended
  return chunks.map((chunk, index) => {
    const chunkMetadata: ChunkMetadata = {
      ...metadata,
      chunkIndex: index,
      totalChunks: chunks.length,
    };

    // Create contextual content by prepending document info
    // This improves embedding quality (Anthropic's contextual retrieval method)
    const contextPrefix = buildContextPrefix(chunkMetadata);
    const contextualContent = `${contextPrefix}\n\n${chunk}`;

    return {
      content: chunk,
      contextualContent,
      metadata: chunkMetadata,
    };
  });
}

/**
 * Build a context prefix for the chunk
 * This helps the embedding model understand the chunk's context
 */
function buildContextPrefix(metadata: ChunkMetadata): string {
  const parts: string[] = [];

  if (metadata.title) {
    parts.push(`Document: ${metadata.title}`);
  }

  if (metadata.fileType) {
    const fileTypeLabel = getFileTypeLabel(metadata.fileType);
    if (fileTypeLabel) {
      parts.push(`Type: ${fileTypeLabel}`);
    }
  }

  if (metadata.chunkIndex !== undefined && metadata.totalChunks !== undefined) {
    parts.push(`Section ${metadata.chunkIndex + 1} of ${metadata.totalChunks}`);
  }

  return parts.join(' | ');
}

/**
 * Get human-readable file type label
 */
function getFileTypeLabel(mimeType: string): string | null {
  const labels: Record<string, string> = {
    'application/pdf': 'PDF Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'text/plain': 'Text File',
    'text/html': 'HTML Page',
  };

  return labels[mimeType] ?? null;
}

/**
 * Estimate token count for a string
 * Rough approximation: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validate chunk size is within limits
 */
export function validateChunkSize(chunk: string): boolean {
  const tokens = estimateTokens(chunk);
  return tokens <= CHUNK_CONFIG.chunkSize * 1.5; // Allow 50% overflow
}
