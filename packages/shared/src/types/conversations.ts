/**
 * Conversation and thread management types
 */

import type { DocumentCategory } from './bots.js';

export interface ThreadSession {
  id: string;
  slackChannelId: string;
  slackThreadTs: string;
  startedByUserId: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  botId: string | null;  // Which bot handled this conversation
}

export interface ThreadMessage {
  id: string;
  sessionId: string;
  slackUserId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceReference[];
  confidenceScore: number | null;
  feedbackRating: number | null; // 1-5
  createdAt: Date;
}

export interface SourceReference {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  relevanceScore: number;
}

export interface ConversationContext {
  threadSession: ThreadSession;
  messages: ThreadMessage[];
  relevantChunks: RetrievedChunk[];
  learnedFacts: LearnedFact[];
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
  rankScore: number;
  category?: DocumentCategory;  // For source attribution
}

export interface LearnedFact {
  id: string;
  fact: string;
  source: 'user_feedback' | 'correction';
  taughtByUserId: string;
  isVerified: boolean;
  createdAt: Date;
}
