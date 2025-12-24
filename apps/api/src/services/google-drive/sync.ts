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

interface SyncOptions {
  workspaceId: string;  // Required for tenant isolation
  botId?: string;  // Optional bot-specific sync
  folderId?: string;  // Optional specific folder to sync
}

interface BotFolder {
  id: string;
  bot_id: string;  // Bot this folder is assigned to
  drive_folder_id: string;
  folder_name: string;
  is_active: boolean;
}

/**
 * Get stored page token for workspace
 */
async function getStoredPageToken(workspaceId: string): Promise<string | null> {
  const pageTokenKey = `drive_page_token:${workspaceId}`;
  const { data } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', pageTokenKey)
    .single();

  return data?.value?.token ?? null;
}

/**
 * Store page token for workspace
 */
async function storePageToken(workspaceId: string, token: string): Promise<void> {
  const pageTokenKey = `drive_page_token:${workspaceId}`;
  await supabase
    .from('bot_config')
    .upsert({
      key: pageTokenKey,
      value: { token, updatedAt: new Date().toISOString() },
    });
}

/**
 * Perform full sync of all documents
 * If botId is provided, syncs all folders assigned to that bot via bot_drive_folders
 * If folderId is provided, syncs only that specific folder
 */
export async function fullSync(options: SyncOptions): Promise<SyncResult> {
  const { workspaceId, botId, folderId } = options;

  if (!isDriveClientInitialized()) {
    logger.warn('Drive client not initialized, skipping sync');
    return { added: 0, updated: 0, removed: 0, errors: ['Drive client not initialized'] };
  }

  logger.info('Starting full document sync', { workspaceId, botId, folderId });
  const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    // Determine which folders to sync
    let foldersToSync: BotFolder[] = [];

    if (folderId) {
      // Sync specific folder only - look up the bot assignment if it exists
      const { data: folderData } = await supabase
        .from('bot_drive_folders')
        .select('id, bot_id, drive_folder_id, folder_name, is_active')
        .eq('drive_folder_id', folderId)
        .eq('workspace_id', workspaceId)
        .single();

      if (folderData) {
        foldersToSync = [folderData];
      } else {
        // Folder not in bot_drive_folders - use without bot assignment
        foldersToSync = [{
          id: 'single',
          bot_id: botId || '',  // Use provided botId or empty
          drive_folder_id: folderId,
          folder_name: 'Specified Folder',
          is_active: true,
        }];
      }
    } else if (botId) {
      // Get folders assigned to this bot from bot_drive_folders table
      const { data: botFolders, error: folderError } = await supabase
        .from('bot_drive_folders')
        .select('id, bot_id, drive_folder_id, folder_name, is_active')
        .eq('bot_id', botId)
        .eq('is_active', true);

      if (folderError) {
        logger.error('Failed to fetch bot folders', { error: folderError, botId });
        return { added: 0, updated: 0, removed: 0, errors: ['Failed to fetch bot folders'] };
      }

      if (!botFolders || botFolders.length === 0) {
        logger.warn('No folders assigned to bot', { botId });
        return { added: 0, updated: 0, removed: 0, errors: [] };
      }

      foldersToSync = botFolders;
      logger.info(`Found ${foldersToSync.length} folders for bot`, { botId, folders: foldersToSync.map(f => f.folder_name) });
    } else {
      // Workspace-wide sync: get all folders from all bots in workspace
      const { data: workspaceFolders, error: wsError } = await supabase
        .from('bot_drive_folders')
        .select('id, bot_id, drive_folder_id, folder_name, is_active, bots!inner(workspace_id)')
        .eq('bots.workspace_id', workspaceId)
        .eq('is_active', true);

      if (wsError) {
        logger.error('Failed to fetch workspace folders', { error: wsError, workspaceId });
        return { added: 0, updated: 0, removed: 0, errors: ['Failed to fetch workspace folders'] };
      }

      foldersToSync = (workspaceFolders ?? []) as unknown as BotFolder[];
      logger.info(`Found ${foldersToSync.length} folders for workspace`, { workspaceId });
    }

    // Get all existing documents from DB for this scope
    let existingQuery = supabase
      .from('documents')
      .select('id, drive_file_id, content_hash, drive_folder_id, bot_id')
      .eq('workspace_id', workspaceId)
      .eq('source_type', 'google_drive');

    if (botId) {
      existingQuery = existingQuery.eq('bot_id', botId);
    }

    const { data: existingDocs } = await existingQuery;
    const existingMap = new Map(
      (existingDocs ?? []).map(d => [d.drive_file_id, d])
    );
    const processedIds = new Set<string>();

    // Sync each folder
    for (const folder of foldersToSync) {
      try {
        logger.info(`Syncing folder: ${folder.folder_name}`, { driveFolderId: folder.drive_folder_id });

        // Get all files from this Drive folder
        const driveFiles = await listFilesInFolder(folder.drive_folder_id);
        logger.info(`Found ${driveFiles.length} files in folder`, { folder: folder.folder_name });

        // Process each file in this folder
        for (const file of driveFiles) {
          try {
            processedIds.add(file.id);
            const existing = existingMap.get(file.id);

            // Parse and hash content
            const parsed = await parseFile(file.id, file.mimeType, file.name);
            const contentHash = hashContent(parsed.content);

            if (existing) {
              // Check if content changed
              const effectiveBotId = botId || folder.bot_id;
              if (existing.content_hash === contentHash) {
                // Content unchanged - but check if bot_id needs updating
                // This handles documents that were synced before bot assignment was fixed
                const existingDoc = existingMap.get(file.id);
                if (effectiveBotId && existingDoc && !existingDoc.bot_id) {
                  await supabase
                    .from('documents')
                    .update({ bot_id: effectiveBotId })
                    .eq('id', existing.id);
                  logger.info(`Updated bot_id for unchanged file: ${file.name}`, { botId: effectiveBotId });
                  result.updated++;
                } else {
                  logger.debug(`Skipping unchanged file: ${file.name}`);
                }
                continue;
              }

              // Update existing document
              await updateDocument(existing.id, file, parsed.content, contentHash);
              result.updated++;
            } else {
              // Add new document with workspace, bot, and folder context
              // Use folder.bot_id to properly associate document with the bot that owns this folder
              const effectiveBotId = botId || folder.bot_id;
              await addDocument(file, parsed.content, contentHash, workspaceId, effectiveBotId, folder.drive_folder_id);
              result.added++;
            }
          } catch (error) {
            const message = `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(message);
            result.errors.push(message);
          }
        }
        // Update last_synced timestamp on the folder
        if (folder.id !== 'single') {
          await supabase
            .from('bot_drive_folders')
            .update({ last_synced: new Date().toISOString() })
            .eq('id', folder.id);
        }
      } catch (error) {
        const message = `Failed to sync folder ${folder.folder_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
      }
    }

    // Remove documents that no longer exist in any synced folder
    for (const [driveFileId, doc] of existingMap) {
      if (!processedIds.has(driveFileId)) {
        await supabase.from('documents').delete().eq('id', doc.id);
        result.removed++;
      }
    }

    // Store page token for incremental sync (per workspace)
    const pageToken = await getStartPageToken();
    await storePageToken(workspaceId, pageToken);

    logger.info('Full sync completed', { ...result, workspaceId, botId });
    return result;
  } catch (error) {
    logger.error('Full sync failed', { error, workspaceId });
    throw error;
  }
}

/**
 * Perform incremental sync based on changes
 * Filters changes to only include files in bot's assigned folders
 */
export async function incrementalSync(options: SyncOptions): Promise<SyncResult> {
  const { workspaceId, botId } = options;

  if (!isDriveClientInitialized()) {
    logger.warn('Drive client not initialized, skipping sync');
    return { added: 0, updated: 0, removed: 0, errors: ['Drive client not initialized'] };
  }

  const result: SyncResult = { added: 0, updated: 0, removed: 0, errors: [] };

  try {
    // Get stored page token for this workspace
    const pageToken = await getStoredPageToken(workspaceId);

    if (!pageToken) {
      logger.info('No page token found, performing full sync', { workspaceId });
      return fullSync(options);
    }

    logger.info('Starting incremental sync', { workspaceId, botId });

    // Get folders assigned to this bot/workspace for filtering changes
    let allowedFolderIds: Set<string> = new Set();

    if (botId) {
      const { data: botFolders } = await supabase
        .from('bot_drive_folders')
        .select('drive_folder_id')
        .eq('bot_id', botId)
        .eq('is_active', true);

      allowedFolderIds = new Set((botFolders ?? []).map(f => f.drive_folder_id));
    } else {
      // Workspace-wide: get all folders from all bots
      const { data: workspaceFolders } = await supabase
        .from('bot_drive_folders')
        .select('drive_folder_id, bots!inner(workspace_id)')
        .eq('bots.workspace_id', workspaceId)
        .eq('is_active', true);

      allowedFolderIds = new Set((workspaceFolders ?? []).map(f => f.drive_folder_id));
    }

    if (allowedFolderIds.size === 0) {
      logger.warn('No folders configured for sync', { workspaceId, botId });
      return result;
    }

    // Get changes since last sync
    const { changes, newPageToken } = await listChanges(pageToken);

    if (changes.length === 0) {
      logger.debug('No changes detected');
      await storePageToken(workspaceId, newPageToken);
      return result;
    }

    logger.info(`Processing ${changes.length} changes`, { workspaceId });

    for (const change of changes) {
      try {
        if (change.removed) {
          // File was deleted - only delete for this workspace/bot
          let deleteQuery = supabase
            .from('documents')
            .delete()
            .eq('workspace_id', workspaceId)
            .eq('drive_file_id', change.fileId);

          if (botId) {
            deleteQuery = deleteQuery.eq('bot_id', botId);
          }

          const { data } = await deleteQuery.select('id');

          if (data && data.length > 0) {
            result.removed++;
          }
        } else if (change.file) {
          // Check if file's parent folder is in our allowed folders
          const fileParentId = change.file.parents?.[0];
          if (!fileParentId || !allowedFolderIds.has(fileParentId)) {
            logger.debug(`Skipping file not in assigned folders: ${change.file.name}`);
            continue;
          }

          // File was added or modified - check within workspace
          let existingQuery = supabase
            .from('documents')
            .select('id, content_hash, drive_folder_id')
            .eq('workspace_id', workspaceId)
            .eq('drive_file_id', change.fileId);

          if (botId) {
            existingQuery = existingQuery.eq('bot_id', botId);
          }

          const { data: existing } = await existingQuery.single();

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
            // Add new document with folder context
            await addDocument(change.file, parsed.content, contentHash, workspaceId, botId, fileParentId);
            result.added++;
          }
        }
      } catch (error) {
        const message = `Failed to process change for ${change.fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
      }
    }

    // Store new page token for this workspace
    await storePageToken(workspaceId, newPageToken);

    logger.info('Incremental sync completed', { ...result, workspaceId, botId });
    return result;
  } catch (error) {
    logger.error('Incremental sync failed', { error, workspaceId });
    throw error;
  }
}

/**
 * Add a new document to the database
 */
async function addDocument(
  file: DriveFile,
  content: string,
  contentHash: string,
  workspaceId: string,
  botId?: string,
  driveFolderId?: string
): Promise<void> {
  logger.info(`Adding document: ${file.name}`, { workspaceId, botId, driveFolderId });

  // Insert document metadata with workspace context
  const insertData: Record<string, unknown> = {
    workspace_id: workspaceId,
    drive_file_id: file.id,
    title: file.name,
    file_type: file.mimeType,
    source_type: 'google_drive',
    source_url: file.webViewLink,
    content_hash: contentHash,
    last_modified: file.modifiedTime,
    tags: [],  // Initialize empty tags array for user customization
  };

  if (botId) {
    insertData.bot_id = botId;
  }

  if (driveFolderId) {
    insertData.drive_folder_id = driveFolderId;
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert(insertData)
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
 * Get sync status for a workspace
 */
export async function getSyncStatus(workspaceId: string): Promise<{
  lastSync: string | null;
  documentCount: number;
  chunkCount: number;
}> {
  const pageTokenKey = `drive_page_token:${workspaceId}`;
  const { data: tokenData } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', pageTokenKey)
    .single();

  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  // Get chunk count by joining with documents for this workspace
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('id, documents!inner(workspace_id)')
    .eq('documents.workspace_id', workspaceId);

  return {
    lastSync: tokenData?.value?.updatedAt ?? null,
    documentCount: docCount ?? 0,
    chunkCount: chunks?.length ?? 0,
  };
}
