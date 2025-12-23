/**
 * Setup API routes - SaaS Multi-Tenant Edition
 * First-time configuration wizard endpoints for workspace onboarding
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { createBot } from '../services/bots/index.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { TIER_CONFIGS } from '@cluebase/shared';
import { fullSync as syncGoogleDrive } from '../services/google-drive/sync.js';
import { isDriveClientInitialized } from '../services/google-drive/client.js';
import { scrapeWebsite } from '../services/scraper/website.js';

export const setupRouter = Router();

const SETUP_STATUS_KEY = 'setup_status';
const SETUP_CONFIG_KEY = 'setup_config';

interface SetupStatus {
  completed: boolean;
  completedAt: string | null;
  steps: {
    workspace: boolean;
    slack: boolean;
    googleDrive: boolean;
    bot: boolean;
  };
}

/**
 * Get setup status - check if initial setup is complete for a workspace
 * Supports both authenticated (workspace context) and unauthenticated (query param) modes
 */
setupRouter.get('/status', async (req, res) => {
  try {
    // Try to get workspaceId from auth context first, fall back to query param
    let workspaceId: string | undefined;

    // Check for workspace from auth middleware (if applied upstream)
    if (req.workspace?.id) {
      workspaceId = req.workspace.id;
    } else {
      // Fall back to query param for unauthenticated setup check
      workspaceId = req.query.workspaceId as string | undefined;
    }

    if (!workspaceId) {
      // Return default status for new users without workspace
      return res.json({
        completed: false,
        completedAt: null,
        steps: {
          workspace: false,
          slack: false,
          googleDrive: false,
          bot: false,
        },
      });
    }

    // Check if workspace has any bots configured (indicates setup is complete)
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('id, slack_bot_token')
      .eq('workspace_id', workspaceId)
      .limit(1);

    if (botsError) {
      logger.error('Error checking bots for setup status', { workspaceId, error: botsError });
    }

    // Check if Google Drive folders are configured for any bot in this workspace
    const { data: driveFolders } = await supabase
      .from('bot_drive_folders')
      .select('id, bots!inner(workspace_id)')
      .eq('bots.workspace_id', workspaceId)
      .limit(1);

    const hasBot = Boolean(bots && bots.length > 0);
    const hasSlack = Boolean(hasBot && bots?.[0]?.slack_bot_token);
    const hasGoogleDrive = Boolean(driveFolders && driveFolders.length > 0);

    // Setup is complete if there's at least one bot configured
    const status: SetupStatus = {
      completed: hasBot,
      completedAt: hasBot ? new Date().toISOString() : null,
      steps: {
        workspace: true, // Workspace exists if we got here
        slack: hasSlack,
        googleDrive: hasGoogleDrive,
        bot: hasBot,
      },
    };

    res.json(status);
  } catch {
    // If config table doesn't exist or other error, setup is not complete
    res.json({
      completed: false,
      completedAt: null,
      steps: {
        workspace: false,
        slack: false,
        googleDrive: false,
        bot: false,
      },
    });
  }
});

/**
 * Test Slack credentials
 */
setupRouter.post('/test-slack', async (req, res) => {
  try {
    const { botToken, appToken } = req.body;

    if (!botToken || !appToken) {
      return res.status(400).json({
        success: false,
        error: 'Bot Token and App Token are required',
      });
    }

    // Validate token formats
    if (!botToken.startsWith('xoxb-')) {
      return res.status(400).json({
        success: false,
        error: 'Bot Token should start with "xoxb-"',
      });
    }

    if (!appToken.startsWith('xapp-')) {
      return res.status(400).json({
        success: false,
        error: 'App Token should start with "xapp-"',
      });
    }

    // Test the bot token by calling Slack's auth.test API directly
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const authResult = await authResponse.json() as { ok: boolean; team?: string; user?: string; error?: string };

    if (!authResult.ok) {
      throw new Error(authResult.error ?? 'Bot token authentication failed');
    }

    res.json({
      success: true,
      message: 'Slack credentials are valid',
      workspace: authResult.team,
      botUser: authResult.user,
    });
  } catch (error) {
    logger.error('Slack credentials test failed', { error });
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid Slack credentials',
    });
  }
});

