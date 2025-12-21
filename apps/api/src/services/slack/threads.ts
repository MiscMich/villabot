/**
 * Thread session management
 * Handles multi-turn conversations
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import { THREAD_CONFIG } from '@teambrain/shared';

export interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Get or create a thread session
 * Uses upsert to handle race conditions with concurrent messages
 */
export async function getOrCreateSession(
  channelId: string,
  threadTs: string,
  userId: string,
  workspaceId: string,
  botId?: string
): Promise<string> {
  // Build session data
  const sessionData: Record<string, unknown> = {
    workspace_id: workspaceId,  // Required for tenant isolation
    slack_channel_id: channelId,
    slack_thread_ts: threadTs,
    started_by_user_id: userId,
    is_active: true,
    last_activity: new Date().toISOString(),
  };

  // Only include bot_id if provided
  if (botId) {
    sessionData.bot_id = botId;
  }

  // Use upsert with ON CONFLICT to handle race conditions
  // The unique constraint on slack_thread_ts prevents duplicate sessions
  const { data: session, error } = await supabase
    .from('thread_sessions')
    .upsert(sessionData, {
      onConflict: 'slack_thread_ts',
      ignoreDuplicates: false, // Update existing record
    })
    .select('id')
    .single();

  if (error) {
    // If upsert fails, try to fetch existing session
    const { data: existing } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('slack_thread_ts', threadTs)
      .single();

    if (existing) {
      // Update last activity
      await supabase
        .from('thread_sessions')
        .update({ is_active: true, last_activity: new Date().toISOString() })
        .eq('id', existing.id);
      return existing.id;
    }

    logger.error('Failed to create/get thread session', { error });
    throw error;
  }

  logger.debug('Thread session ready', { sessionId: session.id });
  return session.id;
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
  rating: number,
  workspaceId: string
): Promise<void> {
  await supabase
    .from('thread_messages')
    .update({ feedback_rating: rating })
    .eq('id', messageId);

  // Also log to analytics with workspace context
  await supabase.from('analytics').insert({
    workspace_id: workspaceId,
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
  logger.info('Checking if bot responded in thread', { threadTs });

  const { data: session, error: sessionError } = await supabase
    .from('thread_sessions')
    .select('id')
    .eq('slack_thread_ts', threadTs)
    .maybeSingle(); // Use maybeSingle to avoid error when no rows

  if (sessionError) {
    logger.error('Error checking thread session', { error: sessionError, threadTs });
    return false;
  }

  if (!session) {
    logger.info('No session found for thread', { threadTs });
    return false;
  }

  const { count, error: countError } = await supabase
    .from('thread_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('role', 'assistant');

  if (countError) {
    logger.error('Error counting assistant messages', { error: countError, sessionId: session.id });
    return false;
  }

  const hasResponded = (count ?? 0) > 0;
  logger.info('Bot response check result', { threadTs, sessionId: session.id, assistantMessages: count, hasResponded });

  return hasResponded;
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
