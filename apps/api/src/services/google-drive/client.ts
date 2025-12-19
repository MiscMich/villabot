/**
 * Google Drive API client
 * Handles OAuth and file operations
 */

import { google, drive_v3 } from 'googleapis';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { SUPPORTED_FILE_TYPES, FILE_LIMITS } from '@villa-paraiso/shared';

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
 * List all files in the configured folder
 */
export async function listFilesInFolder(folderId?: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const targetFolderId = folderId ?? env.GOOGLE_DRIVE_FOLDER_ID;

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  const supportedMimeTypes = Object.keys(SUPPORTED_FILE_TYPES);
  const mimeTypeQuery = supportedMimeTypes.map(mt => `mimeType='${mt}'`).join(' or ');

  do {
    const response = await drive.files.list({
      q: `'${targetFolderId}' in parents and trashed=false and (${mimeTypeQuery})`,
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

  logger.info(`Found ${files.length} files in folder`);
  return files;
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
        // Only include changes from our folder
        const parents = change.file?.parents ?? [];
        if (
          change.removed ||
          parents.includes(env.GOOGLE_DRIVE_FOLDER_ID)
        ) {
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
            } : undefined,
          });
        }
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
