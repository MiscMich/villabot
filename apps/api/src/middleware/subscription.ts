/**
 * Subscription Middleware
 * Checks tier limits and tracks usage
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { TIER_CONFIGS } from '@teambrain/shared';
import type { SubscriptionTier, TierLimits } from '@teambrain/shared';

// Extend Express Request to include usage context
declare global {
  namespace Express {
    interface Request {
      tierLimits?: TierLimits;
      usage?: {
        queries_used: number;
        queries_limit: number;
        documents_used: number;
        documents_limit: number;
      };
    }
  }
}

/**
 * Check subscription status - ensures workspace has active subscription
 */
export async function checkSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.workspace) {
      res.status(401).json({
        error: 'Workspace context required',
        code: 'NO_WORKSPACE_CONTEXT',
      });
      return;
    }

    const { status, tier } = req.workspace;

    // Check subscription status
    if (status === 'canceled') {
      res.status(402).json({
        error: 'Subscription has been canceled',
        code: 'SUBSCRIPTION_CANCELED',
        upgrade_url: '/billing',
      });
      return;
    }

    if (status === 'unpaid') {
      res.status(402).json({
        error: 'Payment is required to continue',
        code: 'PAYMENT_REQUIRED',
        billing_url: '/billing',
      });
      return;
    }

    if (status === 'past_due') {
      // Allow access but log warning
      logger.warn('Workspace has past due subscription', {
        workspaceId: req.workspace.id,
      });
    }

    // Attach tier limits to request
    const tierConfig = TIER_CONFIGS[tier as SubscriptionTier];
    if (tierConfig) {
      req.tierLimits = tierConfig.limits;
    }

    next();
  } catch (error) {
    logger.error('Subscription check error', { error });
    res.status(500).json({
      error: 'Failed to check subscription',
      code: 'SUBSCRIPTION_ERROR',
    });
  }
}

/**
 * Check and track usage for a specific limit type
 */
export function checkUsageLimit(limitType: 'queries' | 'documents' | 'team_members' | 'bots') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.workspace) {
        res.status(401).json({
          error: 'Workspace context required',
          code: 'NO_WORKSPACE_CONTEXT',
        });
        return;
      }

      const workspaceId = req.workspace.id;

      // Get current usage based on limit type
      let currentUsage = 0;
      let limit = 0;

      switch (limitType) {
        case 'queries': {
          // Get queries from current billing period
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const { count } = await supabase
            .from('analytics')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('event_type', 'question')
            .gte('created_at', startOfMonth.toISOString());

          currentUsage = count || 0;
          limit = req.workspace.max_queries_per_month;
          break;
        }

        case 'documents': {
          const { count } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('is_active', true);

          currentUsage = count || 0;
          limit = req.workspace.max_documents;
          break;
        }

        case 'team_members': {
          const { count } = await supabase
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('is_active', true);

          currentUsage = count || 0;
          limit = req.workspace.max_team_members;
          break;
        }

        case 'bots': {
          const { count } = await supabase
            .from('bots')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .neq('status', 'inactive');

          currentUsage = count || 0;
          limit = req.workspace.max_bots;
          break;
        }
      }

      // Check if limit exceeded
      if (currentUsage >= limit) {
        res.status(402).json({
          error: `${limitType} limit exceeded`,
          code: 'LIMIT_EXCEEDED',
          limit_type: limitType,
          current: currentUsage,
          limit: limit,
          upgrade_url: '/billing',
        });
        return;
      }

      // Store usage in request for handlers that need it
      req.usage = {
        queries_used: limitType === 'queries' ? currentUsage : 0,
        queries_limit: limitType === 'queries' ? limit : 0,
        documents_used: limitType === 'documents' ? currentUsage : 0,
        documents_limit: limitType === 'documents' ? limit : 0,
      };

      next();
    } catch (error) {
      logger.error('Usage limit check error', { error, limitType });
      res.status(500).json({
        error: 'Failed to check usage limits',
        code: 'USAGE_CHECK_ERROR',
      });
    }
  };
}

/**
 * Track usage after successful operation
 */
export async function trackUsage(
  workspaceId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('analytics').insert({
      workspace_id: workspaceId,
      event_type: eventType,
      event_data: eventData,
    });

    // Also update daily usage tracking
    const today = new Date().toISOString().split('T')[0];

    await supabase.rpc('increment_daily_usage', {
      p_workspace_id: workspaceId,
      p_date: today,
      p_queries: eventType === 'question' ? 1 : 0,
      p_documents: eventType === 'document_added' ? 1 : 0,
    });
  } catch (error) {
    logger.error('Failed to track usage', { error, workspaceId, eventType });
    // Don't throw - usage tracking should not block operations
  }
}

/**
 * Check feature availability based on tier
 */
export function requireFeature(feature: keyof TierLimits) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tierLimits) {
      res.status(401).json({
        error: 'Subscription context required',
        code: 'NO_SUBSCRIPTION_CONTEXT',
      });
      return;
    }

    const featureValue = req.tierLimits[feature];

    // For boolean features
    if (typeof featureValue === 'boolean' && !featureValue) {
      res.status(402).json({
        error: `Feature "${feature}" is not available on your plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature: feature,
        upgrade_url: '/billing',
      });
      return;
    }

    // For numeric features (limit = 0 means not available)
    if (typeof featureValue === 'number' && featureValue === 0) {
      res.status(402).json({
        error: `Feature "${feature}" is not available on your plan`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature: feature,
        upgrade_url: '/billing',
      });
      return;
    }

    next();
  };
}

/**
 * Get usage summary for a workspace
 */
export async function getUsageSummary(workspaceId: string): Promise<{
  queries_used: number;
  queries_limit: number;
  queries_percent: number;
  documents_used: number;
  documents_limit: number;
  documents_percent: number;
  team_members_used: number;
  team_members_limit: number;
  bots_used: number;
  bots_limit: number;
  period_start: string;
  period_end: string;
  days_remaining: number;
}> {
  // Get workspace for limits
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  // Calculate billing period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Get current usage counts
  const [queriesResult, documentsResult, membersResult, botsResult] = await Promise.all([
    supabase
      .from('analytics')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'question')
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true),
    supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_active', true),
    supabase
      .from('bots')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .neq('status', 'inactive'),
  ]);

  const queriesUsed = queriesResult.count || 0;
  const documentsUsed = documentsResult.count || 0;
  const membersUsed = membersResult.count || 0;
  const botsUsed = botsResult.count || 0;

  return {
    queries_used: queriesUsed,
    queries_limit: workspace.max_queries_per_month,
    queries_percent: Math.round((queriesUsed / workspace.max_queries_per_month) * 100),
    documents_used: documentsUsed,
    documents_limit: workspace.max_documents,
    documents_percent: Math.round((documentsUsed / workspace.max_documents) * 100),
    team_members_used: membersUsed,
    team_members_limit: workspace.max_team_members,
    bots_used: botsUsed,
    bots_limit: workspace.max_bots,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    days_remaining: daysRemaining,
  };
}
