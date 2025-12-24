'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
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
  ArrowUpRight,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { GlassCard, GradientText } from '@/components/design-system';

// Stat Card Component with Glassmorphism
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  index = 0,
  gradient = 'purple',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  index?: number;
  gradient?: 'purple' | 'blue' | 'pink' | 'cyan';
}) {
  const gradientColors = {
    purple: 'from-violet-600 to-pink-600',
    blue: 'from-blue-600 to-cyan-600',
    pink: 'from-pink-600 to-rose-600',
    cyan: 'from-cyan-600 to-teal-600',
  };

  const glowColors = {
    purple: 'shadow-glow-purple',
    blue: 'shadow-glow-blue',
    pink: 'shadow-glow-pink',
    cyan: 'shadow-glow-cyan',
  };

  return (
    <motion.div
      variants={fadeInUp}
      custom={index}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <GlassCard hover glow={gradient} padding="none" className="h-full">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientColors[gradient]} ${glowColors[gradient]}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            {trend && (
              <div
                className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
                  trend.positive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <TrendingUp
                  className={`w-3.5 h-3.5 ${!trend.positive && 'rotate-180'}`}
                />
                {trend.value}%
              </div>
            )}
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-sm font-medium text-white/60">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-sm text-white/40">{subtitle}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Service Status Badge
function ServiceStatus({
  name,
  online,
  index = 0,
}: {
  name: string;
  online: boolean;
  index?: number;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      custom={index}
      className="flex items-center gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
    >
      <div className="relative flex items-center justify-center">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        {online && (
          <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
        )}
      </div>
      <span className="font-medium text-white capitalize">
        {name.replace(/([A-Z])/g, ' $1').trim()}
      </span>
      <span
        className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${
          online
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}
      >
        {online ? 'Connected' : 'Offline'}
      </span>
    </motion.div>
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
    <motion.div variants={fadeInUp}>
      <GlassCard hover glow="blue" padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-glow-blue">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Google Drive Sync</h3>
            <p className="text-sm text-white/50">Document synchronization</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex justify-center mb-2">
              {connected ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </div>
            <p className="text-xs text-white/40 mb-1">Status</p>
            <p className="font-semibold text-white">
              {connected ? 'Connected' : 'Offline'}
            </p>
          </div>

          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex justify-center mb-2">
              <Activity className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-xs text-white/40 mb-1">Last Sync</p>
            <p className="font-semibold text-white text-sm">
              {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
            </p>
          </div>

          <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex justify-center mb-2">
              <FileText className="w-6 h-6 text-pink-400" />
            </div>
            <p className="text-xs text-white/40 mb-1">Documents</p>
            <p className="font-semibold text-white">{documentCount}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-5 w-64 bg-white/5 rounded-lg animate-pulse" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-44 bg-white/5 rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
      <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
      <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
    </div>
  );
}

// Error State Component
function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white">
          Dash<span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">board</span>
        </h1>
      </div>

      <GlassCard padding="lg" className="text-center">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">Failed to load dashboard</h2>
            <p className="text-white/60 max-w-md">
              {error?.message || 'An error occurred while loading dashboard data. Please try again.'}
            </p>
          </div>
          <button
            onClick={onRetry}
            className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

// Quick Action Button
function QuickActionButton({
  onClick,
  disabled,
  loading,
  icon: Icon,
  title,
  description,
  index = 0,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ElementType;
  title: string;
  description: string;
  index?: number;
}) {
  return (
    <motion.button
      variants={fadeInUp}
      custom={index}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="group p-6 text-left rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple group-hover:shadow-glow-purple transition-shadow">
          {loading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Icon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>
        <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-violet-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/50">{description}</p>
    </motion.button>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [syncMessage, setSyncMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Wait for workspace context to be ready before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErrorData,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['overview', workspace?.id],
    queryFn: api.getOverview,
    // Don't run until workspace is available
    enabled: !!workspace?.id,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus', workspace?.id],
    queryFn: api.getSyncStatus,
    // Don't run until workspace is available
    enabled: !!workspace?.id,
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

  if (overviewError) {
    return (
      <ErrorState
        error={overviewErrorData instanceof Error ? overviewErrorData : null}
        onRetry={() => refetchOverview()}
      />
    );
  }

  // Show loading while workspace is loading or data is being fetched
  if (isWorkspaceLoading || overviewLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <motion.div
      ref={ref}
      variants={staggerContainer}
      initial="initial"
      animate={isInView ? 'animate' : 'initial'}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">
            Dash<GradientText as="span" className="text-4xl font-bold">board</GradientText>
          </h1>
        </div>
        <p className="text-lg text-white/60">
          Monitor your AI knowledge assistant performance and activity
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={staggerContainer}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Total Documents"
          value={overview?.documents.total ?? 0}
          subtitle={`${overview?.documents.chunks ?? 0} chunks indexed`}
          icon={FileText}
          index={0}
          gradient="purple"
        />
        <StatCard
          title="Messages This Week"
          value={overview?.activity.messagesThisWeek ?? 0}
          subtitle={`${overview?.activity.responsesThisWeek ?? 0} responses sent`}
          icon={MessageSquare}
          trend={{ value: 12, positive: true }}
          index={1}
          gradient="blue"
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
          index={2}
          gradient="pink"
        />
        <StatCard
          title="Learned Facts"
          value={overview?.knowledge.learnedFacts ?? 0}
          subtitle="From user corrections"
          icon={Brain}
          index={3}
          gradient="cyan"
        />
      </motion.div>

      {/* Service Status */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold text-white">Service Status</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <motion.div
          variants={staggerContainer}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
        >
          {health?.services &&
            Object.entries(health.services).map(([service, status], index) => (
              <ServiceStatus
                key={service}
                name={service}
                online={status as boolean}
                index={index}
              />
            ))}
        </motion.div>
      </motion.div>

      {/* Google Drive Sync */}
      <SyncStatusCard
        connected={syncStatus?.driveConnected ?? false}
        lastSync={syncStatus?.lastSync ?? null}
        documentCount={syncStatus?.documentCount ?? 0}
      />

      {/* Sync Status Message */}
      {syncMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg backdrop-blur-xl border ${
            syncMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
              : 'bg-red-500/10 text-red-200 border-red-500/20'
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
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        <motion.div
          variants={staggerContainer}
          className="grid gap-4 md:grid-cols-3"
        >
          <QuickActionButton
            onClick={handleSyncDocuments}
            disabled={syncMutation.isPending}
            loading={syncMutation.isPending}
            icon={RefreshCw}
            title={syncMutation.isPending ? 'Syncing...' : 'Sync Documents'}
            description="Manually trigger a Google Drive sync"
            index={0}
          />
          <QuickActionButton
            onClick={handleTrainBot}
            icon={Brain}
            title="Train Bot"
            description="Add new knowledge to the assistant"
            index={1}
          />
          <QuickActionButton
            onClick={handleViewConversations}
            icon={MessageSquare}
            title="View Conversations"
            description="Browse recent bot interactions"
            index={2}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
