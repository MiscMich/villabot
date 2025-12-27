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
  Key,
  Folder,
  FolderPlus,
  Trash2,
  Check,
  AlertTriangle,
  Plus,
  Slack,
  Settings,
  Megaphone,
  TrendingUp,
  Users,
  Code,
  Lock,
  Search,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Bot type configuration matching shared/constants.ts
type BotType = 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';

interface BotTypeOption {
  value: BotType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const BOT_TYPE_OPTIONS: BotTypeOption[] = [
  {
    value: 'operations',
    label: 'Operations',
    description: 'SOPs, procedures, and workflow inquiries',
    icon: <Settings className="w-5 h-5" />,
    color: 'blue',
  },
  {
    value: 'marketing',
    label: 'Marketing',
    description: 'Brand guidelines and campaign info',
    icon: <Megaphone className="w-5 h-5" />,
    color: 'pink',
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'Product info, pricing, and sales materials',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'green',
  },
  {
    value: 'hr',
    label: 'HR & People',
    description: 'Policies, benefits, and employee resources',
    icon: <Users className="w-5 h-5" />,
    color: 'purple',
  },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Documentation, APIs, and dev guidelines',
    icon: <Code className="w-5 h-5" />,
    color: 'orange',
  },
  {
    value: 'general',
    label: 'General',
    description: 'Cross-functional company knowledge',
    icon: <Bot className="w-5 h-5" />,
    color: 'violet',
  },
];

// Error code to user-friendly message mapping
interface ApiError {
  message: string;
  code?: string;
}

function parseApiError(error: unknown): { message: string; code?: string; isRecoverable: boolean } {
  const defaultError = {
    message: 'An unexpected error occurred. Please try again.',
    code: undefined,
    isRecoverable: true,
  };

  if (!error) return defaultError;

  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as ApiError;
      return getErrorDetails(parsed.code, parsed.message);
    } catch {
      return getErrorDetails(undefined, error.message);
    }
  }

  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    return getErrorDetails(apiError.code, apiError.message);
  }

  return defaultError;
}

function getErrorDetails(code?: string, message?: string): { message: string; code?: string; isRecoverable: boolean } {
  switch (code) {
    case 'DUPLICATE_BOT_TOKEN':
      return {
        message: 'This Slack bot token is already registered to another workspace. Each Slack app can only be used by one workspace. Please create a new Slack app for this workspace.',
        code,
        isRecoverable: true,
      };
    case 'INVALID_SLACK_TOKEN':
      return {
        message: 'The Slack token format is invalid. Bot tokens should start with "xoxb-" and app tokens with "xapp-".',
        code,
        isRecoverable: true,
      };
    case 'BOT_LIMIT_REACHED':
      return {
        message: 'You have reached the maximum number of bots for your subscription tier. Please upgrade to add more bots.',
        code,
        isRecoverable: false,
      };
    case 'UNAUTHORIZED':
      return {
        message: 'Your session has expired. Please refresh the page and try again.',
        code,
        isRecoverable: false,
      };
    case 'NETWORK_ERROR':
      return {
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        code,
        isRecoverable: true,
      };
    case 'VALIDATION_ERROR':
      return {
        message: message || 'Please check your input and try again.',
        code,
        isRecoverable: true,
      };
    default:
      return {
        message: message || 'An unexpected error occurred. Please try again.',
        code,
        isRecoverable: true,
      };
  }
}

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-600 dark:text-blue-400' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/50', text: 'text-pink-600 dark:text-pink-400' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-600 dark:text-green-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-600 dark:text-purple-400' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-600 dark:text-orange-400' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/50', text: 'text-violet-600 dark:text-violet-400' },
};

interface BotFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editBot?: {
    id: string;
    name: string;
    slug: string;
    bot_type?: BotType;
  } | null;
}

