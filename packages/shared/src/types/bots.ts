/**
 * Bot types for multi-bot platform
 */

/**
 * @deprecated Use custom tags instead of predefined categories.
 * This type is kept for backwards compatibility but should not be used for new features.
 * Documents now use string[] tags for flexible categorization.
 */
export type DocumentCategory =
  | 'shared'
  | 'operations'
  | 'marketing'
  | 'sales'
  | 'hr'
  | 'technical'
  | 'custom';

export type BotStatus = 'active' | 'inactive' | 'configuring';

export interface Bot {
  id: string;
  workspaceId: string;  // Required for tenant isolation
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;

  // Slack Configuration
  slackBotToken: string | null;
  slackAppToken: string | null;
  slackSigningSecret: string | null;
  slackBotUserId: string | null;

  // AI Configuration
  systemInstructions: string;
  personality: string;
  temperature: number;
  maxResponseLength: number;

  // Knowledge Configuration
  includeSharedKnowledge: boolean;
  categories: DocumentCategory[];

  // Status
  status: BotStatus;
  isDefault: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface BotCreateInput {
  workspaceId: string;  // Required for tenant isolation
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  slackBotToken?: string;
  slackAppToken?: string;
  slackSigningSecret?: string;
  systemInstructions?: string;
  personality?: string;
  temperature?: number;
  maxResponseLength?: number;
  includeSharedKnowledge?: boolean;
  categories?: DocumentCategory[];
}

export interface BotUpdateInput {
  name?: string;
  description?: string;
  avatarUrl?: string;
  slackBotToken?: string;
  slackAppToken?: string;
  slackSigningSecret?: string;
  systemInstructions?: string;
  personality?: string;
  temperature?: number;
  maxResponseLength?: number;
  includeSharedKnowledge?: boolean;
  categories?: DocumentCategory[];
  status?: BotStatus;
}

export interface BotDriveFolder {
  id: string;
  workspaceId: string;  // Required for tenant isolation
  botId: string;
  driveFolderId: string;
  folderName: string;
  category: DocumentCategory;
  isActive: boolean;
  lastSynced: Date | null;
  createdAt: Date;
}

export interface BotDriveFolderInput {
  botId: string;
  driveFolderId: string;
  folderName: string;
  category?: DocumentCategory;
}

export interface BotChannel {
  id: string;
  workspaceId: string;  // Required for tenant isolation
  botId: string;
  slackChannelId: string;
  channelName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface BotChannelInput {
  botId: string;
  slackChannelId: string;
  channelName?: string;
}

export interface BotStats {
  totalDocuments: number;
  totalChunks: number;
  totalConversations: number;
  totalMessages: number;
  activeChannels: number;
}

export interface BotWithStats extends Bot {
  stats?: BotStats;
  folders?: BotDriveFolder[];
  channels?: BotChannel[];
}

// API Response types
export interface BotListResponse {
  bots: BotWithStats[];
  total: number;
}

export interface BotDetailResponse {
  bot: BotWithStats;
}

// Slack connection status
export interface BotSlackStatus {
  connected: boolean;
  botUserId: string | null;
  teamName: string | null;
  error: string | null;
}
