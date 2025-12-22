/**
 * Platform Admin Routes
 * Routes for platform operators to manage workspaces, users, and view platform stats
 * Security: All routes require is_platform_admin flag
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import type {
  PlatformStats,
  AdminWorkspaceDetails,
  AdminUser,
  CreateInternalWorkspaceRequest,
  AdminWorkspaceFilters,
  PaginatedResponse,
  AdminAuditLogEntry,
} from '@cluebase/shared';

const router = Router();

// Extend Express Request to include admin context
declare global {
  namespace Express {
    interface Request {
      isAdmin?: boolean;
    }
  }
}

/**
 * Admin authentication middleware - verifies platform admin status
 * Must be used after authenticate middleware
 */
async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Check if user has platform admin flag
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_platform_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || !profile.is_platform_admin) {
      logger.warn('Unauthorized admin access attempt', {
        userId: req.user.id,
        email: req.user.email,
      });
      res.status(403).json({
        error: 'Platform admin access required',
        code: 'ADMIN_REQUIRED',
      });
      return;
    }

    req.isAdmin = true;
    next();
  } catch (error) {
    logger.error('Admin auth error', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Log admin action to audit log
 */
async function logAdminAction(
  adminId: string,
  action: string,
  targetType?: 'workspace' | 'user' | 'subscription',
  targetId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details ?? {},
      ip_address: ipAddress,
    });
  } catch (error) {
    logger.error('Failed to log admin action', { error, action });
  }
}

/**
 * Get platform statistics
 * GET /api/admin/stats
 */
