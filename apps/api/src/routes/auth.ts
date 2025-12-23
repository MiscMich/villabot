/**
 * Authentication routes
 * Google OAuth flow for Drive access
 */

import { Router } from 'express';
import { getAuthUrl, exchangeCodeForTokens, initializeDriveClient } from '../services/google-drive/client.js';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const authRouter = Router();

const TOKENS_KEY = 'google_drive_tokens';

/**
 * Get Google OAuth URL
 */
authRouter.get('/google', (_req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error('Failed to generate auth URL', { error });
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * Google OAuth callback
 */
authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Store tokens securely
    await supabase
      .from('bot_config')
      .upsert({
        key: TOKENS_KEY,
        value: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          connected_at: new Date().toISOString(),
        },
      });

    logger.info('Google Drive connected successfully');

    // Redirect based on state - setup wizard or settings page
    if (state === 'setup') {
      res.redirect(`${env.APP_URL}/setup?google_auth=success`);
    } else {
      res.redirect(`${env.APP_URL}/settings?google_connected=true`);
    }
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    // Redirect with error state
    const state = req.query.state;
    if (state === 'setup') {
      res.redirect(`${env.APP_URL}/setup?google_auth=error`);
    } else {
      res.redirect(`${env.APP_URL}/settings?google_connected=false`);
    }
  }
});

/**
 * Get connection status
 */
authRouter.get('/status', async (_req, res) => {
  try {
    const { data } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .single();

    const isConnected = !!data?.value?.access_token;
    const connectedAt = data?.value?.connected_at ?? null;

    res.json({
      google: {
        connected: isConnected,
        connectedAt,
      },
    });
  } catch (error) {
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
 */
authRouter.delete('/google', async (_req, res) => {
  try {
    await supabase
      .from('bot_config')
      .delete()
      .eq('key', TOKENS_KEY);

    logger.info('Google Drive disconnected');
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect Google Drive', { error });
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * Initialize Drive client from stored tokens (called on startup)
 */
export async function initializeDriveFromStoredTokens(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .single();

    if (!data?.value?.access_token) {
      logger.info('No stored Google Drive tokens found');
      return false;
    }

    initializeDriveClient({
      access_token: data.value.access_token,
      refresh_token: data.value.refresh_token,
      expiry_date: data.value.expiry_date,
    });

    logger.info('Google Drive client initialized from stored tokens');
    return true;
  } catch (error) {
    logger.warn('Failed to initialize Drive from stored tokens', { error });
    return false;
  }
}
