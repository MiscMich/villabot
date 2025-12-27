/**
 * Authentication routes
 * Google OAuth flow for Drive access
 *
 * Security features:
 * - CSRF protection via cryptographic state tokens
 * - User authentication required for initiating OAuth
 * - Workspace ownership validation
 */

import { Router } from 'express';
import crypto from 'crypto';
import { getAuthUrl, exchangeCodeForTokens, initializeDriveClient } from '../services/google-drive/client.js';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export const authRouter = Router();

const TOKENS_KEY = 'google_drive_tokens';
const OAUTH_STATE_KEY = 'oauth_state_token';
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cryptographic CSRF token for OAuth state
 */
function generateStateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store OAuth state token with expiry
 */
async function storeStateToken(
  stateToken: string,
  userId: string,
  workspaceId: string | null,
  source: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MS).toISOString();

  await supabase.from('bot_config').insert({
    key: `${OAUTH_STATE_KEY}:${stateToken}`,
    workspace_id: workspaceId,
    value: {
      userId,
      workspaceId,
      source,
      expiresAt,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * Validate and consume OAuth state token (one-time use)
 * Returns null if invalid/expired, otherwise returns the stored context
 */
async function validateAndConsumeStateToken(
  stateToken: string
): Promise<{ userId: string; workspaceId: string | null; source: string } | null> {
  const { data, error } = await supabase
    .from('bot_config')
    .select('value, workspace_id')
    .eq('key', `${OAUTH_STATE_KEY}:${stateToken}`)
    .single();

  if (error || !data?.value) {
    logger.warn('OAuth state token not found or invalid', { stateToken: stateToken.slice(0, 8) + '...' });
    return null;
  }

  const { userId, workspaceId, source, expiresAt } = data.value as {
    userId: string;
    workspaceId: string | null;
    source: string;
    expiresAt: string;
  };

  // Check expiry
  if (new Date(expiresAt) < new Date()) {
    logger.warn('OAuth state token expired', { stateToken: stateToken.slice(0, 8) + '...' });
    // Clean up expired token
    await supabase.from('bot_config').delete().eq('key', `${OAUTH_STATE_KEY}:${stateToken}`);
    return null;
  }

  // Consume token (one-time use) - delete it
  await supabase.from('bot_config').delete().eq('key', `${OAUTH_STATE_KEY}:${stateToken}`);

  return { userId, workspaceId, source };
}

/**
 * Get Google OAuth URL
 * Query params:
 *   - workspaceId: The workspace to associate the Drive connection with
 *   - source: Where the auth was initiated from (settings, setup)
 *
 * Security: Requires authentication and generates CSRF state token
 */
authRouter.get('/google', authenticate, async (req, res) => {
  try {
    const { workspaceId, source } = req.query as { workspaceId?: string; source?: string };
    const userId = req.user!.id;

    // Validate workspace ownership if workspaceId provided
    if (workspaceId) {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (membershipError || !membership) {
        logger.warn('OAuth attempt for unauthorized workspace', { userId, workspaceId });
        res.status(403).json({ error: 'You do not have access to this workspace' });
        return;
      }

      // Only admins and owners can connect Drive
      if (!['admin', 'owner'].includes(membership.role)) {
        res.status(403).json({ error: 'Only workspace admins can connect Google Drive' });
        return;
      }
    }

    const authUrl = getAuthUrl();

    // Generate CSRF token and store with context
    const stateToken = generateStateToken();
    await storeStateToken(stateToken, userId, workspaceId || null, source || 'settings');

    const urlWithState = `${authUrl}&state=${encodeURIComponent(stateToken)}`;

    logger.info('OAuth flow initiated', {
      userId,
      workspaceId: workspaceId || null,
      source: source || 'settings',
    });

    res.json({ authUrl: urlWithState });
  } catch (error) {
    logger.error('Failed to generate auth URL', { error });
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * Google OAuth callback
 * State is now a CSRF token that maps to stored context
 *
 * Security: Validates CSRF token before processing
 */
authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      logger.warn('OAuth callback missing authorization code');
      res.redirect(`${env.APP_URL}/settings?google_connected=false&error=missing_code`);
      return;
    }

    if (!state || typeof state !== 'string') {
      logger.warn('OAuth callback missing state token (CSRF protection)');
      res.redirect(`${env.APP_URL}/settings?google_connected=false&error=invalid_state`);
      return;
    }

    // Validate CSRF token and get stored context
    const stateContext = await validateAndConsumeStateToken(state);

    if (!stateContext) {
      logger.warn('OAuth callback with invalid/expired state token', {
        stateToken: state.slice(0, 8) + '...',
      });
      res.redirect(`${env.APP_URL}/settings?google_connected=false&error=invalid_state`);
      return;
    }

    const { userId, workspaceId, source } = stateContext;
    const isSetup = source === 'setup';

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens with workspace context if available
    const tokenData = {
      key: TOKENS_KEY,
      workspace_id: workspaceId || null,
      value: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        connected_at: new Date().toISOString(),
        connected_by: userId,
      },
    };

    if (workspaceId) {
      // Store with workspace_id - use upsert with conflict handling
      await supabase
        .from('bot_config')
        .upsert(tokenData, { onConflict: 'workspace_id,key' });
      logger.info('Google Drive connected for workspace', { workspaceId, userId });
    } else {
      // Store as legacy (no workspace_id) - will be migrated when setup completes
      await supabase
        .from('bot_config')
        .upsert({
          key: TOKENS_KEY,
          workspace_id: null,
          value: tokenData.value,
        });
      logger.info('Google Drive connected (pending workspace association)', { userId });
    }

    // Redirect based on source
    if (isSetup) {
      res.redirect(`${env.APP_URL}/setup?google_auth=success`);
    } else {
      res.redirect(`${env.APP_URL}/settings?google_connected=true`);
    }
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    res.redirect(`${env.APP_URL}/settings?google_connected=false&error=exchange_failed`);
  }
});

/**
 * Get connection status
 * Query params:
 *   - workspaceId: Check status for specific workspace (required when authenticated)
 *
 * Security: Requires authentication to check workspace-specific status
 */
authRouter.get('/status', optionalAuth, async (req, res) => {
  try {
    const { workspaceId } = req.query as { workspaceId?: string };
    const userId = req.user?.id;

    // If workspaceId provided, validate access
    if (workspaceId && userId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'You do not have access to this workspace' });
        return;
      }
    }

    let data;

    if (workspaceId) {
      // Check for workspace-specific tokens first
      const { data: wsData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', TOKENS_KEY)
        .eq('workspace_id', workspaceId)
        .single();

      if (wsData?.value?.access_token) {
        data = wsData;
      } else {
        // Fall back to legacy tokens
        const { data: legacyData } = await supabase
          .from('bot_config')
          .select('value')
          .eq('key', TOKENS_KEY)
          .is('workspace_id', null)
          .single();
        data = legacyData;
      }
    } else {
      // No workspace specified - check for any tokens (legacy behavior)
      const { data: anyData } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', TOKENS_KEY)
        .single();
      data = anyData;
    }

    const isConnected = !!data?.value?.access_token;
    const connectedAt = data?.value?.connected_at ?? null;

    res.json({
      google: {
        connected: isConnected,
        connectedAt,
      },
    });
  } catch {
    res.json({
      google: {
        connected: false,
        connectedAt: null,
      },
    });
  }
});

