/**
 * Platform Feedback API Routes
 * Handle user-submitted feedback about the platform (feature requests, bugs, suggestions)
 * This is distinct from response feedback which tracks individual bot response quality
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  generalApiRateLimiter,
  validateBody,
} from '../middleware/index.js';
import type {
  PlatformFeedback,
  PlatformFeedbackStats,
  PaginatedPlatformFeedback,
} from '@cluebase/shared';

export const platformFeedbackRouter = Router();

// ============================================================================
// Zod Schemas for Input Validation
// ============================================================================

const feedbackTypeSchema = z.enum([
  'feature_request',
  'bug_report',
  'improvement',
  'question',
  'other',
]);

const feedbackCategorySchema = z.enum([
  'dashboard',
  'bots',
  'documents',
  'search',
  'billing',
  'integrations',
  'performance',
  'security',
  'other',
]);

const feedbackStatusSchema = z.enum([
  'new',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'declined',
  'duplicate',
]);

const feedbackPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

const browserInfoSchema = z.object({
  userAgent: z.string().max(500).optional(),
  platform: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  screenWidth: z.number().positive().optional(),
  screenHeight: z.number().positive().optional(),
}).optional();

const createFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be at most 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters'),
  category: feedbackCategorySchema.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  browser_info: browserInfoSchema,
  page_url: z.string().url().max(500).optional(),
});

const updateFeedbackSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5000 characters')
    .optional(),
  category: feedbackCategorySchema.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const adminUpdateFeedbackSchema = z.object({
  status: feedbackStatusSchema.optional(),
  priority: feedbackPrioritySchema.optional(),
  admin_response: z.string().max(5000).optional(),
  category: feedbackCategorySchema.optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const addNoteSchema = z.object({
  note: z.string()
    .min(1, 'Note cannot be empty')
    .max(2000, 'Note must be at most 2000 characters'),
});

// Apply authentication, workspace resolution, and rate limiting to all routes
platformFeedbackRouter.use(authenticate, resolveWorkspace, generalApiRateLimiter);

// ============================================================================
// Public Routes (any workspace member)
// ============================================================================

/**
 * Create new platform feedback
 */
platformFeedbackRouter.post('/', validateBody(createFeedbackSchema), async (req, res) => {
  try {
    const input = req.body;
    const workspaceId = req.workspace!.id;
    const userId = req.user!.id;

    const { data, error } = await supabase
      .from('platform_feedback')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        type: input.type,
        title: input.title,
        description: input.description,
        category: input.category ?? null,
        tags: input.tags ?? [],
        browser_info: input.browser_info ?? null,
        page_url: input.page_url ?? null,
      })
      .select('id, type, title, status, priority, created_at')
      .single();

    if (error) throw error;

    logger.info('Platform feedback created', {
      id: data.id,
      type: input.type,
      userId,
      workspaceId,
    });

    res.status(201).json({ success: true, feedback: data });
  } catch (error) {
    logger.error('Failed to create platform feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

/**
 * List platform feedback for the workspace
 */
platformFeedbackRouter.get('/', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const userId = req.user!.id;
    const {
      type,
      status,
      priority,
      category,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validate sort_by
    const validSortBy = ['created_at', 'upvotes', 'priority', 'status'];
    const sortColumn = validSortBy.includes(sort_by as string) ? sort_by : 'created_at';
    const ascending = sort_order === 'asc';

    let query = supabase
      .from('platform_feedback')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(sortColumn as string, { ascending })
      .range(offset, offset + limitNum - 1);

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (category) query = query.eq('category', category);
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Check which feedback the current user has voted on
    const feedbackIds = (data ?? []).map(f => f.id);
    let userVotes: Set<string> = new Set();

    if (feedbackIds.length > 0) {
      const { data: votes } = await supabase
        .from('platform_feedback_votes')
        .select('feedback_id')
        .eq('user_id', userId)
        .in('feedback_id', feedbackIds);

      userVotes = new Set((votes ?? []).map(v => v.feedback_id));
    }

    // Add has_voted flag to each feedback
    const feedbackWithVotes = (data ?? []).map(f => ({
      ...f,
      has_voted: userVotes.has(f.id),
    }));

    const response: PaginatedPlatformFeedback = {
      data: feedbackWithVotes as PlatformFeedback[],
      total: count ?? 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count ?? 0) / limitNum),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to list platform feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to list feedback' });
  }
});

