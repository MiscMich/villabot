/**
 * Document types for the knowledge base
 */

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
