/**
 * Thread session management
 * Handles multi-turn conversations
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import { THREAD_CONFIG } from '@villa-paraiso/shared';
import type { ThreadSession, ThreadMessage } from '@villa-paraiso/shared';

export interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Get or create a thread session
 */
export async function getOrCreateSession(
  channelId: string,
  threadTs: string,
  userId: string
): Promise<string> {
  // Try to find existing session
  const { data: existing } = await supabase
    .from('thread_sessions')
    .select('id, is_active')
    .eq('slack_thread_ts', threadTs)
    .single();

  if (existing) {
    // Reactivate if needed
    if (!existing.is_active) {
      await supabase
        .from('thread_sessions')
        .update({ is_active: true, last_activity: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('thread_sessions')
    .insert({
      slack_channel_id: channelId,
      slack_thread_ts: threadTs,
      started_by_user_id: userId,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to create thread session', { error });
    throw error;
  }

  logger.debug('Created new thread session', { sessionId: newSession.id });
  return newSession.id;
}

/**
 * Add a message to a thread session
 */
export async function addMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  sources?: string[],
  confidenceScore?: number
): Promise<string> {
  const { data, error } = await supabase
    .from('thread_messages')
    .insert({
      session_id: sessionId,
      slack_user_id: userId,
      role,
      content,
      sources: sources ?? [],
      confidence_score: confidenceScore,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to add message', { error });
    throw error;
  }

  // Update session last activity
  await supabase
    .from('thread_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', sessionId);

  return data.id;
}

/**
 * Get conversation context for a thread
 */
export async function getConversationContext(
  threadTs: string
): Promise<ConversationContext | null> {
  // Get session
  const { data: session } = await supabase
    .from('thread_sessions')
    .select('id')
    .eq('slack_thread_ts', threadTs)
    .single();

  if (!session) {
    return null;
  }

  // Get recent messages
  const { data: messages } = await supabase
    .from('thread_messages')
    .select('role, content')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .limit(THREAD_CONFIG.maxMessagesInContext);

  return {
    sessionId: session.id,
    messages: (messages ?? []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  };
}

/**
 * Record user feedback on a bot response
 */
export async function recordFeedback(
  sessionId: string,
  messageId: string,
  rating: number
): Promise<void> {
  await supabase
    .from('thread_messages')
    .update({ feedback_rating: rating })
    .eq('id', messageId);

  // Also log to analytics
  await supabase.from('analytics').insert({
    event_type: 'feedback',
    event_data: {
      session_id: sessionId,
      message_id: messageId,
      rating,
    },
  });
}

/**
 * Check if the bot has previously responded in a thread
 */
export async function hasBotRespondedInThread(threadTs: string): Promise<boolean> {
  const { data: session } = await supabase
    .from('thread_sessions')
    .select('id')
    .eq('slack_thread_ts', threadTs)
    .single();

  if (!session) {
    return false;
  }

  const { count } = await supabase
    .from('thread_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('role', 'assistant');

  return (count ?? 0) > 0;
}

/**
 * Close inactive sessions
 */
export async function closeInactiveSessions(): Promise<number> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - THREAD_CONFIG.sessionTimeoutHours);

  const { data } = await supabase
    .from('thread_sessions')
    .update({ is_active: false })
    .lt('last_activity', cutoffTime.toISOString())
    .eq('is_active', true)
    .select('id');

  const count = data?.length ?? 0;
  if (count > 0) {
    logger.info(`Closed ${count} inactive sessions`);
  }

  return count;
}
