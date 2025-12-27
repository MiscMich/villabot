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
import { botManager } from '../slack/manager.js';
import { syncProgressEmitter } from '../sync/index.js';

interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

/**
 * Error codes for Drive sync operations
 */
export type SyncErrorCode =
  | 'DRIVE_AUTH_EXPIRED'
  | 'DRIVE_AUTH_REVOKED'
  | 'DRIVE_AUTH_INVALID'
  | 'DRIVE_PERMISSION_DENIED'
  | 'DRIVE_FOLDER_NOT_FOUND'
  | 'DRIVE_QUOTA_EXCEEDED'
  | 'DRIVE_NETWORK_ERROR'
  | 'DRIVE_SYNC_FAILED';

/**
 * Custom error class for Drive sync operations with error codes
 */
export class SyncError extends Error {
  code: SyncErrorCode;

  constructor(message: string, code: SyncErrorCode) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

/**
 * Detect OAuth/auth errors from Google API responses
 */
function classifyDriveError(error: unknown): SyncError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // OAuth token errors
  if (lowerMessage.includes('invalid_grant') ||
      lowerMessage.includes('token has been expired') ||
      lowerMessage.includes('token has been revoked')) {
    return new SyncError(
      'Google Drive authorization expired. Please reconnect your Drive.',
      'DRIVE_AUTH_EXPIRED'
    );
  }

  // Token revoked/invalid
  if (lowerMessage.includes('invalid_token') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('unauthenticated')) {
    return new SyncError(
      'Google Drive authorization is invalid. Please reconnect.',
      'DRIVE_AUTH_INVALID'
    );
  }

  // Permission errors
  if (lowerMessage.includes('permission denied') ||
      lowerMessage.includes('access denied') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('403')) {
    return new SyncError(
      'Permission denied. Check folder sharing settings.',
      'DRIVE_PERMISSION_DENIED'
    );
  }

  // Folder not found
  if (lowerMessage.includes('not found') ||
      lowerMessage.includes('404') ||
      lowerMessage.includes('file not found')) {
    return new SyncError(
      'Drive folder not found. It may have been deleted or moved.',
      'DRIVE_FOLDER_NOT_FOUND'
    );
  }

  // Quota exceeded
  if (lowerMessage.includes('quota') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests') ||
      lowerMessage.includes('429')) {
    return new SyncError(
      'Google API quota exceeded. Please try again later.',
      'DRIVE_QUOTA_EXCEEDED'
    );
  }

  // Network errors
  if (lowerMessage.includes('network') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('socket')) {
    return new SyncError(
      'Network error connecting to Google Drive.',
      'DRIVE_NETWORK_ERROR'
    );
  }

  // Generic sync failure
  return new SyncError(
    message || 'Drive sync failed',
    'DRIVE_SYNC_FAILED'
  );
}

/**
 * Auth-related error codes that should trigger Slack notifications
 */
const AUTH_ERROR_CODES: SyncErrorCode[] = [
  'DRIVE_AUTH_EXPIRED',
  'DRIVE_AUTH_REVOKED',
  'DRIVE_AUTH_INVALID',
];

/**
 * Send Slack notification to workspace when Drive sync fails due to auth issues
 */
async function notifyAuthFailure(workspaceId: string, error: SyncError): Promise<void> {
  if (!AUTH_ERROR_CODES.includes(error.code)) {
    return;
  }

  const message = `⚠️ *Google Drive Sync Failed*\n\n${error.message}\n\nPlease visit the <https://cluebase.ai/settings|dashboard> to reconnect your Google Drive.`;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '⚠️ *Google Drive Sync Failed*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: error.message,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '👉 Please visit the <https://cluebase.ai/settings|dashboard> to reconnect your Google Drive.',
      },
    },
  ];

  try {
    await botManager.notifyWorkspace(workspaceId, message, blocks);
    logger.info('Sent Drive auth failure notification to workspace', { workspaceId, errorCode: error.code });
  } catch (notifyError) {
    logger.error('Failed to send auth failure notification', { workspaceId, error: notifyError });
  }
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
  const pageTokenKey = `drive_page_token`;
  const { data } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', pageTokenKey)
    .eq('workspace_id', workspaceId)
    .single();

  return data?.value?.token ?? null;
}

/**
 * Store page token for workspace
 */
