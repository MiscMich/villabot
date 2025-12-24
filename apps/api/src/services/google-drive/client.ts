/**
 * Google Drive API client
 * Handles OAuth and file operations
 */

import { google, drive_v3 } from 'googleapis';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { SUPPORTED_FILE_TYPES, FILE_LIMITS } from '@cluebase/shared';

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

// Drive API client
let driveClient: drive_v3.Drive | null = null;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];  // Parent folder IDs for change tracking
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
  parentId?: string;
}

export interface DriveChangeToken {
  token: string;
  expiresAt: Date;
}

/**
 * Initialize the Drive client with stored credentials
 */
export function initializeDriveClient(tokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}): void {
  oauth2Client.setCredentials(tokens);
  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  logger.info('Google Drive client initialized');
}

/**
 * Get OAuth URL for authorization
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  driveClient = google.drive({ version: 'v3', auth: oauth2Client });

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
}

/**
 * Get the Drive client instance
 */
export function getDriveClient(): drive_v3.Drive {
  if (!driveClient) {
    throw new Error('Drive client not initialized. Call initializeDriveClient first.');
  }
  return driveClient;
}

/**
 * Check if client is initialized
 */
export function isDriveClientInitialized(): boolean {
  return driveClient !== null;
}

/**
 * Recursively get all subfolder IDs under a parent folder
 */
async function getSubfolderIds(parentFolderId: string, maxDepth: number = 10): Promise<string[]> {
  if (maxDepth <= 0) return [];

  const drive = getDriveClient();
  const subfolderIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken,
    });

    if (response.data.files) {
      for (const folder of response.data.files) {
        if (folder.id) {
          subfolderIds.push(folder.id);
          // Recursively get subfolders
          const nestedIds = await getSubfolderIds(folder.id, maxDepth - 1);
          subfolderIds.push(...nestedIds);
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return subfolderIds;
}

/**
 * List files in a single folder (non-recursive helper)
 */
async function listFilesInSingleFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  const supportedMimeTypes = Object.keys(SUPPORTED_FILE_TYPES);
  const mimeTypeQuery = supportedMimeTypes.map(mt => `mimeType='${mt}'`).join(' or ');

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (${mimeTypeQuery})`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size)',
      pageSize: 100,
      pageToken,
      orderBy: 'modifiedTime desc',
    });

    if (response.data.files) {
      for (const file of response.data.files) {
        // Skip files that are too large
        if (file.size && parseInt(file.size) > FILE_LIMITS.maxFileSizeBytes) {
          logger.warn(`Skipping large file: ${file.name} (${file.size} bytes)`);
          continue;
        }

        files.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          modifiedTime: file.modifiedTime!,
          webViewLink: file.webViewLink ?? undefined,
          size: file.size ?? undefined,
        });
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * List all files in the configured folder and all subfolders recursively
 */
export async function listFilesInFolder(folderId?: string): Promise<DriveFile[]> {
  const targetFolderId = folderId ?? env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolderId) {
    throw new Error('No folder ID provided and GOOGLE_DRIVE_FOLDER_ID not configured');
  }

  // Get all folder IDs to scan (parent + all subfolders)
  const allFolderIds: string[] = [targetFolderId];
  const subfolderIds = await getSubfolderIds(targetFolderId);
  allFolderIds.push(...subfolderIds);

  logger.info(`Scanning ${allFolderIds.length} folders (1 parent + ${subfolderIds.length} subfolders)`);

  // Collect files from all folders
  const allFiles: DriveFile[] = [];
  for (const fId of allFolderIds) {
    const files = await listFilesInSingleFolder(fId);
    allFiles.push(...files);
  }

  logger.info(`Found ${allFiles.length} files across all folders`);
  return allFiles;
}

/**
 * List folders in Drive
 * Used for folder picker UI
 */
export async function listFolders(
  parentId?: string,
  pageToken?: string
): Promise<{
  folders: DriveFolder[];
  nextPageToken?: string;
}> {
  const drive = getDriveClient();
  const targetParentId = parentId ?? 'root';

  const response = await drive.files.list({
    q: `'${targetParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'nextPageToken, files(id, name, modifiedTime, parents)',
    pageSize: 50,
    pageToken: pageToken ?? undefined,
    orderBy: 'name',
  });

  const folders: DriveFolder[] = (response.data.files ?? []).map(file => ({
    id: file.id!,
    name: file.name!,
    modifiedTime: file.modifiedTime!,
    parentId: file.parents?.[0] ?? undefined,
  }));

  logger.debug(`Listed ${folders.length} folders in ${targetParentId}`);

  return {
    folders,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, modifiedTime, webViewLink, size',
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
    mimeType: response.data.mimeType!,
    modifiedTime: response.data.modifiedTime!,
    webViewLink: response.data.webViewLink ?? undefined,
    size: response.data.size ?? undefined,
  };
}

/**
 * Download file content as buffer
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Export Google Workspace file (Docs, Sheets) as text
 */
export async function exportGoogleFile(
  fileId: string,
  mimeType: string
): Promise<string> {
  const drive = getDriveClient();

  // Determine export format
  let exportMimeType: string;
  if (mimeType === 'application/vnd.google-apps.document') {
    exportMimeType = 'text/plain';
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    exportMimeType = 'text/csv';
  } else {
    throw new Error(`Unsupported Google file type: ${mimeType}`);
  }

  const response = await drive.files.export(
    { fileId, mimeType: exportMimeType },
    { responseType: 'text' }
  );

  return response.data as string;
}

/**
 * Get start page token for change tracking
 */
export async function getStartPageToken(): Promise<string> {
  const drive = getDriveClient();
  const response = await drive.changes.getStartPageToken({});
  return response.data.startPageToken!;
}

/**
 * List changes since a given page token
 * Returns all changes - filtering by folder is done by the sync service
 */
export async function listChanges(pageToken: string): Promise<{
  changes: Array<{
    fileId: string;
    removed: boolean;
    file?: DriveFile;
  }>;
  newPageToken: string;
}> {
  const drive = getDriveClient();
  const changes: Array<{ fileId: string; removed: boolean; file?: DriveFile }> = [];
  let currentToken = pageToken;
  let newStartPageToken: string | undefined;

  do {
    const response = await drive.changes.list({
      pageToken: currentToken,
      fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, webViewLink, size, parents))',
      includeRemoved: true,
      spaces: 'drive',
    });

    if (response.data.changes) {
      for (const change of response.data.changes) {
        // Include all changes - folder filtering is done by sync service based on bot_drive_folders
        changes.push({
          fileId: change.fileId!,
          removed: change.removed ?? false,
          file: change.file ? {
            id: change.file.id!,
            name: change.file.name!,
            mimeType: change.file.mimeType!,
            modifiedTime: change.file.modifiedTime!,
            webViewLink: change.file.webViewLink ?? undefined,
            size: change.file.size ?? undefined,
            parents: change.file.parents ?? undefined,
          } : undefined,
        });
      }
    }

    currentToken = response.data.nextPageToken ?? '';
    newStartPageToken = response.data.newStartPageToken ?? undefined;
  } while (currentToken);

  return {
    changes,
    newPageToken: newStartPageToken ?? pageToken,
  };
}
