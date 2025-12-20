'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bot,
  X,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Hash,
  FileText,
  MessageSquare,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editBot?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    system_prompt: string | null;
  } | null;
}

export function BotFormModal({ isOpen, onClose, editBot }: BotFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editBot;

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');

  // UI state
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);
  const [showSigningSecret, setShowSigningSecret] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Reset form when modal opens/closes or editBot changes
  useEffect(() => {
    if (isOpen) {
      if (editBot) {
        setName(editBot.name);
        setSlug(editBot.slug);
        setDescription(editBot.description ?? '');
        setSystemPrompt(editBot.system_prompt ?? '');
        setSlugManuallyEdited(true);
        // Don't populate tokens for security - they're stored encrypted
        setSlackBotToken('');
        setSlackAppToken('');
        setSlackSigningSecret('');
      } else {
        setName('');
        setSlug('');
        setDescription('');
        setSystemPrompt('');
        setSlackBotToken('');
        setSlackAppToken('');
        setSlackSigningSecret('');
        setSlugManuallyEdited(false);
      }
    }
  }, [isOpen, editBot]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(generatedSlug);
    }
  }, [name, slugManuallyEdited]);

  const createMutation = useMutation({
    mutationFn: api.createBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateBot>[1] }) =>
      api.updateBot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing && editBot) {
      updateMutation.mutate({
        id: editBot.id,
        data: {
          name,
          description: description || undefined,
          system_prompt: systemPrompt || undefined,
        },
      });
    } else {
      createMutation.mutate({
        name,
        slug,
        description: description || undefined,
        system_prompt: systemPrompt || undefined,
        slack_bot_token: slackBotToken || undefined,
        slack_app_token: slackAppToken || undefined,
        slack_signing_secret: slackSigningSecret || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold">
                {isEditing ? 'Edit Bot' : 'Create New Bot'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditing ? 'Update bot configuration' : 'Configure a new AI bot instance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span>Basic Information</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Bot Name *</Label>
                  <div className="relative">
                    <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Marketing Bot"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugManuallyEdited(true);
                      }}
                      placeholder="marketing-bot"
                      className="pl-10 font-mono"
                      required
                      disabled={isEditing}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used in URLs and API calls. Auto-generated from name.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A helpful bot for marketing team questions..."
                    className="w-full min-h-[80px] pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Instructions</Label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="You are a helpful marketing assistant. Focus on..."
                    className="w-full min-h-[120px] pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Custom personality and behavior instructions for this bot.
                </p>
              </div>
            </div>

            {/* Slack Credentials Section - Only for new bots */}
            {!isEditing && (
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Key className="w-4 h-4" />
                  <span>Slack Credentials</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Optional
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to use the default Slack app credentials. Add custom credentials for a dedicated Slack app.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slackBotToken">Bot Token</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="slackBotToken"
                        type={showBotToken ? 'text' : 'password'}
                        value={slackBotToken}
                        onChange={(e) => setSlackBotToken(e.target.value)}
                        placeholder="xoxb-..."
                        className="pl-10 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBotToken(!showBotToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slackAppToken">App Token</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="slackAppToken"
                        type={showAppToken ? 'text' : 'password'}
                        value={slackAppToken}
                        onChange={(e) => setSlackAppToken(e.target.value)}
                        placeholder="xapp-..."
                        className="pl-10 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppToken(!showAppToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slackSigningSecret">Signing Secret</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="slackSigningSecret"
                        type={showSigningSecret ? 'text' : 'password'}
                        value={slackSigningSecret}
                        onChange={(e) => setSlackSigningSecret(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigningSecret(!showSigningSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showSigningSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50 bg-secondary/30">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name || !slug}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {isEditing ? 'Save Changes' : 'Create Bot'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
