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
  Key,
  FolderPlus,
  Folder,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Slack,
  AlertTriangle,
  Play,
  Settings,
  Megaphone,
  TrendingUp,
  Users,
  Code,
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
  // Default error state
  const defaultError = {
    message: 'An unexpected error occurred. Please try again.',
    code: undefined,
    isRecoverable: true,
  };

  if (!error) return defaultError;

  // Handle Error objects with potential API response
  if (error instanceof Error) {
    // Try to parse JSON from the error message (some APIs include it)
    try {
      const parsed = JSON.parse(error.message) as ApiError;
      return getErrorDetails(parsed.code, parsed.message);
    } catch {
      // Not JSON, use the message directly
      return getErrorDetails(undefined, error.message);
    }
  }

  // Handle plain objects (direct API responses)
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    return getErrorDetails(apiError.code, apiError.message);
  }

  return defaultError;
}

function getErrorDetails(code?: string, message?: string): { message: string; code?: string; isRecoverable: boolean } {
  // Map known error codes to user-friendly messages
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
      // Use the API message if provided, otherwise generic message
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

interface BotSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FolderEntry {
  id: string;
  driveFolderId: string;
  folderName: string;
}

type WizardStep = 'basic' | 'slack' | 'folders' | 'confirm';

const STEPS: { key: WizardStep; title: string; description: string }[] = [
  { key: 'basic', title: 'Basic Info', description: 'Name your bot and choose its type' },
  { key: 'slack', title: 'Connect Slack', description: 'Add Slack credentials' },
  { key: 'folders', title: 'Add Folders', description: 'Link Google Drive folders' },
  { key: 'confirm', title: 'Confirm', description: 'Review and create' },
];

export function BotSetupWizard({ isOpen, onClose }: BotSetupWizardProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');

  // Basic info state - simplified
  const [name, setName] = useState('');
  const [botType, setBotType] = useState<BotType>('general');

  // Slack credentials state
  const [slackBotToken, setSlackBotToken] = useState('');
  const [slackAppToken, setSlackAppToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);
  const [showSigningSecret, setShowSigningSecret] = useState(false);
  const [slackTestStatus, setSlackTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [slackTestError, setSlackTestError] = useState<string | null>(null);
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null);

  // Folders state
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [newFolderId, setNewFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  // Check Drive connection status
  const { data: driveStatus } = useQuery({
    queryKey: ['drive-status'],
    queryFn: api.getDriveStatus,
    enabled: isOpen,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Creation state
  const [createdBotId, setCreatedBotId] = useState<string | null>(null);
  const [isAddingFolders, setIsAddingFolders] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('basic');
      setName('');
      setBotType('general');
      setSlackBotToken('');
      setSlackAppToken('');
      setSlackSigningSecret('');
      setSlackTestStatus('idle');
      setSlackTestError(null);
      setSlackTeamName(null);
      setFolders([]);
      setNewFolderId('');
      setNewFolderName('');
      setCreatedBotId(null);
      setIsAddingFolders(false);
    }
  }, [isOpen]);

  // Generate slug from name
  const generateSlug = (botName: string): string => {
    return botName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Create bot mutation
  const createMutation = useMutation({
    mutationFn: api.createBot,
    onSuccess: (data) => {
      setCreatedBotId(data.bot.id);
    },
  });

  // Add folder mutation
  const addFolderMutation = useMutation({
    mutationFn: ({ botId, folder }: { botId: string; folder: FolderEntry }) =>
      api.addBotFolder(botId, {
        driveFolderId: folder.driveFolderId,
        folderName: folder.folderName,
      }),
  });

  // Test Slack connection
  const handleTestSlack = async () => {
    if (!slackBotToken || !slackAppToken) {
      setSlackTestError('Bot Token and App Token are required');
      setSlackTestStatus('error');
      return;
    }

    setSlackTestStatus('testing');
    setSlackTestError(null);

    try {
      const response = await api.testSlackCredentials({
        botToken: slackBotToken,
        appToken: slackAppToken,
        signingSecret: slackSigningSecret,
      });

      if (response.valid) {
        setSlackTestStatus('success');
        setSlackTeamName(response.teamName ?? null);
      } else {
        setSlackTestStatus('error');
        setSlackTestError(response.error ?? 'Invalid credentials');
      }
    } catch (error) {
      setSlackTestStatus('error');
      setSlackTestError(error instanceof Error ? error.message : 'Failed to test credentials');
    }
  };

  // Extract folder ID from URL or use direct ID
  const extractFolderId = (input: string): string => {
    // Handle Google Drive URLs
    const urlMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Otherwise treat as direct ID
    return input.trim();
  };

  // Add folder to list
  const handleAddFolder = () => {
    if (!newFolderId || !newFolderName) return;

    const folderId = extractFolderId(newFolderId);

    // Check for duplicates
    if (folders.some(f => f.driveFolderId === folderId)) {
      return;
    }

    setFolders([...folders, {
      id: crypto.randomUUID(),
      driveFolderId: folderId,
      folderName: newFolderName,
    }]);
    setNewFolderId('');
    setNewFolderName('');
  };

  // Remove folder from list
  const handleRemoveFolder = (id: string) => {
    setFolders(folders.filter(f => f.id !== id));
  };

  // Handle folder selection from picker
  const handleFolderPickerSelect = (selectedFolders: SelectedFolder[]) => {
    const newFolders: FolderEntry[] = selectedFolders
      .filter(sf => !folders.some(f => f.driveFolderId === sf.id))
      .map(sf => ({
        id: crypto.randomUUID(),
        driveFolderId: sf.id,
        folderName: sf.name,
      }));
    setFolders([...folders, ...newFolders]);
  };

  // Handle final creation
  const handleCreate = async () => {
    try {
      // First create the bot with auto-generated slug and bot_type
      const result = await createMutation.mutateAsync({
        name,
        slug: generateSlug(name),
        bot_type: botType,
        slack_bot_token: slackBotToken || undefined,
        slack_app_token: slackAppToken || undefined,
        slack_signing_secret: slackSigningSecret || undefined,
      });

      const botId = result.bot.id;

      // Then add all folders
      if (folders.length > 0) {
        setIsAddingFolders(true);
        for (const folder of folders) {
          await addFolderMutation.mutateAsync({ botId, folder });
        }
        setIsAddingFolders(false);
      }

      // Invalidate queries and close
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      onClose();
    } catch (error) {
      console.error('Failed to create bot:', error);
    }
  };

  // Navigation
  const stepIndex = STEPS.findIndex(s => s.key === currentStep);
  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < STEPS.length - 1;

  const goNext = () => {
    if (canGoNext) {
      setCurrentStep(STEPS[stepIndex + 1].key);
    }
  };

  const goBack = () => {
    if (canGoBack) {
      setCurrentStep(STEPS[stepIndex - 1].key);
    }
  };

  // Validation - only name is required (slug auto-generated, bot_type has default)
  const isBasicValid = name.trim().length > 0;
  const isSlackValid = slackTestStatus === 'success';
  const canProceedFromSlack = isSlackValid || (slackBotToken === '' && slackAppToken === '');

  const isPending = createMutation.isPending || isAddingFolders;
  const error = createMutation.error;

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
              <h2 className="text-xl font-display font-semibold">Create New Bot</h2>
              <p className="text-sm text-muted-foreground">
                Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex].description}
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

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 px-6 border-b border-border/50 bg-secondary/30">
          {STEPS.map((step, index) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => index < stepIndex && setCurrentStep(step.key)}
                disabled={index > stepIndex}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  index === stepIndex
                    ? 'bg-violet-500 text-white'
                    : index < stepIndex
                    ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/30'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {index < stepIndex ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center text-xs rounded-full bg-current/20">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={cn(
                  'w-8 h-0.5 mx-1',
                  index < stepIndex ? 'bg-violet-500' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-350px)] overflow-y-auto">
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <div className="space-y-6 animate-fade-in">
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
                  Select the department this bot serves. The bot will be configured with appropriate personality and instructions.
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
            </div>
          )}

          {/* Step 2: Slack Credentials */}
          {currentStep === 'slack' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Slack className="w-4 h-4" />
                <span>Connect Slack</span>
              </div>

              {/* Workspace-specific Slack App notice */}
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-3">
                  <Slack className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-700 dark:text-purple-300">
                    <p className="font-medium">Your Own Slack App Required</p>
                    <p className="mt-1">
                      Each workspace creates their own Slack app. Your bot credentials are private to your
                      workspace and give you full control. Slack tokens cannot be shared between workspaces.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Create your Slack app first</p>
                    <p className="mt-1">
                      You'll need to create a Slack app at{' '}
                      <a
                        href="https://api.slack.com/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        api.slack.com/apps
                      </a>{' '}
                      and add the required permissions (app_mentions:read, chat:write, im:history, etc.)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slackBotToken">Bot Token *</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="slackBotToken"
                      type={showBotToken ? 'text' : 'password'}
                      value={slackBotToken}
                      onChange={(e) => {
                        setSlackBotToken(e.target.value);
                        setSlackTestStatus('idle');
                      }}
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
                  <p className="text-xs text-muted-foreground">
                    Found in OAuth & Permissions → Bot User OAuth Token
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slackAppToken">App Token *</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="slackAppToken"
                      type={showAppToken ? 'text' : 'password'}
                      value={slackAppToken}
                      onChange={(e) => {
                        setSlackAppToken(e.target.value);
                        setSlackTestStatus('idle');
                      }}
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
                  <p className="text-xs text-muted-foreground">
                    Found in Basic Information → App-Level Tokens (with connections:write scope)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slackSigningSecret">Signing Secret</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="slackSigningSecret"
                      type={showSigningSecret ? 'text' : 'password'}
                      value={slackSigningSecret}
                      onChange={(e) => {
                        setSlackSigningSecret(e.target.value);
                        setSlackTestStatus('idle');
                      }}
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
                  <p className="text-xs text-muted-foreground">
                    Found in Basic Information → Signing Secret
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="pt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant={slackTestStatus === 'success' ? 'default' : 'outline'}
                  onClick={handleTestSlack}
                  disabled={slackTestStatus === 'testing' || !slackBotToken || !slackAppToken}
                  className={cn(
                    'w-full',
                    slackTestStatus === 'success' && 'bg-green-600 hover:bg-green-700'
                  )}
                >
                  {slackTestStatus === 'testing' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing Connection...
                    </>
                  ) : slackTestStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Connected to {slackTeamName}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                {slackTestStatus === 'error' && slackTestError && (
                  <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{slackTestError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Add Folders */}
          {currentStep === 'folders' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FolderPlus className="w-4 h-4" />
                <span>Google Drive Folders</span>
              </div>

              <p className="text-sm text-muted-foreground">
                Add Google Drive folders that contain documents for this bot to use as knowledge.
                You can add multiple folders.
              </p>

              {/* Browse Google Drive Button */}
              {driveStatus?.connected ? (
                <Button
                  type="button"
                  onClick={() => setFolderPickerOpen(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                >
                  <Folder className="w-4 h-4 mr-2" />
                  Browse Google Drive
                </Button>
              ) : (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      <p className="font-medium">Google Drive not connected</p>
                      <p className="mt-1">
                        Connect Google Drive in{' '}
                        <a href="/settings" className="underline hover:no-underline">Settings → Integrations</a>{' '}
                        to browse folders visually. You can still add folders manually below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Add Folder Form - Collapsible */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <span className="text-xs">▶</span>
                  <span className="group-open:hidden">Add folder manually</span>
                  <span className="hidden group-open:inline">Hide manual entry</span>
                </summary>
                <div className="mt-3 p-4 rounded-lg border border-dashed border-border bg-secondary/30">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="newFolderId">Folder ID or URL</Label>
                      <Input
                        id="newFolderId"
                        value={newFolderId}
                        onChange={(e) => setNewFolderId(e.target.value)}
                        placeholder="1ABC...xyz or https://drive.google.com/..."
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Copy from your Google Drive folder URL
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newFolderName">Folder Name</Label>
                      <Input
                        id="newFolderName"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Marketing Documents"
                      />
                      <p className="text-xs text-muted-foreground">
                        A friendly name to identify this folder
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddFolder}
                    disabled={!newFolderId || !newFolderName}
                    className="mt-3 w-full"
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Add Folder
                  </Button>
                </div>
              </details>

              {/* Folder List */}
              {folders.length > 0 ? (
                <div className="space-y-2">
                  <Label>Added Folders ({folders.length})</Label>
                  <div className="space-y-2">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-violet-500" />
                          <div>
                            <p className="font-medium text-sm">{folder.folderName}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {folder.driveFolderId.length > 30
                                ? `${folder.driveFolderId.slice(0, 30)}...`
                                : folder.driveFolderId}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFolder(folder.id)}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No folders added yet</p>
                  <p className="text-xs mt-1">Add at least one folder for your bot to use</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 'confirm' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle className="w-4 h-4" />
                <span>Review & Create</span>
              </div>

              <div className="space-y-4">
                {/* Bot Info Summary */}
                <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Bot Information
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Type:</span>
                      {(() => {
                        const selectedType = BOT_TYPE_OPTIONS.find(o => o.value === botType);
                        const colors = selectedType ? COLOR_CLASSES[selectedType.color] : COLOR_CLASSES.violet;
                        return (
                          <span className={cn('flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium', colors.bg, colors.text)}>
                            {selectedType?.icon}
                            {selectedType?.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Slack Summary */}
                <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Slack className="w-4 h-4" />
                    Slack Connection
                  </h4>
                  {slackTestStatus === 'success' ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Connected to {slackTeamName}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Not configured - bot won't respond to Slack messages</span>
                    </div>
                  )}
                </div>

                {/* Folders Summary */}
                <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Knowledge Folders ({folders.length})
                  </h4>
                  {folders.length > 0 ? (
                    <div className="space-y-1">
                      {folders.map((folder) => (
                        <div key={folder.id} className="flex items-center gap-2 text-sm">
                          <Check className="w-3 h-3 text-green-500" />
                          <span>{folder.folderName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No folders added - you can add them later
                    </p>
                  )}
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
                          {errorDetails.code === 'DUPLICATE_BOT_TOKEN' ? 'Slack Token Already In Use' : 'Unable to Create Bot'}
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-border/50 bg-secondary/30">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={!canGoBack || isPending}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>

            {currentStep === 'confirm' ? (
              <Button
                onClick={handleCreate}
                disabled={isPending || !isBasicValid}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isAddingFolders ? 'Adding Folders...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Bot
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={goNext}
                disabled={
                  (currentStep === 'basic' && !isBasicValid) ||
                  (currentStep === 'slack' && !canProceedFromSlack && slackBotToken !== '' && slackAppToken !== '')
                }
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Drive Folder Picker Modal */}
      <DriveFolderPicker
        isOpen={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelect={handleFolderPickerSelect}
        selectedFolders={folders.map(f => ({ id: f.driveFolderId, name: f.folderName }))}
        maxSelections={10}
      />
    </div>
  );
}
