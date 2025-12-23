/**
 * Conversations API routes
 * View and manage bot conversation threads
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  generalApiRateLimiter,
} from '../middleware/index.js';

const router = Router();

// Apply authentication, workspace resolution, and rate limiting to all routes
// Order matters: authenticate first, then resolveWorkspace, then rate limiter
router.use(authenticate, resolveWorkspace, generalApiRateLimiter);

/**
 * GET /api/conversations
 * List all conversation threads for the workspace with pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const workspaceId = req.workspace!.id;

    // Get total count for this workspace
    const { count } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    // Get conversations with message counts for this workspace
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
      .eq('workspace_id', workspaceId)
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
    logger.error('Failed to fetch conversations', { error, workspaceId: req.workspace!.id });
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
    const workspaceId = req.workspace!.id;

    // Get session details with workspace filter
    const { data: session, error: sessionError } = await supabase
      .from('thread_sessions')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
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
    logger.error('Failed to fetch conversation', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * GET /api/conversations/stats/summary
 * Get conversation statistics for the workspace
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    // Total conversations for this workspace
    const { count: totalConversations } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    // Active conversations (last 24 hours) for this workspace
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: activeConversations } = await supabase
      .from('thread_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('last_activity', oneDayAgo.toISOString());

    // Get session IDs for this workspace
    const { data: sessions } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('workspace_id', workspaceId);

    const sessionIds = (sessions ?? []).map(s => s.id);

    // Total messages for this workspace's sessions
    let totalMessages = 0;
    if (sessionIds.length > 0) {
      const { count } = await supabase
        .from('thread_messages')
        .select('*', { count: 'exact', head: true })
        .in('session_id', sessionIds);
      totalMessages = count ?? 0;
    }

    // Average messages per conversation
    const avgMessagesPerConversation =
      totalConversations && totalConversations > 0
        ? Math.round(totalMessages / totalConversations)
        : 0;

    res.json({
      stats: {
        totalConversations: totalConversations ?? 0,
        activeConversations: activeConversations ?? 0,
        totalMessages,
        avgMessagesPerConversation,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch conversation stats', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