export function BotFormModal({ isOpen, onClose, editBot }: BotFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editBot;

  // Form state - simplified
  const [name, setName] = useState('');
  const [botType, setBotType] = useState<BotType>('general');
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');

  // Validation helpers for Slack tokens
  const validateBotToken = (token: string): string | null => {
    if (!token) return null; // Empty is ok (optional field)
    if (!token.startsWith('xoxb-')) return 'Bot token must start with "xoxb-"';
    if (token.length < 50) return 'Bot token appears too short';
    return null;
  };

  const validateAppToken = (token: string): string | null => {
    if (!token) return null; // Empty is ok (optional field)
    if (!token.startsWith('xapp-')) return 'App token must start with "xapp-"';
    if (token.length < 50) return 'App token appears too short';
    return null;
  };

  const botTokenError = validateBotToken(slackBotToken);
  const appTokenError = validateAppToken(slackAppToken);
  const hasValidationErrors = !!(botTokenError || appTokenError);

  // UI state
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);
  const [showSigningSecret, setShowSigningSecret] = useState(false);
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
  const [channelSearch, setChannelSearch] = useState('');
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  // Fetch existing channels for the bot
  const { data: botChannels, refetch: refetchChannels } = useQuery({
    queryKey: ['bot-channels', editBot?.id],
    queryFn: () => api.getBotChannels(editBot!.id),
    enabled: isOpen && isEditing && !!editBot?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch available Slack channels from Slack API
  const { data: slackChannels, isLoading: isLoadingSlackChannels, refetch: refetchSlackChannels } = useQuery({
    queryKey: ['slack-channels', editBot?.id],
    queryFn: () => api.getSlackChannels(editBot!.id),
    enabled: isOpen && isEditing && !!editBot?.id && showChannelPicker,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Add channel mutation
  const addChannelMutation = useMutation({
    mutationFn: ({ botId, data }: { botId: string; data: { slackChannelId: string; channelName?: string } }) =>
      api.addBotChannel(botId, data),
    onSuccess: () => {
      refetchChannels();
      refetchSlackChannels();
    },
  });

  // Remove channel mutation
  const removeChannelMutation = useMutation({
    mutationFn: ({ botId, channelId }: { botId: string; channelId: string }) =>
      api.removeBotChannel(botId, channelId),
    onSuccess: () => {
      refetchChannels();
      refetchSlackChannels();
    },
  });

  // Toggle channel assignment
  const handleToggleChannel = async (channelId: string, channelName: string, isCurrentlyAssigned: boolean) => {
    if (!editBot) return;

    if (isCurrentlyAssigned) {
      // Find the assignment ID from botChannels
      const assignment = botChannels?.channels.find(c => c.slack_channel_id === channelId);
      if (assignment) {
        removeChannelMutation.mutate({ botId: editBot.id, channelId: assignment.id });
      }
    } else {
      addChannelMutation.mutate({
        botId: editBot.id,
        data: { slackChannelId: channelId, channelName },
      });
    }
  };

  // Filter channels by search
  const filteredSlackChannels = slackChannels?.channels.filter(channel =>
    channel.name.toLowerCase().includes(channelSearch.toLowerCase())
  ) ?? [];

  // Reset form when modal opens/closes or editBot changes
  useEffect(() => {
    if (isOpen) {
      if (editBot) {
        setName(editBot.name);
        setBotType(editBot.bot_type ?? 'general');
        // Don't populate tokens for security - they're stored encrypted
        setSlackBotToken('');
        setSlackAppToken('');
        setSlackSigningSecret('');
      } else {
        setName('');
        setBotType('general');
        setSlackBotToken('');
        setSlackAppToken('');
        setSlackSigningSecret('');
      }
      // Reset channel picker state
      setChannelSearch('');
      setShowChannelPicker(false);
    }
  }, [isOpen, editBot]);

  // Generate slug from name
  const generateSlug = (botName: string): string => {
    return botName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

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
      // Build update data, only include credentials if they were entered
      const updateData: Parameters<typeof api.updateBot>[1] = {
        name,
        bot_type: botType,
      };

      // Only include credentials if user entered new values
      // (empty fields mean "keep existing", not "clear")
      if (slackBotToken) updateData.slackBotToken = slackBotToken;
      if (slackAppToken) updateData.slackAppToken = slackAppToken;
      if (slackSigningSecret) updateData.slackSigningSecret = slackSigningSecret;

      updateMutation.mutate({
        id: editBot.id,
        data: updateData,
      });
    } else {
      createMutation.mutate({
        name,
        slug: generateSlug(name),
        bot_type: botType,
        slack_bot_token: slackBotToken || undefined,
        slack_app_token: slackAppToken || undefined,
        slack_signing_secret: slackSigningSecret || undefined,
      });
    }
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

  // Handle channel removal from assigned list
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
            {/* Bot Name Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                <span>Bot Identity</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Bot Name *</Label>
                <div className="relative">
                  <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Operations Bot"
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Give your bot a descriptive name that reflects its purpose.
                </p>
              </div>
            </div>

            {/* Bot Type Section */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Settings className="w-4 h-4" />
                <span>Bot Type</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Select the department this bot serves. The bot will automatically access shared company knowledge plus documents relevant to its type.
              </p>

              <div className="grid gap-2 md:grid-cols-2">
                {BOT_TYPE_OPTIONS.map((option) => {
                  const isSelected = botType === option.value;
                  const colors = COLOR_CLASSES[option.color];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBotType(option.value)}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                        isSelected
                          ? `${colors.border} ${colors.bg} ring-1 ring-${option.color}-500/30`
                          : 'border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-border'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected
                            ? `${colors.bg} ${colors.text}`
                            : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            'text-sm font-medium',
                            isSelected ? colors.text : ''
                          )}>
                            {option.label}
                          </p>
                          {isSelected && <Check className="w-4 h-4 text-current" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
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

                <p className="text-xs text-muted-foreground">
                  Add Google Drive folders containing documents for this bot to search.
                </p>

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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Slack className="w-4 h-4" />
                    <span>Slack Channels</span>
                    {(botChannels?.channels ?? []).length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                        {botChannels?.channels.length} assigned
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowChannelPicker(!showChannelPicker)}
                    className="text-xs"
                  >
                    {showChannelPicker ? 'Hide Picker' : 'Add Channels'}
                    <Plus className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure which Slack channels this bot should listen to. Leave empty to respond in all channels where it&apos;s mentioned.
                </p>

                {/* Channel Picker */}
                {showChannelPicker && (
                  <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={channelSearch}
                          onChange={(e) => setChannelSearch(e.target.value)}
                          placeholder="Search channels..."
                          className="pl-9"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => refetchSlackChannels()}
                        disabled={isLoadingSlackChannels}
                      >
                        <RefreshCw className={cn("w-4 h-4", isLoadingSlackChannels && "animate-spin")} />
                      </Button>
                    </div>

                    {isLoadingSlackChannels ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading channels from Slack...</span>
                      </div>
                    ) : filteredSlackChannels.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                          {channelSearch ? 'No channels match your search' : 'No channels available'}
                        </p>
                        <p className="text-xs mt-1">Make sure the bot is added to channels in Slack</p>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {filteredSlackChannels.map((channel) => (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => handleToggleChannel(channel.id, channel.name, channel.isAssigned)}
                            disabled={addChannelMutation.isPending || removeChannelMutation.isPending}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-md text-left transition-colors",
                              channel.isAssigned
                                ? "bg-violet-100 dark:bg-violet-900/30 border border-violet-500/50"
                                : "hover:bg-secondary border border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {channel.isPrivate ? (
                                <Lock className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Hash className="w-4 h-4 text-muted-foreground" />
                              )}
                              <span className="text-sm font-medium">{channel.name}</span>
                              {channel.numMembers && (
                                <span className="text-xs text-muted-foreground">
                                  ({channel.numMembers} members)
                                </span>
                              )}
                            </div>
                            {channel.isAssigned && (
                              <Check className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Assigned channel list */}
                {(botChannels?.channels ?? []).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Assigned Channels</p>
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

            {/* Slack Credentials Section - For both new and editing bots */}
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Key className="w-4 h-4" />
                <span>Slack Credentials</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {isEditing ? 'Update Credentials' : 'Required for Slack'}
                </span>
              </div>

              {/* Contextual notice based on editing state */}
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-2">
                  <Slack className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-purple-700 dark:text-purple-300">
                    {isEditing ? (
                      <>
                        <p className="font-medium">Update Slack Credentials</p>
                        <p className="mt-1">
                          Leave fields empty to keep existing credentials. Enter new values only if you need to update them.
                          Credentials are stored encrypted and never displayed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Your Own Slack App Required</p>
                        <p className="mt-1">
                          Each workspace creates their own Slack app. Tokens cannot be shared between workspaces.
                          You can skip this now and add Slack credentials later.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

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
                      placeholder={isEditing ? '••••••••••••' : 'xoxb-...'}
                      className={cn("pl-10 pr-10 font-mono", botTokenError && "border-red-500")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowBotToken(!showBotToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {botTokenError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {botTokenError}
                    </p>
                  )}
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
                      placeholder={isEditing ? '••••••••••••' : 'xapp-...'}
                      className={cn("pl-10 pr-10 font-mono", appTokenError && "border-red-500")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAppToken(!showAppToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {appTokenError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {appTokenError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slackSigningSecret">Signing Secret (Optional)</Label>
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

            {/* Error Message - Comprehensive handling */}
            {error && (() => {
              const errorDetails = parseApiError(error);
              return (
                <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        {errorDetails.code === 'DUPLICATE_BOT_TOKEN'
                          ? 'Slack Token Already In Use'
                          : isEditing ? 'Unable to Save Changes' : 'Unable to Create Bot'}
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {errorDetails.message}
                      </p>
                      {errorDetails.code === 'DUPLICATE_BOT_TOKEN' && (
                        <a
                          href="https://api.slack.com/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
                        >
                          <Slack className="w-3 h-3" />
                          Create a new Slack app
                        </a>
                      )}
                      {!errorDetails.isRecoverable && (
                        <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                          Please refresh the page or contact support if the issue persists.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50 bg-secondary/30">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name || hasValidationErrors}
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
