'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  MessageSquare,
  Activity,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Clock,
  Users,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
  // Wait for workspace context before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const {
    data: overview,
    isLoading: isOverviewLoading,
    isError: overviewError,
    error: overviewErrorData,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['overview', workspace?.id],
    queryFn: api.getOverview,
    enabled: !!workspace?.id,
  });

  const { data: activity } = useQuery({
    queryKey: ['activity', workspace?.id],
    queryFn: () => api.getActivity(14),
    enabled: !!workspace?.id,
  });

  const { data: events } = useQuery({
    queryKey: ['events', workspace?.id],
    queryFn: () => api.getEvents(50),
    enabled: !!workspace?.id,
  });

  // Combined loading state
  const overviewLoading = isWorkspaceLoading || isOverviewLoading;

  if (overviewError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Analytics</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Monitor bot performance and user engagement
          </p>
        </div>
        <div className="premium-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load analytics</h2>
              <p className="text-muted-foreground max-w-md">
                {overviewErrorData instanceof Error ? overviewErrorData.message : 'An error occurred while loading analytics. Please try again.'}
              </p>
            </div>
            <Button
              onClick={() => refetchOverview()}
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

  if (overviewLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl shimmer" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-xl shimmer" />
      </div>
    );
  }

  const satisfactionRate = overview?.feedback.satisfactionRate ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Analytics</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Monitor bot performance and user engagement
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-start justify-between">
            <div className="icon-container">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Messages Received</p>
            <p className="stat-value">{overview?.activity.messagesThisWeek ?? 0}</p>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-start justify-between">
            <div className="icon-container">
              <Zap className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Active
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Responses Sent</p>
            <p className="stat-value">{overview?.activity.responsesThisWeek ?? 0}</p>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-start justify-between">
            <div className="icon-container">
              <ThumbsUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Positive Feedback</p>
            <p className="text-4xl font-bold tracking-tight text-green-600 dark:text-green-400">
              {overview?.feedback.positive ?? 0}
            </p>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-start justify-between">
            <div className="icon-container">
              <ThumbsDown className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Negative Feedback</p>
            <p className="text-4xl font-bold tracking-tight text-red-600 dark:text-red-400">
              {overview?.feedback.negative ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Chart & Satisfaction */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Chart */}
        <div className="lg:col-span-2 premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-xl font-semibold">Activity Over Time</h2>
            </div>
          </div>
          <div className="p-6">
            {activity?.data && activity.data.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{activity.period.start.split('T')[0]}</span>
                  <span>{activity.period.end.split('T')[0]}</span>
                </div>
                {/* Simple bar chart visualization */}
                <div className="flex items-end gap-1 h-48">
                  {activity.data.map((day, i) => {
                    const maxValue = Math.max(...activity.data.map(d => d.messages + d.responses));
                    const height = maxValue > 0 ? ((day.messages + day.responses) / maxValue) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-sm transition-all duration-300 hover:from-amber-600 hover:to-amber-500"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: ${day.messages} messages, ${day.responses} responses`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-6 pt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gradient-to-r from-amber-500 to-amber-400" />
                    <span className="text-muted-foreground">Daily Activity</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No activity data yet. Start using the bot to see analytics.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Satisfaction Meter */}
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-xl font-semibold">Satisfaction</h2>
            </div>
          </div>
          <div className="p-6 flex flex-col items-center justify-center">
            {/* Circular Progress */}
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${satisfactionRate * 2.51} 251`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-gradient">
                  {satisfactionRate !== null ? `${satisfactionRate}%` : 'N/A'}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Based on {(overview?.feedback.positive ?? 0) + (overview?.feedback.negative ?? 0)} feedback responses
            </p>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <h2 className="font-display text-xl font-semibold">Recent Events</h2>
          </div>
        </div>
        <div className="p-6">
          <Tabs defaultValue="all">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <EventList events={events?.events ?? []} />
            </TabsContent>
            <TabsContent value="messages" className="mt-4">
              <EventList
                events={events?.events.filter((e) => e.event_type === 'message_received') ?? []}
              />
            </TabsContent>
            <TabsContent value="responses" className="mt-4">
              <EventList
                events={events?.events.filter((e) => e.event_type === 'response_sent') ?? []}
              />
            </TabsContent>
            <TabsContent value="feedback" className="mt-4">
              <EventList
                events={events?.events.filter((e) => e.event_type === 'feedback') ?? []}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function EventList({
  events,
}: {
  events: Array<{
    id: string;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string;
  }>;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Activity className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No events yet</p>
      </div>
    );
  }

  const getEventConfig = (type: string) => {
    switch (type) {
      case 'message_received':
        return {
          icon: MessageSquare,
          color: 'text-blue-500',
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          label: 'Message Received',
        };
      case 'response_sent':
        return {
          icon: Activity,
          color: 'text-green-500',
          bg: 'bg-green-100 dark:bg-green-900/30',
          label: 'Response Sent',
        };
      case 'feedback':
        return {
          icon: ThumbsUp,
          color: 'text-purple-500',
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          label: 'Feedback',
        };
      default:
        return {
          icon: Activity,
          color: 'text-gray-500',
          bg: 'bg-gray-100 dark:bg-gray-900/30',
          label: type.replace('_', ' '),
        };
    }
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {events.map((event, index) => {
        const config = getEventConfig(event.event_type);
        const Icon = config.icon;
        return (
          <div
            key={event.id}
            className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors opacity-0 animate-fade-in"
            style={{ animationDelay: `${450 + index * 30}ms` }}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                  {config.label}
                </span>
                <p className="text-sm text-muted-foreground mt-1">
                  {Object.entries(event.event_data)
                    .slice(0, 2)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' • ')}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(event.created_at).toLocaleTimeString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
