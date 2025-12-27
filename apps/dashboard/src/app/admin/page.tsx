'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  DollarSign,
  Bot,
  TrendingUp,
  Plus,
  Loader2,
  Shield,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { CreateInternalModal } from '@/components/admin/create-internal-modal';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: statsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.getAdminStats,
  });

  const { data: growthData } = useQuery({
    queryKey: ['admin-growth', 30],
    queryFn: () => api.getAdminGrowth(30),
  });

  const { data: recentWorkspaces } = useQuery({
    queryKey: ['admin-workspaces-recent'],
    queryFn: () => api.getAdminWorkspaces({ sortBy: 'created_at', sortOrder: 'desc', limit: 5 }),
  });

  const stats = statsData?.stats;

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-display font-bold">Platform Overview</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Cluebase AI platform administration and monitoring
          </p>
        </div>
        <div className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load admin dashboard</h2>
              <p className="text-muted-foreground max-w-md">
                {error instanceof Error ? error.message : 'An error occurred while loading the admin dashboard. Please try again.'}
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-purple-500" />
            <h1 className="text-4xl font-display font-bold">Platform Overview</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Cluebase AI platform administration and monitoring
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Internal Workspace
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats?.totalWorkspaces ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">
              {stats?.activeWorkspaces ?? 0} active • {stats?.trialingWorkspaces ?? 0} trialing
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats?.totalUsers ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">
              {stats?.adminUsers ?? 0} platform admins
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Estimated MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              ${((stats?.estimatedMrr ?? 0) / 100).toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {stats?.payingWorkspaces ?? 0} paying workspaces
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Bots</CardTitle>
            <Bot className="h-4 w-4 text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats?.totalBots ?? 0}</div>
            <p className="text-xs text-slate-400 mt-1">
              {stats?.totalConversations ?? 0} conversations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Breakdown */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-slate-100">Starter</CardTitle>
            <CardDescription className="text-slate-400">Free tier workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats?.starterWorkspaces ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-slate-100">Pro</CardTitle>
            <CardDescription className="text-slate-400">Pro tier workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats?.proWorkspaces ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-slate-100">Business</CardTitle>
            <CardDescription className="text-slate-400">Business tier workspaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{stats?.businessWorkspaces ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Workspace Growth
          </CardTitle>
          <CardDescription className="text-slate-400">
            New workspaces over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Last 7 days</span>
              <span className="font-medium text-slate-100">+{stats?.newWorkspaces7d ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Last 30 days</span>
              <span className="font-medium text-slate-100">+{stats?.newWorkspaces30d ?? 0}</span>
            </div>
          </div>
          {growthData?.data && (
            <div className="mt-4 h-48 flex items-end justify-between gap-1">
              {growthData.data.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 transition-colors rounded-t relative group"
                  style={{
                    height: `${Math.max(5, (day.newWorkspaces / Math.max(...growthData.data.map(d => d.newWorkspaces), 1)) * 100)}%`,
                  }}
                  title={`${day.date}: ${day.newWorkspaces} new`}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 px-2 py-1 rounded text-xs whitespace-nowrap">
                    {new Date(day.date).toLocaleDateString()}: {day.newWorkspaces}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Workspaces */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-slate-100">Recent Workspaces</CardTitle>
            <CardDescription className="text-slate-400">
              Latest workspace registrations
            </CardDescription>
          </div>
          <Link href="/admin/workspaces">
            <Button variant="outline" className="border-white/10 text-white/80 hover:bg-white/5 hover:text-white">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentWorkspaces?.data.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/admin/workspaces/${workspace.id}`}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      workspace.isInternal
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-amber-500/20 text-violet-400'
                    )}
                  >
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">{workspace.name}</p>
                    <p className="text-xs text-slate-400">{workspace.ownerEmail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {new Date(workspace.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {workspace.isInternal && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                        Internal
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">
                      {workspace.tier}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Internal Workspace Modal */}
      <CreateInternalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
