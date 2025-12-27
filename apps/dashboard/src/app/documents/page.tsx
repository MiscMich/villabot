'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  RefreshCw,
  FileText,
  ExternalLink,
  Trash2,
  Cloud,
  Globe,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  File,
  ChevronDown,
  Building2,
  Settings,
  Megaphone,
  TrendingUp,
  Users,
  Code,
  Folder,
  Bot,
  LayoutGrid,
  List,
  FolderSync,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncProgress } from '@/hooks/useSyncProgress';
import { SyncProgressBar, SyncStatusBadge } from '@/components/sync';
import { syncToast } from '@/components/sync/useSyncToast';

// Category configuration
type DocumentCategory = 'shared' | 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'custom' | null;

interface CategoryConfig {
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  description: string;
}

const CATEGORY_CONFIG: Record<NonNullable<DocumentCategory>, CategoryConfig> = {
  shared: {
    label: 'Company-Wide',
    icon: <Building2 className="w-3.5 h-3.5" />,
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    description: 'Available to all bots',
  },
  operations: {
    label: 'Operations',
    icon: <Settings className="w-3.5 h-3.5" />,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    description: 'SOPs and workflows',
  },
  marketing: {
    label: 'Marketing',
    icon: <Megaphone className="w-3.5 h-3.5" />,
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
    textClass: 'text-pink-700 dark:text-pink-400',
    description: 'Brand and campaigns',
  },
  sales: {
    label: 'Sales',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    description: 'Products and pricing',
  },
  hr: {
    label: 'HR',
    icon: <Users className="w-3.5 h-3.5" />,
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    description: 'Policies and benefits',
  },
  technical: {
    label: 'Technical',
    icon: <Code className="w-3.5 h-3.5" />,
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    description: 'Docs and APIs',
  },
  custom: {
    label: 'Custom',
    icon: <Folder className="w-3.5 h-3.5" />,
    bgClass: 'bg-gray-100 dark:bg-gray-900/30',
    textClass: 'text-gray-700 dark:text-gray-400',
    description: 'Other documents',
  },
};

// Bot type configuration (matching bots page)
type BotType = 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';

interface BotTypeConfig {
  label: string;
  icon: React.ReactNode;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

const BOT_TYPE_CONFIG: Record<BotType, BotTypeConfig> = {
  operations: {
    label: 'Operations',
    icon: <Settings className="w-3.5 h-3.5" />,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
  },
  marketing: {
    label: 'Marketing',
    icon: <Megaphone className="w-3.5 h-3.5" />,
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
    textClass: 'text-pink-700 dark:text-pink-400',
    borderClass: 'border-pink-200 dark:border-pink-800',
  },
  sales: {
    label: 'Sales',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800',
  },
  hr: {
    label: 'HR',
    icon: <Users className="w-3.5 h-3.5" />,
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800',
  },
  technical: {
    label: 'Technical',
    icon: <Code className="w-3.5 h-3.5" />,
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800',
  },
  general: {
    label: 'General',
    icon: <Bot className="w-3.5 h-3.5" />,
    bgClass: 'bg-gray-100 dark:bg-gray-900/30',
    textClass: 'text-gray-700 dark:text-gray-400',
    borderClass: 'border-gray-200 dark:border-gray-800',
  },
};

type ViewMode = 'list' | 'by-bot';
type SourceFilter = 'all' | 'google_drive' | 'website';

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  const [showSyncedFolders, setShowSyncedFolders] = useState(false);

  // Wait for workspace context before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  // Real-time sync progress
  const syncProgress = useSyncProgress();

