/**
 * Setup API routes - SaaS Multi-Tenant Edition
 * First-time configuration wizard endpoints for workspace onboarding
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { createBot } from '../services/bots/index.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { setupTestRateLimiter, setupCompleteRateLimiter } from '../middleware/rateLimit.js';
import { TIER_CONFIGS } from '@cluebase/shared';
import { fullSync as syncGoogleDrive } from '../services/google-drive/sync.js';
import { isDriveClientInitialized } from '../services/google-drive/client.js';
import { scrapeWebsite } from '../services/scraper/website.js';

export const setupRouter = Router();

// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================

const testSlackSchema = z.object({
  botToken: z.string()
    .min(1, 'Bot Token is required')
    .refine(val => val.startsWith('xoxb-'), 'Bot Token should start with "xoxb-"'),
  appToken: z.string()
    .min(1, 'App Token is required')
    .refine(val => val.startsWith('xapp-'), 'App Token should start with "xapp-"'),
});

const setupCompleteSchema = z.object({
  config: z.object({
    workspaceId: z.string().uuid().optional(),
    workspace: z.object({
      name: z.string().min(1, 'Workspace name is required').max(100),
      slug: z.string().min(1, 'Workspace slug is required').max(50),
    }),
    slack: z.object({
      botToken: z.string()
        .min(1, 'Bot Token is required')
        .refine(val => val.startsWith('xoxb-'), 'Bot Token should start with "xoxb-"'),
      appToken: z.string()
        .min(1, 'App Token is required')
        .refine(val => val.startsWith('xapp-'), 'App Token should start with "xapp-"'),
      signingSecret: z.string().max(100).optional(),
    }),
    googleDrive: z.object({
      authenticated: z.boolean().optional(),
      selectedFolders: z.array(z.object({
        id: z.string(),
        name: z.string(),
      })).optional(),
    }).optional(),
    website: z.object({
      url: z.string().url('Invalid URL').optional().or(z.literal('')),
      maxPages: z.number().min(1).max(1000).optional(),
    }).optional(),
    bot: z.object({
      name: z.string().min(1, 'Bot name is required').max(100),
      slug: z.string().min(1, 'Bot slug is required').max(50),
      botType: z.enum(['general', 'support', 'sales', 'hr', 'technical']).optional(),
      personality: z.string().max(1000).optional(),
      instructions: z.string().max(5000).optional(),
    }),
  }),
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

/**
 * Generic validation middleware factory for Zod schemas
 * SECURITY: Validates request body against schema before processing
 */
function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Setup validation failed', {
          path: req.path,
          errors: error.errors,
        });
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

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
 * SECURITY: Requires authentication to query specific workspace status
 * Unauthenticated requests only get generic "not completed" status
 */
setupRouter.get('/status', async (req, res) => {
  try {
    let workspaceId: string | undefined;
    const requestedWorkspaceId = req.query.workspaceId as string | undefined;

    // Check for workspace from auth middleware (if applied upstream)
    if (req.workspace?.id) {
      workspaceId = req.workspace.id;
    }

    // SECURITY: If a workspaceId is requested via query param, verify ownership
    if (requestedWorkspaceId && !workspaceId) {
      // Try to authenticate using Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          // Verify user is a member of the requested workspace
          const { data: membership } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .eq('workspace_id', requestedWorkspaceId)
            .eq('is_active', true)
            .single();

          if (membership) {
            workspaceId = requestedWorkspaceId;
          } else {
            // User is authenticated but not a member of requested workspace
            // SECURITY: Don't reveal workspace existence - return generic status
            logger.warn('Setup status: unauthorized workspace access attempt', {
              userId: user.id,
              requestedWorkspaceId,
            });
          }
        }
      }
      // If no valid auth or not a member, workspaceId remains undefined
    }

    if (!workspaceId) {
      // Return default status for unauthenticated users or users without workspace access
      // SECURITY: Don't reveal whether workspace exists or not
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
    // SECURITY: Only query with 'id' column, don't expose token status
    const { data: bots, error: botsError } = await supabase
      .from('bots')
      .select('id')
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

    // Check if any bot has Slack configured (separate query to avoid token exposure)
    const { data: slackConfigured } = await supabase
      .from('bots')
      .select('id')
      .eq('workspace_id', workspaceId)
      .not('slack_bot_token', 'is', null)
      .limit(1);

    const hasBot = Boolean(bots && bots.length > 0);
    const hasSlack = Boolean(slackConfigured && slackConfigured.length > 0);
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
 * SECURITY: Rate limited to 10 tests per minute per IP, validated with Zod
 */
setupRouter.post('/test-slack', setupTestRateLimiter, validateBody(testSlackSchema), async (req, res) => {
  try {
    // Body is validated by Zod middleware (token format already verified)
    // appToken is validated by Zod but not needed for auth.test API call
    const { botToken } = req.body;

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
 * SECURITY: Rate limited to 3 completions per minute per IP (resource-intensive), validated with Zod
 */
setupRouter.post('/complete', setupCompleteRateLimiter, authenticate, validateBody(setupCompleteSchema), async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Body is validated by Zod middleware
    const { config } = req.body;
    const { workspaceId: providedWorkspaceId, workspace, slack, googleDrive, website, bot } = config;

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

    // Note: Slack and bot configuration validated by Zod middleware

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
      botType: bot.botType ?? 'general',
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
 * SECURITY: Requires authentication and workspace membership verification
 */
setupRouter.delete('/reset', authenticate, async (req, res) => {
  try {
    // SECURITY: Block in production regardless of authentication
    if (env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Setup reset is not allowed in production',
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const workspaceId = req.query.workspaceId as string | undefined;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: 'Workspace ID is required',
      });
    }

    // SECURITY: Verify user is an owner of the workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (!membership || membership.role !== 'owner') {
      logger.warn('Setup reset: unauthorized attempt', { userId, workspaceId });
      return res.status(403).json({
        success: false,
        error: 'Only workspace owners can reset setup',
      });
    }

    await supabase
      .from('bot_config')
      .delete()
      .eq('workspace_id', workspaceId)
      .in('key', [SETUP_STATUS_KEY, SETUP_CONFIG_KEY]);

    logger.info('Setup status reset', { workspaceId, userId });

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
