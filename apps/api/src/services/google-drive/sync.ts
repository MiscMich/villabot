/**
 * Google Drive sync service
 * Handles document synchronization and change detection
 */

import crypto from 'crypto';
import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import {
  listFilesInFolder,
  listChanges,
  getStartPageToken,
  DriveFile,
  isDriveClientInitialized,
} from './client.js';
import { parseFile } from './parsers/index.js';
import { chunkDocument } from '../rag/chunking.js';
import { generateEmbeddings } from '../rag/embeddings.js';
// Types imported from shared package if needed

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

// Store page token in bot_config
const PAGE_TOKEN_KEY = 'drive_page_token';

/**
 * Get stored page token
 */
async function getStoredPageToken(): Promise<string | null> {
  const { data } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', PAGE_TOKEN_KEY)
    .single();

  return data?.value?.token ?? null;
}

/**
 * Store page token
 */
async function storePageToken(token: string): Promise<void> {
  await supabase
    .from('bot_config')
    .upsert({
      key: PAGE_TOKEN_KEY,
      value: { token, updatedAt: new Date().toISOString() },
    });
}

/**
 * Perform full sync of all documents
 */
export async function fullSync(): Promise<SyncResult> {
  if (!isDriveClientInitialized()) {
    logger.warn('Drive client not initialized, skipping sync');
    return { added: 0, updated: 0, removed: 0, errors: ['Drive client not initialized'] };
  }

  logger.info('Starting full document sync');
  const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    // Get all files from Drive
    const driveFiles = await listFilesInFolder();

    // Get all existing documents from DB
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id, drive_file_id, content_hash')
      .eq('source_type', 'google_drive');

    const existingMap = new Map(
      (existingDocs ?? []).map(d => [d.drive_file_id, d])
    );
    const processedIds = new Set<string>();

    // Process each file
    for (const file of driveFiles) {
      try {
        processedIds.add(file.id);
        const existing = existingMap.get(file.id);

        // Parse and hash content
        const parsed = await parseFile(file.id, file.mimeType, file.name);
        const contentHash = hashContent(parsed.content);

        if (existing) {
          // Check if content changed
          if (existing.content_hash === contentHash) {
            logger.debug(`Skipping unchanged file: ${file.name}`);
            continue;
          }

          // Update existing document
          await updateDocument(existing.id, file, parsed.content, contentHash);
          result.updated++;
        } else {
          // Add new document
          await addDocument(file, parsed.content, contentHash);
          result.added++;
        }
      } catch (error) {
        const message = `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
      }
    }

    // Remove documents that no longer exist in Drive
    for (const [driveFileId, doc] of existingMap) {
      if (!processedIds.has(driveFileId)) {
        await supabase.from('documents').delete().eq('id', doc.id);
        result.removed++;
      }
    }

    // Store page token for incremental sync
    const pageToken = await getStartPageToken();
    await storePageToken(pageToken);

    logger.info('Full sync completed', result);
    return result;
  } catch (error) {
    logger.error('Full sync failed', { error });
    throw error;
  }
}

/**
 * Perform incremental sync based on changes
 */
export async function incrementalSync(): Promise<SyncResult> {
  if (!isDriveClientInitialized()) {
    logger.warn('Drive client not initialized, skipping sync');
    return { added: 0, updated: 0, removed: 0, errors: ['Drive client not initialized'] };
  }

  const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    // Get stored page token
    let pageToken = await getStoredPageToken();

    if (!pageToken) {
      logger.info('No page token found, performing full sync');
      return fullSync();
    }

    logger.info('Starting incremental sync');

    // Get changes since last sync
    const { changes, newPageToken } = await listChanges(pageToken);

    if (changes.length === 0) {
      logger.debug('No changes detected');
      await storePageToken(newPageToken);
      return result;
    }

    logger.info(`Processing ${changes.length} changes`);

    for (const change of changes) {
      try {
        if (change.removed) {
          // File was deleted
          const { data } = await supabase
            .from('documents')
            .delete()
            .eq('drive_file_id', change.fileId)
            .select('id');

          if (data && data.length > 0) {
            result.removed++;
          }
        } else if (change.file) {
          // File was added or modified
          const { data: existing } = await supabase
            .from('documents')
            .select('id, content_hash')
            .eq('drive_file_id', change.fileId)
            .single();

          const parsed = await parseFile(
            change.file.id,
            change.file.mimeType,
            change.file.name
          );
          const contentHash = hashContent(parsed.content);

          if (existing) {
            if (existing.content_hash !== contentHash) {
              await updateDocument(existing.id, change.file, parsed.content, contentHash);
              result.updated++;
            }
          } else {
            await addDocument(change.file, parsed.content, contentHash);
            result.added++;
          }
        }
      } catch (error) {
        const message = `Failed to process change for ${change.fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
      }
    }

    // Store new page token
    await storePageToken(newPageToken);

    logger.info('Incremental sync completed', result);
    return result;
  } catch (error) {
    logger.error('Incremental sync failed', { error });
    throw error;
  }
}

/**
 * Add a new document to the database
 */
async function addDocument(
  file: DriveFile,
  content: string,
  contentHash: string
): Promise<void> {
  logger.info(`Adding document: ${file.name}`);

  // Insert document metadata
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      drive_file_id: file.id,
      title: file.name,
      file_type: file.mimeType,
      source_type: 'google_drive',
      source_url: file.webViewLink,
      content_hash: contentHash,
      last_modified: file.modifiedTime,
    })
    .select('id')
    .single();

  if (docError) throw docError;

  // Chunk the content
  const chunks = await chunkDocument(content, {
    title: file.name,
    fileType: file.mimeType,
    sourceUrl: file.webViewLink,
  });

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.content));

  // Insert chunks with embeddings
  const chunkRows = chunks.map((chunk, index) => ({
    document_id: doc.id,
    chunk_index: index,
    content: chunk.content,
    embedding: embeddings[index],
    metadata: chunk.metadata,
  }));

  const { error: chunkError } = await supabase
    .from('document_chunks')
    .insert(chunkRows);

  if (chunkError) throw chunkError;

  logger.debug(`Added ${chunks.length} chunks for ${file.name}`);
}

/**
 * Update an existing document
 */
async function updateDocument(
  documentId: string,
  file: DriveFile,
  content: string,
  contentHash: string
): Promise<void> {
  logger.info(`Updating document: ${file.name}`);

  // Update document metadata
  await supabase
    .from('documents')
    .update({
      title: file.name,
      content_hash: contentHash,
      last_modified: file.modifiedTime,
      last_synced: new Date().toISOString(),
    })
    .eq('id', documentId);

  // Delete old chunks
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  // Chunk the new content
  const chunks = await chunkDocument(content, {
    title: file.name,
    fileType: file.mimeType,
    sourceUrl: file.webViewLink,
  });

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.content));

  // Insert new chunks
  const chunkRows = chunks.map((chunk, index) => ({
    document_id: documentId,
    chunk_index: index,
    content: chunk.content,
    embedding: embeddings[index],
    metadata: chunk.metadata,
  }));

  await supabase.from('document_chunks').insert(chunkRows);

  logger.debug(`Updated ${chunks.length} chunks for ${file.name}`);
}

/**
 * Hash content for change detection
 */
function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  lastSync: string | null;
  documentCount: number;
  chunkCount: number;
}> {
  const { data: tokenData } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', PAGE_TOKEN_KEY)
    .single();

  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true });

  const { count: chunkCount } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true });

  return {
    lastSync: tokenData?.value?.updatedAt ?? null,
    documentCount: docCount ?? 0,
    chunkCount: chunkCount ?? 0,
  };
}