/**
 * Disconnect Google Drive
 * Query params:
 *   - workspaceId: Disconnect for specific workspace (required)
 *
 * Security: Requires authentication and workspace admin role
 */
authRouter.delete('/google', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.query as { workspaceId?: string };
    const userId = req.user!.id;

    if (!workspaceId) {
      res.status(400).json({ error: 'workspaceId is required' });
      return;
    }

    // Validate workspace ownership/admin role
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      logger.warn('Disconnect attempt for unauthorized workspace', { userId, workspaceId });
      res.status(403).json({ error: 'You do not have access to this workspace' });
      return;
    }

    // Only admins and owners can disconnect Drive
    if (!['admin', 'owner'].includes(membership.role)) {
      res.status(403).json({ error: 'Only workspace admins can disconnect Google Drive' });
      return;
    }

    // Delete workspace-specific tokens
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', TOKENS_KEY)
      .eq('workspace_id', workspaceId);

    logger.info('Google Drive disconnected for workspace', { workspaceId, userId });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect Google Drive', { error });
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * Initialize Drive client from stored tokens (called on startup)
 * This is a fallback for legacy tokens - workspace-scoped initialization
 * should be done via initializeDriveForWorkspace in drive.ts
 */
export async function initializeDriveFromStoredTokens(): Promise<boolean> {
  try {
    // Try to find any workspace-scoped tokens first
    const { data: wsData } = await supabase
      .from('bot_config')
      .select('value, workspace_id')
      .eq('key', TOKENS_KEY)
      .not('workspace_id', 'is', null)
      .limit(1)
      .single();

    if (wsData?.value?.access_token) {
      initializeDriveClient({
        access_token: wsData.value.access_token,
        refresh_token: wsData.value.refresh_token,
        expiry_date: wsData.value.expiry_date,
      });
      logger.info('Google Drive client initialized from workspace tokens', {
        workspaceId: wsData.workspace_id
      });
      return true;
    }

    // Fall back to legacy tokens (no workspace_id)
    const { data: legacyData } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .is('workspace_id', null)
      .single();

    if (!legacyData?.value?.access_token) {
      logger.info('No stored Google Drive tokens found');
      return false;
    }

    initializeDriveClient({
      access_token: legacyData.value.access_token,
      refresh_token: legacyData.value.refresh_token,
      expiry_date: legacyData.value.expiry_date,
    });

    logger.info('Google Drive client initialized from legacy tokens');
    return true;
  } catch (error) {
    logger.warn('Failed to initialize Drive from stored tokens', { error });
    return false;
  }
}

