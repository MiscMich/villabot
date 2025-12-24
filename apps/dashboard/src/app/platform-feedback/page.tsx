'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  Bug,
  Sparkles,
  HelpCircle,
  MoreHorizontal,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string | null;
  tags: string[];
  status: string;
  priority: string;
  admin_response: string | null;
  upvotes: number;
  has_voted: boolean;
  created_at: string;
  updated_at: string;
  user?: { email: string; full_name: string | null };
}

interface FeedbackStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  recentCount: number;
  averageResponseTime: number | null;
}

const feedbackTypes = [
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-amber-500' },
  { value: 'bug_report', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { value: 'improvement', label: 'Improvement', icon: Sparkles, color: 'text-blue-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-purple-500' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'text-gray-500' },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
  planned: { label: 'Planned', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: TrendingUp },
  in_progress: { label: 'In Progress', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  duplicate: { label: 'Duplicate', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: MoreHorizontal },
};

const categories = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'bots', label: 'Bots' },
  { value: 'documents', label: 'Documents' },
  { value: 'search', label: 'Search' },
  { value: 'billing', label: 'Billing' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

export default function PlatformFeedbackPage() {
  const queryClient = useQueryClient();
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  // Filters
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 10;

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    type: 'feature_request',
    title: '',
    description: '',
    category: '',
  });

  // Queries
  const {
    data: statsData,
    isLoading: isStatsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<FeedbackStats>({
    queryKey: ['platform-feedback-stats', workspace?.id],
    queryFn: () => api.getPlatformFeedbackStats(),
    enabled: !!workspace?.id,
  });

  const {
    data: feedbackData,
    isLoading: isFeedbackLoading,
    isError: feedbackError,
    refetch: refetchFeedback,
  } = useQuery({
    queryKey: ['platform-feedback', page, typeFilter, statusFilter, searchQuery, sortBy, sortOrder, workspace?.id],
    queryFn: () => api.getPlatformFeedback({
      page,
      limit,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      search: searchQuery || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    enabled: !!workspace?.id,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof newFeedback) => api.createPlatformFeedback({
      ...data,
      browser_info: typeof window !== 'undefined' ? {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      } : undefined,
      page_url: typeof window !== 'undefined' ? window.location.href : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['platform-feedback-stats'] });
      setShowCreateForm(false);
      setNewFeedback({ type: 'feature_request', title: '', description: '', category: '' });
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, hasVoted }: { id: string; hasVoted: boolean }) =>
      hasVoted ? api.unvotePlatformFeedback(id) : api.votePlatformFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-feedback'] });
    },
  });

  // Loading states
  const isLoading = isWorkspaceLoading || isStatsLoading || isFeedbackLoading;

  if (statsError || feedbackError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Ideas & Bugs</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Share feature requests, report bugs, and suggest improvements
          </p>
        </div>
        <div className="premium-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load feedback</h2>
              <p className="text-muted-foreground max-w-md">
                An error occurred while loading feedback. Please try again.
              </p>
            </div>
            <Button
              onClick={() => {
                refetchStats();
                refetchFeedback();
              }}
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
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="h-24 bg-muted rounded-xl shimmer" />
          <div className="h-24 bg-muted rounded-xl shimmer" />
          <div className="h-24 bg-muted rounded-xl shimmer" />
          <div className="h-24 bg-muted rounded-xl shimmer" />
        </div>
        <div className="h-96 bg-muted rounded-xl shimmer" />
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    const config = feedbackTypes.find(t => t.value === type);
    if (!config) return { Icon: MoreHorizontal, color: 'text-gray-500' };
    return { Icon: config.icon, color: config.color };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Ideas & Bugs</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Share feature requests, report bugs, and suggest improvements
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Feedback
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Feedback</p>
              <p className="text-3xl font-display font-bold">{statsData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-400/20 to-violet-600/20">
              <MessageSquare className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Feature Requests</p>
              <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
                {statsData?.byType?.feature_request ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bug Reports</p>
              <p className="text-3xl font-display font-bold text-red-600 dark:text-red-400">
                {statsData?.byType?.bug_report ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-400/20 to-red-600/20">
              <Bug className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-3xl font-display font-bold text-green-600 dark:text-green-400">
                {statsData?.recentCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-400/20 to-green-600/20">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border/50">
              <h2 className="text-xl font-display font-semibold">Submit Feedback</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Share your ideas, report bugs, or suggest improvements
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Type Selection */}
              <div>
                <label className="text-sm font-medium mb-3 block">Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {feedbackTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setNewFeedback(prev => ({ ...prev, type: type.value }))}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 rounded-lg border transition-all',
                        newFeedback.type === type.value
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-border hover:border-violet-500/50'
                      )}
                    >
                      <type.icon className={cn('w-4 h-4', type.color)} />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <input
                  type="text"
                  value={newFeedback.title}
                  onChange={(e) => setNewFeedback(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary of your feedback"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <textarea
                  value={newFeedback.description}
                  onChange={(e) => setNewFeedback(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide more details about your feedback..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium mb-2 block">Category (optional)</label>
                <select
                  value={newFeedback.category}
                  onChange={(e) => setNewFeedback(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-border/50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(newFeedback)}
                disabled={!newFeedback.title || !newFeedback.description || createMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-pink-600"
              >
                {createMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and List */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        {/* Filters Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Types</option>
              {feedbackTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">All Status</option>
              {Object.entries(statusConfig).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split(':');
                setSortBy(by);
                setSortOrder(order as 'asc' | 'desc');
                setPage(1);
              }}
              className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="created_at:desc">Newest First</option>
              <option value="created_at:asc">Oldest First</option>
              <option value="upvotes:desc">Most Voted</option>
              <option value="priority:desc">Highest Priority</option>
            </select>
          </div>
        </div>

        {/* Feedback List */}
        <div className="divide-y divide-border/50">
          {feedbackData?.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No feedback yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Be the first to share your ideas or report issues
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-violet-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Submit Feedback
              </Button>
            </div>
          ) : (
            feedbackData?.data?.map((item: FeedbackItem, index: number) => {
              const { Icon, color } = getTypeIcon(item.type);
              const status = statusConfig[item.status] || statusConfig.new;
              const StatusIcon = status.icon;

              return (
                <div
                  key={item.id}
                  className="p-5 hover:bg-secondary/30 transition-colors opacity-0 animate-fade-in"
                  style={{ animationDelay: `${350 + index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Vote Button */}
                    <button
                      onClick={() => voteMutation.mutate({ id: item.id, hasVoted: item.has_voted })}
                      disabled={voteMutation.isPending}
                      className={cn(
                        'flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all',
                        item.has_voted
                          ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                          : 'border-border hover:border-violet-500/50 text-muted-foreground hover:text-violet-600'
                      )}
                    >
                      <ThumbsUp className={cn('w-4 h-4', item.has_voted && 'fill-current')} />
                      <span className="text-sm font-medium">{item.upvotes}</span>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {/* Type Icon */}
                        <div className={cn('p-1.5 rounded-md bg-muted')}>
                          <Icon className={cn('w-4 h-4', color)} />
                        </div>

                        {/* Title */}
                        <h3 className="font-medium truncate">{item.title}</h3>

                        {/* Status Badge */}
                        <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>

                        {/* Category */}
                        {item.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                            {categories.find(c => c.value === item.category)?.label || item.category}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {item.description}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {item.user?.full_name || item.user?.email?.split('@')[0] || 'Anonymous'}
                        </span>
                        <span>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Admin Response */}
                      {item.admin_response && (
                        <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                            Admin Response
                          </p>
                          <p className="text-sm text-green-800 dark:text-green-300">
                            {item.admin_response}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {(feedbackData?.total ?? 0) > limit && (
          <div className="flex items-center justify-between p-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, feedbackData?.total ?? 0)} of {feedbackData?.total ?? 0}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3">
                Page {page} of {feedbackData?.totalPages ?? 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (feedbackData?.totalPages ?? 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
