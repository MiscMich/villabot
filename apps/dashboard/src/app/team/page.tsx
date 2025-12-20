'use client';

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import type { WorkspaceMemberRole } from '@villa-paraiso/shared';

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
  member: <Users className="h-4 w-4 text-slate-400" />,
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

  // Fetch team data
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await api.getTeamMembers();
        setMembers(data.members as TeamMember[]);
        // Note: invites would need a separate API endpoint
        // For now, we'll show pending invites if the API returns them
      } catch (err) {
        console.error('Failed to fetch team:', err);
        setError('Failed to load team members');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsInviting(true);

    try {
      await api.inviteMember(inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteForm(false);
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to invite:', err);
      setError('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: WorkspaceMemberRole) => {
    try {
      await api.updateMemberRole(memberId, newRole);
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      setSuccess('Role updated successfully');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to update role:', err);
      setError('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await api.removeMember(memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      setSuccess('Member removed from workspace');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team Management</h1>
          <p className="text-slate-400">
            Manage your workspace members and invitations
          </p>
        </div>
        {canManageTeam && !showInviteForm && (
          <Button
            onClick={() => setShowInviteForm(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900"
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
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-100">Invite Team Member</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteForm(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-slate-400">
              Send an invitation to join {workspace?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="bg-slate-900/50 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Role</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={inviteRole === 'member' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setInviteRole('member')}
                      className={
                        inviteRole === 'member'
                          ? 'bg-slate-600 text-slate-100'
                          : 'border-slate-600 text-slate-300'
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
                          ? 'bg-blue-600 text-slate-100'
                          : 'border-slate-600 text-slate-300'
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
                            ? 'bg-amber-600 text-slate-100'
                            : 'border-slate-600 text-slate-300'
                        }
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        Owner
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{roleDescriptions[inviteRole]}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteForm(false)}
                  className="border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isInviting}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900"
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
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({members.length})
          </CardTitle>
          <CardDescription className="text-slate-400">
            People with access to this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const canManageMember = canManageTeam && !isCurrentUser && member.role !== 'owner';
              const canChangeRole = isOwner && !isCurrentUser;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-lg font-medium text-slate-300">
                        {member.user?.full_name?.charAt(0) ?? member.user?.email?.charAt(0) ?? '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-100">
                        {member.user?.full_name ?? 'Unknown User'}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-slate-400">(you)</span>
                        )}
                      </p>
                      <p className="text-sm text-slate-400">
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
                                  : 'bg-slate-500/20 text-slate-300'
                                : 'text-slate-500 hover:text-slate-300'
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
                            : 'border-slate-500 text-slate-400'
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
                        className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
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
              <div className="text-center py-8 text-slate-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No team members yet</p>
                <p className="text-sm">Invite your first team member to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription className="text-slate-400">
            Understanding workspace roles and their capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(['owner', 'admin', 'member'] as const).map((role) => (
              <div
                key={role}
                className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
              >
                <div className="flex items-center gap-2 mb-2">
                  {roleIcons[role]}
                  <h3 className="font-medium text-slate-100">{roleLabels[role]}</h3>
                </div>
                <p className="text-sm text-slate-400">{roleDescriptions[role]}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
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
        </CardContent>
      </Card>
    </div>
  );
}
