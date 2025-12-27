/**
 * Team Management Routes
 * Handles workspace members and invites
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  checkUsageLimit,
  generalApiRateLimiter,
  inviteAcceptRateLimiter,
} from '../middleware/index.js';
import { randomBytes } from 'crypto';
import { env } from '../config/env.js';
import { sendInviteEmail } from '../services/email/index.js';
import type {
  InviteMemberRequest,
  WorkspaceMemberRole,
} from '@cluebase/shared';

export const teamRouter = Router();

// Apply authentication, workspace resolution, and rate limiting to all routes
// Order matters: authenticate first, then resolveWorkspace, then rate limiter
teamRouter.use(authenticate, resolveWorkspace, generalApiRateLimiter);

/**
 * List all members in the workspace
 */
teamRouter.get('/members', async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        *,
        user:user_profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('workspace_id', req.workspace!.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ members });
  } catch (error) {
    logger.error('Failed to list members', { error });
    res.status(500).json({
      error: 'Failed to list members',
      code: 'LIST_MEMBERS_ERROR',
    });
  }
});

/**
 * Get a specific member
 */
teamRouter.get('/members/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: member, error } = await supabase
      .from('workspace_members')
      .select(`
        *,
        user:user_profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('workspace_id', req.workspace!.id)
      .eq('user_id', userId)
      .single();

    if (error || !member) {
      return res.status(404).json({
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND',
      });
    }

    res.json({ member });
  } catch (error) {
    logger.error('Failed to get member', { error });
    res.status(500).json({
      error: 'Failed to get member',
      code: 'GET_MEMBER_ERROR',
    });
  }
});

/**
 * Update member role
 */
teamRouter.patch(
  '/members/:userId',
  requireWorkspaceAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body as { role: WorkspaceMemberRole };

      // Can't change own role
      if (userId === req.user!.id) {
        return res.status(400).json({
          error: 'Cannot change your own role',
          code: 'CANNOT_CHANGE_OWN_ROLE',
        });
      }

      // Get current member
      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', req.workspace!.id)
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.status(404).json({
          error: 'Member not found',
          code: 'MEMBER_NOT_FOUND',
        });
      }

      // Only owner can promote to owner
      if (role === 'owner' && req.membership!.role !== 'owner') {
        return res.status(403).json({
          error: 'Only owner can transfer ownership',
          code: 'OWNER_REQUIRED',
        });
      }

      // If promoting to owner, demote current owner to admin
      if (role === 'owner') {
        await supabase
          .from('workspace_members')
          .update({ role: 'admin' })
          .eq('workspace_id', req.workspace!.id)
          .eq('user_id', req.user!.id);
      }

      // Update member role
      const { data: updatedMember, error } = await supabase
        .from('workspace_members')
        .update({ role })
        .eq('workspace_id', req.workspace!.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Member role updated', {
        workspaceId: req.workspace!.id,
        targetUserId: userId,
        newRole: role,
        updatedBy: req.user!.id,
      });

      res.json({ member: updatedMember });
    } catch (error) {
      logger.error('Failed to update member', { error });
      res.status(500).json({
        error: 'Failed to update member',
        code: 'UPDATE_MEMBER_ERROR',
      });
    }
  }
);

/**
 * Remove member from workspace
 */
teamRouter.delete(
  '/members/:userId',
  requireWorkspaceAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Can't remove yourself
      if (userId === req.user!.id) {
        return res.status(400).json({
          error: 'Cannot remove yourself',
          code: 'CANNOT_REMOVE_SELF',
        });
      }

      // Get current member
      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', req.workspace!.id)
        .eq('user_id', userId)
        .single();

      if (!member) {
        return res.status(404).json({
          error: 'Member not found',
          code: 'MEMBER_NOT_FOUND',
        });
      }

      // Can't remove owner (must transfer ownership first)
      if (member.role === 'owner') {
        return res.status(400).json({
          error: 'Cannot remove workspace owner. Transfer ownership first.',
          code: 'CANNOT_REMOVE_OWNER',
        });
      }

      // Soft delete (mark inactive)
      const { error } = await supabase
        .from('workspace_members')
        .update({ is_active: false })
        .eq('workspace_id', req.workspace!.id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      logger.info('Member removed', {
        workspaceId: req.workspace!.id,
        removedUserId: userId,
        removedBy: req.user!.id,
      });

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Failed to remove member', { error });
      res.status(500).json({
        error: 'Failed to remove member',
        code: 'REMOVE_MEMBER_ERROR',
      });
    }
  }
);

/**
 * List pending invites
 */
teamRouter.get('/invites', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { data: invites, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', req.workspace!.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ invites });
  } catch (error) {
    logger.error('Failed to list invites', { error });
    res.status(500).json({
      error: 'Failed to list invites',
      code: 'LIST_INVITES_ERROR',
    });
  }
});

/**
 * Create invite
 */
teamRouter.post(
  '/invites',
  requireWorkspaceAdmin,
  checkUsageLimit('team_members'),
  async (req, res) => {
    try {
      const { email, role = 'member' } = req.body as InviteMemberRequest;

      if (!email) {
        return res.status(400).json({
          error: 'Email is required',
          code: 'MISSING_EMAIL',
        });
      }

      // For now, check if email already has a pending invite
      const { data: existingInvite } = await supabase
        .from('workspace_invites')
        .select('id')
        .eq('workspace_id', req.workspace!.id)
        .eq('email', email.toLowerCase())
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingInvite) {
        return res.status(400).json({
          error: 'An invite is already pending for this email',
          code: 'INVITE_EXISTS',
        });
      }

      // Generate invite token
      const inviteToken = randomBytes(32).toString('hex');

      // Create invite (expires in 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invite, error } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: req.workspace!.id,
          email: email.toLowerCase(),
          role,
          invite_token: inviteToken,
          expires_at: expiresAt.toISOString(),
          invited_by: req.user!.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Generate invite link
      const inviteLink = `${env.APP_URL}/invite/${inviteToken}`;

      // Get inviter and workspace names for email
      const { data: inviterProfile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', req.user!.id)
        .single();

      // Send invite email (async, don't block response)
      sendInviteEmail({
        email: email.toLowerCase(),
        inviteLink,
        workspaceName: req.workspace!.name,
        inviterName: inviterProfile?.full_name ?? undefined,
      }).catch((err) => {
        logger.error('Failed to send invite email', { error: err, email });
      });

      logger.info('Invite created', {
        workspaceId: req.workspace!.id,
        email,
        invitedBy: req.user!.id,
      });

      res.status(201).json({
        invite,
        invite_link: inviteLink,
      });
    } catch (error) {
      logger.error('Failed to create invite', { error });
      res.status(500).json({
        error: 'Failed to create invite',
        code: 'CREATE_INVITE_ERROR',
      });
    }
  }
);

/**
 * Revoke invite
 */
teamRouter.delete(
  '/invites/:inviteId',
  requireWorkspaceAdmin,
  async (req, res) => {
    try {
      const { inviteId } = req.params;

      const { error } = await supabase
        .from('workspace_invites')
        .delete()
        .eq('id', inviteId)
        .eq('workspace_id', req.workspace!.id);

      if (error) {
        throw error;
      }

      logger.info('Invite revoked', {
        workspaceId: req.workspace!.id,
        inviteId,
        revokedBy: req.user!.id,
      });

      res.json({ message: 'Invite revoked successfully' });
    } catch (error) {
      logger.error('Failed to revoke invite', { error });
      res.status(500).json({
        error: 'Failed to revoke invite',
        code: 'REVOKE_INVITE_ERROR',
      });
    }
  }
);

/**
 * Accept invite (requires authentication - creates membership for authenticated user)
 * Rate limited by IP to prevent brute force token guessing
 */
teamRouter.post('/invites/:token/accept', inviteAcceptRateLimiter, authenticate, async (req, res) => {
  try {
    const { token } = req.params;

    // Find valid invite
    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('invite_token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({
        error: 'Invalid or expired invite',
        code: 'INVALID_INVITE',
      });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', req.user!.id)
      .single();

    if (existingMember) {
      return res.status(400).json({
        error: 'Already a member of this workspace',
        code: 'ALREADY_MEMBER',
      });
    }

    // Create membership
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: req.user!.id,
        role: invite.role,
        invited_by: invite.invited_by,
        invited_at: invite.created_at,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (memberError) {
      throw memberError;
    }

    // Mark invite as used
    await supabase
      .from('workspace_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Get workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', invite.workspace_id)
      .single();

    logger.info('Invite accepted', {
      workspaceId: invite.workspace_id,
      userId: req.user!.id,
      inviteId: invite.id,
    });

    res.json({ workspace, membership });
  } catch (error) {
    logger.error('Failed to accept invite', { error });
    res.status(500).json({
      error: 'Failed to accept invite',
      code: 'ACCEPT_INVITE_ERROR',
    });
  }
});

/**
 * Leave workspace (for non-owners)
 */
teamRouter.post('/leave', async (req, res) => {
  try {
    // Owner cannot leave (must transfer ownership first)
    if (req.membership!.role === 'owner') {
      return res.status(400).json({
        error: 'Owner cannot leave workspace. Transfer ownership first.',
        code: 'OWNER_CANNOT_LEAVE',
      });
    }

    // Soft delete membership
    const { error } = await supabase
      .from('workspace_members')
      .update({ is_active: false })
      .eq('workspace_id', req.workspace!.id)
      .eq('user_id', req.user!.id);

    if (error) {
      throw error;
    }

    logger.info('User left workspace', {
      workspaceId: req.workspace!.id,
      userId: req.user!.id,
    });

    res.json({ message: 'Left workspace successfully' });
  } catch (error) {
    logger.error('Failed to leave workspace', { error });
    res.status(500).json({
      error: 'Failed to leave workspace',
      code: 'LEAVE_ERROR',
    });
  }
});
