'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DriveFolderPicker, SelectedFolder } from '@/components/drive-folder-picker';
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
  FolderOpen,
  Folder,
  FolderPlus,
  Trash2,
  Check,
  AlertTriangle,
  Plus,
  Slack,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DocumentCategory = 'shared' | 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'custom';

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string; description: string }[] = [
  { value: 'shared', label: 'Shared', description: 'Company-wide knowledge available to all' },
  { value: 'operations', label: 'Operations', description: 'SOPs and operational procedures' },
  { value: 'marketing', label: 'Marketing', description: 'Marketing materials and campaigns' },
  { value: 'sales', label: 'Sales', description: 'Sales collateral and playbooks' },
  { value: 'hr', label: 'HR', description: 'Human resources policies and docs' },
  { value: 'technical', label: 'Technical', description: 'Technical documentation and guides' },
  { value: 'custom', label: 'Custom', description: 'Uncategorized documents' },
];

interface BotFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editBot?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    system_prompt: string | null;
    categories?: DocumentCategory[];
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
  const [categories, setCategories] = useState<DocumentCategory[]>(['shared']);
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');

  // UI state
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);
  const [showSigningSecret, setShowSigningSecret] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // Fetch Drive connection status
  const { data: driveStatus } = useQuery({
    queryKey: ['drive-status'],
    queryFn: api.getDriveStatus,
    enabled: isOpen && isEditing,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch existing folders for the bot
  const { data: botFolders, refetch: refetchFolders } = useQuery({
    queryKey: ['bot-folders', editBot?.id],
    queryFn: () => api.getBotFolders(editBot!.id),
    enabled: isOpen && isEditing && !!editBot?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Add folder mutation
  const addFolderMutation = useMutation({
    mutationFn: ({ botId, data }: { botId: string; data: { driveFolderId: string; folderName: string } }) =>
      api.addBotFolder(botId, data),
    onSuccess: () => {
      refetchFolders();
    },
  });

  // Remove folder mutation
  const removeFolderMutation = useMutation({
    mutationFn: ({ botId, folderId }: { botId: string; folderId: string }) =>
      api.removeBotFolder(botId, folderId),
    onSuccess: () => {
      refetchFolders();
    },
  });

  // Channel state
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');

  // Fetch existing channels for the bot
  const { data: botChannels, refetch: refetchChannels } = useQuery({
    queryKey: ['bot-channels', editBot?.id],
    queryFn: () => api.getBotChannels(editBot!.id),
    enabled: isOpen && isEditing && !!editBot?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Add channel mutation
  const addChannelMutation = useMutation({
    mutationFn: ({ botId, data }: { botId: string; data: { slackChannelId: string; channelName?: string } }) =>
      api.addBotChannel(botId, data),
    onSuccess: () => {
      refetchChannels();
      setNewChannelId('');
      setNewChannelName('');
    },
  });

  // Remove channel mutation
  const removeChannelMutation = useMutation({
    mutationFn: ({ botId, channelId }: { botId: string; channelId: string }) =>
      api.removeBotChannel(botId, channelId),
    onSuccess: () => {
      refetchChannels();
    },
  });

  // Reset form when modal opens/closes or editBot changes
  useEffect(() => {
    if (isOpen) {
      if (editBot) {
        setName(editBot.name);
        setSlug(editBot.slug);
        setDescription(editBot.description ?? '');
        setSystemPrompt(editBot.system_prompt ?? '');
        setCategories(editBot.categories ?? ['shared']);
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
        setCategories(['shared']);
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
          categories: categories.length > 0 ? categories : undefined,
        },
      });
    } else {
      createMutation.mutate({
        name,
        slug,
        description: description || undefined,
        system_prompt: systemPrompt || undefined,
        categories: categories.length > 0 ? categories : undefined,
        slack_bot_token: slackBotToken || undefined,
        slack_app_token: slackAppToken || undefined,
        slack_signing_secret: slackSigningSecret || undefined,
      });
    }
  };

  const toggleCategory = (category: DocumentCategory) => {
    setCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Handle folder selection from picker
  const handleFolderPickerSelect = async (selectedFolders: SelectedFolder[]) => {
    if (!editBot?.id) return;

    const existingIds = new Set((botFolders?.folders ?? []).map(f => f.drive_folder_id));
    const newFolders = selectedFolders.filter(sf => !existingIds.has(sf.id));

    for (const folder of newFolders) {
      await addFolderMutation.mutateAsync({
        botId: editBot.id,
        data: { driveFolderId: folder.id, folderName: folder.name },
      });
    }
  };

  // Handle folder removal
  const handleRemoveFolder = async (folderId: string) => {
    if (!editBot?.id) return;
    await removeFolderMutation.mutateAsync({ botId: editBot.id, folderId });
  };

  // Handle adding a channel
  const handleAddChannel = async () => {
    if (!editBot?.id || !newChannelId.trim()) return;
    await addChannelMutation.mutateAsync({
      botId: editBot.id,
      data: {
        slackChannelId: newChannelId.trim(),
        channelName: newChannelName.trim() || undefined,
      },
    });
  };

  // Handle channel removal
  const handleRemoveChannel = async (channelId: string) => {
    if (!editBot?.id) return;
    await removeChannelMutation.mutateAsync({ botId: editBot.id, channelId });
  };

  const isPending = createMutation.isPending || updateMutation.isPending || addFolderMutation.isPending || removeFolderMutation.isPending || addChannelMutation.isPending || removeChannelMutation.isPending;
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
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg">
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
                    className="w-full min-h-[80px] pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
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
                    className="w-full min-h-[120px] pl-10 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/50 focus:bg-background focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all resize-none font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Custom personality and behavior instructions for this bot.
                </p>
              </div>
            </div>

            {/* Document Categories Section */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FolderOpen className="w-4 h-4" />
                <span>Document Access</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Select which document categories this bot can search. At least one category is recommended.
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const isSelected = categories.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleCategory(option.value)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                        isSelected
                          ? 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/30'
                          : 'border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-border'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                          isSelected
                            ? 'bg-violet-500 text-white'
                            : 'bg-secondary border border-border'
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-violet-700 dark:text-violet-300' : ''
                        )}>
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {categories.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No categories selected. Bot will have limited document access.
                </p>
              )}
            </div>

            {/* Knowledge Sources Section - Only when editing */}
            {isEditing && (
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Folder className="w-4 h-4" />
                    <span>Knowledge Sources</span>
                  </div>
                  {driveStatus?.connected && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFolderPickerOpen(true)}
                      disabled={addFolderMutation.isPending}
                    >
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Add Folder
                    </Button>
                  )}
                </div>

                {!driveStatus?.connected && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Connect Google Drive in{' '}
                        <a href="/settings" className="underline hover:no-underline">Settings → Integrations</a>{' '}
                        to browse and add folders.
                      </p>
                    </div>
                  </div>
                )}

                {/* Folder list */}
                {(botFolders?.folders ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {botFolders?.folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-blue-500" />
                          <div>
                            <p className="font-medium text-sm">{folder.folder_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {folder.drive_folder_id.length > 25
                                ? `${folder.drive_folder_id.slice(0, 25)}...`
                                : folder.drive_folder_id}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFolder(folder.id)}
                          disabled={removeFolderMutation.isPending}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          {removeFolderMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Folder className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No folders linked to this bot</p>
                    <p className="text-xs mt-1">Add folders to give this bot knowledge from Google Drive</p>
                  </div>
                )}
              </div>
            )}

            {/* Slack Channels Section - Only when editing */}
            {isEditing && (
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Slack className="w-4 h-4" />
                  <span>Slack Channels</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure which Slack channels this bot should listen to. Leave empty to respond in all channels where it&apos;s mentioned.
                </p>

                {/* Add Channel Form */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      value={newChannelId}
                      onChange={(e) => setNewChannelId(e.target.value)}
                      placeholder="Channel ID (e.g., C01ABC123)"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="Channel name (optional)"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddChannel}
                    disabled={!newChannelId.trim() || addChannelMutation.isPending}
                  >
                    {addChannelMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Channel list */}
                {(botChannels?.channels ?? []).length > 0 ? (
                  <div className="space-y-2">
                    {botChannels?.channels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <Hash className="w-5 h-5 text-violet-500" />
                          <div>
                            <p className="font-medium text-sm">
                              {channel.channel_name || channel.slack_channel_id}
                            </p>
                            {channel.channel_name && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {channel.slack_channel_id}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveChannel(channel.id)}
                          disabled={removeChannelMutation.isPending}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          {removeChannelMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No channel restrictions</p>
                    <p className="text-xs mt-1">Bot will respond in all channels where mentioned</p>
                  </div>
                )}
              </div>
            )}

            {/* Slack Credentials Section - Only for new bots */}
            {!isEditing && (
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Key className="w-4 h-4" />
                  <span>Slack Credentials</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
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
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
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

      {/* Drive Folder Picker Modal */}
      {isEditing && (
        <DriveFolderPicker
          isOpen={folderPickerOpen}
          onClose={() => setFolderPickerOpen(false)}
          onSelect={handleFolderPickerSelect}
          selectedFolders={(botFolders?.folders ?? []).map(f => ({
            id: f.drive_folder_id,
            name: f.folder_name,
          }))}
          maxSelections={10}
        />
      )}
    </div>
  );
}
