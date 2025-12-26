'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { BotFormModal } from '@/components/bot-form-modal';
import { BotSetupWizard } from '@/components/bot-setup-wizard';
import { useToast } from '@/components/ui/use-toast';
import { GlassCardStatic } from '@/components/design-system/glass-card';
import {
  Bot,
  Plus,
  Trash2,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Search,
  Edit,
  RefreshCw,
  Settings,
  Megaphone,
  TrendingUp,
  Users,
  Code,
  Hash,
  Globe,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Bot type configuration matching shared/constants.ts
type BotType = 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';

interface BotTypeConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgClass: string;
  textClass: string;
  categories: string[];
}

const BOT_TYPE_CONFIG: Record<BotType, BotTypeConfig> = {
  operations: {
    label: 'Operations',
    description: 'SOPs, procedures, and workflows',
    icon: <Settings className="w-4 h-4" />,
    color: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    categories: ['shared', 'operations'],
  },
  marketing: {
    label: 'Marketing',
    description: 'Brand and campaign info',
    icon: <Megaphone className="w-4 h-4" />,
    color: 'pink',
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
    textClass: 'text-pink-700 dark:text-pink-400',
    categories: ['shared', 'marketing'],
  },
  sales: {
    label: 'Sales',
    description: 'Products and pricing',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'green',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    categories: ['shared', 'sales'],
  },
  hr: {
    label: 'HR',
    description: 'Policies and benefits',
    icon: <Users className="w-4 h-4" />,
    color: 'purple',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    categories: ['shared', 'hr'],
  },
  technical: {
    label: 'Technical',
    description: 'Docs and APIs',
    icon: <Code className="w-4 h-4" />,
    color: 'orange',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-400',
    categories: ['shared', 'technical'],
  },
  general: {
    label: 'General',
    description: 'All company knowledge',
    icon: <Bot className="w-4 h-4" />,
    color: 'violet',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
    textClass: 'text-violet-700 dark:text-violet-400',
    categories: ['shared', 'operations', 'marketing', 'sales', 'hr', 'technical', 'custom'],
  },
};

interface BotData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  is_default: boolean;
  bot_type: BotType;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
  // Credential status flags from API
  has_slack_bot_token?: boolean;
  has_slack_app_token?: boolean;
  has_slack_signing_secret?: boolean;
}

/**
 * Check if a bot has valid Slack credentials for activation
 */
function hasValidCredentials(bot: BotData): boolean {
  return Boolean(bot.has_slack_bot_token && bot.has_slack_app_token);
}

/**
 * Get missing credentials as a human-readable list
 */
function getMissingCredentials(bot: BotData): string[] {
  const missing: string[] = [];
  if (!bot.has_slack_bot_token) missing.push('Bot Token');
  if (!bot.has_slack_app_token) missing.push('App Token');
  return missing;
}

