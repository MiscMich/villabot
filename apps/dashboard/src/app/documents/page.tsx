'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  FileText,
  ExternalLink,
  Trash2,
  Cloud,
  Globe,
} from 'lucide-react';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: api.getSyncStatus,
  });

  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.toggleDocument(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncMutation.mutateAsync();
    } finally {
      setSyncing(false);
    }
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes('google')) return <Cloud className="h-4 w-4" />;
    if (type === 'website') return <Globe className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getFileTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'DOCX',
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'text/html': 'HTML',
    };
    return labels[type] || type.split('/').pop()?.toUpperCase() || 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Manage your knowledge base documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing || !syncStatus?.driveConnected}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`}
            />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Google Drive Sync</p>
              <p className="text-sm text-muted-foreground">
                {syncStatus?.driveConnected
                  ? `Last synced: ${
                      syncStatus.lastSync
                        ? new Date(syncStatus.lastSync).toLocaleString()
                        : 'Never'
                    }`
                  : 'Not connected - go to Settings to connect'}
              </p>
            </div>
            <Badge variant={syncStatus?.driveConnected ? 'success' : 'outline'}>
              {syncStatus?.driveConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Documents ({documents?.total ?? 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {documents?.documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No documents synced yet. Connect Google Drive and sync to get
                started.
              </p>
            ) : (
              documents?.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {getFileTypeIcon(doc.file_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.title}</p>
                        <Badge variant="secondary">
                          {getFileTypeBadge(doc.file_type)}
                        </Badge>
                        {!doc.is_active && (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Last modified:{' '}
                        {new Date(doc.last_modified).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Active
                      </span>
                      <Switch
                        checked={doc.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: doc.id, active: checked })
                        }
                      />
                    </div>
                    {doc.source_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={doc.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Delete this document?')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
