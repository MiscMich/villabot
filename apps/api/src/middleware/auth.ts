/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user context to requests
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import type { AuthUser, UserProfile, AuthSession } from '@cluebase/shared';
import { TIER_CONFIGS } from '@cluebase/shared';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      profile?: UserProfile;
      session?: AuthSession;
    }
  }
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Authentication middleware - verifies JWT and attaches user to request
 * Use this for routes that require authentication
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Verify the JWT with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Invalid or expired token', { error: authError?.message });
      res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Get user profile from our profiles table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('Failed to fetch user profile', { error: profileError, userId: user.id });
      res.status(500).json({
        error: 'Failed to fetch user profile',
        code: 'PROFILE_ERROR',
      });
      return;
    }

    // If no profile exists, create one (first login after migration)
    let userProfile = profile;
    if (!userProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          preferences: { theme: 'system', notifications: true },
        })
        .select()
        .single();

      if (createError) {
        logger.error('Failed to create user profile', { error: createError, userId: user.id });
        res.status(500).json({
          error: 'Failed to create user profile',
          code: 'PROFILE_CREATE_ERROR',
        });
        return;
      }
      userProfile = newProfile;

      // Also check if user needs a default workspace (new signup via client-side)
      const { data: existingMemberships } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!existingMemberships?.length) {
        // User has no workspace - create a default one
        const workspaceName = user.user_metadata?.workspace_name || 'My Workspace';
        const slug = workspaceName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const tierConfig = TIER_CONFIGS.pro; // New workspaces start on Pro trial

        const { data: newWorkspace, error: wsError } = await supabase
          .from('workspaces')
          .insert({
            name: workspaceName,
            slug: `${slug}-${Date.now()}`,
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
          logger.error('Failed to create default workspace', { error: wsError, userId: user.id });
        } else if (newWorkspace) {
          // Create owner membership
          const { error: membershipError } = await supabase
            .from('workspace_members')
            .insert({
              workspace_id: newWorkspace.id,
              user_id: user.id,
              role: 'owner',
              is_active: true,
            });

          if (membershipError) {
            logger.error('Failed to create workspace membership', {
              error: membershipError,
              userId: user.id,
              workspaceId: newWorkspace.id,
            });
          }

          // Update profile with default workspace
          const { data: updatedProfile, error: profileUpdateError } = await supabase
            .from('user_profiles')
            .update({ default_workspace_id: newWorkspace.id })
            .eq('id', user.id)
            .select()
            .single();

          if (profileUpdateError) {
            logger.error('Failed to update profile with default workspace', {
              error: profileUpdateError,
              userId: user.id,
              workspaceId: newWorkspace.id,
            });
          } else if (updatedProfile) {
            userProfile = updatedProfile;
          }

          logger.info('Created default workspace for new user', {
            userId: user.id,
            workspaceId: newWorkspace.id,
            workspaceName,
          });
        }
      }
    }

    // Attach user context to request
    req.user = {
      id: user.id,
      email: user.email!,
      email_confirmed_at: user.email_confirmed_at || null,
      phone: user.phone || null,
      confirmed_at: user.confirmed_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {},
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
    };

    req.profile = userProfile as UserProfile;

    // Store session info for later use
    req.session = {
      access_token: token,
      refresh_token: '', // Not available here
      expires_in: 0,
      token_type: 'bearer',
      user: req.user,
    };

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional authentication - attaches user if token present, but doesn't require it
 * Use this for routes that work differently for authenticated vs anonymous users
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    // No token, continue without user
    next();
    return;
  }

  // Try to authenticate, but don't fail if invalid
  try {
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email!,
        email_confirmed_at: user.email_confirmed_at || null,
        phone: user.phone || null,
        confirmed_at: user.confirmed_at || null,
        last_sign_in_at: user.last_sign_in_at || null,
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      };
      req.profile = profile as UserProfile;
    }
  } catch (error) {
    // Log but don't fail for optional auth
    logger.debug('Optional auth error (non-blocking)', { error: error instanceof Error ? error.message : 'Unknown error' });
  }

  next();
}

/**
 * Require specific role - use after authenticate middleware
 */
export function requireRole(...roles: string[]) {
  return async (req: Request, response: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      response.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Role is checked in workspace middleware, this is a placeholder
    // for checking admin roles etc.
    const userRole = (req as Request & { membership?: { role: string } }).membership?.role;

    if (userRole && roles.includes(userRole)) {
      next();
      return;
    }

    response.status(403).json({
      error: 'Insufficient permissions',
      code: 'FORBIDDEN',
      required_roles: roles,
    });
  };
}
