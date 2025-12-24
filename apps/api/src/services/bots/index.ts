/**
 * Bot Management Service
 * Handles CRUD operations for bots, folders, and channels
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import type {
  Bot,
  BotCreateInput,
  BotUpdateInput,
  BotDriveFolder,
  BotDriveFolderInput,
  BotChannel,
  BotChannelInput,
  BotStats,
  BotWithStats,
  DocumentCategory,
} from '@cluebase/shared';

/**
 * Converts snake_case database row to camelCase Bot type
 */
function mapBotRow(row: Record<string, unknown>): Bot {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: row.description as string | null,
    avatarUrl: row.avatar_url as string | null,
    slackBotToken: row.slack_bot_token as string | null,
    slackAppToken: row.slack_app_token as string | null,
    slackSigningSecret: row.slack_signing_secret as string | null,
    slackBotUserId: row.slack_bot_user_id as string | null,
    systemInstructions: row.system_instructions as string,
    personality: row.personality as string,
    temperature: row.temperature as number,
    maxResponseLength: row.max_response_length as number,
    includeSharedKnowledge: row.include_shared_knowledge as boolean,
    categories: row.categories as DocumentCategory[],
    status: row.status as Bot['status'],
    isDefault: row.is_default as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapFolderRow(row: Record<string, unknown>): BotDriveFolder {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    botId: row.bot_id as string,
    driveFolderId: row.drive_folder_id as string,
    folderName: row.folder_name as string,
    category: row.category as DocumentCategory,
    isActive: row.is_active as boolean,
    lastSynced: row.last_synced ? new Date(row.last_synced as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

function mapChannelRow(row: Record<string, unknown>): BotChannel {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    botId: row.bot_id as string,
    slackChannelId: row.slack_channel_id as string,
    channelName: row.channel_name as string | null,
    isActive: row.is_active as boolean,
    createdAt: new Date(row.created_at as string),
  };
}

// ============================================
// BOT CRUD OPERATIONS
// ============================================

export async function listBots(): Promise<BotWithStats[]> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to list bots', { error });
    throw error;
  }

  const bots = (data ?? []).map(mapBotRow);

  // Get stats for each bot
  const botsWithStats: BotWithStats[] = await Promise.all(
    bots.map(async (bot) => {
      const stats = await getBotStats(bot.id);
      const folders = await listBotFolders(bot.id);
      const channels = await listBotChannels(bot.id);
      return { ...bot, stats, folders, channels };
    })
  );

  return botsWithStats;
}

export async function getBot(id: string): Promise<BotWithStats | null> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get bot', { error, id });
    throw error;
  }

  const bot = mapBotRow(data);
  const stats = await getBotStats(id);
  const folders = await listBotFolders(id);
  const channels = await listBotChannels(id);

  return { ...bot, stats, folders, channels };
}

export async function getBotBySlug(slug: string): Promise<Bot | null> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get bot by slug', { error, slug });
    throw error;
  }

  return mapBotRow(data);
}

export async function getDefaultBot(): Promise<Bot | null> {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('is_default', true)
    .eq('status', 'active')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to get default bot', { error });
    throw error;
  }

  return mapBotRow(data);
}

/**
 * Custom error for duplicate Slack bot token
 */
export class DuplicateBotTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateBotTokenError';
  }
}

/**
 * Check if a Slack bot token is already in use by another bot
 */
async function checkTokenUniqueness(token: string, excludeBotId?: string): Promise<void> {
  if (!token) return;

  const query = supabase
    .from('bots')
    .select('id, workspace_id')
    .eq('slack_bot_token', token);

  // Exclude current bot when updating
  if (excludeBotId) {
    query.neq('id', excludeBotId);
  }

  const { data: existingBot } = await query.single();

  if (existingBot) {
    throw new DuplicateBotTokenError(
      'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.'
    );
  }
}

export async function createBot(input: BotCreateInput): Promise<Bot> {
  // Check for duplicate token before creating
  if (input.slackBotToken) {
    await checkTokenUniqueness(input.slackBotToken);
  }

  const { data, error } = await supabase
    .from('bots')
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      avatar_url: input.avatarUrl ?? null,
      slack_bot_token: input.slackBotToken ?? null,
      slack_app_token: input.slackAppToken ?? null,
      slack_signing_secret: input.slackSigningSecret ?? null,
      system_instructions: input.systemInstructions ?? 'You are a helpful assistant.',
      personality: input.personality ?? 'friendly and professional',
      temperature: input.temperature ?? 0.3,
      max_response_length: input.maxResponseLength ?? 2000,
      include_shared_knowledge: input.includeSharedKnowledge ?? true,
      categories: input.categories ?? [],
      status: 'configuring',
      is_default: false,
    })
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505' && error.message?.includes('slack_bot_token')) {
      throw new DuplicateBotTokenError(
        'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.'
      );
    }
    logger.error('Failed to create bot', { error, input });
    throw error;
  }

  logger.info('Bot created', { id: data.id, name: input.name, slug: input.slug });
  return mapBotRow(data);
}

