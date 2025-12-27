'use client';

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Crown,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Settings,
  X,
  Clock,
} from 'lucide-react';
import type { WorkspaceMemberRole } from '@cluebase/shared';

const roleLabels: Record<WorkspaceMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

const roleDescriptions: Record<WorkspaceMemberRole, string> = {
  owner: 'Full access including billing and workspace deletion',
  admin: 'Can manage team members and workspace settings',
  member: 'Can use the bot and view documents',
};

const roleIcons: Record<WorkspaceMemberRole, React.ReactNode> = {
  owner: <Crown className="h-4 w-4 text-amber-500" />,
  admin: <Shield className="h-4 w-4 text-blue-500" />,
  member: <Users className="h-4 w-4 text-white/40" />,
};

interface TeamMember {
  id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  is_active: boolean;
  invited_at: string;
  accepted_at: string | null;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string;
  } | null;
}

interface TeamInvite {
  id: string;
  email: string;
  role: WorkspaceMemberRole;
  created_at: string;
  expires_at: string;
}

export default function TeamPage() {
  const { workspace, canManageTeam, isOwner } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null);

  // Fetch team data
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const [membersData, invitesData] = await Promise.all([
          api.getTeamMembers(),
          canManageTeam ? api.getTeamInvites().catch(() => ({ invites: [] })) : Promise.resolve({ invites: [] }),
        ]);
        setMembers(membersData.members as TeamMember[]);
        setInvites(invitesData.invites as TeamInvite[]);
      } catch (err) {
        console.error('Failed to fetch team:', err);
        setError('Failed to load team members');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeam();
  }, [canManageTeam]);

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsInviting(true);

    try {
      const result = await api.inviteMember(inviteEmail, inviteRole);
      // Add the new invite to the list
      if (result.invite) {
        const newInvite: TeamInvite = {
          id: result.invite.id,
          email: result.invite.email,
          role: inviteRole,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        setInvites([newInvite, ...invites]);
      }
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
      setSuccess(`Invitation sent to ${inviteEmail}`);
      toast({ title: 'Invitation Sent', description: `Invite sent to ${inviteEmail}` });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to invite:', err);
      setError('Failed to send invitation. Please try again.');
      toast({ title: 'Invite Failed', description: 'Failed to send invitation', variant: 'destructive' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInvite(inviteId);
    try {
      await api.revokeInvite(inviteId);
      setInvites(invites.filter((i) => i.id !== inviteId));
      setSuccess('Invitation revoked');
      toast({ title: 'Invite Revoked', description: 'Invitation has been cancelled' });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to revoke invite:', err);
      setError('Failed to revoke invitation');
      toast({ title: 'Revoke Failed', description: 'Failed to cancel invitation', variant: 'destructive' });
    } finally {
      setRevokingInvite(null);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: WorkspaceMemberRole) => {
    try {
      await api.updateMemberRole(memberId, newRole);
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setSuccess('Role updated successfully');
      toast({ title: 'Role Updated', description: `Member role changed to ${roleLabels[newRole]}` });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update role');
      toast({ title: 'Update Failed', description: 'Failed to update member role', variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await api.removeMember(memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      setSuccess('Member removed from workspace');
      toast({ title: 'Member Removed', description: 'Team member has been removed' });
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
      toast({ title: 'Remove Failed', description: 'Failed to remove team member', variant: 'destructive' });
    } finally {
      setRemovingMember(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="h-64 bg-muted rounded-xl shimmer" />
        <div className="h-48 bg-muted rounded-xl shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 md:gap-3 mb-2">
            <Users className="w-6 h-6 md:w-8 md:h-8 text-amber-500 shrink-0" />
            <h1 className="text-2xl md:text-4xl font-display font-bold">Team Management</h1>
          </div>
          <p className="text-sm md:text-lg text-muted-foreground">
            Manage your workspace members and invitations
          </p>
        </div>
        {canManageTeam && !showInviteForm && (
          <Button
            onClick={() => setShowInviteForm(true)}
            className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Invite Team Member</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Send an invitation to join {workspace?.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Role</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={inviteRole === 'member' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInviteRole('member')}
                      className={
                        inviteRole === 'member'
                          ? 'bg-white/10 text-foreground'
                          : 'border-white/10 text-muted-foreground hover:text-foreground'
                      }
                    >
                      <Users className="mr-1 h-3 w-3" />
                      Member
                    </Button>
                    <Button
                      type="button"
                      variant={inviteRole === 'admin' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInviteRole('admin')}
                      className={
                        inviteRole === 'admin'
                          ? 'bg-blue-600 text-white'
                          : 'border-white/10 text-muted-foreground hover:text-foreground'
                      }
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      Admin
                    </Button>
                    {isOwner && (
                      <Button
                        type="button"
                        variant={inviteRole === 'owner' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInviteRole('owner')}
                        className={
                          inviteRole === 'owner'
                            ? 'bg-amber-600 text-white'
                            : 'border-white/10 text-muted-foreground hover:text-foreground'
                        }
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        Owner
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{roleDescriptions[inviteRole]}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteForm(false)}
                  className="border-white/10 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isInviting}
                  className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {canManageTeam && invites.length > 0 && (
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Pending Invitations</h2>
                <p className="text-sm text-muted-foreground">Invitations awaiting acceptance</p>
              </div>
              <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {invites.length} pending
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {invites.map((invite, index) => {
                const expiresAt = new Date(invite.expires_at);
                const daysUntilExpiry = Math.ceil(
                  (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isExpiringSoon = daysUntilExpiry <= 2;

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 opacity-0 animate-fade-in"
                    style={{ animationDelay: `${200 + index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{invite.email}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge
                            variant="outline"
                            className={`${
                              invite.role === 'admin'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-white/20 text-muted-foreground'
                            }`}
                          >
                            {roleIcons[invite.role]}
                            <span className="ml-1">{roleLabels[invite.role]}</span>
                          </Badge>
                          <span className="text-white/20">•</span>
                          <span className={isExpiringSoon ? 'text-amber-400' : ''}>
                            Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvite(invite.id)}
                      disabled={revokingInvite === invite.id}
                      className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                    >
                      {revokingInvite === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Team Members</h2>
              <p className="text-sm text-muted-foreground">People with access to this workspace</p>
            </div>
            <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {members.length} members
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {members.map((member, index) => {
              const isCurrentUser = member.user_id === user?.id;
              const canManageMember = canManageTeam && !isCurrentUser && member.role !== 'owner';
              const canChangeRole = isOwner && !isCurrentUser;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg opacity-0 animate-fade-in"
                  style={{ animationDelay: `${250 + index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-lg font-medium text-foreground">
                        {member.user?.full_name?.charAt(0) ?? member.user?.email?.charAt(0) ?? '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {member.user?.full_name ?? 'Unknown User'}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.user?.email ?? 'No email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {canChangeRole ? (
                      <div className="flex gap-1">
                        {(['member', 'admin', 'owner'] as const).map((role) => (
                          <Button
                            key={role}
                            variant={member.role === role ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => handleUpdateRole(member.id, role)}
                            disabled={member.role === role || (role === 'owner' && !isOwner)}
                            className={`text-xs ${
                              member.role === role
                                ? role === 'owner'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : role === 'admin'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-white/10 text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {roleIcons[role]}
                            <span className="ml-1">{roleLabels[role]}</span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`${
                          member.role === 'owner'
                            ? 'border-amber-500 text-amber-400'
                            : member.role === 'admin'
                            ? 'border-blue-500 text-blue-400'
                            : 'border-white/20 text-muted-foreground'
                        }`}
                      >
                        {roleIcons[member.role]}
                        <span className="ml-1">{roleLabels[member.role]}</span>
                      </Badge>
                    )}

                    {canManageMember && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingMember === member.id}
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      >
                        {removingMember === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {members.length === 0 && (
              <div className="text-center py-12">
                <div className="p-4 rounded-full bg-muted mx-auto w-fit mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-1">No team members yet</p>
                <p className="text-sm text-muted-foreground">Invite your first team member to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold">Role Permissions</h2>
              <p className="text-sm text-muted-foreground">Understanding workspace roles and their capabilities</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {(['owner', 'admin', 'member'] as const).map((role, index) => (
              <div
                key={role}
                className="p-4 bg-white/5 rounded-lg border border-white/5 opacity-0 animate-fade-in"
                style={{ animationDelay: `${350 + index * 50}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {roleIcons[role]}
                  <h3 className="font-medium text-foreground">{roleLabels[role]}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{roleDescriptions[role]}</p>
                <ul className="mt-3 space-y-1 text-sm text-foreground">
                  {role === 'owner' && (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Manage billing & subscription
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Delete workspace
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Transfer ownership
                      </li>
                    </>
                  )}
                  {(role === 'owner' || role === 'admin') && (
                    <>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Invite & remove members
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Manage workspace settings
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        Manage bots & documents
                      </li>
                    </>
                  )}
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Use bot & view documents
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    View analytics
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
