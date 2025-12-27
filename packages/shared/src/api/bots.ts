/**
 * Bot API Zod schemas
 * Covers bot CRUD, channels, folders, and Slack integration
 */

import { z } from 'zod';
import { BotTypeSchema, DocumentCategorySchema, NullableTimestampSchema } from './common.js';

// ============================================================================
// Bot Core Schemas
// ============================================================================

/** Bot entity schema */
export const BotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'error']),
  is_default: z.boolean(),
  bot_type: BotTypeSchema,
  system_prompt: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** Bot with sensitive fields (for detail view) */
export const BotDetailSchema = BotSchema.extend({
  slack_bot_token: z.string().nullable(),
  slack_app_token: z.string().nullable(),
});

// ============================================================================
// Bot API Requests
// ============================================================================

/** Create bot request */
export const CreateBotRequestSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  bot_type: BotTypeSchema.optional().default('general'),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  categories: z.array(DocumentCategorySchema).optional(),
  slack_bot_token: z.string().optional(),
  slack_app_token: z.string().optional(),
  slack_signing_secret: z.string().optional(),
});

/** Update bot request */
export const UpdateBotRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bot_type: BotTypeSchema.optional(),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  categories: z.array(DocumentCategorySchema).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  slackBotToken: z.string().nullable().optional(),
  slackAppToken: z.string().nullable().optional(),
  slackSigningSecret: z.string().nullable().optional(),
});

// ============================================================================
// Bot API Responses
// ============================================================================

/** List bots response */
export const ListBotsResponseSchema = z.object({
  bots: z.array(BotSchema),
  total: z.number(),
});

/** Get bot response */
export const GetBotResponseSchema = z.object({
  bot: BotDetailSchema,
});

/** Create bot response */
export const CreateBotResponseSchema = z.object({
  bot: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    bot_type: z.string().optional(),
  }),
});

// ============================================================================
// Bot Channels
// ============================================================================

export const BotChannelSchema = z.object({
  id: z.string().uuid(),
  slack_channel_id: z.string(),
  channel_name: z.string().nullable(),
  is_enabled: z.boolean(),
  created_at: z.string(),
});

export const ListBotChannelsResponseSchema = z.object({
  channels: z.array(BotChannelSchema),
});

export const AddBotChannelRequestSchema = z.object({
  slackChannelId: z.string(),
  channelName: z.string().optional(),
});

export const AddBotChannelResponseSchema = z.object({
  channel: z.object({
    id: z.string().uuid(),
    slack_channel_id: z.string(),
    channel_name: z.string().nullable(),
  }),
});

// ============================================================================
// Bot Folders
// ============================================================================

export const BotFolderSchema = z.object({
  id: z.string().uuid(),
  drive_folder_id: z.string(),
  folder_name: z.string(),
  category: z.string(),
  is_active: z.boolean(),
  last_synced: NullableTimestampSchema,
  created_at: z.string(),
});

export const ListBotFoldersResponseSchema = z.object({
  folders: z.array(BotFolderSchema),
});

export const AddBotFolderRequestSchema = z.object({
  driveFolderId: z.string(),
  folderName: z.string(),
  category: z.string().optional(),
});

export const AddBotFolderResponseSchema = z.object({
  folder: z.object({
    id: z.string().uuid(),
    drive_folder_id: z.string(),
    folder_name: z.string(),
  }),
});

// ============================================================================
// Slack Integration
// ============================================================================

export const TestSlackCredentialsRequestSchema = z.object({
  botToken: z.string(),
  appToken: z.string(),
  signingSecret: z.string().optional(),
});

export const TestSlackCredentialsResponseSchema = z.object({
  valid: z.boolean(),
  teamName: z.string().optional(),
  error: z.string().optional(),
});

export const SlackChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  isPrivate: z.boolean(),
  isMember: z.boolean(),
  numMembers: z.number().optional(),
  isAssigned: z.boolean(),
});

export const ListSlackChannelsResponseSchema = z.object({
  channels: z.array(SlackChannelSchema),
});

// ============================================================================
// Bot Sync
// ============================================================================

export const TriggerBotSyncResponseSchema = z.object({
  success: z.boolean(),
  added: z.number(),
  updated: z.number(),
  removed: z.number(),
  errors: z.array(z.string()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type Bot = z.infer<typeof BotSchema>;
export type BotDetail = z.infer<typeof BotDetailSchema>;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;
export type UpdateBotRequest = z.infer<typeof UpdateBotRequestSchema>;
export type ListBotsResponse = z.infer<typeof ListBotsResponseSchema>;
export type GetBotResponse = z.infer<typeof GetBotResponseSchema>;
export type CreateBotResponse = z.infer<typeof CreateBotResponseSchema>;
export type BotChannel = z.infer<typeof BotChannelSchema>;
export type ListBotChannelsResponse = z.infer<typeof ListBotChannelsResponseSchema>;
export type AddBotChannelRequest = z.infer<typeof AddBotChannelRequestSchema>;
export type AddBotChannelResponse = z.infer<typeof AddBotChannelResponseSchema>;
export type BotFolder = z.infer<typeof BotFolderSchema>;
export type ListBotFoldersResponse = z.infer<typeof ListBotFoldersResponseSchema>;
export type AddBotFolderRequest = z.infer<typeof AddBotFolderRequestSchema>;
export type AddBotFolderResponse = z.infer<typeof AddBotFolderResponseSchema>;
export type TestSlackCredentialsRequest = z.infer<typeof TestSlackCredentialsRequestSchema>;
export type TestSlackCredentialsResponse = z.infer<typeof TestSlackCredentialsResponseSchema>;
export type SlackChannel = z.infer<typeof SlackChannelSchema>;
export type ListSlackChannelsResponse = z.infer<typeof ListSlackChannelsResponseSchema>;
export type TriggerBotSyncResponse = z.infer<typeof TriggerBotSyncResponseSchema>;
