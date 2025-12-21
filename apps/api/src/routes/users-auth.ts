/**
 * User Authentication Routes
 * Handles signup, signin, password reset, and token refresh
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import { TIER_CONFIGS } from '@teambrain/shared';
import type {
  SignUpRequest,
  SignUpResponse,
  SignInRequest,
  SignInResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
  UpdateProfileRequest,
  WorkspaceWithRole,
} from '@teambrain/shared';

export const usersAuthRouter = Router();

/**
 * Sign up a new user
 * Optionally creates a workspace or joins via invite
 */
usersAuthRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, workspace_name, invite_token } = req.body as SignUpRequest;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
      },
    });

    if (authError) {
      logger.warn('Signup failed', { error: authError.message, email });
      return res.status(400).json({
        error: authError.message,
        code: 'SIGNUP_FAILED',
      });
    }

    if (!authData.user) {
      return res.status(400).json({
        error: 'Failed to create user',
        code: 'USER_CREATION_FAILED',
      });
    }

    const userId = authData.user.id;

    // Create user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        full_name: full_name || null,
        preferences: { theme: 'system', notifications: true },
      })
      .select()
      .single();

    if (profileError) {
      logger.error('Failed to create profile', { error: profileError, userId });
    }

    let workspace = null;
    let membership = null;

    // Handle invite token (joining existing workspace)
    if (invite_token) {
      const { data: invite } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('invite_token', invite_token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invite) {
        // Create membership
        const { data: newMembership } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: invite.workspace_id,
            user_id: userId,
            role: invite.role,
            invited_by: invite.invited_by,
            invited_at: invite.created_at,
            accepted_at: new Date().toISOString(),
            is_active: true,
          })
          .select()
          .single();

        // Mark invite as used
        await supabase
          .from('workspace_invites')
          .update({ used_at: new Date().toISOString() })
          .eq('id', invite.id);

        // Get workspace
        const { data: ws } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', invite.workspace_id)
          .single();

        workspace = ws;
        membership = newMembership;

        // Update profile default workspace
        await supabase
          .from('user_profiles')
          .update({ default_workspace_id: invite.workspace_id })
          .eq('id', userId);
      }
    }

    // Create new workspace if specified and not joining via invite
    if (workspace_name && !workspace) {
      const slug = workspace_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const tierConfig = TIER_CONFIGS.pro; // New workspaces start on Pro trial

      const { data: newWorkspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({
          name: workspace_name,
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
        logger.error('Failed to create workspace', { error: wsError, userId });
      } else {
        workspace = newWorkspace;

        // Create owner membership
        const { data: ownerMembership } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: newWorkspace.id,
            user_id: userId,
            role: 'owner',
            is_active: true,
          })
          .select()
          .single();

        membership = ownerMembership;

        // Update profile default workspace
        await supabase
          .from('user_profiles')
          .update({ default_workspace_id: newWorkspace.id })
          .eq('id', userId);
      }
    }

    const response: SignUpResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        email_confirmed_at: authData.user.email_confirmed_at || null,
        phone: authData.user.phone || null,
        confirmed_at: authData.user.confirmed_at || null,
        last_sign_in_at: authData.user.last_sign_in_at || null,
        app_metadata: authData.user.app_metadata || {},
        user_metadata: authData.user.user_metadata || {},
        created_at: authData.user.created_at,
        updated_at: authData.user.updated_at || authData.user.created_at,
      },
      session: authData.session ? {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
        user: {} as SignUpResponse['session']['user'], // Simplified
      } : null as unknown as SignUpResponse['session'],
      profile: profile!,
      workspace: workspace || undefined,
      membership: membership || undefined,
    };

    logger.info('User signed up successfully', { userId, email });
    res.status(201).json(response);
  } catch (error) {
    logger.error('Signup error', { error });
    res.status(500).json({
      error: 'Failed to sign up',
      code: 'SIGNUP_ERROR',
    });
  }
});

/**
 * Sign in existing user
 */
usersAuthRouter.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body as SignInRequest;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
      });
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      logger.warn('Signin failed', { error: authError?.message, email });
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const userId = authData.user.id;

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Get user's workspaces with roles
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    const workspaces: WorkspaceWithRole[] = (memberships || []).map((m) => ({
      workspace: m.workspaces as unknown as WorkspaceWithRole['workspace'],
      role: m.role,
    }));

    const response: SignInResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        email_confirmed_at: authData.user.email_confirmed_at || null,
        phone: authData.user.phone || null,
        confirmed_at: authData.user.confirmed_at || null,
        last_sign_in_at: authData.user.last_sign_in_at || null,
        app_metadata: authData.user.app_metadata || {},
        user_metadata: authData.user.user_metadata || {},
        created_at: authData.user.created_at,
        updated_at: authData.user.updated_at || authData.user.created_at,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
        user: {} as SignInResponse['session']['user'],
      },
      profile: profile!,
      workspaces,
    };

    logger.info('User signed in', { userId, email });
    res.json(response);
  } catch (error) {
    logger.error('Signin error', { error });
    res.status(500).json({
      error: 'Failed to sign in',
      code: 'SIGNIN_ERROR',
    });
  }
});

