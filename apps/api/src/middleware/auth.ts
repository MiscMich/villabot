/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user context to requests
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import type { AuthUser, UserProfile, AuthSession } from '@villa-paraiso/shared';

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
  } catch {
    // Ignore errors for optional auth
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
