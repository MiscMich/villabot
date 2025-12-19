/**
 * Slack-related types
 */

export interface SlackMessage {
  channelId: string;
  userId: string;
  text: string;
  threadTs?: string;
  ts: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isEnabled: boolean;
  config: ChannelConfig;
}

export interface ChannelConfig {
  confidenceThreshold: number; // 0.0 - 1.0
  responseDelay: number; // milliseconds
  responseStyle: 'formal' | 'casual' | 'friendly';
  quietHours: QuietHours | null;
  topicBlocklist: string[];
}

export interface QuietHours {
  start: string; // HH:MM format
  end: string; // HH:MM format
  timezone: string;
}

export interface IntentClassification {
  shouldRespond: boolean;
  confidence: number;
  reasoning: string;
  detectedTopics: string[];
}

export interface SlackBotResponse {
  text: string;
  sources: SourceCitation[];
  confidence: number;
}

export interface SourceCitation {
  documentId: string;
  documentTitle: string;
  chunkPreview: string;
}
