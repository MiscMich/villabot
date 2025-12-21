'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { BotFormModal } from '@/components/bot-form-modal';
import { useToast } from '@/components/ui/use-toast';
import {
  Bot,
  Plus,
  Trash2,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  is_default: boolean;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export default function BotsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBot, setEditingBot] = useState<BotData | null>(null);

  const { data: botsData, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: api.getBots,
  });

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
            <Bot className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Bots</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Manage your AI bot instances and configurations
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingBot(null);
            setShowFormModal(true);
          }}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Bot
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bots</p>
              <p className="text-3xl font-display font-bold">{botsData?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20">
              <Bot className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
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

        <div className="premium-card p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
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
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search bots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
        </div>
      </div>

      {/* Bots Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBots?.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 premium-card">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No bots found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'Create your first bot to get started'}
            </p>
          </div>
        ) : (
          filteredBots?.map((bot, index) => (
            <div
              key={bot.id}
              className="premium-card p-6 group opacity-0 animate-fade-in-up hover:border-amber-500/30 transition-all"
              style={{ animationDelay: `${300 + index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    bot.status === 'active'
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-glow'
                      : 'bg-secondary'
                  )}>
                    <Bot className={cn(
                      'h-6 w-6',
                      bot.status === 'active' ? 'text-white' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold">{bot.name}</h3>
                      {bot.is_default && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
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
                    className="h-8 w-8 hover:text-amber-600"
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

              {bot.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {bot.description}
                </p>
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

                <Switch
                  checked={bot.status === 'active'}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      activateMutation.mutate(bot.id);
                    } else {
                      deactivateMutation.mutate(bot.id);
                    }
                  }}
                  disabled={activateMutation.isPending || deactivateMutation.isPending}
                />
              </div>

              <div className="mt-4 text-xs text-muted-foreground">
                Created {new Date(bot.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bot Form Modal */}
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