/**
 * Forgot password - send reset email
 */
usersAuthRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as ForgotPasswordRequest;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL',
      });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3001'}/auth/reset-password`,
    });

    if (error) {
      logger.warn('Password reset request failed', { error: error.message, email });
    }

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Forgot password error', { error });
    res.status(500).json({
      error: 'Failed to process password reset request',
      code: 'RESET_REQUEST_ERROR',
    });
  }
});

/**
 * Reset password with token
 */
usersAuthRouter.post('/reset-password', async (req, res) => {
  try {
    const { password } = req.body as ResetPasswordRequest;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!password) {
      return res.status(400).json({
        error: 'New password is required',
        code: 'MISSING_PASSWORD',
      });
    }

    if (!token) {
      return res.status(401).json({
        error: 'Reset token is required',
        code: 'MISSING_TOKEN',
      });
    }

    // Verify the token first
    const { data: { user }, error: verifyError } = await supabase.auth.getUser(token);

    if (verifyError || !user) {
      return res.status(401).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN',
      });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      logger.error('Password reset failed', { error: updateError.message });
      return res.status(400).json({
        error: updateError.message,
        code: 'RESET_FAILED',
      });
    }

    logger.info('Password reset successful', { userId: user.id });
    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error('Reset password error', { error });
    res.status(500).json({
      error: 'Failed to reset password',
      code: 'RESET_ERROR',
    });
  }
});

/**
 * Update password (authenticated)
 */
usersAuthRouter.post('/update-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body as UpdatePasswordRequest;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current and new password are required',
        code: 'MISSING_PASSWORDS',
      });
    }

    // Verify current password by attempting sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: req.user!.email,
      password: current_password,
    });

    if (verifyError) {
      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    });

    if (updateError) {
      return res.status(400).json({
        error: updateError.message,
        code: 'PASSWORD_UPDATE_FAILED',
      });
    }

    logger.info('Password updated', { userId: req.user!.id });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Update password error', { error });
    res.status(500).json({
      error: 'Failed to update password',
      code: 'UPDATE_PASSWORD_ERROR',
    });
  }
});

/**
 * Get current user profile
 */
usersAuthRouter.get('/me', authenticate, async (req, res) => {
  try {
    // Get workspaces
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (*)
      `)
      .eq('user_id', req.user!.id)
      .eq('is_active', true);

    const workspaces = (memberships || []).map((m) => ({
      workspace: m.workspaces,
      role: m.role,
    }));

    res.json({
      user: req.user,
      profile: req.profile,
      workspaces,
    });
  } catch (error) {
    logger.error('Get profile error', { error });
    res.status(500).json({
      error: 'Failed to get profile',
      code: 'PROFILE_ERROR',
    });
  }
});

/**
 * Update user profile
 */
usersAuthRouter.patch('/me', authenticate, async (req, res) => {
  try {
    const updates = req.body as UpdateProfileRequest;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        full_name: updates.full_name,
        avatar_url: updates.avatar_url,
        preferences: updates.preferences,
        default_workspace_id: updates.default_workspace_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: 'Failed to update profile',
        code: 'UPDATE_FAILED',
      });
    }

    logger.info('Profile updated', { userId: req.user!.id });
    res.json({ profile });
  } catch (error) {
    logger.error('Update profile error', { error });
    res.status(500).json({
      error: 'Failed to update profile',
      code: 'UPDATE_PROFILE_ERROR',
    });
  }
});

/**
 * Refresh token
 */
usersAuthRouter.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        token_type: data.session.token_type,
      },
    });
  } catch (error) {
    logger.error('Refresh token error', { error });
    res.status(500).json({
      error: 'Failed to refresh token',
      code: 'REFRESH_ERROR',
    });
  }
});

/**
 * Sign out
 */
usersAuthRouter.post('/signout', authenticate, async (req, res) => {
  try {
    await supabase.auth.signOut();
    logger.info('User signed out', { userId: req.user!.id });
    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    logger.error('Signout error', { error });
    res.status(500).json({
      error: 'Failed to sign out',
      code: 'SIGNOUT_ERROR',
    });
  }
});
