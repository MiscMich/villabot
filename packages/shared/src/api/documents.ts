/**
 * Document API Zod schemas
 * Covers document management, sync, and scraping
 */

import { z } from 'zod';
import { DocumentCategorySchema, DocumentSourceTypeSchema, NullableTimestampSchema } from './common.js';

// ============================================================================
// Document Core Schemas
// ============================================================================

/** Document entity schema */
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  file_type: z.string(),
  source_type: DocumentSourceTypeSchema,
  source_url: z.string().nullable().optional(),
  last_modified: z.string(),
  last_synced: z.string(),
  is_active: z.boolean(),
  category: DocumentCategorySchema.nullable(),
  bot_id: z.string().uuid().nullable().optional(),
  drive_folder_id: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

/** Document chunk schema */
export const DocumentChunkSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  chunk_index: z.number(),
});

/** Document with chunks (detail view) */
export const DocumentDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  chunks: z.array(DocumentChunkSchema),
  chunk_count: z.number(),
});

// ============================================================================
// Document API Requests
// ============================================================================

/** Get documents request (query params) */
export const GetDocumentsQuerySchema = z.object({
  category: DocumentCategorySchema.optional(),
});

/** Update document request */
export const UpdateDocumentRequestSchema = z.object({
  bot_id: z.string().uuid().nullable().optional(),
  category: z.string().optional(),
});

/** Toggle document status request */
export const ToggleDocumentRequestSchema = z.object({
  is_active: z.boolean(),
});

// ============================================================================
// Document API Responses
// ============================================================================

/** List documents response */
export const ListDocumentsResponseSchema = z.object({
  documents: z.array(DocumentSchema),
  total: z.number(),
});

/** Get document response */
export const GetDocumentResponseSchema = DocumentDetailSchema;

/** Update document response */
export const UpdateDocumentResponseSchema = z.object({
  document: z.object({
    id: z.string().uuid(),
    bot_id: z.string().nullable(),
    category: z.string(),
  }),
});

// ============================================================================
// Sync Schemas
// ============================================================================

/** Sync status response */
export const SyncStatusResponseSchema = z.object({
  lastSync: NullableTimestampSchema,
  documentCount: z.number(),
  chunkCount: z.number(),
  driveConnected: z.boolean(),
});

/** Sync result response */
export const SyncResultResponseSchema = z.object({
  success: z.boolean(),
  added: z.number(),
  updated: z.number(),
  removed: z.number(),
  errors: z.array(z.string()),
});

// ============================================================================
// Website Scrape Schemas
// ============================================================================

/** Scrape status response */
export const ScrapeStatusResponseSchema = z.object({
  websiteConfigured: z.boolean(),
  websiteUrl: z.string().nullable(),
  lastScrape: NullableTimestampSchema,
  lastScrapeResult: z.object({
    pagesScraped: z.number(),
    chunksCreated: z.number(),
    errors: z.array(z.string()),
  }).nullable(),
  documentCount: z.number(),
});

/** Scrape result response */
export const ScrapeResultResponseSchema = z.object({
  success: z.boolean(),
  pagesScraped: z.number(),
  chunksCreated: z.number(),
  errors: z.array(z.string()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type Document = z.infer<typeof DocumentSchema>;
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;
export type GetDocumentsQuery = z.infer<typeof GetDocumentsQuerySchema>;
export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>;
export type ToggleDocumentRequest = z.infer<typeof ToggleDocumentRequestSchema>;
export type ListDocumentsResponse = z.infer<typeof ListDocumentsResponseSchema>;
export type GetDocumentResponse = z.infer<typeof GetDocumentResponseSchema>;
export type UpdateDocumentResponse = z.infer<typeof UpdateDocumentResponseSchema>;
export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;
export type SyncResultResponse = z.infer<typeof SyncResultResponseSchema>;
export type ScrapeStatusResponse = z.infer<typeof ScrapeStatusResponseSchema>;
export type ScrapeResultResponse = z.infer<typeof ScrapeResultResponseSchema>;