router.get(
  '/stats',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { data: stats, error } = await supabase
        .from('platform_stats')
        .select('*')
        .single();

      if (error) {
        logger.error('Failed to fetch platform stats', { error });
        res.status(500).json({
          error: 'Failed to fetch platform statistics',
          code: 'STATS_ERROR',
        });
        return;
      }

      // Convert snake_case to camelCase
      const platformStats: PlatformStats = {
        totalWorkspaces: stats.total_workspaces,
        payingWorkspaces: stats.paying_workspaces,
        internalWorkspaces: stats.internal_workspaces,
        activeWorkspaces: stats.active_workspaces,
        trialingWorkspaces: stats.trialing_workspaces,
        totalUsers: stats.total_users,
        adminUsers: stats.admin_users,
        starterWorkspaces: stats.starter_workspaces,
        proWorkspaces: stats.pro_workspaces,
        businessWorkspaces: stats.business_workspaces,
        estimatedMrr: stats.estimated_mrr,
        totalDocuments: stats.total_documents,
        totalConversations: stats.total_conversations,
        totalBots: stats.total_bots,
        newWorkspaces30d: stats.new_workspaces_30d,
        newWorkspaces7d: stats.new_workspaces_7d,
      };

      await logAdminAction(
        req.user!.id,
        'view_platform_stats',
        undefined,
        undefined,
        undefined,
        req.ip
      );

      res.json(platformStats);
    } catch (error) {
      logger.error('Error fetching platform stats', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * List workspaces with filters and pagination
 * GET /api/admin/workspaces
 */
router.get(
  '/workspaces',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const filters: AdminWorkspaceFilters = {
        search: req.query.search as string | undefined,
        tier: req.query.tier as string | undefined,
        status: req.query.status as string | undefined,
        isInternal: req.query.isInternal === 'true' ? true : req.query.isInternal === 'false' ? false : undefined,
        sortBy: (req.query.sortBy as AdminWorkspaceFilters['sortBy']) ?? 'created_at',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') ?? 'desc',
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
      };

      let query = supabase.from('admin_workspace_details').select('*', { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,owner_email.ilike.%${filters.search}%,slug.ilike.%${filters.search}%`);
      }
      if (filters.tier) {
        query = query.eq('tier', filters.tier);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.isInternal !== undefined) {
        query = query.eq('is_internal', filters.isInternal);
      }

      // Apply sorting
      query = query.order(filters.sortBy!, { ascending: filters.sortOrder === 'asc' });

      // Apply pagination
      const offset = (filters.page! - 1) * filters.limit!;
      query = query.range(offset, offset + filters.limit! - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch workspaces', { error });
        res.status(500).json({
          error: 'Failed to fetch workspaces',
          code: 'FETCH_ERROR',
        });
        return;
      }

      // Convert snake_case to camelCase
      const workspaces: AdminWorkspaceDetails[] = (data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        tier: w.tier,
        status: w.status,
        isInternal: w.is_internal,
        internalNotes: w.internal_notes,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
        trialStartedAt: w.trial_started_at,
        trialEndsAt: w.trial_ends_at,
        maxDocuments: w.max_documents,
        maxQueriesPerMonth: w.max_queries_per_month,
        stripeCustomerId: w.stripe_customer_id,
        stripeSubscriptionId: w.stripe_subscription_id,
        ownerId: w.owner_id,
        ownerEmail: w.owner_email,
        ownerName: w.owner_name,
        memberCount: w.member_count,
        documentCount: w.document_count,
        botCount: w.bot_count,
        conversationCount: w.conversation_count,
        queriesThisMonth: w.queries_this_month,
        lastActivity: w.last_activity,
      }));

      const response: PaginatedResponse<AdminWorkspaceDetails> = {
        data: workspaces,
        total: count ?? 0,
        page: filters.page!,
        limit: filters.limit!,
        totalPages: Math.ceil((count ?? 0) / filters.limit!),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error listing workspaces', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * Get workspace details
 * GET /api/admin/workspaces/:id
 */
router.get(
  '/workspaces/:id',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;

      const { data, error } = await supabase
        .from('admin_workspace_details')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error || !data) {
        res.status(404).json({
          error: 'Workspace not found',
          code: 'NOT_FOUND',
        });
        return;
      }

      const workspace: AdminWorkspaceDetails = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        tier: data.tier,
        status: data.status,
        isInternal: data.is_internal,
        internalNotes: data.internal_notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        trialStartedAt: data.trial_started_at,
        trialEndsAt: data.trial_ends_at,
        maxDocuments: data.max_documents,
        maxQueriesPerMonth: data.max_queries_per_month,
        stripeCustomerId: data.stripe_customer_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        ownerId: data.owner_id,
        ownerEmail: data.owner_email,
        ownerName: data.owner_name,
        memberCount: data.member_count,
        documentCount: data.document_count,
        botCount: data.bot_count,
        conversationCount: data.conversation_count,
        queriesThisMonth: data.queries_this_month,
        lastActivity: data.last_activity,
      };

      await logAdminAction(
        req.user!.id,
        'view_workspace_details',
        'workspace',
        workspaceId,
        { workspaceName: workspace.name },
        req.ip
      );

      res.json(workspace);
    } catch (error) {
      logger.error('Error fetching workspace details', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * Create internal workspace
 * POST /api/admin/workspaces/internal
 */
router.post(
  '/workspaces/internal',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { name, ownerEmail, notes } = req.body as CreateInternalWorkspaceRequest;

      if (!name || !ownerEmail) {
        res.status(400).json({
          error: 'Name and owner email are required',
          code: 'INVALID_INPUT',
        });
        return;
      }

      // Call database function to create internal workspace
      const { data, error } = await supabase.rpc('create_internal_workspace', {
        p_name: name,
        p_owner_email: ownerEmail,
        p_notes: notes ?? null,
        p_admin_id: req.user!.id,
      });

      if (error) {
        logger.error('Failed to create internal workspace', { error });
        res.status(500).json({
          error: 'Failed to create internal workspace',
          code: 'CREATE_ERROR',
        });
        return;
      }

      const workspaceId = data as string;

      await logAdminAction(
        req.user!.id,
        'create_internal_workspace',
        'workspace',
        workspaceId,
        { name, ownerEmail, notes },
        req.ip
      );

      logger.info('Created internal workspace', {
        workspaceId,
        name,
        ownerEmail,
        adminId: req.user!.id,
      });

      res.status(201).json({
        id: workspaceId,
        message: 'Internal workspace created successfully',
      });
    } catch (error) {
      logger.error('Error creating internal workspace', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * Update workspace
 * PATCH /api/admin/workspaces/:id
 */
router.patch(
  '/workspaces/:id',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      const { tier, status, isInternal, notes } = req.body as {
        tier?: string;
        status?: string;
        isInternal?: boolean;
        notes?: string;
      };

      const updates: Record<string, unknown> = {};
      if (tier !== undefined) updates.tier = tier;
      if (status !== undefined) updates.status = status;
      if (isInternal !== undefined) updates.is_internal = isInternal;
      if (notes !== undefined) updates.internal_notes = notes;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          error: 'No valid fields to update',
          code: 'INVALID_INPUT',
        });
        return;
      }

      const { error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId);

      if (error) {
        logger.error('Failed to update workspace', { error, workspaceId });
        res.status(500).json({
          error: 'Failed to update workspace',
          code: 'UPDATE_ERROR',
        });
        return;
      }

      await logAdminAction(
        req.user!.id,
        'update_workspace',
        'workspace',
        workspaceId,
        updates,
        req.ip
      );

      logger.info('Updated workspace', {
        workspaceId,
        updates,
        adminId: req.user!.id,
      });

      res.json({
        message: 'Workspace updated successfully',
      });
    } catch (error) {
      logger.error('Error updating workspace', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * List users with filters
 * GET /api/admin/users
 * Note: We need to join user_profiles with auth.users to get email and last_sign_in_at
 */
router.get(
  '/users',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string | undefined;
      const isAdmin = req.query.isAdmin === 'true' ? true : req.query.isAdmin === 'false' ? false : undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      // Use raw SQL to join user_profiles with auth.users for email
      let sqlQuery = `
        SELECT
          up.id,
          au.email,
          up.full_name,
          up.avatar_url,
          up.is_platform_admin,
          up.created_at,
          au.last_sign_in_at
        FROM user_profiles up
        JOIN auth.users au ON up.id = au.id
        WHERE 1=1
      `;

      let countQuery = `
        SELECT COUNT(*) as total
        FROM user_profiles up
        JOIN auth.users au ON up.id = au.id
        WHERE 1=1
      `;

      const params: unknown[] = [];
      let paramIndex = 1;

      if (search) {
        const searchCondition = ` AND (au.email ILIKE $${paramIndex} OR up.full_name ILIKE $${paramIndex})`;
        sqlQuery += searchCondition;
        countQuery += searchCondition;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (isAdmin !== undefined) {
        const adminCondition = ` AND up.is_platform_admin = $${paramIndex}`;
        sqlQuery += adminCondition;
        countQuery += adminCondition;
        params.push(isAdmin);
        paramIndex++;
      }

      sqlQuery += ` ORDER BY up.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      // Execute queries
      const { data, error } = await supabase.rpc('exec_sql', {
        query: sqlQuery,
        params: params,
      }).single();

      // Fallback: if RPC doesn't exist, use direct query approach
      let users: AdminUser[] = [];
      let total = 0;

      if (error) {
        // Fallback: Query user_profiles and auth.users separately
        let profileQuery = supabase.from('user_profiles').select('*', { count: 'exact' });

        if (search) {
          profileQuery = profileQuery.ilike('full_name', `%${search}%`);
        }
        if (isAdmin !== undefined) {
          profileQuery = profileQuery.eq('is_platform_admin', isAdmin);
        }

        profileQuery = profileQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data: profiles, error: profileError, count } = await profileQuery;

        if (profileError) {
          logger.error('Failed to fetch users', { error: profileError });
          res.status(500).json({
            error: 'Failed to fetch users',
            code: 'FETCH_ERROR',
          });
          return;
        }

        // Get auth.users data for emails
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const authUserMap = new Map(
          (authUsers?.users ?? []).map(u => [u.id, { email: u.email, lastSignInAt: u.last_sign_in_at }])
        );

        // Filter by email search if needed
        let filteredProfiles = profiles ?? [];
        if (search) {
          filteredProfiles = filteredProfiles.filter(p => {
            const authUser = authUserMap.get(p.id);
            return authUser?.email?.toLowerCase().includes(search.toLowerCase()) ||
                   p.full_name?.toLowerCase().includes(search.toLowerCase());
          });
        }

        users = filteredProfiles.map((u) => {
          const authUser = authUserMap.get(u.id);
          return {
            id: u.id,
            email: authUser?.email ?? 'unknown',
            fullName: u.full_name ?? undefined,
            avatarUrl: u.avatar_url ?? undefined,
            isPlatformAdmin: u.is_platform_admin ?? false,
            createdAt: u.created_at,
            lastSignInAt: authUser?.lastSignInAt ?? undefined,
          };
        });
        total = count ?? 0;
      } else {
        users = (data as Record<string, unknown>[]).map((u) => ({
          id: u.id as string,
          email: u.email as string,
          fullName: (u.full_name as string | null) ?? undefined,
          avatarUrl: (u.avatar_url as string | null) ?? undefined,
          isPlatformAdmin: u.is_platform_admin as boolean,
          createdAt: u.created_at as string,
          lastSignInAt: (u.last_sign_in_at as string | null) ?? undefined,
        }));

        // Get count
        const { data: countData } = await supabase.rpc('exec_sql', {
          query: countQuery,
          params: params.slice(0, -2), // Remove limit and offset
        }).single();
        total = (countData as { total: number })?.total ?? 0;
      }

      const response: PaginatedResponse<AdminUser> = {
        data: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error listing users', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * Toggle platform admin status
 * POST /api/admin/users/:id/admin
 */
router.post(
  '/users/:id/admin',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { isAdmin } = req.body as { isAdmin: boolean };

      if (typeof isAdmin !== 'boolean') {
        res.status(400).json({
          error: 'isAdmin must be a boolean',
          code: 'INVALID_INPUT',
        });
        return;
      }

      // Prevent self-demotion
      if (userId === req.user!.id && !isAdmin) {
        res.status(400).json({
          error: 'Cannot remove your own admin status',
          code: 'SELF_DEMOTION',
        });
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ is_platform_admin: isAdmin })
        .eq('id', userId);

      if (error) {
        logger.error('Failed to update admin status', { error, userId });
        res.status(500).json({
          error: 'Failed to update admin status',
          code: 'UPDATE_ERROR',
        });
        return;
      }

      await logAdminAction(
        req.user!.id,
        'set_platform_admin',
        'user',
        userId,
        { isAdmin },
        req.ip
      );

      logger.info('Updated platform admin status', {
        userId,
        isAdmin,
        adminId: req.user!.id,
      });

      res.json({
        message: `User ${isAdmin ? 'granted' : 'revoked'} platform admin access`,
      });
    } catch (error) {
      logger.error('Error updating admin status', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

/**
 * Get audit log
 * GET /api/admin/audit-log
 */
router.get(
  '/audit-log',
  authenticate,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const action = req.query.action as string | undefined;
      const targetType = req.query.targetType as 'workspace' | 'user' | 'subscription' | undefined;
      const adminId = req.query.adminId as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      let query = supabase
        .from('admin_audit_log')
        .select(`
          *,
          admin:admin_id (
            email,
            full_name
          )
        `, { count: 'exact' });

      if (action) {
        query = query.eq('action', action);
      }
      if (targetType) {
        query = query.eq('target_type', targetType);
      }
      if (adminId) {
        query = query.eq('admin_id', adminId);
      }

      const offset = (page - 1) * limit;
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch audit log', { error });
        res.status(500).json({
          error: 'Failed to fetch audit log',
          code: 'FETCH_ERROR',
        });
        return;
      }

      const auditLog: AdminAuditLogEntry[] = (data ?? []).map((entry) => ({
        id: entry.id,
        adminId: entry.admin_id,
        adminEmail: entry.admin?.email,
        action: entry.action,
        targetType: entry.target_type,
        targetId: entry.target_id,
        details: entry.details,
        ipAddress: entry.ip_address,
        createdAt: entry.created_at,
      }));

      const response: PaginatedResponse<AdminAuditLogEntry> = {
        data: auditLog,
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching audit log', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR',
      });
    }
  }
);

export default router;
