'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  FileText,
  MessageSquare,
  ThumbsUp,
  Brain,
  RefreshCw,
  CheckCircle,
  XCircle,
  Cloud,
  Sparkles,
  TrendingUp,
  Activity,
  Loader2,
} from 'lucide-react';

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  delay = 0,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  delay?: number;
}) {
  return (
    <div
      className="premium-card group opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="icon-container group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              <TrendingUp
                className={`w-4 h-4 ${!trend.positive && 'rotate-180'}`}
              />
              {trend.value}%
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="stat-value">{value}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Decorative gradient line at bottom */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

// Service Status Badge
function ServiceStatus({
  name,
  online,
  delay = 0,
}: {
  name: string;
  online: boolean;
  delay?: number;
}) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`status-pulse ${online ? 'online' : 'offline'}`}>
        <span />
      </div>
      <span className="font-medium capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
      <span
        className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
          online
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}
      >
        {online ? 'Connected' : 'Offline'}
      </span>
    </div>
  );
}

// Sync Status Card
function SyncStatusCard({
  connected,
  lastSync,
  documentCount,
}: {
  connected: boolean;
  lastSync: string | null;
  documentCount: number;
}) {
  return (
    <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
          <Cloud className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Google Drive Sync</h3>
          <p className="text-sm text-muted-foreground">Document synchronization</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 rounded-xl bg-secondary/50">
          <div className="flex justify-center mb-2">
            {connected ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-semibold">{connected ? 'Connected' : 'Offline'}</p>
        </div>

        <div className="text-center p-4 rounded-xl bg-secondary/50">
          <div className="flex justify-center mb-2">
            <Activity className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-xs text-muted-foreground">Last Sync</p>
          <p className="font-semibold text-sm">
            {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
          </p>
        </div>

        <div className="text-center p-4 rounded-xl bg-secondary/50">
          <div className="flex justify-center mb-2">
            <FileText className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-xs text-muted-foreground">Documents</p>
          <p className="font-semibold">{documentCount}</p>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
        <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-44 bg-muted rounded-xl shimmer" />
        ))}
      </div>
      <div className="h-32 bg-muted rounded-xl shimmer" />
      <div className="h-48 bg-muted rounded-xl shimmer" />
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: api.getOverview,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: api.getSyncStatus,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: (data) => {
      setSyncMessage({
        type: 'success',
        text: `Sync complete! Added: ${data.added}, Updated: ${data.updated}, Removed: ${data.removed}`,
      });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      setTimeout(() => setSyncMessage(null), 5000);
    },
    onError: (error) => {
      setSyncMessage({
        type: 'error',
        text: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      setTimeout(() => setSyncMessage(null), 5000);
    },
  });

  const handleSyncDocuments = () => {
    if (!syncMutation.isPending) {
      syncMutation.mutate();
    }
  };

  const handleTrainBot = () => {
    router.push('/knowledge');
  };

  const handleViewConversations = () => {
    router.push('/conversations');
  };

  if (overviewLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Decorative noise overlay */}
      <div className="noise-overlay" />

      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Dashboard</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Monitor your VillaBot AI assistant performance and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={overview?.documents.total ?? 0}
          subtitle={`${overview?.documents.chunks ?? 0} chunks indexed`}
          icon={FileText}
          delay={100}
        />
        <StatCard
          title="Messages This Week"
          value={overview?.activity.messagesThisWeek ?? 0}
          subtitle={`${overview?.activity.responsesThisWeek ?? 0} responses sent`}
          icon={MessageSquare}
          trend={{ value: 12, positive: true }}
          delay={200}
        />
        <StatCard
          title="Satisfaction Rate"
          value={
            overview?.feedback.satisfactionRate !== null
              ? `${overview?.feedback.satisfactionRate}%`
              : 'N/A'
          }
          subtitle={`${overview?.feedback.positive ?? 0} positive, ${overview?.feedback.negative ?? 0} negative`}
          icon={ThumbsUp}
          delay={300}
        />
        <StatCard
          title="Learned Facts"
          value={overview?.knowledge.learnedFacts ?? 0}
          subtitle="From user corrections"
          icon={Brain}
          delay={400}
        />
      </div>

      {/* Service Status */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="section-header">
          <h2 className="font-display">Service Status</h2>
          <div className="divider" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {health?.services &&
            Object.entries(health.services).map(([service, status], index) => (
              <ServiceStatus
                key={service}
                name={service}
                online={status as boolean}
                delay={350 + index * 50}
              />
            ))}
        </div>
      </div>

      {/* Google Drive Sync */}
      <SyncStatusCard
        connected={syncStatus?.driveConnected ?? false}
        lastSync={syncStatus?.lastSync ?? null}
        documentCount={syncStatus?.documentCount ?? 0}
      />

      {/* Sync Status Message */}
      {syncMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg animate-fade-in ${
            syncMessage.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{syncMessage.text}</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
        <div className="section-header">
          <h2 className="font-display">Quick Actions</h2>
          <div className="divider" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={handleSyncDocuments}
            disabled={syncMutation.isPending}
            className="premium-card p-6 text-left group hover:border-amber-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-8 h-8 text-amber-500 mb-3 animate-spin" />
            ) : (
              <RefreshCw className="w-8 h-8 text-amber-500 mb-3 group-hover:rotate-180 transition-transform duration-500" />
            )}
            <h3 className="font-display font-semibold mb-1">
              {syncMutation.isPending ? 'Syncing...' : 'Sync Documents'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Manually trigger a Google Drive sync
            </p>
          </button>
          <button
            onClick={handleTrainBot}
            className="premium-card p-6 text-left group hover:border-amber-500/50 transition-colors"
          >
            <Brain className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-display font-semibold mb-1">Train Bot</h3>
            <p className="text-sm text-muted-foreground">
              Add new knowledge to the assistant
            </p>
          </button>
          <button
            onClick={handleViewConversations}
            className="premium-card p-6 text-left group hover:border-amber-500/50 transition-colors"
          >
            <MessageSquare className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-display font-semibold mb-1">View Conversations</h3>
            <p className="text-sm text-muted-foreground">
              Browse recent bot interactions
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