/**
 * Get Google OAuth URL for setup
 */
setupRouter.get('/google-auth-url', async (_req, res) => {
  try {
    // Dynamically import to avoid initialization issues
    const { getAuthUrl } = await import('../services/google-drive/client.js');

    // Add setup=true parameter to redirect back to setup wizard
    const authUrl = getAuthUrl();
    const setupAuthUrl = authUrl + '&state=setup';

    res.json({ authUrl: setupAuthUrl });
  } catch (error) {
    logger.error('Failed to generate Google auth URL', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate Google authentication URL',
    });
  }
});

/**
 * Save setup configuration and complete setup
 * SaaS Edition: Creates workspace, configures Slack/Drive, and creates first bot
 */
setupRouter.post('/complete', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration is required',
      });
    }

    const { workspaceId: providedWorkspaceId, workspace, slack, googleDrive, website, bot } = config;

    // Validate workspace configuration
    if (!workspace?.name || !workspace?.slug) {
      return res.status(400).json({
        success: false,
        error: 'Workspace name and slug are required',
      });
    }

    // Get or create workspace
    let workspaceId = providedWorkspaceId;

    if (!workspaceId) {
      // Check if user already has a workspace
      const { data: existingMembership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (existingMembership) {
        workspaceId = existingMembership.workspace_id;
      } else {
        // Create new workspace for the user
        const tierConfig = TIER_CONFIGS.pro;
        const slug = workspace.slug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const { data: newWorkspace, error: wsError } = await supabase
          .from('workspaces')
          .insert({
            name: workspace.name,
            slug: `${slug}-${Date.now()}`,
            tier: 'pro',
            status: 'trialing',
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + tierConfig.trialDays * 24 * 60 * 60 * 1000).toISOString(),
            max_documents: tierConfig.limits.documents,
            max_queries_per_month: tierConfig.limits.queriesPerMonth,
            max_file_upload_mb: tierConfig.limits.fileUploadMb,
            max_team_members: tierConfig.limits.teamMembers,
            max_website_pages: tierConfig.limits.websitePages,
            max_bots: tierConfig.limits.bots,
            settings: { brandColor: '#f59e0b', timezone: 'UTC', weeklyDigest: false },
          })
          .select()
          .single();

        if (wsError || !newWorkspace) {
          logger.error('Failed to create workspace during setup', { error: wsError, userId });
          return res.status(500).json({
            success: false,
            error: 'Failed to create workspace',
          });
        }

        // Create owner membership - CRITICAL: must succeed or rollback
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: newWorkspace.id,
            user_id: userId,
            role: 'owner',
            is_active: true,
          });

        if (memberError) {
          // Rollback: delete the orphan workspace we just created
          await supabase.from('workspaces').delete().eq('id', newWorkspace.id);
          logger.error('Failed to create workspace membership, rolled back workspace', {
            workspaceId: newWorkspace.id,
            userId,
            error: memberError,
          });
          return res.status(500).json({
            success: false,
            error: 'Failed to associate user with workspace',
            details: memberError.message,
          });
        }

        // Update user profile with default workspace
        await supabase
          .from('user_profiles')
          .update({ default_workspace_id: newWorkspace.id })
          .eq('id', userId);

        workspaceId = newWorkspace.id;
        logger.info('Created workspace during setup', { workspaceId, userId, workspaceName: workspace.name });
      }
    }

    // Validate Slack configuration
    if (!slack?.botToken || !slack?.appToken) {
      return res.status(400).json({
        success: false,
        error: 'Slack configuration is incomplete',
      });
    }

    // Validate bot configuration
    if (!bot?.name || !bot?.slug) {
      return res.status(400).json({
        success: false,
        error: 'Bot configuration is incomplete',
      });
    }

    // Save setup configuration to database (for reference)
    const configToSave = {
      workspace: {
        name: workspace.name,
        slug: workspace.slug,
      },
      slack: {
        configured: true,
      },
      googleDrive: {
        authenticated: googleDrive?.authenticated ?? false,
        folders: googleDrive?.selectedFolders ?? [],
      },
      website: {
        url: website?.url ?? '',
        maxPages: website?.maxPages ?? 200,
      },
    };

    // Save setup config
    await supabase
      .from('bot_config')
      .upsert(
        {
          key: SETUP_CONFIG_KEY,
          value: configToSave,
          workspace_id: workspaceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,key' }
      );

    // Create the first bot with Slack credentials
    const newBot = await createBot({
      workspaceId,
      name: bot.name,
      slug: bot.slug,
      description: bot.personality ?? 'AI assistant powered by TeamBrain AI',
      systemInstructions: bot.instructions ?? undefined,
      slackBotToken: slack.botToken,
      slackAppToken: slack.appToken,
      slackSigningSecret: slack.signingSecret ?? undefined,
    });

    // Activate the bot and start it in the bot manager
    const { botManager } = await import('../services/slack/manager.js');

    // Update bot status to 'active'
    await supabase
      .from('bots')
      .update({ status: 'active', is_default: true })
      .eq('id', newBot.id);

    // Start the bot in the manager
    const botStarted = await botManager.startBot(newBot.id);
    if (botStarted) {
      logger.info('Bot started successfully during setup', { botId: newBot.id });
    } else {
      logger.warn('Bot created but failed to start - may need manual restart', { botId: newBot.id });
    }

    // Mark setup as complete
    const setupStatus: SetupStatus = {
      completed: true,
      completedAt: new Date().toISOString(),
      steps: {
        workspace: true,
        slack: true,
        googleDrive: googleDrive?.authenticated ?? false,
        bot: true,
      },
    };

    await supabase
      .from('bot_config')
      .upsert(
        {
          key: SETUP_STATUS_KEY,
          value: setupStatus,
          workspace_id: workspaceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,key' }
      );

    // Trigger initial sync operations in background (don't await)
    // These run asynchronously so setup completes immediately
    if (googleDrive?.authenticated && isDriveClientInitialized()) {
      syncGoogleDrive({ workspaceId })
        .then((result) => {
          logger.info('Initial Google Drive sync completed', {
            workspaceId,
            added: result.added,
            errors: result.errors.length,
          });
        })
        .catch((error) => {
          logger.error('Initial Google Drive sync failed', { workspaceId, error });
        });
    }

    if (website?.url) {
      scrapeWebsite({
        workspaceId,
        websiteUrl: website.url,
        maxPages: website.maxPages ?? 200,
      })
        .then((result) => {
          logger.info('Initial website scrape completed', {
            workspaceId,
            pagesScraped: result.pagesScraped,
            chunksCreated: result.chunksCreated,
            errors: result.errors.length,
          });
        })
        .catch((error) => {
          logger.error('Initial website scrape failed', { workspaceId, error });
        });
    }

    logger.info('Setup completed successfully', {
      workspaceId,
      botId: newBot.id,
      workspaceName: workspace.name,
    });

    res.json({
      success: true,
      message: 'Setup completed successfully',
      bot: newBot,
      workspace: {
        id: workspaceId,
        name: workspace.name,
        slug: workspace.slug,
      },
    });
  } catch (error) {
    // Enhanced error logging for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as { code?: string })?.code,
      details: (error as { details?: string })?.details,
      hint: (error as { hint?: string })?.hint,
      stack: error instanceof Error ? error.stack : undefined,
    };
    logger.error('Setup completion failed', { error: errorDetails });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete setup',
      details: errorDetails.code || errorDetails.details || undefined,
    });
  }
});

/**
 * Reset setup status (for development/testing)
 */
setupRouter.delete('/reset', async (req, res) => {
  try {
    if (env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Setup reset is not allowed in production',
      });
    }

    const workspaceId = req.query.workspaceId as string | undefined;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    await supabase
      .from('bot_config')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('key', [SETUP_STATUS_KEY, SETUP_CONFIG_KEY]);

    logger.info('Setup status reset', { workspaceId });

    res.json({
      success: true,
      message: 'Setup status has been reset',
    });
  } catch (error) {
    logger.error('Failed to reset setup', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to reset setup status',
    });
  }
});
