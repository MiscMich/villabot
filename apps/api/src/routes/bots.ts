/**
 * Bot Management API Routes
 * CRUD operations for bots, folders, and channels
 */

import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { supabase } from '../services/supabase/client.js';
import { botManager } from '../services/slack/manager.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  checkUsageLimit,
} from '../middleware/index.js';
import type { BotCreateInput, BotUpdateInput } from '@villa-paraiso/shared';

export const botsRouter = Router();

// Apply authentication and workspace resolution to all routes
botsRouter.use(authenticate, resolveWorkspace);

// ============================================
// BOT CRUD
// ============================================

/**
 * List all bots for the workspace
 */
botsRouter.get('/', async (req, res) => {
  try {
    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ bots: bots ?? [], total: bots?.length ?? 0 });
  } catch (error) {
    logger.error('Failed to list bots', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list bots' });
  }
});

/**
 * Get a single bot by ID
 */
botsRouter.get('/:id', async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bot not found' });
      }
      throw error;
    }

    res.json({ bot });
  } catch (error) {
    logger.error('Failed to get bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

/**
 * Get a bot by slug
 */
botsRouter.get('/slug/:slug', async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Bot not found' });
      }
      throw error;
    }

    res.json({ bot });
  } catch (error) {
    logger.error('Failed to get bot by slug', { error, slug: req.params.slug, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

/**
 * Create a new bot
 */
botsRouter.post('/', requireWorkspaceAdmin, checkUsageLimit('bots'), async (req, res) => {
  try {
    const input: BotCreateInput = req.body;
    const workspaceId = req.workspace!.id;

    // Validate required fields
    if (!input.name || !input.slug) {
      return res.status(400).json({ error: 'name and slug are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      return res.status(400).json({ error: 'slug must be lowercase letters, numbers, and hyphens only' });
    }

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

    // Create the bot
    const { data: bot, error } = await supabase
      .from('bots')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        personality: input.personality ?? 'helpful',
        system_instructions: input.systemInstructions ?? null,
        status: 'active',
        is_default: false,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot created', { botId: bot.id, workspaceId });
    res.status(201).json({ bot });
  } catch (error) {
    logger.error('Failed to create bot', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

/**
 * Update a bot
 */
botsRouter.patch('/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const input: BotUpdateInput = req.body;
    const workspaceId = req.workspace!.id;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.personality !== undefined) updateData.personality = input.personality;
    if (input.systemInstructions !== undefined) updateData.system_instructions = input.systemInstructions;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.slackBotToken !== undefined) updateData.slack_bot_token = input.slackBotToken;
    if (input.slackAppToken !== undefined) updateData.slack_app_token = input.slackAppToken;
    if (input.slackSigningSecret !== undefined) updateData.slack_signing_secret = input.slackSigningSecret;

    const { data: bot, error } = await supabase
      .from('bots')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot updated', { botId: req.params.id, workspaceId });
    res.json({ bot });
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
 */
botsRouter.post('/:id/folders', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { driveFolderId, folderName, category } = req.body;
    const workspaceId = req.workspace!.id;

    if (!driveFolderId || !folderName) {
      return res.status(400).json({ error: 'driveFolderId and folderName are required' });
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

    const { data: folder, error } = await supabase
      .from('bot_drive_folders')
      .insert({
        bot_id: req.params.id,
        workspace_id: workspaceId,
        drive_folder_id: driveFolderId,
        folder_name: folderName,
        category: category ?? 'company_knowledge',
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
        workspace_id: workspaceId,
        slack_channel_id: slackChannelId,
        channel_name: channelName ?? null,
        is_enabled: true,
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

// ============================================
// BOT STATUS
// ============================================

/**
 * Activate a bot
 */
botsRouter.post('/:id/activate', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot activated', { id: req.params.id, workspaceId: req.workspace!.id });
    res.json({ bot });
  } catch (error) {
    logger.error('Failed to activate bot', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to activate bot' });
  }
});

/**
 * Deactivate a bot
 */
botsRouter.post('/:id/deactivate', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { data: bot, error } = await supabase
      .from('bots')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Bot deactivated', { id: req.params.id, workspaceId: req.workspace!.id });
    res.json({ bot });
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
