/**
 * Conversations API routes
 * View and manage bot conversation threads
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/conversations
 * List all conversation threads with pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get total count
    const { count } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true });

    // Get conversations with message counts
    const { data: sessions, error } = await supabase
      .from('thread_sessions')
      .select(`
        id,
        slack_channel_id,
        slack_thread_ts,
        started_by_user_id,
        is_active,
        created_at,
        last_activity
      `)
      .order('last_activity', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get message counts for each session
    const sessionsWithCounts = await Promise.all(
      (sessions ?? []).map(async (session) => {
        const { count: messageCount } = await supabase
          .from('thread_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id);

        const { data: lastMessage } = await supabase
          .from('thread_messages')
          .select('content, role, created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...session,
          messageCount: messageCount ?? 0,
          lastMessage: lastMessage ?? null,
        };
      })
    );

    res.json({
      conversations: sessionsWithCounts,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch conversations', { error });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('thread_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Get all messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from('thread_messages')
      .select(`
        id,
        slack_user_id,
        role,
        content,
        sources,
        confidence_score,
        feedback_rating,
        created_at
      `)
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    res.json({
      conversation: {
        ...session,
        messages: messages ?? [],
      },
    });
  } catch (error) {
    logger.error('Failed to fetch conversation', { error });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/conversations/stats/summary
 * Get conversation statistics
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    // Total conversations
    const { count: totalConversations } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true });

    // Active conversations (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: activeConversations } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity', oneDayAgo.toISOString());

    // Total messages
    const { count: totalMessages } = await supabase
      .from('thread_messages')
      .select('*', { count: 'exact', head: true });

    // Average messages per conversation
    const avgMessagesPerConversation =
      totalConversations && totalConversations > 0
        ? Math.round((totalMessages ?? 0) / totalConversations)
        : 0;

    res.json({
      stats: {
        totalConversations: totalConversations ?? 0,
        activeConversations: activeConversations ?? 0,
        totalMessages: totalMessages ?? 0,
        avgMessagesPerConversation,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch conversation stats', { error });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