/**
 * Get a single platform feedback entry
 */
platformFeedbackRouter.get('/:id', async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const userId = req.user!.id;
    const feedbackId = req.params.id;

    const { data, error } = await supabase
      .from('platform_feedback')
      .select('*')
      .eq('id', feedbackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Feedback not found' });
      }
      throw error;
    }

    // Check if user has voted
    const { data: vote } = await supabase
      .from('platform_feedback_votes')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId)
      .maybeSingle();

    const feedback: PlatformFeedback = {
      ...data,
      has_voted: !!vote,
    };

    res.json({ feedback });
  } catch (error) {
    logger.error('Failed to get platform feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * Update own feedback (users can only update their own)
 */
platformFeedbackRouter.patch('/:id', validateBody(updateFeedbackSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const workspaceId = req.workspace!.id;
    const feedbackId = req.params.id;
    const input = req.body;

    // First verify the feedback belongs to this user
    const { data: existing, error: checkError } = await supabase
      .from('platform_feedback')
      .select('id, user_id')
      .eq('id', feedbackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'You can only update your own feedback' });
    }

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const { data, error } = await supabase
      .from('platform_feedback')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) throw error;

    logger.info('Platform feedback updated', { id: feedbackId, userId, workspaceId });
    res.json({ feedback: data });
  } catch (error) {
    logger.error('Failed to update platform feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

/**
 * Delete own feedback (users can only delete their own)
 */
platformFeedbackRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const workspaceId = req.workspace!.id;
    const feedbackId = req.params.id;

    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('platform_feedback')
      .select('id, user_id')
      .eq('id', feedbackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own feedback' });
    }

    const { error } = await supabase
      .from('platform_feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) throw error;

    logger.info('Platform feedback deleted', { id: feedbackId, userId, workspaceId });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete platform feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

/**
 * Vote/upvote feedback
 */
platformFeedbackRouter.post('/:id/vote', async (req, res) => {
  try {
    const userId = req.user!.id;
    const workspaceId = req.workspace!.id;
    const feedbackId = req.params.id;

    // Verify feedback exists in this workspace
    const { data: feedback, error: checkError } = await supabase
      .from('platform_feedback')
      .select('id')
      .eq('id', feedbackId)
      .eq('workspace_id', workspaceId)
      .single();

    if (checkError || !feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Try to insert vote (will fail on duplicate due to unique constraint)
    const { error } = await supabase
      .from('platform_feedback_votes')
      .insert({
        feedback_id: feedbackId,
        user_id: userId,
      });

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Already voted' });
      }
      throw error;
    }

    logger.info('Vote added', { feedbackId, userId, workspaceId });
    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('Failed to vote', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to vote' });
  }
});

/**
 * Remove vote from feedback
 */
platformFeedbackRouter.delete('/:id/vote', async (req, res) => {
  try {
    const userId = req.user!.id;
    const feedbackId = req.params.id;

    const { error } = await supabase
      .from('platform_feedback_votes')
      .delete()
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId);

    if (error) throw error;

    logger.info('Vote removed', { feedbackId, userId, workspaceId: req.workspace!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove vote', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to remove vote' });
  }
});

// ============================================================================
// Admin Routes (workspace admins only)
// ============================================================================

/**
 * Admin update feedback (status, priority, response)
 */
platformFeedbackRouter.patch(
  '/:id/admin',
  requireWorkspaceAdmin,
  validateBody(adminUpdateFeedbackSchema),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const workspaceId = req.workspace!.id;
      const feedbackId = req.params.id;
      const input = req.body;

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.tags !== undefined) updateData.tags = input.tags;

      // Handle admin response
      if (input.admin_response !== undefined) {
        updateData.admin_response = input.admin_response;
        updateData.responded_by = userId;
        updateData.responded_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('platform_feedback')
        .update(updateData)
        .eq('id', feedbackId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Feedback not found' });
        }
        throw error;
      }

      logger.info('Platform feedback admin update', { id: feedbackId, adminId: userId, workspaceId });
      res.json({ feedback: data });
    } catch (error) {
      logger.error('Failed to admin update feedback', { error, workspaceId: req.workspace!.id });
      res.status(500).json({ error: 'Failed to update feedback' });
    }
  }
);