export async function updateBot(id: string, input: BotUpdateInput): Promise<Bot> {
  // Check for duplicate token before updating (if token is being changed)
  if (input.slackBotToken) {
    await checkTokenUniqueness(input.slackBotToken, id);
  }

  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
  if (input.slackBotToken !== undefined) updateData.slack_bot_token = input.slackBotToken;
  if (input.slackAppToken !== undefined) updateData.slack_app_token = input.slackAppToken;
  if (input.slackSigningSecret !== undefined) updateData.slack_signing_secret = input.slackSigningSecret;
  if (input.systemInstructions !== undefined) updateData.system_instructions = input.systemInstructions;
  if (input.personality !== undefined) updateData.personality = input.personality;
  if (input.temperature !== undefined) updateData.temperature = input.temperature;
  if (input.maxResponseLength !== undefined) updateData.max_response_length = input.maxResponseLength;
  if (input.includeSharedKnowledge !== undefined) updateData.include_shared_knowledge = input.includeSharedKnowledge;
  if (input.categories !== undefined) updateData.categories = input.categories;
  if (input.status !== undefined) updateData.status = input.status;

  const { data, error } = await supabase
    .from('bots')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505' && error.message?.includes('slack_bot_token')) {
      throw new DuplicateBotTokenError(
        'This Slack bot is already registered to another workspace. Each Slack bot can only be used by one workspace.'
      );
    }
    logger.error('Failed to update bot', { error, id, input });
    throw error;
  }

  logger.info('Bot updated', { id, updates: Object.keys(updateData) });
  return mapBotRow(data);
}

export async function deleteBot(id: string): Promise<void> {
  // Don't allow deleting default bot
  const { data: bot } = await supabase
    .from('bots')
    .select('is_default')
    .eq('id', id)
    .single();

  if (bot?.is_default) {
    throw new Error('Cannot delete the default bot');
  }

  const { error } = await supabase
    .from('bots')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Failed to delete bot', { error, id });
    throw error;
  }

  logger.info('Bot deleted', { id });
}

// ============================================
// BOT STATS
// ============================================

export async function getBotStats(botId: string): Promise<BotStats> {
  // Get document count
  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .or(`bot_id.eq.${botId},category.eq.shared`);

  // Get chunk count
  const { data: chunkData } = await supabase
    .from('document_chunks')
    .select('id, document_id')
    .limit(10000);

  // Get conversation count
  const { count: convCount } = await supabase
    .from('thread_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', botId);

  // Get message count
  const { data: sessions } = await supabase
    .from('thread_sessions')
    .select('id')
    .eq('bot_id', botId);

  const sessionIds = sessions?.map(s => s.id) ?? [];
  let msgCount = 0;
  if (sessionIds.length > 0) {
    const { count } = await supabase
      .from('thread_messages')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    msgCount = count ?? 0;
  }

  // Get channel count
  const { count: channelCount } = await supabase
    .from('bot_channels')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', botId)
    .eq('is_active', true);

  return {
    totalDocuments: docCount ?? 0,
    totalChunks: chunkData?.length ?? 0,
    totalConversations: convCount ?? 0,
    totalMessages: msgCount,
    activeChannels: channelCount ?? 0,
  };
}

// ============================================
// BOT FOLDERS
// ============================================

export async function listBotFolders(botId: string): Promise<BotDriveFolder[]> {
  const { data, error } = await supabase
    .from('bot_drive_folders')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to list bot folders', { error, botId });
    throw error;
  }

  return (data ?? []).map(mapFolderRow);
}

export async function addBotFolder(input: BotDriveFolderInput): Promise<BotDriveFolder> {
  const { data, error } = await supabase
    .from('bot_drive_folders')
    .insert({
      bot_id: input.botId,
      drive_folder_id: input.driveFolderId,
      folder_name: input.folderName,
      category: input.category ?? 'custom',
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to add bot folder', { error, input });
    throw error;
  }

  logger.info('Bot folder added', { botId: input.botId, folderId: input.driveFolderId });
  return mapFolderRow(data);
}

export async function removeBotFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('bot_drive_folders')
    .delete()
    .eq('id', folderId);

  if (error) {
    logger.error('Failed to remove bot folder', { error, folderId });
    throw error;
  }

  logger.info('Bot folder removed', { folderId });
}

// ============================================
// BOT CHANNELS
// ============================================

export async function listBotChannels(botId: string): Promise<BotChannel[]> {
  const { data, error } = await supabase
    .from('bot_channels')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to list bot channels', { error, botId });
    throw error;
  }

  return (data ?? []).map(mapChannelRow);
}

export async function addBotChannel(input: BotChannelInput): Promise<BotChannel> {
  const { data, error } = await supabase
    .from('bot_channels')
    .insert({
      bot_id: input.botId,
      slack_channel_id: input.slackChannelId,
      channel_name: input.channelName ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to add bot channel', { error, input });
    throw error;
  }

  logger.info('Bot channel added', { botId: input.botId, channelId: input.slackChannelId });
  return mapChannelRow(data);
}

export async function removeBotChannel(channelId: string): Promise<void> {
  const { error } = await supabase
    .from('bot_channels')
    .delete()
    .eq('id', channelId);

  if (error) {
    logger.error('Failed to remove bot channel', { error, channelId });
    throw error;
  }

  logger.info('Bot channel removed', { channelId });
}

// ============================================
// BOT FOR CHANNEL LOOKUP
// ============================================

export async function getBotForChannel(channelId: string): Promise<Bot | null> {
  // First check explicit channel mapping
  const { data: mapping } = await supabase
    .from('bot_channels')
    .select('bot_id')
    .eq('slack_channel_id', channelId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (mapping?.bot_id) {
    const { data: bot } = await supabase
      .from('bots')
      .select('*')
      .eq('id', mapping.bot_id)
      .eq('status', 'active')
      .single();

    if (bot) return mapBotRow(bot);
  }

  // Fall back to default bot
  return getDefaultBot();
}
