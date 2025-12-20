'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  RefreshCw,
  FileText,
  ExternalLink,
  Trash2,
  Cloud,
  Globe,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  File,
  Sparkles,
} from 'lucide-react';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: api.getSyncStatus,
  });

  const { data: scrapeStatus } = useQuery({
    queryKey: ['scrapeStatus'],
    queryFn: api.getScrapeStatus,
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

  const scrapeMutation = useMutation({
    mutationFn: api.triggerWebsiteScrape,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['scrapeStatus'] });
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

  const handleScrape = async () => {
    setScraping(true);
    try {
      await scrapeMutation.mutateAsync();
    } finally {
      setScraping(false);
    }
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes('google-apps.document')) return <FileText className="h-5 w-5" />;
    if (type.includes('google-apps.spreadsheet')) return <FileSpreadsheet className="h-5 w-5" />;
    if (type.includes('pdf')) return <File className="h-5 w-5" />;
    if (type === 'text/html') return <Globe className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const getFileTypeBadge = (type: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      'application/pdf': { label: 'PDF', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'DOCX', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      'application/vnd.google-apps.document': { label: 'Google Doc', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
      'application/vnd.google-apps.spreadsheet': { label: 'Google Sheet', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      'text/html': { label: 'Website', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    };
    return labels[type] || { label: type.split('/').pop()?.toUpperCase() || 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
  };

  const filteredDocuments = documents?.documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Documents</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage your knowledge base documents and sync settings
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || !syncStatus?.driveConnected}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Sync Status Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Google Drive Sync */}
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Cloud className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-lg">Google Drive</p>
                <p className="text-sm text-muted-foreground">
                  {syncStatus?.driveConnected
                    ? `Last synced: ${syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}`
                    : 'Not connected - configure in Settings'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {syncStatus?.driveConnected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${syncStatus?.driveConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                {syncStatus?.driveConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Website Scraping */}
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-display font-semibold text-lg">Website Scraping</p>
                {scrapeStatus?.websiteUrl && (
                  <a
                    href={scrapeStatus.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    {scrapeStatus.websiteUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {!scrapeStatus?.websiteConfigured && (
                  <p className="text-sm text-muted-foreground">
                    No website URL configured - add in Settings
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${scrapeStatus?.websiteConfigured ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}`}>
                {scrapeStatus?.websiteConfigured ? 'Configured' : 'Not Set'}
              </span>
              {scrapeStatus?.websiteConfigured && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScrape}
                  disabled={scraping}
                  className="hover:border-amber-500/50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${scraping ? 'animate-spin' : ''}`} />
                  {scraping ? 'Scraping...' : 'Scrape Now'}
                </Button>
              )}
            </div>
          </div>

          {/* Scraping Progress Indicator */}
          {scraping && (
            <div className="mt-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  Scraping website...
                </span>
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                This may take a few minutes depending on the website size.
              </p>
              <div className="mt-3 h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          )}

          {/* Stats Grid */}
          {scrapeStatus?.websiteConfigured && !scraping && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-3 rounded-xl bg-secondary/50">
                <p className="text-2xl font-display font-bold text-purple-600 dark:text-purple-400">
                  {scrapeStatus.documentCount}
                </p>
                <p className="text-xs text-muted-foreground">Pages Indexed</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/50">
                <p className="text-2xl font-display font-bold">
                  {scrapeStatus.lastScrapeResult?.pagesScraped ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground">Last Scraped</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/50">
                <p className="text-2xl font-display font-bold">
                  {scrapeStatus.lastScrapeResult?.chunksCreated ?? '-'}
                </p>
                <p className="text-xs text-muted-foreground">Chunks Created</p>
              </div>
            </div>
          )}

          {/* Last Scrape Info */}
          {scrapeStatus?.lastScrape && !scraping && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Last scraped: {new Date(scrapeStatus.lastScrape).toLocaleString()}
                </p>
                {scrapeStatus.lastScrapeResult?.errors && scrapeStatus.lastScrapeResult.errors.length > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {scrapeStatus.lastScrapeResult.errors.length} warnings
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-semibold">All Documents</h2>
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {documents?.total ?? 0} total
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all w-64"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden">
          {filteredDocuments?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No documents found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Connect Google Drive and sync to get started'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredDocuments?.map((doc, index) => {
                const fileType = getFileTypeBadge(doc.file_type);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group opacity-0 animate-fade-in"
                    style={{ animationDelay: `${250 + index * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-subtle text-amber-600 dark:text-amber-400">
                        {getFileTypeIcon(doc.file_type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                            {doc.title}
                          </p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fileType.color}`}>
                            {fileType.label}
                          </span>
                          {!doc.is_active && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Modified {new Date(doc.last_modified).toLocaleDateString()} at{' '}
                          {new Date(doc.last_modified).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Active Toggle */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={doc.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: doc.id, active: checked })
                          }
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.source_url && (
                          <Button variant="ghost" size="icon" asChild className="hover:text-amber-600">
                            <a href={doc.source_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            if (confirm('Delete this document?')) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
