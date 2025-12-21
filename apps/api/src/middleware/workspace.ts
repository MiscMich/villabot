/**
 * Workspace Middleware
 * Resolves workspace context from header or user's default workspace
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import type { Workspace, WorkspaceMember } from '@teambrain/shared';

// Extend Express Request to include workspace context
declare global {
  namespace Express {
    interface Request {
      workspace?: Workspace;
      membership?: WorkspaceMember;
    }
  }
}

/**
 * Workspace resolution middleware
 * Resolves workspace from X-Workspace-ID header or user's default workspace
 * Requires authenticate middleware to be called first
 */
export async function resolveWorkspace(
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

    // Get workspace ID from header or user's default
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const userId = req.user.id;

    let resolvedWorkspaceId = workspaceId;

    // If no workspace specified, use user's default
    if (!resolvedWorkspaceId && req.profile?.default_workspace_id) {
      resolvedWorkspaceId = req.profile.default_workspace_id;
    }

    // If still no workspace, get the first one user belongs to
    if (!resolvedWorkspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (membership) {
        resolvedWorkspaceId = membership.workspace_id;
      }
    }

    if (!resolvedWorkspaceId) {
      res.status(400).json({
        error: 'No workspace available. Please create or join a workspace.',
        code: 'NO_WORKSPACE',
      });
      return;
    }

    // Fetch workspace and verify membership
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', resolvedWorkspaceId)
      .single();

    if (workspaceError || !workspaceData) {
      logger.warn('Workspace not found', { workspaceId: resolvedWorkspaceId });
      res.status(404).json({
        error: 'Workspace not found',
        code: 'WORKSPACE_NOT_FOUND',
      });
      return;
    }

    // Verify user is a member of this workspace
    const { data: membershipData, error: membershipError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', resolvedWorkspaceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membershipError || !membershipData) {
      logger.warn('User not a member of workspace', {
        userId,
        workspaceId: resolvedWorkspaceId
      });
      res.status(403).json({
        error: 'You are not a member of this workspace',
        code: 'NOT_WORKSPACE_MEMBER',
      });
      return;
    }

    // Attach workspace context to request
    req.workspace = workspaceData as Workspace;
    req.membership = membershipData as WorkspaceMember;

    logger.debug('Workspace resolved', {
      workspaceId: req.workspace.id,
      workspaceName: req.workspace.name,
      userRole: req.membership.role
    });

    next();
  } catch (error) {
    logger.error('Workspace resolution error', { error });
    res.status(500).json({
      error: 'Failed to resolve workspace',
      code: 'WORKSPACE_ERROR',
    });
  }
}

/**
 * Require workspace owner or admin role
 */
export function requireWorkspaceAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.membership) {
    res.status(401).json({
      error: 'Workspace context required',
      code: 'NO_WORKSPACE_CONTEXT',
    });
    return;
  }

  if (!['owner', 'admin'].includes(req.membership.role)) {
    res.status(403).json({
      error: 'Admin or owner access required',
      code: 'ADMIN_REQUIRED',
    });
    return;
  }

  next();
}

/**
 * Require workspace owner role only
 */
export function requireWorkspaceOwner(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.membership) {
    res.status(401).json({
      error: 'Workspace context required',
      code: 'NO_WORKSPACE_CONTEXT',
    });
    return;
  }

  if (req.membership.role !== 'owner') {
    res.status(403).json({
      error: 'Owner access required',
      code: 'OWNER_REQUIRED',
    });
    return;
  }

  next();
}

/**
 * Helper to get workspace ID from request
 * Use this in route handlers after middleware
 */
export function getWorkspaceId(req: Request): string {
  if (!req.workspace) {
    throw new Error('Workspace context not available - ensure resolveWorkspace middleware is applied');
  }
  return req.workspace.id;
}

/**
 * Helper to check if user has specific role in workspace
 */
export function hasWorkspaceRole(req: Request, ...roles: string[]): boolean {
  if (!req.membership) {
    return false;
  }
  return roles.includes(req.membership.role);
}
