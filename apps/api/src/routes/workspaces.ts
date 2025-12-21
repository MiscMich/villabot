/**
 * Workspace Routes
 * CRUD operations for workspaces
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
  getUsageSummary,
} from '../middleware/index.js';
import { TIER_CONFIGS } from '@teambrain/shared';
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
} from '@teambrain/shared';

export const workspacesRouter = Router();

/**
 * List all workspaces the user belongs to
 */
workspacesRouter.get('/', authenticate, async (req, res) => {
  try {
    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select(`
        role,
        is_active,
        created_at,
        workspaces (*)
      `)
      .eq('user_id', req.user!.id)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const workspaces = (memberships || []).map((m) => ({
      ...m.workspaces,
      role: m.role,
      joined_at: m.created_at,
    }));

    res.json({ workspaces });
  } catch (error) {
    logger.error('Failed to list workspaces', { error });
    res.status(500).json({
      error: 'Failed to list workspaces',
      code: 'LIST_WORKSPACES_ERROR',
    });
  }
});

/**
 * Create a new workspace
 */
workspacesRouter.post('/', authenticate, async (req, res) => {
  try {
    const { name, slug } = req.body as CreateWorkspaceRequest;

    if (!name) {
      return res.status(400).json({
        error: 'Workspace name is required',
        code: 'MISSING_NAME',
      });
    }

    // Generate slug if not provided
    const workspaceSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug is unique
    const { data: existing } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', workspaceSlug)
      .single();

    const finalSlug = existing ? `${workspaceSlug}-${Date.now()}` : workspaceSlug;

    const tierConfig = TIER_CONFIGS.pro; // New workspaces start on Pro trial

    // Create workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug: finalSlug,
        tier: 'pro',
        status: 'trialing',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + tierConfig.trialDays * 24 * 60 * 60 * 1000).toISOString(),
        max_documents: tierConfig.limits.documents,
        max_queries_per_month: tierConfig.limits.queriesPerMonth,
        max_file_upload_mb: tierConfig.limits.fileUploadMb,
        max_team_members: tierConfig.limits.teamMembers,
        max_website_pages: tierConfig.limits.websitePages,
        max_bots: tierConfig.limits.bots,
        settings: { brandColor: '#f59e0b', timezone: 'UTC', weeklyDigest: false },
      })
      .select()
      .single();

    if (wsError) {
      throw wsError;
    }

    // Create owner membership
    const { data: membership, error: memError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: req.user!.id,
        role: 'owner',
        is_active: true,
      })
      .select()
      .single();

    if (memError) {
      // Rollback workspace creation
      await supabase.from('workspaces').delete().eq('id', workspace.id);
      throw memError;
    }

    logger.info('Workspace created', {
      workspaceId: workspace.id,
      userId: req.user!.id,
    });

    res.status(201).json({ workspace, membership });
  } catch (error) {
    logger.error('Failed to create workspace', { error });
    res.status(500).json({
      error: 'Failed to create workspace',
      code: 'CREATE_WORKSPACE_ERROR',
    });
  }
});

/**
 * Get current workspace details
 */
workspacesRouter.get(
  '/current',
  authenticate,
  resolveWorkspace,
  async (req, res) => {
    try {
      const usage = await getUsageSummary(req.workspace!.id);

      res.json({
        workspace: req.workspace,
        membership: req.membership,
        usage,
      });
    } catch (error) {
      logger.error('Failed to get workspace', { error });
      res.status(500).json({
        error: 'Failed to get workspace',
        code: 'GET_WORKSPACE_ERROR',
      });
    }
  }
);

/**
 * Get workspace by ID
 */
workspacesRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const workspaceId = req.params.id;

    if (!workspaceId) {
      return res.status(400).json({
        error: 'Workspace ID is required',
        code: 'MISSING_ID',
      });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', req.user!.id)
      .eq('is_active', true)
      .single();

    if (!membership) {
      return res.status(403).json({
        error: 'Not a member of this workspace',
        code: 'NOT_MEMBER',
      });
    }

    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (error || !workspace) {
      return res.status(404).json({
        error: 'Workspace not found',
        code: 'NOT_FOUND',
      });
    }

    const usage = await getUsageSummary(workspaceId);

    res.json({ workspace, membership, usage });
  } catch (error) {
    logger.error('Failed to get workspace', { error });
    res.status(500).json({
      error: 'Failed to get workspace',
      code: 'GET_WORKSPACE_ERROR',
    });
  }
});

/**
 * Update workspace settings
 */
workspacesRouter.patch(
  '/current',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req, res) => {
    try {
      const updates = req.body as UpdateWorkspaceRequest;

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
      if (updates.settings !== undefined) {
        updateData.settings = {
          ...req.workspace!.settings,
          ...updates.settings,
        };
      }

      const { data: workspace, error } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', req.workspace!.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Workspace updated', {
        workspaceId: workspace.id,
        userId: req.user!.id,
      });

      res.json({ workspace });
    } catch (error) {
      logger.error('Failed to update workspace', { error });
      res.status(500).json({
        error: 'Failed to update workspace',
        code: 'UPDATE_WORKSPACE_ERROR',
      });
    }
  }
);

/**
 * Delete workspace (owner only)
 */
workspacesRouter.delete(
  '/current',
  authenticate,
  resolveWorkspace,
  requireWorkspaceOwner,
  async (req, res) => {
    try {
      // Cancel any active subscription first
      const stripeSubId = req.workspace!.stripe_subscription_id;
      if (stripeSubId) {
        // TODO: Cancel Stripe subscription
        logger.info('Would cancel subscription', {
          subscriptionId: stripeSubId,
        });
      }

      // Delete workspace (cascades to members, bots, documents, etc.)
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', req.workspace!.id);

      if (error) {
        throw error;
      }

      logger.info('Workspace deleted', {
        workspaceId: req.workspace!.id,
        userId: req.user!.id,
      });

      res.json({ message: 'Workspace deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete workspace', { error });
      res.status(500).json({
        error: 'Failed to delete workspace',
        code: 'DELETE_WORKSPACE_ERROR',
      });
    }
  }
);

/**
 * Get workspace statistics
 */
workspacesRouter.get(
  '/current/stats',
  authenticate,
  resolveWorkspace,
  async (req, res) => {
    try {
      const { data, error } = await supabase.rpc('get_workspace_stats', {
        p_workspace_id: req.workspace!.id,
      });

      if (error) {
        throw error;
      }

      res.json({ stats: data?.[0] || {} });
    } catch (error) {
      logger.error('Failed to get workspace stats', { error });
      res.status(500).json({
        error: 'Failed to get workspace stats',
        code: 'STATS_ERROR',
      });
    }
  }
);

/**
 * Get workspace usage summary
 */
workspacesRouter.get(
  '/current/usage',
  authenticate,
  resolveWorkspace,
  async (req, res) => {
    try {
      const usage = await getUsageSummary(req.workspace!.id);
      res.json({ usage });
    } catch (error) {
      logger.error('Failed to get usage', { error });
      res.status(500).json({
        error: 'Failed to get usage',
        code: 'USAGE_ERROR',
      });
    }
  }
);
