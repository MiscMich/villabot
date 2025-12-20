'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  FileText,
  Bot,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Shield,
  Calendar,
  Mail,
  Edit,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminWorkspaceDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    tier: '',
    status: '',
    isInternal: false,
    internalNotes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-workspace-details', params.id],
    queryFn: () => api.getAdminWorkspaceDetails(params.id),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: {
      name?: string;
      tier?: string;
      status?: string;
      isInternal?: boolean;
      internalNotes?: string;
    }) => api.updateAdminWorkspace(params.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workspace-details', params.id] });
      setShowEditModal(false);
    },
  });

  const workspace = data?.workspace;

  const handleEdit = () => {
    if (workspace) {
      setEditForm({
        name: workspace.name,
        tier: workspace.tier,
        status: workspace.status,
        isInternal: workspace.isInternal,
        internalNotes: workspace.internalNotes || '',
      });
      setShowEditModal(true);
    }
  };

  const handleUpdate = () => {
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-lg font-medium mb-2">Workspace not found</p>
        <Link href="/admin/workspaces">
          <Button variant="outline">Back to Workspaces</Button>
        </Link>
      </div>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'business':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'pro':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'trialing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <Link
            href="/admin/workspaces"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workspaces
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                workspace.isInternal
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-amber-500/20 text-amber-400'
              )}
            >
              {workspace.isInternal ? <Shield className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold">{workspace.name}</h1>
              <p className="text-lg text-muted-foreground font-mono">/{workspace.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Badge className={getTierBadgeColor(workspace.tier)}>
              {workspace.tier.charAt(0).toUpperCase() + workspace.tier.slice(1)}
            </Badge>
            <Badge className={getStatusBadgeColor(workspace.status)}>
              {workspace.status}
            </Badge>
            {workspace.isInternal && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Internal
              </Badge>
            )}
          </div>
        </div>
        <Button
          onClick={handleEdit}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Workspace
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Members</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{workspace.memberCount}</div>
            <p className="text-xs text-slate-400 mt-1">
              Max: {workspace.tier === 'business' ? 'Unlimited' : workspace.tier === 'pro' ? '10' : '3'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Documents</CardTitle>
            <FileText className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{workspace.documentCount}</div>
            <p className="text-xs text-slate-400 mt-1">Max: {workspace.maxDocuments}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Bots</CardTitle>
            <Bot className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{workspace.botCount}</div>
            <p className="text-xs text-slate-400 mt-1">Active instances</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{workspace.conversationCount}</div>
            <p className="text-xs text-slate-400 mt-1">Total threads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Workspace Info */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Workspace Information</CardTitle>
            <CardDescription className="text-slate-400">Core workspace details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm text-slate-400">Owner</p>
                <p className="text-sm font-medium text-slate-100">{workspace.ownerEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm text-slate-400">Created</p>
                <p className="text-sm font-medium text-slate-100">
                  {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {workspace.trialEndsAt && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-400">Trial Ends</p>
                  <p className="text-sm font-medium text-slate-100">
                    {new Date(workspace.trialEndsAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            {workspace.internalNotes && (
              <div className="pt-3 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Internal Notes</p>
                <p className="text-sm text-slate-100">{workspace.internalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Usage Statistics</CardTitle>
            <CardDescription className="text-slate-400">Current period usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-slate-400">Queries This Month</p>
                <p className="text-sm font-medium text-slate-100">
                  {workspace.queriesThisMonth} / {workspace.maxQueriesPerMonth === -1 ? '∞' : workspace.maxQueriesPerMonth}
                </p>
              </div>
              {workspace.maxQueriesPerMonth !== -1 && (
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                    style={{
                      width: `${Math.min(100, (workspace.queriesThisMonth / workspace.maxQueriesPerMonth) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-slate-400">Documents</p>
                <p className="text-sm font-medium text-slate-100">
                  {data.usage.documents} / {workspace.maxDocuments === -1 ? '∞' : workspace.maxDocuments}
                </p>
              </div>
              {workspace.maxDocuments !== -1 && (
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-600"
                    style={{
                      width: `${Math.min(100, (data.usage.documents / workspace.maxDocuments) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Team Members</CardTitle>
          <CardDescription className="text-slate-400">
            {data.members.length} member{data.members.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{member.fullName || 'Unknown'}</p>
                  <p className="text-xs text-slate-400">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {member.role}
                  </Badge>
                  <p className="text-xs text-slate-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bots */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Bots</CardTitle>
          <CardDescription className="text-slate-400">
            {data.bots.length} bot instance{data.bots.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.bots.map((bot) => (
              <div
                key={bot.id}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{bot.name}</p>
                    <p className="text-xs text-slate-400 font-mono">/{bot.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      bot.status === 'active'
                        ? 'border-green-500 text-green-400'
                        : 'border-slate-600 text-slate-400'
                    )}
                  >
                    {bot.status}
                  </Badge>
                  <p className="text-xs text-slate-400">
                    {new Date(bot.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {data.bots.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No bots configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Edit Workspace</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update workspace settings and configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Workspace Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-slate-900/50 border-slate-600 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier" className="text-slate-300">Tier</Label>
              <select
                id="tier"
                value={editForm.tier}
                onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100"
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-slate-300">Status</Label>
              <select
                id="status"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100"
              >
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isInternal"
                checked={editForm.isInternal}
                onChange={(e) => setEditForm({ ...editForm, isInternal: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
              />
              <Label htmlFor="isInternal" className="text-slate-300">Internal Workspace (No billing)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-300">Internal Notes</Label>
              <textarea
                id="notes"
                value={editForm.internalNotes}
                onChange={(e) => setEditForm({ ...editForm, internalNotes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-600 text-slate-100 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