  const {
    data: documents,
    isLoading: isDocumentsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['documents', categoryFilter, workspace?.id],
    queryFn: () => api.getDocuments(categoryFilter !== 'all' ? { category: categoryFilter } : undefined),
    enabled: !!workspace?.id,
  });

  // Fetch bots for grouping and folder visibility
  const { data: botsData } = useQuery({
    queryKey: ['bots', workspace?.id],
    queryFn: api.getBots,
    enabled: !!workspace?.id,
  });

  // Fetch all synced folders from all bots
  const { data: allBotFolders } = useQuery({
    queryKey: ['allBotFolders', workspace?.id, botsData?.bots],
    queryFn: async () => {
      if (!botsData?.bots) return { folders: [] };

      // Fetch folders for each bot in parallel
      const folderPromises = botsData.bots.map(async (bot) => {
        try {
          const result = await api.getBotFolders(bot.id);
          return result.folders.map(f => ({ ...f, bot_id: bot.id, bot_name: bot.name, bot_type: bot.bot_type }));
        } catch {
          return [];
        }
      });

      const allFolders = await Promise.all(folderPromises);
      return { folders: allFolders.flat() };
    },
    enabled: !!workspace?.id && !!botsData?.bots && botsData.bots.length > 0,
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus', workspace?.id],
    queryFn: api.getSyncStatus,
    enabled: !!workspace?.id,
  });

  const { data: scrapeStatus } = useQuery({
    queryKey: ['scrapeStatus', workspace?.id],
    queryFn: api.getScrapeStatus,
    enabled: !!workspace?.id,
  });

  // Combined loading state
  const isLoading = isWorkspaceLoading || isDocumentsLoading;

  // Auto-refresh when sync completes and show toast notifications
  // Track which operations we've already shown notifications for
  const notifiedOperationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const operations = syncProgress.recentOperations;
    if (operations.length === 0) return;

    const lastOp = operations[0];
    if (!lastOp) return;

    // Skip if we've already notified for this operation
    if (notifiedOperationsRef.current.has(lastOp.operationId)) return;

    // Show toast for completed/failed operations
    if (lastOp.status === 'completed') {
      notifiedOperationsRef.current.add(lastOp.operationId);
      syncToast.complete(lastOp.type, lastOp.result);
      // Refresh document list
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatus'] });
      queryClient.invalidateQueries({ queryKey: ['scrapeStatus'] });
    } else if (lastOp.status === 'failed') {
      notifiedOperationsRef.current.add(lastOp.operationId);
      syncToast.error(lastOp.type, lastOp.error);
    }

    // Clean up old operation IDs (keep last 20)
    if (notifiedOperationsRef.current.size > 20) {
      const arr = Array.from(notifiedOperationsRef.current);
      notifiedOperationsRef.current = new Set(arr.slice(-20));
    }
  }, [syncProgress.recentOperations, queryClient]);

  // Note: Success/error toasts are handled by SSE events in useEffect above
  // Mutation only triggers the sync - SSE provides real-time progress and completion
  const syncMutation = useMutation({
    mutationFn: api.triggerSync,
    onError: (error: Error) => {
      // Only show error if the API call itself fails (not sync errors from SSE)
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.toggleDocument(id, active),
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: active ? 'Document Enabled' : 'Document Disabled', description: 'Document status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document Deleted', description: 'Document removed from knowledge base' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    },
  });

  // Note: Success/error toasts are handled by SSE events in useEffect above
  const scrapeMutation = useMutation({
    mutationFn: api.triggerWebsiteScrape,
    onError: (error: Error) => {
      toast({ title: 'Scrape Failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleSync = async () => {
    setSyncing(true);
    syncToast.start('drive_sync');
    try {
      await syncMutation.mutateAsync();
    } finally {
      setSyncing(false);
    }
  };

  const handleScrape = async () => {
    setScraping(true);
    syncToast.start('website_scrape');
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

  // Filter documents by search query and source type
  const filteredDocuments = documents?.documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === 'all' || doc.source_type === sourceFilter;
    return matchesSearch && matchesSource;
  });

  // Get website documents for enhanced display
  const websiteDocuments = documents?.documents.filter(d => d.source_type === 'website') || [];
  const driveDocuments = documents?.documents.filter(d => d.source_type === 'google_drive') || [];

  // Helper to extract page path from URL
  const getPagePath = (url?: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      return path === '/' ? 'Home' : path;
    } catch {
      return null;
    }
  };

  // Helper to get domain from URL
  const getDomain = (url?: string | null) => {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  // Group documents by bot
  const documentsByBot = useMemo(() => {
    if (!filteredDocuments || !botsData?.bots) return new Map();

    const grouped = new Map<string | null, typeof filteredDocuments>();

    // Initialize with all bots (even those with no docs)
    botsData.bots.forEach(bot => {
      grouped.set(bot.id, []);
    });
    grouped.set(null, []); // For unassigned documents

    // Group documents
    filteredDocuments.forEach(doc => {
      const botId = doc.bot_id ?? null;
      const existing = grouped.get(botId) || [];
      existing.push(doc);
      grouped.set(botId, existing);
    });

    return grouped;
  }, [filteredDocuments, botsData?.bots]);

  // Get bot by ID helper
  const getBotById = (botId: string | null) => {
    if (!botId || !botsData?.bots) return null;
    return botsData.bots.find(b => b.id === botId);
  };

  // Toggle bot expansion
  const toggleBotExpansion = (botId: string) => {
    setExpandedBots(prev => {
      const next = new Set(prev);
      if (next.has(botId)) {
        next.delete(botId);
      } else {
        next.add(botId);
      }
      return next;
    });
  };

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Documents</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage documents synced from Google Drive and website scraping
          </p>
        </div>
        <div className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load documents</h2>
              <p className="text-muted-foreground max-w-md">
                {error instanceof Error ? error.message : 'An error occurred while loading documents. Please try again.'}
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

  // Render a single document row
  const renderDocumentRow = (doc: NonNullable<typeof filteredDocuments>[number], index: number, showBotBadge = true) => {
    const fileType = getFileTypeBadge(doc.file_type);
    const bot = doc.bot_id ? getBotById(doc.bot_id) : null;
    const botType = bot?.bot_type as BotType | undefined;
    const isWebsite = doc.source_type === 'website';
    const pagePath = isWebsite ? getPagePath(doc.source_url) : null;
    const domain = isWebsite ? getDomain(doc.source_url) : null;

    return (
      <div
        key={doc.id}
        className={cn(
          "flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group opacity-0 animate-fade-in",
          isWebsite && "border-l-4 border-l-purple-400 dark:border-l-purple-600"
        )}
        style={{ animationDelay: `${250 + index * 30}ms` }}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Icon with source-specific styling */}
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
            isWebsite
              ? "bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-600 dark:text-purple-400"
              : "bg-gradient-subtle text-amber-600 dark:text-amber-400"
          )}>
            {isWebsite ? <Globe className="h-5 w-5" /> : getFileTypeIcon(doc.file_type)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Title - for website pages, show path prominently */}
              {isWebsite && pagePath ? (
                <div className="flex items-center gap-2 min-w-0">
                  <code className="font-mono font-semibold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {pagePath}
                  </code>
                  {domain && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {domain}
                    </span>
                  )}
                </div>
              ) : (
                <p className="font-semibold group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                  {doc.title}
                </p>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${fileType.color}`}>
                {fileType.label}
              </span>
              {/* Category Badge */}
              {doc.category && CATEGORY_CONFIG[doc.category] && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                    CATEGORY_CONFIG[doc.category].bgClass,
                    CATEGORY_CONFIG[doc.category].textClass
                  )}
                  title={CATEGORY_CONFIG[doc.category].description}
                >
                  {CATEGORY_CONFIG[doc.category].icon}
                  {CATEGORY_CONFIG[doc.category].label}
                </span>
              )}
              {/* Bot Badge (when in list view) */}
              {showBotBadge && bot && botType && BOT_TYPE_CONFIG[botType] && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                    BOT_TYPE_CONFIG[botType].bgClass,
                    BOT_TYPE_CONFIG[botType].textClass
                  )}
                  title={`Assigned to ${bot.name}`}
                >
                  <Bot className="w-3 h-3" />
                  {bot.name}
                </span>
              )}
              {!doc.is_active && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 flex-shrink-0">
                  Disabled
                </span>
              )}
            </div>
            {/* Subtitle - show page title for website, date for drive docs */}
            {isWebsite ? (
              <p className="text-sm text-muted-foreground truncate" title={doc.title}>
                {doc.title}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Modified {new Date(doc.last_modified).toLocaleDateString()} at{' '}
                {new Date(doc.last_modified).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 flex-shrink-0">
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
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Documents</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Manage your knowledge base documents and sync settings
        </p>
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
            <div className="flex items-center gap-3">
              {/* Status indicator */}
              {syncProgress.driveSync ? (
                <SyncStatusBadge
                  status={syncProgress.driveSync.status}
                  progress={syncProgress.driveSync.progress}
                />
              ) : (
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${syncStatus?.driveConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {syncStatus?.driveConnected ? 'Connected' : 'Not Connected'}
                </span>
              )}
              {/* Sync button - only show when connected and not syncing */}
              {syncStatus?.driveConnected && !syncProgress.driveSync && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  className="hover:border-blue-500/50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          </div>

          {/* Real-time sync progress */}
          {syncProgress.driveSync && syncProgress.driveSync.status === 'running' && (
            <div className="mt-4">
              <SyncProgressBar
                progress={syncProgress.driveSync.progress}
                totalItems={syncProgress.driveSync.totalItems}
                processedItems={syncProgress.driveSync.processedItems}
                currentItem={syncProgress.driveSync.currentItem}
                showDetails
              />
            </div>
          )}
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

          {/* Real-time Scraping Progress Indicator */}
          {(scraping || syncProgress.websiteScrape) && (
            <div className="mt-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              {syncProgress.websiteScrape ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                      <span className="font-medium text-purple-700 dark:text-purple-300">
                        Scraping website...
                      </span>
                    </div>
                    <SyncStatusBadge
                      status={syncProgress.websiteScrape.status}
                      progress={syncProgress.websiteScrape.progress}
                      size="sm"
                    />
                  </div>
                  <SyncProgressBar
                    progress={syncProgress.websiteScrape.progress}
                    totalItems={syncProgress.websiteScrape.totalItems}
                    processedItems={syncProgress.websiteScrape.processedItems}
                    currentItem={syncProgress.websiteScrape.currentItem}
                    showDetails
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      Starting website scrape...
                    </span>
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Connecting to scraper service...
                  </p>
                </>
              )}
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

          {/* Recent Pages List */}
          {websiteDocuments.length > 0 && !scraping && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">Recent Pages</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSourceFilter('website')}
                  className="text-xs h-7 px-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  View all {websiteDocuments.length} pages →
                </Button>
              </div>
              <div className="space-y-2">
                {websiteDocuments
                  .sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime())
                  .slice(0, 5)
                  .map((doc) => {
                    const pagePath = getPagePath(doc.source_url);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                          <Globe className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          {pagePath && (
                            <code className="text-xs text-muted-foreground font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                              {pagePath}
                            </code>
                          )}
                        </div>
                        {doc.source_url && (
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-secondary rounded-md"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-purple-600" />
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Synced Folders Panel */}
      {allBotFolders?.folders && allBotFolders.folders.length > 0 && (
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '175ms' }}>
          <button
            onClick={() => setShowSyncedFolders(!showSyncedFolders)}
            className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FolderSync className="w-5 h-5 text-amber-500" />
              <span className="font-display font-semibold">Synced Folders</span>
              <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {allBotFolders.folders.length} folder{allBotFolders.folders.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", showSyncedFolders && "rotate-180")} />
          </button>

          {showSyncedFolders && (
            <div className="px-4 pb-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allBotFolders.folders.map((folder) => {
                  const botType = folder.bot_type as BotType | undefined;
                  const typeConfig = botType ? BOT_TYPE_CONFIG[botType] : null;

                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all",
                        typeConfig ? typeConfig.borderClass : "border-border",
                        "bg-secondary/30 hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          typeConfig ? typeConfig.bgClass : "bg-gray-100 dark:bg-gray-800"
                        )}>
                          <Folder className={cn(
                            "w-4 h-4",
                            typeConfig ? typeConfig.textClass : "text-gray-600 dark:text-gray-400"
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" title={folder.folder_name}>
                            {folder.folder_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                              typeConfig?.bgClass || "bg-gray-100 dark:bg-gray-800",
                              typeConfig?.textClass || "text-gray-700 dark:text-gray-400"
                            )}>
                              <Bot className="w-3 h-3" />
                              {folder.bot_name}
                            </span>
                          </div>
                          {folder.last_synced && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Synced {new Date(folder.last_synced).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {!folder.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents List */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-semibold">All Documents</h2>
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {documents?.total ?? 0} total
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Source Type Filter */}
              <div className="flex items-center border border-border/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setSourceFilter('all')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    sourceFilter === 'all'
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <span>All</span>
                </button>
                <button
                  onClick={() => setSourceFilter('google_drive')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors border-l border-border/50",
                    sourceFilter === 'google_drive'
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Cloud className="w-4 h-4" />
                  <span className="hidden sm:inline">Drive</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-200/50 dark:bg-blue-800/50">
                    {driveDocuments.length}
                  </span>
                </button>
                <button
                  onClick={() => setSourceFilter('website')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors border-l border-border/50",
                    sourceFilter === 'website'
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">Website</span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-200/50 dark:bg-purple-800/50">
                    {websiteDocuments.length}
                  </span>
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center border border-border/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                    viewMode === 'list'
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <List className="w-4 h-4" />
                  <span>List</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode('by-bot');
                    // Expand all bots by default
                    if (botsData?.bots) {
                      setExpandedBots(new Set(botsData.bots.map(b => b.id)));
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-colors border-l border-border/50",
                    viewMode === 'by-bot'
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>By Bot</span>
                </button>
              </div>

              {/* Category Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm",
                    categoryFilter !== 'all'
                      ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400"
                      : "border-border/50 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {categoryFilter === 'all'
                      ? 'All Categories'
                      : CATEGORY_CONFIG[categoryFilter as keyof typeof CATEGORY_CONFIG]?.label || categoryFilter}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showCategoryDropdown && "rotate-180")} />
                </button>

                {/* Dropdown */}
                {showCategoryDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowCategoryDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setCategoryFilter('all');
                            setShowCategoryDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                            categoryFilter === 'all'
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "hover:bg-secondary"
                          )}
                        >
                          <FileText className="w-4 h-4" />
                          <div>
                            <p className="font-medium">All Categories</p>
                            <p className="text-xs text-muted-foreground">Show all documents</p>
                          </div>
                        </button>

                        <div className="my-1 border-t border-border/50" />

                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => {
                              setCategoryFilter(key);
                              setShowCategoryDropdown(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition-colors",
                              categoryFilter === key
                                ? `${config.bgClass} ${config.textClass}`
                                : "hover:bg-secondary"
                            )}
                          >
                            {config.icon}
                            <div>
                              <p className="font-medium">{config.label}</p>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

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

        {/* Content */}
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
          ) : viewMode === 'list' ? (
            // List View
            <div className="divide-y divide-border/50">
              {filteredDocuments?.map((doc, index) => renderDocumentRow(doc, index, true))}
            </div>
          ) : (
            // Group by Bot View
            <div className="divide-y divide-border/50">
              {/* First show bots with documents */}
              {botsData?.bots.map((bot) => {
                const docs: NonNullable<typeof filteredDocuments> = documentsByBot.get(bot.id) || [];
                const botType = bot.bot_type as BotType;
                const typeConfig = BOT_TYPE_CONFIG[botType];
                const isExpanded = expandedBots.has(bot.id);

                return (
                  <div key={bot.id}>
                    {/* Bot Header */}
                    <button
                      onClick={() => toggleBotExpansion(bot.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors",
                        isExpanded && "bg-secondary/20"
                      )}
                    >
                      <ChevronRight className={cn(
                        "w-5 h-5 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                      <div className={cn(
                        "p-2 rounded-lg",
                        typeConfig.bgClass
                      )}>
                        <Bot className={cn("w-5 h-5", typeConfig.textClass)} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{bot.name}</span>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            typeConfig.bgClass,
                            typeConfig.textClass
                          )}>
                            {typeConfig.label}
                          </span>
                          {bot.is_default && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {docs.length} document{docs.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>

                    {/* Bot Documents */}
                    {isExpanded && docs.length > 0 && (
                      <div className="border-t border-border/30 bg-secondary/10">
                        {docs.map((doc, index) => renderDocumentRow(doc, index, false))}
                      </div>
                    )}
                    {isExpanded && docs.length === 0 && (
                      <div className="border-t border-border/30 bg-secondary/10 p-8 text-center">
                        <p className="text-sm text-muted-foreground">No documents assigned to this bot</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unassigned documents */}
              {(() => {
                const unassignedDocs: NonNullable<typeof filteredDocuments> = documentsByBot.get(null) || [];
                if (unassignedDocs.length === 0) return null;

                const isExpanded = expandedBots.has('unassigned');

                return (
                  <div>
                    <button
                      onClick={() => {
                        setExpandedBots(prev => {
                          const next = new Set(prev);
                          if (next.has('unassigned')) {
                            next.delete('unassigned');
                          } else {
                            next.add('unassigned');
                          }
                          return next;
                        });
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors",
                        isExpanded && "bg-secondary/20"
                      )}
                    >
                      <ChevronRight className={cn(
                        "w-5 h-5 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Unassigned Documents</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                            General
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {unassignedDocs.length} document{unassignedDocs.length !== 1 ? 's' : ''} not assigned to any bot
                        </p>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/30 bg-secondary/10">
                        {unassignedDocs.map((doc, index) => renderDocumentRow(doc, index, false))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
