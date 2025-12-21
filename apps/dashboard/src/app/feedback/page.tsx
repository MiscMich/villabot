'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface FeedbackItem {
  id: string;
  is_helpful: boolean;
  feedback_category: string | null;
  feedback_text: string | null;
  query_text: string | null;
  response_text: string | null;
  sources_used: string[];
  slack_user_id: string;
  slack_channel_id: string;
  is_reviewed: boolean;
  created_at: string;
}

interface FeedbackAnalytics {
  overall: {
    total_feedback: number;
    helpful_count: number;
    unhelpful_count: number;
    satisfaction_rate: number;
  };
  byBot: Record<string, { botName: string; stats: { satisfaction_rate: number } }>;
  recentUnhelpful: Array<{
    id: string;
    is_helpful: boolean;
    feedback_text: string | null;
    query_text: string | null;
    created_at: string;
  }>;
}

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'helpful' | 'unhelpful' | 'unreviewed'>('all');
  const limit = 10;

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<FeedbackAnalytics>({
    queryKey: ['feedback-analytics'],
    queryFn: () => api.getFeedbackAnalytics(),
  });

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['feedback', page, filter],
    queryFn: () => api.getFeedback({ limit, offset: (page - 1) * limit }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, isReviewed }: { id: string; isReviewed: boolean }) =>
      api.markFeedbackReviewed(id, isReviewed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-analytics'] });
    },
  });

  const filteredFeedback = feedbackData?.feedback?.filter((item: FeedbackItem) => {
    if (filter === 'helpful') return item.is_helpful;
    if (filter === 'unhelpful') return !item.is_helpful;
    if (filter === 'unreviewed') return !item.is_reviewed;
    return true;
  });

  const satisfactionRate = analyticsData?.overall?.satisfaction_rate ?? 0;
  const totalFeedback = analyticsData?.overall?.total_feedback ?? 0;
  const helpfulCount = analyticsData?.overall?.helpful_count ?? 0;
  const unhelpfulCount = analyticsData?.overall?.unhelpful_count ?? 0;

  if (analyticsLoading || feedbackLoading) {
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <ThumbsUp className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Feedback</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Track user satisfaction and improve response quality
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Satisfaction Rate</p>
              <p className={cn(
                'text-3xl font-display font-bold',
                satisfactionRate >= 80 ? 'text-green-600 dark:text-green-400' :
                satisfactionRate >= 60 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              )}>
                {satisfactionRate.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Feedback</p>
              <p className="text-3xl font-display font-bold">{totalFeedback}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-600/20">
              <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Helpful</p>
              <p className="text-3xl font-display font-bold text-green-600 dark:text-green-400">
                {helpfulCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-400/20 to-green-600/20">
              <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Not Helpful</p>
              <p className="text-3xl font-display font-bold text-red-600 dark:text-red-400">
                {unhelpfulCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-400/20 to-red-600/20">
              <ThumbsDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-semibold">All Feedback</h2>
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {feedbackData?.total ?? 0} total
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter Buttons */}
              <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
                {(['all', 'helpful', 'unhelpful', 'unreviewed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setPage(1); }}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                      filter === f
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f === 'all' ? 'All' :
                     f === 'helpful' ? 'Helpful' :
                     f === 'unhelpful' ? 'Not Helpful' :
                     'Unreviewed'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Items */}
        <div className="divide-y divide-border/50">
          {filteredFeedback?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <ThumbsUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No feedback found</p>
              <p className="text-sm text-muted-foreground">
                Feedback will appear here when users rate bot responses
              </p>
            </div>
          ) : (
            filteredFeedback?.map((item: FeedbackItem, index: number) => (
              <div
                key={item.id}
                className="p-5 hover:bg-secondary/30 transition-colors group opacity-0 animate-fade-in"
                style={{ animationDelay: `${350 + index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    item.is_helpful
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    {item.is_helpful ? (
                      <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <ThumbsDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        item.is_helpful
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {item.is_helpful ? 'Helpful' : 'Not Helpful'}
                      </span>
                      {item.feedback_category && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                          {item.feedback_category}
                        </span>
                      )}
                      {item.is_reviewed ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" />
                          Reviewed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          Pending Review
                        </span>
                      )}
                    </div>

                    {item.query_text && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Query:</p>
                        <p className="text-sm text-foreground line-clamp-2">{item.query_text}</p>
                      </div>
                    )}

                    {item.feedback_text && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Comment:</p>
                        <p className="text-sm text-foreground italic">&quot;{item.feedback_text}&quot;</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.is_reviewed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reviewMutation.mutate({ id: item.id, isReviewed: true })}
                        disabled={reviewMutation.isPending}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Mark Reviewed
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
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
                Page {page} of {Math.ceil((feedbackData?.total ?? 0) / limit)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= (feedbackData?.total ?? 0)}
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
