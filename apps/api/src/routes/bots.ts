/**
 * Bot Management API Routes
 * CRUD operations for bots, folders, and channels
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger.js';
import { supabase } from '../services/supabase/client.js';
import { botManager } from '../services/slack/manager.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  checkUsageLimit,
  generalApiRateLimiter,
} from '../middleware/index.js';
import type { BotCreateInput, BotUpdateInput, BotType } from '@cluebase/shared';
import { getBotTypeConfig } from '@cluebase/shared';

export const botsRouter = Router();

// ============================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================

const botSlugSchema = z.string()
  .min(1, 'Slug is required')
  .max(50, 'Slug too long')
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only');

const createBotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  slug: botSlugSchema,
  bot_type: z.enum(['general', 'support', 'sales', 'hr', 'technical']).optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  personality: z.string().max(100, 'Personality too long').optional(),
  systemInstructions: z.string().max(5000, 'Instructions too long').optional(),
  slackBotToken: z.string()
    .refine(val => !val || val.startsWith('xoxb-'), 'Bot Token should start with "xoxb-"')
    .optional()
    .nullable(),
  slackAppToken: z.string()
    .refine(val => !val || val.startsWith('xapp-'), 'App Token should start with "xapp-"')
    .optional()
    .nullable(),
  slackSigningSecret: z.string().max(100).optional().nullable(),
});

const updateBotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bot_type: z.enum(['general', 'support', 'sales', 'hr', 'technical']).optional(),
  description: z.string().max(1000).optional(),
  personality: z.string().max(100).optional(),
  systemInstructions: z.string().max(5000).optional(),
  status: z.enum(['active', 'inactive', 'error']).optional(),
  slackBotToken: z.string()
    .refine(val => !val || val.startsWith('xoxb-'), 'Bot Token should start with "xoxb-"')
    .optional()
    .nullable(),
  slackAppToken: z.string()
    .refine(val => !val || val.startsWith('xapp-'), 'App Token should start with "xapp-"')
    .optional()
    .nullable(),
  slackSigningSecret: z.string().max(100).optional().nullable(),
});

const addFolderSchema = z.object({
  driveFolderId: z.string().min(1, 'Drive folder ID is required'),
  folderName: z.string().min(1, 'Folder name is required').max(255, 'Folder name too long'),
  category: z.enum(['company_knowledge', 'internal_sops', 'marketing', 'sales', 'support', 'hr', 'technical', 'shared']).optional(),
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
        logger.warn('Bot validation failed', {
          path: req.path,
          errors: error.errors,
        });
        res.status(400).json({
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

// SECURITY: Define safe bot columns to exclude sensitive Slack tokens from API responses
// Slack tokens should NEVER be returned to the client - they're only used server-side
const BOT_SAFE_COLUMNS = `
  id,
  workspace_id,
  name,
  slug,
  bot_type,
  description,
  personality,
  system_instructions,
  status,
  is_default,
  created_at,
  updated_at
`;

// Apply authentication, workspace resolution, and rate limiting to all routes
// Order matters: authenticate first, then resolveWorkspace, then rate limiter
botsRouter.use(authenticate, resolveWorkspace, generalApiRateLimiter);

// ============================================
// BOT CRUD
// ============================================

/**
 * List all bots for the workspace
 * SECURITY: Returns safe columns only - no Slack tokens exposed
 */
