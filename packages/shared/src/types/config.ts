/**
 * Bot configuration types
 */

export interface BotConfig {
  // General
  botName: string;
  botAvatar: string | null;
  timezone: string;

  // AI Settings
  geminiModel: string;
  temperature: number;
  maxResponseLength: number;
  systemPrompt: string;

  // Sync Settings
  drivePollIntervalMs: number;
  websiteScrapeSchedule: string; // cron format

  // Default Channel Settings
  defaultConfidenceThreshold: number;
  defaultResponseDelay: number;
  defaultResponseStyle: 'formal' | 'casual' | 'friendly';
}

export interface ApiCredentials {
  geminiApiKey: string;
  slackBotToken: string;
  slackSigningSecret: string;
  slackAppToken: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  isActive: boolean;
  lastSynced: Date | null;
}

export interface WebsiteSource {
  id: string;
  url: string;
  isActive: boolean;
  lastScraped: Date | null;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  botName: 'Cluebase',
  botAvatar: null,
  timezone: 'America/Los_Angeles',
  geminiModel: 'gemini-1.5-flash',
  temperature: 0.3,
  maxResponseLength: 2000,
  systemPrompt: `You are Cluebase, a helpful AI assistant for your organization.
You answer questions about company policies, procedures, and documentation based on the provided context.
Always cite your sources. If you don't know the answer, say so honestly.
Be concise but thorough. Use bullet points for lists.`,
  drivePollIntervalMs: 300000, // 5 minutes
  websiteScrapeSchedule: '0 0 * * 0', // Weekly on Sunday
  defaultConfidenceThreshold: 0.7,
  defaultResponseDelay: 1000, // 1 second
  defaultResponseStyle: 'friendly',
};