async function storePageToken(workspaceId: string, token: string): Promise<void> {
  const pageTokenKey = `drive_page_token`;
  await supabase
    .from('bot_config')
    .upsert(
      {
        key: pageTokenKey,
        value: { token, updatedAt: new Date().toISOString() },
        workspace_id: workspaceId,
      },
      {
        onConflict: 'workspace_id,key',
      }
    );
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

  // Create sync operation for progress tracking
  let operationId: string | null = null;
  try {
    operationId = await syncProgressEmitter.createOperation(workspaceId, 'drive_full_sync');
  } catch (opError) {
    logger.warn('Failed to create sync operation record', { error: opError });
    // Continue without progress tracking
  }

  try {
    // Emit initial progress
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_full_sync',
        status: 'running',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        currentItem: 'Discovering folders...',
      });
    }

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

      // Map query results to BotFolder shape (join returns nested bots object)
      foldersToSync = (workspaceFolders ?? []).map(folder => ({
        id: folder.id,
        bot_id: folder.bot_id,
        drive_folder_id: folder.drive_folder_id,
        folder_name: folder.folder_name,
        is_active: folder.is_active,
      }));
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

    // First pass: collect all files to get total count
    let totalFiles = 0;
    let processedFiles = 0;
    const folderFiles: Map<string, DriveFile[]> = new Map();

    for (const folder of foldersToSync) {
      try {
        const driveFiles = await listFilesInFolder(folder.drive_folder_id);
        folderFiles.set(folder.drive_folder_id, driveFiles);
        totalFiles += driveFiles.length;
      } catch (error) {
        const message = `Failed to list folder ${folder.folder_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
      }
    }

    // Update progress with total count
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_full_sync',
        status: 'running',
        progress: 0,
        totalItems: totalFiles,
        processedItems: 0,
        currentItem: `Found ${totalFiles} files to sync`,
      });
    }

    // Sync each folder
    for (const folder of foldersToSync) {
      try {
        logger.info(`Syncing folder: ${folder.folder_name}`, { driveFolderId: folder.drive_folder_id });

        // Use cached files from first pass
        const driveFiles = folderFiles.get(folder.drive_folder_id) ?? [];
        logger.info(`Processing ${driveFiles.length} files in folder`, { folder: folder.folder_name });

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
            // Update progress after each file
            processedFiles++;
            if (operationId) {
              syncProgressEmitter.emitProgress({
                operationId,
                workspaceId,
                type: 'drive_full_sync',
                status: 'running',
                progress: totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0,
                totalItems: totalFiles,
                processedItems: processedFiles,
                currentItem: file.name,
              });
            }
          } catch (error) {
            const message = `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(message);
            result.errors.push(message);
            // Still count as processed for progress
            processedFiles++;
            if (operationId) {
              syncProgressEmitter.emitProgress({
                operationId,
                workspaceId,
                type: 'drive_full_sync',
                status: 'running',
                progress: totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0,
                totalItems: totalFiles,
                processedItems: processedFiles,
                currentItem: `Error: ${file.name}`,
              });
            }
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

    // Emit completion event
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_full_sync',
        status: 'completed',
        progress: 100,
        totalItems: totalFiles,
        processedItems: processedFiles,
        result,
      });
    }

    logger.info('Full sync completed', { ...result, workspaceId, botId });
    return result;
  } catch (error) {
    const syncError = classifyDriveError(error);
    logger.error('Full sync failed', {
      error: syncError.message,
      code: syncError.code,
      workspaceId,
      originalError: error instanceof Error ? error.message : String(error),
    });

    // Emit failure event
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_full_sync',
        status: 'failed',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        error: syncError.message,
      });
    }

    // Notify workspace via Slack if auth-related error
    await notifyAuthFailure(workspaceId, syncError);

    throw syncError;
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

  // Check for page token BEFORE creating operation record
  // This prevents orphan "pending" operations when delegating to fullSync
  const pageToken = await getStoredPageToken(workspaceId);

  if (!pageToken) {
    logger.info('No page token found, performing full sync', { workspaceId });
    return fullSync(options);
  }

  // Create sync operation for progress tracking AFTER confirming we'll handle the sync
  let operationId: string | null = null;
  try {
    operationId = await syncProgressEmitter.createOperation(workspaceId, 'drive_sync');
  } catch (opError) {
    logger.warn('Failed to create sync operation record', { error: opError });
  }

  try {
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
      // Emit completion for empty sync
      if (operationId) {
        syncProgressEmitter.emitProgress({
          operationId,
          workspaceId,
          type: 'drive_sync',
          status: 'completed',
          progress: 100,
          totalItems: 0,
          processedItems: 0,
          result,
        });
      }
      return result;
    }

    logger.info(`Processing ${changes.length} changes`, { workspaceId });

    // Emit initial progress with total count
    const totalChanges = changes.length;
    let processedChanges = 0;
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_sync',
        status: 'running',
        progress: 0,
        totalItems: totalChanges,
        processedItems: 0,
        currentItem: `Processing ${totalChanges} changes...`,
      });
    }

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
        // Update progress after each change
        processedChanges++;
        if (operationId) {
          syncProgressEmitter.emitProgress({
            operationId,
            workspaceId,
            type: 'drive_sync',
            status: 'running',
            progress: totalChanges > 0 ? Math.round((processedChanges / totalChanges) * 100) : 0,
            totalItems: totalChanges,
            processedItems: processedChanges,
            currentItem: change.file?.name ?? change.fileId,
          });
        }
      } catch (error) {
        const message = `Failed to process change for ${change.fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        logger.error(message);
        result.errors.push(message);
        // Still count as processed
        processedChanges++;
        if (operationId) {
          syncProgressEmitter.emitProgress({
            operationId,
            workspaceId,
            type: 'drive_sync',
            status: 'running',
            progress: totalChanges > 0 ? Math.round((processedChanges / totalChanges) * 100) : 0,
            totalItems: totalChanges,
            processedItems: processedChanges,
            currentItem: `Error: ${change.fileId}`,
          });
        }
      }
    }

    // Store new page token for this workspace
    await storePageToken(workspaceId, newPageToken);

    // Emit completion event
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_sync',
        status: 'completed',
        progress: 100,
        totalItems: totalChanges,
        processedItems: processedChanges,
        result,
      });
    }

    logger.info('Incremental sync completed', { ...result, workspaceId, botId });
    return result;
  } catch (error) {
    const syncError = classifyDriveError(error);
    logger.error('Incremental sync failed', {
      error: syncError.message,
      code: syncError.code,
      workspaceId,
      originalError: error instanceof Error ? error.message : String(error),
    });

    // Emit failure event
    if (operationId) {
      syncProgressEmitter.emitProgress({
        operationId,
        workspaceId,
        type: 'drive_sync',
        status: 'failed',
        progress: 0,
        totalItems: 0,
        processedItems: 0,
        error: syncError.message,
      });
    }

    // Notify workspace via Slack if auth-related error
    await notifyAuthFailure(workspaceId, syncError);

    throw syncError;
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
  const pageTokenKey = `drive_page_token`;
  const { data: tokenData } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', pageTokenKey)
    .eq('workspace_id', workspaceId)
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
