/**
 * Document types for the knowledge base
 */

import type { DocumentCategory } from './bots.js';

export type DocumentSourceType = 'google_drive' | 'website';

export type DocumentFileType = 'pdf' | 'docx' | 'google_doc' | 'google_sheet' | 'txt' | 'html';

export interface Document {
  id: string;
  driveFileId: string | null;
  title: string;
  fileType: DocumentFileType;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  contentHash: string;
  lastModified: Date;
  lastSynced: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Multi-bot fields
  botId: string | null;
  /** @deprecated Use tags instead */
  category: DocumentCategory;
  priority: number;

  // New fields for simplified categorization
  /** Custom user-defined tags for document organization */
  tags: string[];
  /** Google Drive folder ID this document was synced from */
  driveFolderId: string | null;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  metadata: ChunkMetadata;
  createdAt: Date;
}

export interface ChunkMetadata {
  documentTitle: string;
  sourceType: DocumentSourceType;
  fileType: DocumentFileType;
  lastModified: string;
  pageNumber?: number;
  section?: string;
  /** Custom tags for the document */
  tags?: string[];
  /** Bot ID this document belongs to */
  botId?: string;
}

export interface DocumentSyncResult {
  added: string[];
  updated: string[];
  deleted: string[];
  errors: Array<{ fileId: string; error: string }>;
}

export interface ParsedDocument {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}