export default function BotsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingBot, setEditingBot] = useState<BotData | null>(null);

  // Wait for workspace context before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const {
    data: botsData,
    isLoading: isBotsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['bots', workspace?.id],
    queryFn: api.getBots,
    enabled: !!workspace?.id,
  });

  // Combined loading state
  const isLoading = isWorkspaceLoading || isBotsLoading;

  const activateMutation = useMutation({
    mutationFn: api.activateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      toast({ title: 'Bot Activated', description: 'Bot is now running and ready' });
    },
    onError: (error: Error) => {
      toast({ title: 'Activation Failed', description: error.message, variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: api.deactivateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      toast({ title: 'Bot Deactivated', description: 'Bot has been stopped' });
    },
    onError: (error: Error) => {
      toast({ title: 'Deactivation Failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      toast({ title: 'Bot Deleted', description: 'Bot has been removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const filteredBots = botsData?.bots.filter((bot) =>
    bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bot.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8 text-violet-500" />
            <h1 className="text-4xl font-display font-bold">Bots</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage your AI bot instances and configurations
          </p>
        </div>
        <div className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load bots</h2>
              <p className="text-muted-foreground max-w-md">
                {error instanceof Error ? error.message : 'An error occurred while loading bots. Please try again.'}
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-48 bg-muted rounded-xl shimmer" />
          <div className="h-48 bg-muted rounded-xl shimmer" />
          <div className="h-48 bg-muted rounded-xl shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between opacity-0 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8 text-violet-500" />
            <h1 className="text-4xl font-display font-bold">Bots</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage your AI bot instances and configurations
          </p>
        </div>
        <Button
          onClick={() => setShowWizard(true)}
          className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Bot
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="glass-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bots</p>
              <p className="text-3xl font-display font-bold">{botsData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-400/20 to-purple-600/20">
              <Bot className="h-6 w-6 text-purple-600 dark:text-violet-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-3xl font-display font-bold text-green-600 dark:text-green-400">
                {botsData?.bots.filter((b) => b.status === 'active').length ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-400/20 to-green-600/20">
              <Power className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-3xl font-display font-bold text-gray-600 dark:text-gray-400">
                {botsData?.bots.filter((b) => b.status === 'inactive').length ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-gray-400/20 to-gray-600/20">
              <PowerOff className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Needs Config</p>
              <p className="text-3xl font-display font-bold text-amber-600 dark:text-amber-400">
                {botsData?.bots.filter((b) => !hasValidCredentials(b)).length ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search bots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
          />
        </div>
      </div>

      {/* Bots Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBots?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 glass-card">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No bots found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'Create your first bot to get started'}
            </p>
          </div>
        ) : (
          filteredBots?.map((bot, index) => {
            const typeConfig = BOT_TYPE_CONFIG[bot.bot_type || 'general'];
            return (
            <div
              key={bot.id}
              className="glass-card p-6 group opacity-0 animate-fade-in-up hover:border-violet-500/30 transition-all"
              style={{ animationDelay: `${300 + index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      bot.status === 'active'
                        ? 'bg-gradient-to-br from-violet-400 to-purple-600 shadow-glow'
                        : !hasValidCredentials(bot)
                          ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
                          : 'bg-secondary'
                    )}>
                      <Bot className={cn(
                        'h-6 w-6',
                        bot.status === 'active'
                          ? 'text-white'
                          : !hasValidCredentials(bot)
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                      )} />
                    </div>
                    {/* Warning badge when credentials are missing */}
                    {!hasValidCredentials(bot) && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                        <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold">{bot.name}</h3>
                      {bot.is_default && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-purple-700 dark:bg-violet-900/30 dark:text-violet-400">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">/{bot.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-purple-600"
                    onClick={() => {
                      setEditingBot(bot);
                      setShowFormModal(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!bot.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        if (confirm('Delete this bot? This cannot be undone.')) {
                          deleteMutation.mutate(bot.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Bot Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
                  typeConfig.bgClass,
                  typeConfig.textClass
                )}>
                  {typeConfig.icon}
                  {typeConfig.label}
                </span>
              </div>

              {bot.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {bot.description}
                </p>
              )}

              {/* Channel and Knowledge Info */}
              <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>All channels</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" />
                  <span>{typeConfig.categories.length} categories</span>
                </div>
              </div>

              {/* Credential Warning Banner */}
              {!hasValidCredentials(bot) && (
                <div className="flex items-center gap-2 p-2.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      Missing Slack Credentials
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                      {getMissingCredentials(bot).join(', ')} required
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    onClick={() => {
                      setEditingBot(bot);
                      setShowFormModal(true);
                    }}
                  >
                    <KeyRound className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(bot.status)}
                  <span className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    getStatusColor(bot.status)
                  )}>
                    {bot.status.charAt(0).toUpperCase() + bot.status.slice(1)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Show disabled reason when credentials are missing */}
                  {!hasValidCredentials(bot) && bot.status !== 'active' && (
                    <span className="text-xs text-muted-foreground">
                      Configure to activate
                    </span>
                  )}
                  <Switch
                    checked={bot.status === 'active'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        // Double-check credentials before attempting activation
                        if (!hasValidCredentials(bot)) {
                          toast({
                            title: 'Cannot Activate Bot',
                            description: `Missing ${getMissingCredentials(bot).join(' and ')}. Configure Slack credentials first.`,
                            variant: 'destructive',
                          });
                          return;
                        }
                        activateMutation.mutate(bot.id);
                      } else {
                        deactivateMutation.mutate(bot.id);
                      }
                    }}
                    disabled={
                      activateMutation.isPending ||
                      deactivateMutation.isPending ||
                      // Disable activation (not deactivation) if credentials are missing
                      (!hasValidCredentials(bot) && bot.status !== 'active')
                    }
                  />
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Created {new Date(bot.created_at).toLocaleDateString()}
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* Bot Setup Wizard (for new bots) */}
      <BotSetupWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
      />

      {/* Bot Form Modal (for editing existing bots) */}
      <BotFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingBot(null);
        }}
        editBot={editingBot}
      />
    </div>
  );
}
