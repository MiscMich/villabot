/**
 * Google Drive API routes
 * Handles folder browsing for folder picker UI
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { resolveWorkspace } from '../middleware/workspace.js';
import { supabase } from '../services/supabase/client.js';
import { initializeDriveClient, listFolders, isDriveClientInitialized } from '../services/google-drive/client.js';
import { logger } from '../utils/logger.js';

export const driveRouter = Router();

// Apply auth middleware to all routes
driveRouter.use(authenticate);
driveRouter.use(resolveWorkspace);

const TOKENS_KEY = 'google_drive_tokens';

/**
 * Initialize Drive client for the workspace
 * Returns false if no tokens are stored
 */
async function initializeDriveForWorkspace(workspaceId: string): Promise<boolean> {
  try {
    // Get workspace-specific Google Drive tokens
    const { data } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .eq('workspace_id', workspaceId)
      .single();

    // If no workspace-specific tokens, try legacy global tokens (migration period)
    if (!data?.value?.access_token) {
      const { data: legacyData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', TOKENS_KEY)
        .is('workspace_id', null)
        .single();

      if (!legacyData?.value?.access_token) {
        return false;
      }

      initializeDriveClient({
        access_token: legacyData.value.access_token,
        refresh_token: legacyData.value.refresh_token,
        expiry_date: legacyData.value.expiry_date,
      });

      return true;
    }

    initializeDriveClient({
      access_token: data.value.access_token,
      refresh_token: data.value.refresh_token,
      expiry_date: data.value.expiry_date,
    });

    return true;
  } catch (error) {
    logger.error('Failed to initialize Drive for workspace', { error, workspaceId });
    return false;
  }
}

/**
 * List folders in Google Drive
 * GET /api/drive/folders
 * Query params:
 *   - parentId: Folder ID to list children of (default: 'root')
 *   - pageToken: Pagination token from previous response
 */
driveRouter.get('/folders', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const { parentId, pageToken } = req.query as {
      parentId?: string;
      pageToken?: string;
    };

    // Initialize Drive client for this workspace
    if (!isDriveClientInitialized()) {
      const initialized = await initializeDriveForWorkspace(workspaceId);
      if (!initialized) {
        return res.status(400).json({
          error: 'Google Drive not connected',
          code: 'DRIVE_NOT_CONNECTED',
        });
      }
    }

    // List folders
    const result = await listFolders(parentId, pageToken);

    res.json({
      folders: result.folders,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    logger.error('Failed to list Drive folders', { error });

    // Check for auth errors
    if (error instanceof Error && error.message.includes('invalid_grant')) {
      return res.status(401).json({
        error: 'Google Drive authorization expired. Please reconnect.',
        code: 'DRIVE_AUTH_EXPIRED',
      });
    }

    res.status(500).json({
      error: 'Failed to list folders',
      code: 'DRIVE_ERROR',
    });
  }
});

/**
 * Check if Google Drive is connected for this workspace
 * GET /api/drive/status
 */
driveRouter.get('/status', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Check for workspace-specific tokens
    const { data } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .eq('workspace_id', workspaceId)
      .single();

    if (data?.value?.access_token) {
      return res.json({
        connected: true,
        connectedAt: data.value.connected_at ?? null,
      });
    }

    // Check for legacy global tokens
    const { data: legacyData } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .is('workspace_id', null)
      .single();

    if (legacyData?.value?.access_token) {
      return res.json({
        connected: true,
        connectedAt: legacyData.value.connected_at ?? null,
        legacy: true,
      });
    }

    res.json({
      connected: false,
      connectedAt: null,
    });
  } catch (error) {
    logger.error('Failed to check Drive status', { error });
    res.json({
      connected: false,
      connectedAt: null,
    });
  }
});
