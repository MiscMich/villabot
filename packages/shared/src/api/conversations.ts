/**
 * Conversation API Zod schemas
 * Covers thread sessions and messages
 */

import { z } from 'zod';
import { PaginationMetaSchema } from './common.js';

// ============================================================================
// Message Schemas
// ============================================================================

/** Message role enum */
export const MessageRoleSchema = z.enum(['user', 'assistant']);

/** Thread message schema */
export const ThreadMessageSchema = z.object({
  id: z.string().uuid(),
  slack_user_id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  sources: z.array(z.string()),
  confidence_score: z.number().nullable(),
  feedback_rating: z.number().nullable(),
  created_at: z.string(),
});

/** Last message preview schema */
export const LastMessagePreviewSchema = z.object({
  content: z.string(),
  role: MessageRoleSchema,
  created_at: z.string(),
});

// ============================================================================
// Conversation Schemas
// ============================================================================

/** Conversation list item schema */
export const ConversationListItemSchema = z.object({
  id: z.string().uuid(),
  slack_channel_id: z.string(),
  slack_thread_ts: z.string(),
  started_by_user_id: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  last_activity: z.string(),
  messageCount: z.number(),
  lastMessage: LastMessagePreviewSchema.nullable(),
});

/** Conversation detail schema */
export const ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  slack_channel_id: z.string(),
  slack_thread_ts: z.string(),
  started_by_user_id: z.string(),
  is_active: z.boolean(),
  created_at: z.string(),
  last_activity: z.string(),
  messages: z.array(ThreadMessageSchema),
});

// ============================================================================
// Conversation API Responses
// ============================================================================

/** List conversations response */
export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationListItemSchema),
  pagination: PaginationMetaSchema,
});

/** Get conversation response */
export const GetConversationResponseSchema = z.object({
  conversation: ConversationDetailSchema,
});

/** Conversation stats response */
export const ConversationStatsResponseSchema = z.object({
  stats: z.object({
    totalConversations: z.number(),
    activeConversations: z.number(),
    totalMessages: z.number(),
    avgMessagesPerConversation: z.number(),
  }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type ThreadMessage = z.infer<typeof ThreadMessageSchema>;
export type LastMessagePreview = z.infer<typeof LastMessagePreviewSchema>;
export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;
export type ConversationStatsResponse = z.infer<typeof ConversationStatsResponseSchema>;