/**
 * Migrate legacy Drive tokens (no workspace_id) to a specific workspace
 * Called by setup/complete when a workspace is created/associated
 */
export async function migrateLegacyDriveTokens(workspaceId: string): Promise<boolean> {
  try {
    // Check for legacy tokens
    const { data: legacyData } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .is('workspace_id', null)
      .single();

    if (!legacyData?.value?.access_token) {
      logger.debug('No legacy Drive tokens to migrate');
      return false;
    }

    // Check if workspace already has tokens
    const { data: existingData } = await supabase
      .from('bot_config')
      .select('id')
      .eq('key', TOKENS_KEY)
      .eq('workspace_id', workspaceId)
      .single();

    if (existingData) {
      logger.debug('Workspace already has Drive tokens, skipping migration', { workspaceId });
      return false;
    }

    // Create workspace-scoped token entry
    await supabase
      .from('bot_config')
      .insert({
        key: TOKENS_KEY,
        workspace_id: workspaceId,
        value: legacyData.value,
      });

    // Delete the legacy tokens
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', TOKENS_KEY)
      .is('workspace_id', null);

    logger.info('Migrated legacy Drive tokens to workspace', { workspaceId });
    return true;
  } catch (error) {
    logger.error('Failed to migrate legacy Drive tokens', { error, workspaceId });
    return false;
  }
}

/**
 * Clean up expired OAuth state tokens
 * Should be called periodically (e.g., every hour) to prevent token buildup
 */
export async function cleanupExpiredOAuthStateTokens(): Promise<number> {
  try {
    // Find all expired state tokens
    const { data: expiredTokens, error } = await supabase
      .from('bot_config')
      .select('key, value')
      .like('key', `${OAUTH_STATE_KEY}:%`);

    if (error || !expiredTokens) {
      logger.warn('Failed to fetch OAuth state tokens for cleanup', { error });
      return 0;
    }

    const now = new Date();
    let cleaned = 0;

    for (const token of expiredTokens) {
      const expiresAt = token.value?.expiresAt;
      if (expiresAt && new Date(expiresAt) < now) {
        await supabase.from('bot_config').delete().eq('key', token.key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired OAuth state tokens', { count: cleaned });
    }

    return cleaned;
  } catch (error) {
    logger.error('Error cleaning up OAuth state tokens', { error });
    return 0;
  }
}
