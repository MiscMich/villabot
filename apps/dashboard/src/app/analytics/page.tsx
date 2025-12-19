'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, MessageSquare, Activity } from 'lucide-react';

export default function AnalyticsPage() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: api.getOverview,
  });

  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.getActivity(14),
  });

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.getEvents(50),
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'message_received':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'response_sent':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'feedback':
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'success'> = {
      message_received: 'default',
      response_sent: 'success',
      feedback: 'secondary',
    };
    return variants[type] || 'secondary';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Monitor bot performance and usage
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Messages This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.activity.messagesThisWeek ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Responses Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.activity.responsesThisWeek ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Positive Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {overview?.feedback.positive ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Negative Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {overview?.feedback.negative ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {activity?.data && activity.data.length > 0 ? (
            <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/50">
              <div className="text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-2" />
                <p>
                  {activity.data.length} days of activity data available
                </p>
                <p className="text-sm">
                  {activity.period.start.split('T')[0]} to{' '}
                  {activity.period.end.split('T')[0]}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/50">
              <p className="text-muted-foreground">
                No activity data yet. Start using the bot to see analytics.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
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
                events={
                  events?.events.filter(
                    (e) => e.event_type === 'message_received'
                  ) ?? []
                }
              />
            </TabsContent>
            <TabsContent value="responses" className="mt-4">
              <EventList
                events={
                  events?.events.filter(
                    (e) => e.event_type === 'response_sent'
                  ) ?? []
                }
              />
            </TabsContent>
            <TabsContent value="feedback" className="mt-4">
              <EventList
                events={
                  events?.events.filter((e) => e.event_type === 'feedback') ??
                  []
                }
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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
      <p className="text-center text-muted-foreground py-8">No events yet</p>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between p-3 rounded-lg border"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              {event.event_type === 'message_received' ? (
                <MessageSquare className="h-4 w-4 text-blue-500" />
              ) : event.event_type === 'response_sent' ? (
                <Activity className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingUp className="h-4 w-4 text-purple-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    event.event_type === 'response_sent'
                      ? 'success'
                      : 'secondary'
                  }
                >
                  {event.event_type.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {Object.entries(event.event_data)
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' | ')}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(event.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
