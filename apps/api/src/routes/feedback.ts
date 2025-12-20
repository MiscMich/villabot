/**
 * Feedback API Routes
 * Handle user feedback on bot responses for quality tracking
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
} from '../middleware/index.js';
import type { FeedbackSubmitInput, FeedbackReviewInput } from '@villa-paraiso/shared';

export const feedbackRouter = Router();

// Apply authentication and workspace resolution to all routes
feedbackRouter.use(authenticate, resolveWorkspace);

/**
 * Submit feedback for a bot response
 */
feedbackRouter.post('/', async (req, res) => {
  try {
    const input: FeedbackSubmitInput = req.body;
    const workspaceId = req.workspace!.id;

    if (typeof input.isHelpful !== 'boolean') {
      return res.status(400).json({ error: 'isHelpful is required' });
    }

    if (!input.slackUserId || !input.slackChannelId) {
      return res.status(400).json({ error: 'slackUserId and slackChannelId are required' });
    }

    const { data, error } = await supabase
      .from('response_feedback')
      .insert({
        workspace_id: workspaceId,
        message_id: input.messageId ?? null,
        session_id: input.sessionId ?? null,
        bot_id: input.botId ?? null,
        is_helpful: input.isHelpful,
        feedback_category: input.feedbackCategory ?? null,
        feedback_text: input.feedbackText ?? null,
        query_text: input.queryText ?? null,
        response_text: input.responseText ?? null,
        sources_used: input.sourcesUsed ?? [],
        slack_user_id: input.slackUserId,
        slack_channel_id: input.slackChannelId,
        slack_message_ts: input.slackMessageTs ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    logger.info('Feedback recorded', {
      id: data.id,
      isHelpful: input.isHelpful,
      slackUser: input.slackUserId,
      workspaceId,
    });

    res.status(201).json({ success: true, id: data.id });
  } catch (error) {
    logger.error('Failed to submit feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * Get feedback analytics for the workspace
 */
feedbackRouter.get('/analytics', async (req, res) => {
  try {
    const { botId, days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10) || 30;
    const workspaceId = req.workspace!.id;

    // Get overall stats for this workspace
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const { data: feedbackData, error: feedbackError } = await supabase
      .from('response_feedback')
      .select('is_helpful, bot_id')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString());

    if (feedbackError) throw feedbackError;

    const feedback = feedbackData ?? [];
    const filteredFeedback = botId ? feedback.filter(f => f.bot_id === botId) : feedback;

    const totalFeedback = filteredFeedback.length;
    const helpfulCount = filteredFeedback.filter(f => f.is_helpful).length;
    const unhelpfulCount = totalFeedback - helpfulCount;
    const satisfactionRate = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0;

    // Get trends over time
    const { data: trends } = await supabase
      .from('feedback_stats')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('date', startDate.toISOString())
      .order('date', { ascending: true });

    // Get recent unhelpful feedback
    const { data: recentUnhelpful } = await supabase
      .from('response_feedback')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_helpful', false)
      .eq('is_reviewed', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get stats by bot for this workspace
    const { data: bots } = await supabase
      .from('bots')
      .select('id, name, slug')
      .eq('workspace_id', workspaceId);

    const byBot: Record<string, { botName: string; stats: { total: number; helpful: number; unhelpful: number; rate: number } }> = {};

    for (const bot of bots ?? []) {
      const botFeedback = feedback.filter(f => f.bot_id === bot.id);
      const botTotal = botFeedback.length;
      const botHelpful = botFeedback.filter(f => f.is_helpful).length;

      if (botTotal > 0) {
        byBot[bot.id] = {
          botName: bot.name,
          stats: {
            total: botTotal,
            helpful: botHelpful,
            unhelpful: botTotal - botHelpful,
            rate: Math.round((botHelpful / botTotal) * 100),
          },
        };
      }
    }

    res.json({
      overall: {
        total_feedback: totalFeedback,
        helpful_count: helpfulCount,
        unhelpful_count: unhelpfulCount,
        satisfaction_rate: satisfactionRate,
      },
      byBot,
      trends: trends ?? [],
      recentUnhelpful: recentUnhelpful ?? [],
    });
  } catch (error) {
    logger.error('Failed to get feedback analytics', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

/**
 * Get feedback for a specific message
 */
feedbackRouter.get('/message/:messageTs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('response_feedback')
      .select('*')
      .eq('workspace_id', req.workspace!.id)
      .eq('slack_message_ts', req.params.messageTs)
      .maybeSingle();

    if (error) throw error;

    res.json({ feedback: data });
  } catch (error) {
    logger.error('Failed to get message feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * List all feedback for the workspace with pagination
 */
feedbackRouter.get('/', async (req, res) => {
  try {
    const {
      botId,
      isHelpful,
      isReviewed,
      limit = '20',
      offset = '0',
    } = req.query;

    let query = supabase
      .from('response_feedback')
      .select('*', { count: 'exact' })
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: false })
      .range(
        parseInt(offset as string, 10),
        parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1
      );

    if (botId) {
      query = query.eq('bot_id', botId);
    }
    if (isHelpful !== undefined) {
      query = query.eq('is_helpful', isHelpful === 'true');
    }
    if (isReviewed !== undefined) {
      query = query.eq('is_reviewed', isReviewed === 'true');
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      feedback: data ?? [],
      total: count ?? 0,
    });
  } catch (error) {
    logger.error('Failed to list feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list feedback' });
  }
});

/**
 * Get a single feedback entry
 */
feedbackRouter.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('response_feedback')
      .select('*')
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      throw error;
    }

    res.json({ feedback: data });
  } catch (error) {
    logger.error('Failed to get feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * Mark feedback as reviewed
 */
feedbackRouter.patch('/:id/review', requireWorkspaceAdmin, async (req, res) => {
  try {
    const input: FeedbackReviewInput = req.body;

    const { data, error } = await supabase
      .from('response_feedback')
      .update({
        is_reviewed: input.isReviewed,
        reviewed_by: input.reviewedBy,
        reviewed_at: input.isReviewed ? new Date().toISOString() : null,
        review_notes: input.reviewNotes ?? null,
      })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select()
      .single();

    if (error) throw error;

    logger.info('Feedback reviewed', { id: req.params.id, reviewedBy: input.reviewedBy, workspaceId: req.workspace!.id });
    res.json({ feedback: data });
  } catch (error) {
    logger.error('Failed to review feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to review feedback' });
  }
});

/**
 * Delete feedback
 */
feedbackRouter.delete('/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('response_feedback')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id);

    if (error) throw error;

    logger.info('Feedback deleted', { id: req.params.id, workspaceId: req.workspace!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});
