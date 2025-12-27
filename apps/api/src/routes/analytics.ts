/**
 * Analytics API routes
 * Dashboard statistics and metrics
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  generalApiRateLimiter,
} from '../middleware/index.js';

export const analyticsRouter = Router();

// Apply authentication, workspace resolution, and rate limiting to all routes
// Order matters: authenticate first, then resolveWorkspace, then rate limiter
analyticsRouter.use(authenticate, resolveWorkspace, generalApiRateLimiter);

/**
 * Get dashboard overview stats for the workspace
 */
analyticsRouter.get('/overview', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Get document counts for this workspace
    const { count: totalDocs } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    const { count: activeDocs } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    // document_chunks doesn't have workspace_id - join through documents table
    const { count: totalChunks } = await supabase
      .from('document_chunks')
      .select('*, documents!inner(workspace_id)', { count: 'exact', head: true })
      .eq('documents.workspace_id', workspaceId);

    // Get message counts for last 7 days for this workspace
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: messagesThisWeek } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'message_received')
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: responsesThisWeek } = await supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'response_sent')
      .gte('created_at', sevenDaysAgo.toISOString());

    // Get feedback stats for this workspace
    const { data: feedback } = await supabase
      .from('thread_messages')
      .select('feedback_rating, session_id')
      .not('feedback_rating', 'is', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    // Filter to only include messages from this workspace's sessions
    const { data: workspaceSessions } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('workspace_id', workspaceId);

    const sessionIds = new Set((workspaceSessions ?? []).map(s => s.id));
    const workspaceFeedback = (feedback ?? []).filter(f => sessionIds.has(f.session_id));

    const positiveCount = workspaceFeedback.filter(f => f.feedback_rating > 0).length;
    const negativeCount = workspaceFeedback.filter(f => f.feedback_rating < 0).length;
    const totalFeedback = positiveCount + negativeCount;
    const satisfactionRate = totalFeedback > 0 ? Math.round((positiveCount / totalFeedback) * 100) : null;

    // Get learned facts count for this workspace
    const { count: learnedFacts } = await supabase
      .from('learned_facts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    res.json({
      documents: {
        total: totalDocs ?? 0,
        active: activeDocs ?? 0,
        chunks: totalChunks ?? 0,
      },
      activity: {
        messagesThisWeek: messagesThisWeek ?? 0,
        responsesThisWeek: responsesThisWeek ?? 0,
      },
      feedback: {
        positive: positiveCount,
        negative: negativeCount,
        satisfactionRate,
      },
      knowledge: {
        learnedFacts: learnedFacts ?? 0,
      },
    });
  } catch (error) {
    logger.error('Failed to get overview stats', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get overview stats' });
  }
});

/**
 * Get daily activity data for charts
 */
analyticsRouter.get('/activity', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 14;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('analytics')
      .select('event_data, created_at')
      .eq('workspace_id', req.workspace!.id)
      .eq('event_type', 'daily_summary')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    res.json({
      data: data ?? [],
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
    });
  } catch (error) {
    logger.error('Failed to get activity data', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get activity data' });
  }
});

/**
 * Get recent events for this workspace
 */
analyticsRouter.get('/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const eventType = req.query.event_type as string;

    let query = supabase
      .from('analytics')
      .select('id, event_type, event_data, created_at')
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ events: data ?? [] });
  } catch (error) {
    logger.error('Failed to get events', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * Get top questions for this workspace
 */
analyticsRouter.get('/top-questions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get workspace sessions first
    const { data: sessions } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('workspace_id', req.workspace!.id);

    const sessionIds = (sessions ?? []).map(s => s.id);

    if (sessionIds.length === 0) {
      return res.json({
        recentQuestions: [],
        topWords: [],
      });
    }

    const { data } = await supabase
      .from('thread_messages')
      .select('content, created_at')
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Simple word frequency analysis
    const wordFrequency: Record<string, number> = {};
    for (const msg of data ?? []) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) {
          wordFrequency[word] = (wordFrequency[word] ?? 0) + 1;
        }
      }
    }

    const topWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));

    res.json({
      recentQuestions: (data ?? []).slice(0, limit).map(d => d.content),
      topWords,
    });
  } catch (error) {
    logger.error('Failed to get top questions', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get top questions' });
  }
});

/**
 * Get learned facts for this workspace
 */
analyticsRouter.get('/learned-facts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const verified = req.query.verified;

    let query = supabase
      .from('learned_facts')
      .select('id, fact, source, taught_by_user_id, is_verified, created_at')
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (verified !== undefined) {
      query = query.eq('is_verified', verified === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ facts: data ?? [] });
  } catch (error) {
    logger.error('Failed to get learned facts', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get learned facts' });
  }
});

/**
 * Create a new learned fact manually
 */
analyticsRouter.post('/learned-facts', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { fact, source } = req.body;

    if (!fact || typeof fact !== 'string' || fact.trim().length === 0) {
      return res.status(400).json({ error: 'fact is required and must be a non-empty string' });
    }

    const { data, error } = await supabase
      .from('learned_facts')
      .insert({
        workspace_id: req.workspace!.id,
        fact: fact.trim(),
        source: source || 'manual',
        is_verified: true, // Manual facts are auto-verified
        taught_by_user_id: req.user!.id,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Learned fact created', { id: data.id, workspaceId: req.workspace!.id });
    res.status(201).json(data);
  } catch (error) {
    logger.error('Failed to create learned fact', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to create learned fact' });
  }
});

/**
 * Verify or reject a learned fact
 */
analyticsRouter.patch('/learned-facts/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { is_verified } = req.body;

    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ error: 'is_verified must be a boolean' });
    }

    const { data, error } = await supabase
      .from('learned_facts')
      .update({ is_verified })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Learned fact updated', { id: req.params.id, is_verified, workspaceId: req.workspace!.id });
    res.json(data);
  } catch (error) {
    logger.error('Failed to update learned fact', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update learned fact' });
  }
});

/**
 * Delete a learned fact
 */
analyticsRouter.delete('/learned-facts/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('learned_facts')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id);

    if (error) throw error;

    logger.info('Learned fact deleted', { id: req.params.id, workspaceId: req.workspace!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete learned fact', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete learned fact' });
  }
});
