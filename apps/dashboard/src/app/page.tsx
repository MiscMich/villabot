'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Brain,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function OverviewPage() {
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

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your VillaBot AI assistant
        </p>
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {health?.services &&
              Object.entries(health.services).map(([service, status]) => (
                <div
                  key={service}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  {status ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="capitalize font-medium">
                    {service.replace('_', ' ')}
                  </span>
                  <Badge variant={status ? 'success' : 'destructive'}>
                    {status ? 'Connected' : 'Offline'}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Documents
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.documents.total ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.documents.chunks ?? 0} chunks indexed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Messages This Week
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.activity.messagesThisWeek ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.activity.responsesThisWeek ?? 0} responses sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Satisfaction Rate
            </CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.feedback.satisfactionRate !== null
                ? `${overview?.feedback.satisfactionRate}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">
                {overview?.feedback.positive ?? 0}
              </span>{' '}
              positive,{' '}
              <span className="text-red-500">
                {overview?.feedback.negative ?? 0}
              </span>{' '}
              negative
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Learned Facts</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.knowledge.learnedFacts ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              From user corrections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Google Drive Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                {syncStatus?.driveConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium">Not Connected</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="font-medium mt-1">
                {syncStatus?.lastSync
                  ? new Date(syncStatus.lastSync).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Documents Synced</p>
              <p className="font-medium mt-1">
                {syncStatus?.documentCount ?? 0} documents
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