/**
 * Get admin notes for feedback
 */
platformFeedbackRouter.get('/:id/notes', requireWorkspaceAdmin, async (req, res) => {
  try {
    const feedbackId = req.params.id;

    const { data, error } = await supabase
      .from('platform_feedback_notes')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ notes: data ?? [] });
  } catch (error) {
    logger.error('Failed to get feedback notes', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get notes' });
  }
});

/**
 * Add admin note to feedback
 */
platformFeedbackRouter.post(
  '/:id/notes',
  requireWorkspaceAdmin,
  validateBody(addNoteSchema),
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const workspaceId = req.workspace!.id;
      const feedbackId = req.params.id;
      const { note } = req.body;

      // Verify feedback exists in this workspace
      const { data: feedback, error: checkError } = await supabase
        .from('platform_feedback')
        .select('id')
        .eq('id', feedbackId)
        .eq('workspace_id', workspaceId)
        .single();

      if (checkError || !feedback) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      const { data, error } = await supabase
        .from('platform_feedback_notes')
        .insert({
          feedback_id: feedbackId,
          admin_id: userId,
          note,
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Feedback note added', { feedbackId, adminId: userId, workspaceId });
      res.status(201).json({ note: data });
    } catch (error) {
      logger.error('Failed to add feedback note', { error, workspaceId: req.workspace!.id });
      res.status(500).json({ error: 'Failed to add note' });
    }
  }
);

/**
 * Get feedback statistics for the workspace
 */
platformFeedbackRouter.get('/stats/summary', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;

    // Get all feedback for this workspace
    const { data: allFeedback, error } = await supabase
      .from('platform_feedback')
      .select('type, status, priority, category, created_at, responded_at')
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    const feedback = allFeedback ?? [];

    // Calculate counts by type
    const byType: Record<string, number> = {
      feature_request: 0,
      bug_report: 0,
      improvement: 0,
      question: 0,
      other: 0,
    };
    feedback.forEach(f => {
      byType[f.type] = (byType[f.type] || 0) + 1;
    });

    // Calculate counts by status
    const byStatus: Record<string, number> = {
      new: 0,
      under_review: 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
      declined: 0,
      duplicate: 0,
    };
    feedback.forEach(f => {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    });

    // Calculate counts by priority
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    feedback.forEach(f => {
      if (f.priority) {
        byPriority[f.priority] = (byPriority[f.priority] || 0) + 1;
      }
    });

    // Calculate counts by category
    const byCategory: Record<string, number> = {};
    feedback.forEach(f => {
      if (f.category) {
        byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      }
    });

    // Count recent feedback (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = feedback.filter(
      f => new Date(f.created_at) > sevenDaysAgo
    ).length;

    // Calculate average response time
    const respondedFeedback = feedback.filter(f => f.responded_at);
    let averageResponseTime: number | null = null;
    if (respondedFeedback.length > 0) {
      const totalHours = respondedFeedback.reduce((sum, f) => {
        const created = new Date(f.created_at).getTime();
        const responded = new Date(f.responded_at!).getTime();
        return sum + (responded - created) / (1000 * 60 * 60); // Convert to hours
      }, 0);
      averageResponseTime = Math.round(totalHours / respondedFeedback.length);
    }

    const stats: PlatformFeedbackStats = {
      total: feedback.length,
      byType: byType as Record<string, number>,
      byStatus: byStatus as Record<string, number>,
      byPriority: byPriority as Record<string, number>,
      byCategory,
      recentCount,
      averageResponseTime,
    };

    res.json({ stats });
  } catch (error) {
    logger.error('Failed to get feedback stats', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Admin delete any feedback
 */
platformFeedbackRouter.delete('/:id/admin', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const feedbackId = req.params.id;

    const { error } = await supabase
      .from('platform_feedback')
      .delete()
      .eq('id', feedbackId)
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    logger.info('Platform feedback admin deleted', {
      id: feedbackId,
      adminId: req.user!.id,
      workspaceId,
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to admin delete feedback', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});