botsRouter.get('/', async (req, res) => {
  try {
    // Use explicit column list to avoid exposing sensitive tokens
    const { data: bots, error } = await supabase
      .from('bots')
      .select(BOT_SAFE_COLUMNS)
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Check token presence status separately (for UI to show connection status)
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('id, slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('workspace_id', req.workspace!.id);

    // Merge token presence flags into response
    const botsWithStatus = (bots ?? []).map(bot => {
      const status = tokenStatus?.find(t => t.id === bot.id);
      return {
        ...bot,
        has_slack_bot_token: !!status?.slack_bot_token,
        has_slack_app_token: !!status?.slack_app_token,
        has_slack_signing_secret: !!status?.slack_signing_secret,
      };
    });

    res.json({ bots: botsWithStatus, total: botsWithStatus.length });
  } catch (error) {
    logger.error('Failed to list bots', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list bots' });
  }
});

/**
 * Get a single bot by ID
 * SECURITY: Returns safe columns only - no Slack tokens exposed
 */
botsRouter.get('/:id', async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .select(BOT_SAFE_COLUMNS)
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bot not found' });
      }
      throw error;
    }

    // Check token presence separately
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    res.json({
      bot: {
        ...bot,
        has_slack_bot_token: !!tokenStatus?.slack_bot_token,
        has_slack_app_token: !!tokenStatus?.slack_app_token,
        has_slack_signing_secret: !!tokenStatus?.slack_signing_secret,
      }
    });
  } catch (error) {
    logger.error('Failed to get bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

/**
 * Get a bot by slug
 * SECURITY: Returns safe columns only - no Slack tokens exposed
 */
botsRouter.get('/slug/:slug', async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .select(BOT_SAFE_COLUMNS)
      .eq('slug', req.params.slug)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bot not found' });
      }
      throw error;
    }

    // Check token presence separately
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('slug', req.params.slug)
      .eq('workspace_id', req.workspace!.id)
      .single();

    res.json({
      bot: {
        ...bot,
        has_slack_bot_token: !!tokenStatus?.slack_bot_token,
        has_slack_app_token: !!tokenStatus?.slack_app_token,
        has_slack_signing_secret: !!tokenStatus?.slack_signing_secret,
      }
    });
  } catch (error) {
    logger.error('Failed to get bot by slug', { error, slug: req.params.slug, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

/**
 * Create a new bot
 * SECURITY: Validated with Zod schema
 */
botsRouter.post('/', requireWorkspaceAdmin, checkUsageLimit('bots'), validateBody(createBotSchema), async (req, res) => {
  try {
    // Body is validated by Zod middleware
    const input: BotCreateInput = req.body;
    const workspaceId = req.workspace!.id;

    // Check if slug already exists in this workspace
    const { data: existing } = await supabase
      .from('bots')
      .select('id')
      .eq('slug', input.slug)
      .eq('workspace_id', workspaceId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'A bot with this slug already exists' });
    }

    // Check if Slack token is already in use by another workspace
    if (input.slackBotToken) {
      const { data: tokenInUse } = await supabase
        .from('bots')
        .select('id, workspace_id')
        .eq('slack_bot_token', input.slackBotToken)
        .single();

      if (tokenInUse) {
        return res.status(409).json({
          error: 'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.',
          code: 'DUPLICATE_BOT_TOKEN',
        });
      }
    }

    // Get bot type config for auto-generating description and system instructions
    const botType: BotType = (input as { bot_type?: BotType }).bot_type ?? 'general';
    const typeConfig = getBotTypeConfig(botType);

    // Create the bot with auto-generated description and system instructions from bot type
    // SECURITY: Use safe columns in response to avoid exposing tokens
    const { data: bot, error } = await supabase
      .from('bots')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        slug: input.slug,
        bot_type: botType,
        description: input.description ?? typeConfig.description,
        personality: input.personality ?? 'helpful',
        system_instructions: input.systemInstructions ?? typeConfig.systemInstructions,
        slack_bot_token: input.slackBotToken ?? null,
        slack_app_token: input.slackAppToken ?? null,
        slack_signing_secret: input.slackSigningSecret ?? null,
        status: 'active',
        is_default: false,
      })
      .select(BOT_SAFE_COLUMNS)
      .single();

    if (error) {
      // Handle unique constraint violation (backup check in case of race condition)
      if (error.code === '23505' && error.message?.includes('slack_bot_token')) {
        return res.status(409).json({
          error: 'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.',
          code: 'DUPLICATE_BOT_TOKEN',
        });
      }
      throw error;
    }

    logger.info('Bot created', { botId: bot.id, workspaceId });
    // Include token presence flags (we know what we just saved)
    res.status(201).json({
      bot: {
        ...bot,
        has_slack_bot_token: !!input.slackBotToken,
        has_slack_app_token: !!input.slackAppToken,
        has_slack_signing_secret: !!input.slackSigningSecret,
      }
    });
  } catch (error) {
    logger.error('Failed to create bot', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

/**
 * Update a bot
 * SECURITY: Validated with Zod schema
 */
botsRouter.patch('/:id', requireWorkspaceAdmin, validateBody(updateBotSchema), async (req, res) => {
  try {
    // Body is validated by Zod middleware
    const input: BotUpdateInput = req.body;
    const workspaceId = req.workspace!.id;
    const botId = req.params.id;

    // Check if Slack token is already in use by another bot (not this one)
    if (input.slackBotToken) {
      const { data: tokenInUse } = await supabase
        .from('bots')
        .select('id, workspace_id')
        .eq('slack_bot_token', input.slackBotToken)
        .neq('id', botId)
        .single();

      if (tokenInUse) {
        return res.status(409).json({
          error: 'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.',
          code: 'DUPLICATE_BOT_TOKEN',
        });
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Handle bot_type change - auto-update description and system instructions
    const newBotType = (input as { bot_type?: BotType }).bot_type;
    if (newBotType !== undefined) {
      updateData.bot_type = newBotType;
      const typeConfig = getBotTypeConfig(newBotType);
      // Auto-update description and system instructions when bot type changes
      updateData.description = typeConfig.description;
      updateData.system_instructions = typeConfig.systemInstructions;
    }

    if (input.name !== undefined) updateData.name = input.name;
    // Only override auto-generated description if explicitly provided
    if (input.description !== undefined && !newBotType) updateData.description = input.description;
    if (input.personality !== undefined) updateData.personality = input.personality;
    // Only override auto-generated system instructions if explicitly provided
    if (input.systemInstructions !== undefined && !newBotType) updateData.system_instructions = input.systemInstructions;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.slackBotToken !== undefined) updateData.slack_bot_token = input.slackBotToken;
    if (input.slackAppToken !== undefined) updateData.slack_app_token = input.slackAppToken;
    if (input.slackSigningSecret !== undefined) updateData.slack_signing_secret = input.slackSigningSecret;

    // SECURITY: Use safe columns in response to avoid exposing tokens
    const { data: bot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .select(BOT_SAFE_COLUMNS)
      .single();

    if (error) {
      // Handle unique constraint violation (backup check in case of race condition)
      if (error.code === '23505' && error.message?.includes('slack_bot_token')) {
        return res.status(409).json({
          error: 'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.',
          code: 'DUPLICATE_BOT_TOKEN',
        });
      }
      throw error;
    }

    logger.info('Bot updated', { botId, workspaceId });

    // Get current token status for response
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .single();

    res.json({
      bot: {
        ...bot,
        has_slack_bot_token: !!tokenStatus?.slack_bot_token,
        has_slack_app_token: !!tokenStatus?.slack_app_token,
        has_slack_signing_secret: !!tokenStatus?.slack_signing_secret,
      }
    });
  } catch (error) {
    logger.error('Failed to update bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

/**
 * Delete a bot
 */
botsRouter.delete('/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Check if it's the default bot
    const { data: bot } = await supabase
      .from('bots')
      .select('is_default')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (bot?.is_default) {
      return res.status(400).json({ error: 'Cannot delete the default bot' });
    }

    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    logger.info('Bot deleted', { botId: req.params.id, workspaceId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// ============================================
// BOT FOLDERS
// ============================================

/**
 * List folders for a bot
 */
botsRouter.get('/:id/folders', async (req, res) => {
  try {
    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { data: folders, error } = await supabase
      .from('bot_drive_folders')
      .select('*')
      .eq('bot_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ folders: folders ?? [] });
  } catch (error) {
    logger.error('Failed to list bot folders', { error, botId: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

/**
 * Add a folder to a bot
 * SECURITY: Validated with Zod schema
 */
botsRouter.post('/:id/folders', requireWorkspaceAdmin, validateBody(addFolderSchema), async (req, res) => {
  try {
    // Body is validated by Zod middleware
    const { driveFolderId, folderName, category } = req.body;
    const workspaceId = req.workspace!.id;

    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { data: folder, error } = await supabase
      .from('bot_drive_folders')
      .insert({
        bot_id: req.params.id,
        workspace_id: workspaceId,
        drive_folder_id: driveFolderId,
        folder_name: folderName,
        category: category ?? 'shared',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot folder added', { botId: req.params.id, folderId: folder.id, workspaceId });
    res.status(201).json({ folder });
  } catch (error) {
    logger.error('Failed to add bot folder', { error, botId: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to add folder' });
  }
});

/**
 * Remove a folder from a bot
 */
botsRouter.delete('/:botId/folders/:folderId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.botId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { error } = await supabase
      .from('bot_drive_folders')
      .delete()
      .eq('id', req.params.folderId)
      .eq('bot_id', req.params.botId);

    if (error) throw error;

    logger.info('Bot folder removed', { botId: req.params.botId, folderId: req.params.folderId, workspaceId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove bot folder', { error, folderId: req.params.folderId, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to remove folder' });
  }
});

// ============================================
// BOT CHANNELS
// ============================================

/**
 * List channels for a bot
 */
botsRouter.get('/:id/channels', async (req, res) => {
  try {
    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { data: channels, error } = await supabase
      .from('bot_channels')
      .select('*')
      .eq('bot_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ channels: channels ?? [] });
  } catch (error) {
    logger.error('Failed to list bot channels', { error, botId: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

/**
 * Add a channel to a bot
 */
botsRouter.post('/:id/channels', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { slackChannelId, channelName } = req.body;
    const workspaceId = req.workspace!.id;

    if (!slackChannelId) {
      return res.status(400).json({ error: 'slackChannelId is required' });
    }

    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { data: channel, error } = await supabase
      .from('bot_channels')
      .insert({
        bot_id: req.params.id,
        slack_channel_id: slackChannelId,
        channel_name: channelName ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot channel added', { botId: req.params.id, channelId: channel.id, workspaceId });
    res.status(201).json({ channel });
  } catch (error) {
    logger.error('Failed to add bot channel', { error, botId: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to add channel' });
  }
});

/**
 * Remove a channel from a bot
 */
botsRouter.delete('/:botId/channels/:channelId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Verify bot belongs to workspace
    const { data: bot } = await supabase
      .from('bots')
      .select('id')
      .eq('id', req.params.botId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const { error } = await supabase
      .from('bot_channels')
      .delete()
      .eq('id', req.params.channelId)
      .eq('bot_id', req.params.botId);

    if (error) throw error;

    logger.info('Bot channel removed', { botId: req.params.botId, channelId: req.params.channelId, workspaceId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove bot channel', { error, channelId: req.params.channelId, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to remove channel' });
  }
});

/**
 * Fetch available Slack channels the bot can access
 * Uses the Slack users.conversations API
 */
botsRouter.get('/:id/slack-channels', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Get bot with Slack credentials
    const { data: bot } = await supabase
      .from('bots')
      .select('id, slack_bot_token')
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    if (!bot.slack_bot_token) {
      return res.status(400).json({ error: 'Bot has no Slack token configured' });
    }

    // Fetch channels from Slack API using cursor-based pagination
    const allChannels: Array<{
      id: string;
      name: string;
      is_member: boolean;
      is_private: boolean;
      num_members?: number;
    }> = [];

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
      });

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(
        `https://slack.com/api/users.conversations?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${bot.slack_bot_token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = await response.json() as {
        ok: boolean;
        error?: string;
        channels?: Array<{
          id: string;
          name: string;
          is_member: boolean;
          is_private: boolean;
          num_members?: number;
        }>;
        response_metadata?: {
          next_cursor?: string;
        };
      };

      if (!data.ok) {
        logger.error('Slack API error fetching channels', { error: data.error, botId: bot.id });
        return res.status(400).json({ error: `Slack API error: ${data.error}` });
      }

      if (data.channels) {
        allChannels.push(...data.channels);
      }

      cursor = data.response_metadata?.next_cursor;
      hasMore = !!cursor && cursor !== '';
    }

    // Get already assigned channels
    const { data: assignedChannels } = await supabase
      .from('bot_channels')
      .select('slack_channel_id')
      .eq('bot_id', req.params.id);

    const assignedIds = new Set(assignedChannels?.map(c => c.slack_channel_id) ?? []);

    // Format response with assignment status
    const channels = allChannels.map(channel => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      isMember: channel.is_member,
      numMembers: channel.num_members,
      isAssigned: assignedIds.has(channel.id),
    }));

    // Sort by name
    channels.sort((a, b) => a.name.localeCompare(b.name));

    logger.info('Fetched Slack channels for bot', { botId: bot.id, count: channels.length });
    res.json({ channels });
  } catch (error) {
    logger.error('Failed to fetch Slack channels', { error, botId: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to fetch Slack channels' });
  }
});

// ============================================
// BOT STATUS
// ============================================

/**
 * Activate a bot - updates status AND starts it in the BotManager
 * SECURITY: Uses safe columns to avoid exposing tokens
 */
botsRouter.post('/:id/activate', requireWorkspaceAdmin, async (req, res) => {
  try {
    const botId = req.params.id as string;
    const workspaceId = req.workspace!.id;

    const { data: bot, error } = await supabase
      .from('bots')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .select(BOT_SAFE_COLUMNS)
      .single();

    if (error) throw error;

    // Start the bot in the manager
    const started = await botManager.startBot(botId);

    // Get token status for response
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('id', botId)
      .single();

    logger.info('Bot activated', {
      id: botId,
      workspaceId,
      started,
    });

    res.json({
      bot: {
        ...bot,
        has_slack_bot_token: !!tokenStatus?.slack_bot_token,
        has_slack_app_token: !!tokenStatus?.slack_app_token,
        has_slack_signing_secret: !!tokenStatus?.slack_signing_secret,
      },
      started,
      message: started
        ? 'Bot activated and started successfully'
        : 'Bot activated but failed to start - check Slack credentials',
    });
  } catch (error) {
    logger.error('Failed to activate bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to activate bot' });
  }
});

/**
 * Deactivate a bot - updates status AND stops it in the BotManager
 * SECURITY: Uses safe columns to avoid exposing tokens
 */
botsRouter.post('/:id/deactivate', requireWorkspaceAdmin, async (req, res) => {
  try {
    const botId = req.params.id as string;
    const workspaceId = req.workspace!.id;

    // Stop the bot in the manager first
    const stopped = await botManager.stopBot(botId);

    const { data: bot, error } = await supabase
      .from('bots')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .select(BOT_SAFE_COLUMNS)
      .single();

    if (error) throw error;

    // Get token status for response
    const { data: tokenStatus } = await supabase
      .from('bots')
      .select('slack_bot_token, slack_app_token, slack_signing_secret')
      .eq('id', botId)
      .single();

    logger.info('Bot deactivated', {
      id: botId,
      workspaceId,
      stopped,
    });

    res.json({
      bot: {
        ...bot,
        has_slack_bot_token: !!tokenStatus?.slack_bot_token,
        has_slack_app_token: !!tokenStatus?.slack_app_token,
        has_slack_signing_secret: !!tokenStatus?.slack_signing_secret,
      },
      stopped,
      message: 'Bot deactivated successfully',
    });
  } catch (error) {
    logger.error('Failed to deactivate bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to deactivate bot' });
  }
});

// ============================================
// BOT HEALTH
// ============================================

/**
 * Get health status of all workspace bots
 */
botsRouter.get('/health/status', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Get all bots for this workspace with health info
    const { data: bots, error } = await supabase
      .from('bot_health_summary')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) {
      // If view doesn't exist, fall back to basic bot info + in-memory status
      const { data: basicBots, error: basicError } = await supabase
        .from('bots')
        .select('id, name, slug, status')
        .eq('workspace_id', workspaceId);

      if (basicError) throw basicError;

      // Enrich with in-memory health status from BotManager
      const healthStatus = botManager.getHealthStatus();
      const enrichedBots = (basicBots ?? []).map(bot => {
        const health = healthStatus.find(h => h.botId === bot.id);
        return {
          ...bot,
          is_healthy: health?.isHealthy ?? (bot.status === 'active'),
          is_running: health?.isRunning ?? false,
          consecutive_failures: health?.consecutiveFailures ?? 0,
          last_check_at: health?.lastCheckAt?.toISOString() ?? null,
          last_restart_at: health?.lastRestartAt?.toISOString() ?? null,
          error_message: health?.errorMessage ?? null,
        };
      });

      return res.json({
        bots: enrichedBots,
        summary: {
          total: enrichedBots.length,
          healthy: enrichedBots.filter(b => b.is_healthy).length,
          unhealthy: enrichedBots.filter(b => !b.is_healthy).length,
          running: enrichedBots.filter(b => b.is_running).length,
        },
      });
    }

    res.json({
      bots: bots ?? [],
      summary: {
        total: bots?.length ?? 0,
        healthy: bots?.filter(b => b.is_healthy).length ?? 0,
        unhealthy: bots?.filter(b => !b.is_healthy).length ?? 0,
        running: bots?.filter(b => b.is_running).length ?? 0,
      },
    });
  } catch (error) {
    logger.error('Failed to get bot health status', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

/**
 * Get health status of a specific bot
 */
botsRouter.get('/:id/health', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const botId = req.params.id;

    // Verify bot belongs to workspace
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name, slug, status')
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .single();

    if (botError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get in-memory health status
    const health = botManager.getBotHealth(botId);

    // Get health history
    const { data: history } = await supabase
      .from('bot_health_history')
      .select('*')
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      bot: {
        ...bot,
        is_healthy: health?.isHealthy ?? (bot.status === 'active'),
        is_running: health?.isRunning ?? false,
        consecutive_failures: health?.consecutiveFailures ?? 0,
        last_check_at: health?.lastCheckAt?.toISOString() ?? null,
        last_restart_at: health?.lastRestartAt?.toISOString() ?? null,
        error_message: health?.errorMessage ?? null,
      },
      history: history ?? [],
    });
  } catch (error) {
    logger.error('Failed to get bot health', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get bot health' });
  }
});

/**
 * Manually restart a bot
 */
botsRouter.post('/:id/restart', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const botId = req.params.id;

    if (!botId) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    // Verify bot belongs to workspace
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name')
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .single();

    if (botError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Restart the bot
    const success = await botManager.restartBot(botId);

    if (success) {
      // Log restart event
      await supabase.from('bot_health_history').insert({
        bot_id: botId,
        event_type: 'restart_success',
        is_healthy: true,
        consecutive_failures: 0,
      });

      logger.info('Bot manually restarted', { botId, workspaceId, triggeredBy: req.user?.id });
      res.json({ success: true, message: `Bot ${bot.name} restarted successfully` });
    } else {
      await supabase.from('bot_health_history').insert({
        bot_id: botId,
        event_type: 'restart_failure',
        is_healthy: false,
        error_message: 'Manual restart failed',
      });

      logger.error('Failed to restart bot manually', { botId, workspaceId });
      res.status(500).json({ error: 'Failed to restart bot' });
    }
  } catch (error) {
    logger.error('Error restarting bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to restart bot' });
  }
});

// ============================================
// SLACK CREDENTIAL TESTING
// ============================================

/**
 * Test Slack credentials before saving
 * POST /api/bots/test-slack
 */
botsRouter.post('/test-slack', async (req, res) => {
  try {
    const { botToken, appToken, signingSecret: _signingSecret } = req.body;

    if (!botToken || !appToken) {
      return res.status(400).json({
        valid: false,
        error: 'Bot Token and App Token are required'
      });
    }

    // Validate token formats
    if (!botToken.startsWith('xoxb-')) {
      return res.status(400).json({
        valid: false,
        error: 'Bot Token must start with xoxb-'
      });
    }

    if (!appToken.startsWith('xapp-')) {
      return res.status(400).json({
        valid: false,
        error: 'App Token must start with xapp-'
      });
    }

    // Test the bot token by calling auth.test
    const { WebClient } = await import('@slack/web-api');
    const client = new WebClient(botToken);

    const authResult = await client.auth.test();

    if (!authResult.ok) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid Bot Token - authentication failed'
      });
    }

    logger.info('Slack credentials validated successfully', {
      teamId: authResult.team_id,
      teamName: authResult.team,
      botUserId: authResult.user_id
    });

    res.json({
      valid: true,
      teamName: authResult.team,
      teamId: authResult.team_id,
      botUserId: authResult.user_id
    });
  } catch (error) {
    logger.error('Slack credential test failed', { error });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific Slack API errors
    if (errorMessage.includes('invalid_auth')) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid Bot Token - please check your token'
      });
    }

    if (errorMessage.includes('token_revoked')) {
      return res.status(400).json({
        valid: false,
        error: 'Bot Token has been revoked'
      });
    }

    res.status(400).json({
      valid: false,
      error: `Slack validation failed: ${errorMessage}`
    });
  }
});

// ============================================
// BOT SYNC TRIGGER
// ============================================

/**
 * Trigger sync for a specific bot
 * POST /api/bots/:id/sync
 */
botsRouter.post('/:id/sync', requireWorkspaceAdmin, async (req, res) => {
  try {
    const botId = req.params.id;
    const workspaceId = req.workspace!.id;

    // Verify bot exists and belongs to workspace
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name, status')
      .eq('id', botId)
      .eq('workspace_id', workspaceId)
      .single();

    if (botError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if bot has any folders assigned
    const { data: folders, error: foldersError } = await supabase
      .from('bot_drive_folders')
      .select('id, drive_folder_id, folder_name')
      .eq('bot_id', botId)
      .eq('is_active', true);

    if (foldersError) {
      logger.error('Failed to fetch bot folders', { error: foldersError, botId });
      return res.status(500).json({ error: 'Failed to check bot folders' });
    }

    if (!folders || folders.length === 0) {
      return res.status(400).json({
        started: false,
        error: 'No folders assigned to this bot. Add folders before syncing.'
      });
    }

    // Import sync service
    const { fullSync } = await import('../services/google-drive/sync.js');
    const { isDriveClientInitialized } = await import('../services/google-drive/client.js');

    // Check if Drive client is initialized
    if (!isDriveClientInitialized()) {
      return res.status(400).json({
        started: false,
        error: 'Google Drive not connected. Please connect Google Drive first.'
      });
    }

    logger.info('Starting bot sync', { botId, workspaceId, folderCount: folders.length });

    // Start sync in background (don't await)
    fullSync({ workspaceId, botId })
      .then((result) => {
        logger.info('Bot sync completed', { botId, workspaceId, result });
      })
      .catch((error) => {
        logger.error('Bot sync failed', { botId, workspaceId, error });
      });

    res.json({
      started: true,
      message: `Sync started for ${bot.name}. Syncing ${folders.length} folder(s).`,
      folders: folders.map(f => f.folder_name)
    });
  } catch (error) {
    logger.error('Error triggering bot sync', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});
