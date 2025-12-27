'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRequireAuth } from '@/contexts/AuthContext';

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
import {
  Sparkles,
  MessageSquare,
  FolderOpen,
  Globe,
  Bot,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  Info,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  HelpCircle,
  Zap,
  Shield,
  FileText,
  Users,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

// Bot type configuration matching shared/constants.ts
type BotType = 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';

interface BotTypeInfo {
  value: BotType;
  label: string;
  description: string;
  categories: string[];
  color: string;
}

const BOT_TYPE_INFO: BotTypeInfo[] = [
  {
    value: 'operations',
    label: 'Operations',
    description: 'SOPs, procedures, and workflow inquiries',
    categories: ['shared', 'operations'],
    color: 'blue',
  },
  {
    value: 'marketing',
    label: 'Marketing',
    description: 'Brand guidelines and campaign info',
    categories: ['shared', 'marketing'],
    color: 'pink',
  },
  {
    value: 'sales',
    label: 'Sales',
    description: 'Product info, pricing, and sales materials',
    categories: ['shared', 'sales'],
    color: 'green',
  },
  {
    value: 'hr',
    label: 'HR & People',
    description: 'Policies, benefits, and employee resources',
    categories: ['shared', 'hr'],
    color: 'purple',
  },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Documentation, APIs, and dev guidelines',
    categories: ['shared', 'technical'],
    color: 'orange',
  },
  {
    value: 'general',
    label: 'General',
    description: 'Cross-functional company knowledge',
    categories: ['shared', 'operations', 'marketing', 'sales', 'technical'],
    color: 'violet',
  },
];

interface SetupConfig {
  workspace: {
    name: string;
    slug: string;
  };
  slack: {
    botToken: string;
    appToken: string;
    signingSecret: string;
    connected: boolean;
    tested: boolean;
  };
  googleDrive: {
    authenticated: boolean;
    selectedFolders: { id: string; name: string }[];
  };
  knowledgeSources: {
    driveEnabled: boolean;
    websiteEnabled: boolean;
    websiteUrl: string;
    maxPages: number;
  };
  bot: {
    name: string;
    slug: string;
    botType: BotType;
    personality: string;
    instructions: string;
  };
}

interface StepConfig {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

// ============================================
// STEP DEFINITIONS
// ============================================

const STEPS: StepConfig[] = [
  {
    id: 0,
    name: 'Welcome',
    title: 'Welcome to Cluebase AI',
    description: 'Let\'s set up your AI-powered knowledge assistant',
    icon: Sparkles,
  },
  {
    id: 1,
    name: 'Workspace',
    title: 'Name Your Workspace',
    description: 'Choose a name for your team workspace',
    icon: Building2,
  },
  {
    id: 2,
    name: 'Slack App',
    title: 'Connect Slack',
    description: 'Create and connect your Slack app',
    icon: MessageSquare,
  },
  {
    id: 3,
    name: 'Google Drive',
    title: 'Connect Google Drive',
    description: 'Authenticate with Google Drive',
    icon: FolderOpen,
  },
  {
    id: 4,
    name: 'Knowledge Sources',
    title: 'Choose Knowledge Sources',
    description: 'Select folders and add website URLs',
    icon: Globe,
  },
  {
    id: 5,
    name: 'First Bot',
    title: 'Create Your First Bot',
    description: 'Customize your AI assistant',
    icon: Bot,
  },
  {
    id: 6,
    name: 'Complete',
    title: 'Ready to Launch',
    description: 'Review and start your assistant',
    icon: Rocket,
  },
];

// ============================================
// UTILITY COMPONENTS
// ============================================

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'p-2 rounded-lg transition-all duration-200',
        'hover:bg-secondary text-muted-foreground hover:text-foreground',
        copied && 'text-success',
        className
      )}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-4 py-3 pr-20 rounded-xl border border-border/50 bg-secondary/50',
          'font-mono text-sm placeholder:text-muted-foreground/60',
          'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50',
          'transition-all duration-200',
          className
        )}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="p-2 rounded-lg hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        {value && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function TestConnectionButton({
  onTest,
  status,
  label,
}: {
  onTest: () => Promise<void>;
  status: 'idle' | 'testing' | 'success' | 'error';
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onTest}
      disabled={status === 'testing'}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm',
        'transition-all duration-200',
        status === 'idle' && 'bg-secondary hover:bg-secondary/80 text-foreground',
        status === 'testing' && 'bg-violet-500/10 text-purple-600 dark:text-violet-400',
        status === 'success' && 'bg-success/10 text-success',
        status === 'error' && 'bg-destructive/10 text-destructive'
      )}
    >
      {status === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
      {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
      {status === 'error' && <XCircle className="w-4 h-4" />}
      {status === 'idle' && <RefreshCw className="w-4 h-4" />}
      {status === 'testing' ? 'Testing...' : status === 'success' ? 'Connected!' : status === 'error' ? 'Failed' : label}
    </button>
  );
}

function InfoModal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border bg-card/95 backdrop-blur-sm">
          <h3 className="text-xl font-semibold font-geist">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-secondary/30 border border-border/50 hover:border-violet-500/30 hover:bg-secondary/50 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400/20 to-purple-600/20 flex items-center justify-center group-hover:from-violet-400/30 group-hover:to-purple-600/30 transition-colors">
          <Icon className="w-6 h-6 text-purple-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP COMPONENTS
// ============================================

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-400 to-purple-600 shadow-glow mx-auto"
        >
          <Sparkles className="w-12 h-12 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-5xl font-bold font-display tracking-tight"
        >
          Welcome to <span className="text-gradient">Cluebase AI</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-xl mx-auto"
        >
          Your AI-powered Slack assistant that learns from your company&apos;s knowledge base and helps your team find answers instantly.
        </motion.p>
      </div>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid md:grid-cols-2 gap-4"
      >
        <FeatureCard
          icon={Sparkles}
          title="Instant Setup"
          description="Connect your integrations and start in minutes"
        />
        <FeatureCard
          icon={FileText}
          title="Multi-Source Knowledge"
          description="Ingest from Google Drive, websites, and more"
        />
        <FeatureCard
          icon={Users}
          title="Multi-Bot Support"
          description="Create specialized bots for different teams"
        />
        <FeatureCard
          icon={Shield}
          title="SaaS Platform"
          description="Managed infrastructure with automatic scaling"
        />
      </motion.div>

      {/* Setup Time */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Zap className="w-4 h-4 text-violet-500" />
        <span>Setup takes about 5-10 minutes</span>
      </motion.div>

      {/* Start Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex justify-center"
      >
        <button
          onClick={onNext}
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-lg shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-[1.02]"
        >
          Get Started
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </div>
  );
}

function WorkspaceStep({
  config,
  onUpdate,
}: {
  config: SetupConfig['workspace'];
  onUpdate: (data: Partial<SetupConfig['workspace']>) => void;
}) {
  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-purple-700 dark:text-purple-300">SaaS Platform</p>
            <p className="text-purple-600/80 dark:text-violet-400/80">
              Cluebase AI is a fully managed platform. Infrastructure, AI, and database are provided and managed for you.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Workspace Name
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => {
              onUpdate({ name: e.target.value, slug: generateSlug(e.target.value) });
            }}
            placeholder="Acme Inc"
            className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
          <p className="text-xs text-muted-foreground">
            The name of your organization or team
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Workspace Slug
          </label>
          <input
            type="text"
            value={config.slug}
            onChange={(e) => onUpdate({ slug: e.target.value })}
            placeholder="acme-inc"
            className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
          <p className="text-xs text-muted-foreground">
            URL-friendly identifier (auto-generated from name)
          </p>
        </div>
      </div>
    </div>
  );
}

function SlackStep({
  config,
  onUpdate,
}: {
  config: SetupConfig['slack'];
  onUpdate: (data: Partial<SetupConfig['slack']>) => void;
}) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);

  const handleTest = async () => {
    setTestStatus('testing');
    try {
      const response = await fetch(`${API_BASE}/api/setup/test-slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.botToken,
          appToken: config.appToken,
          signingSecret: config.signingSecret,
        }),
      });
      const result = await response.json();
      const success = result.success === true;
      setTestStatus(success ? 'success' : 'error');
      onUpdate({ connected: success, tested: true });
    } catch {
      setTestStatus('error');
      onUpdate({ connected: false, tested: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace-specific messaging */}
      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-purple-700 dark:text-purple-300">Your Own Slack App</p>
            <p className="text-purple-600/80 dark:text-violet-400/80">
              Each workspace creates their own Slack app. Your bot credentials are private to your workspace and give you full control over your Slack integration.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowHelp(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
        How to create a Slack App
      </button>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Bot Token (xoxb-...)
          </label>
          <PasswordInput
            value={config.botToken}
            onChange={(value) => onUpdate({ botToken: value })}
            placeholder="xoxb-1234567890-1234567890123-..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            App-Level Token (xapp-...)
          </label>
          <PasswordInput
            value={config.appToken}
            onChange={(value) => onUpdate({ appToken: value })}
            placeholder="xapp-1-A1234567890-..."
          />
          <p className="text-xs text-muted-foreground">
            Required for Socket Mode. Create in App Settings → Basic Information → App-Level Tokens
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Signing Secret
          </label>
          <PasswordInput
            value={config.signingSecret}
            onChange={(value) => onUpdate({ signingSecret: value })}
            placeholder="abc123def456..."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TestConnectionButton
          onTest={handleTest}
          status={testStatus}
          label="Test Slack Connection"
        />
        {testStatus === 'success' && (
          <span className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Connected to Slack!
          </span>
        )}
      </div>

      <InfoModal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Creating a Slack App">
        <div className="space-y-6 text-sm">
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">1. Create a New App</h4>
            <p className="text-muted-foreground">
              Go to{' '}
              <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-1">
                api.slack.com/apps <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and click &quot;Create New App&quot; → &quot;From scratch&quot;. Give it a name (e.g., &quot;Cluebase AI&quot;) and select your workspace.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">2. Enable Socket Mode</h4>
            <p className="text-muted-foreground">
              Go to &quot;Socket Mode&quot; in the sidebar and toggle it on. Create an App-Level Token with <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">connections:write</span> scope. Copy this token - it&apos;s your App-Level Token (xapp-...).
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">3. Add Bot Token Scopes</h4>
            <p className="text-muted-foreground">
              Under &quot;OAuth & Permissions&quot;, add these Bot Token Scopes:
            </p>
            <div className="flex flex-wrap gap-2">
              {['app_mentions:read', 'channels:history', 'chat:write', 'reactions:read', 'users:read', 'channels:read', 'groups:history', 'groups:read', 'im:history', 'im:read', 'im:write', 'mpim:history', 'mpim:read'].map((scope) => (
                <span key={scope} className="px-2 py-1 bg-secondary rounded-md font-mono text-xs">
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">4. Enable Event Subscriptions</h4>
            <p className="text-muted-foreground">
              Go to &quot;Event Subscriptions&quot; and turn it on. Under &quot;Subscribe to bot events&quot;, add:
            </p>
            <div className="flex flex-wrap gap-2">
              {['app_mention', 'message.channels', 'message.groups', 'message.im', 'message.mpim'].map((event) => (
                <span key={event} className="px-2 py-1 bg-secondary rounded-md font-mono text-xs">
                  {event}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground text-success">5. Install to Workspace (Required!)</h4>
            <p className="text-muted-foreground">
              <strong className="text-foreground">This step is essential.</strong> Click &quot;Install to Workspace&quot; at the top of the &quot;OAuth & Permissions&quot; page. Authorize the app, then copy the <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">Bot User OAuth Token</span> (starts with xoxb-).
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">6. Get Signing Secret</h4>
            <p className="text-muted-foreground">
              Find the Signing Secret in &quot;Basic Information&quot; under App Credentials.
            </p>
          </div>

          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-amber-600 dark:text-amber-400">After Setup: Invite Your Bot!</p>
                <p className="text-amber-600/80 dark:text-amber-400/80 text-sm">
                  Once setup is complete, you must invite the bot to channels. In Slack, go to any channel and type:
                  <code className="block mt-2 px-3 py-2 bg-secondary rounded font-mono text-sm">/invite @YourBotName</code>
                  The bot will only respond in channels it&apos;s been invited to.
                </p>
              </div>
            </div>
          </div>
        </div>
      </InfoModal>
    </div>
  );
}

function GoogleDriveStep({
  config,
  onUpdate: _onUpdate,
  fullConfig,
  currentStep,
}: {
  config: SetupConfig['googleDrive'];
  onUpdate: (data: Partial<SetupConfig['googleDrive']>) => void;
  fullConfig: SetupConfig;
  currentStep: number;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/setup/google-auth-url`);
      const result = await response.json();
      if (result.authUrl) {
        // Save wizard state before OAuth redirect
        sessionStorage.setItem('setup_wizard_config', JSON.stringify(fullConfig));
        sessionStorage.setItem('setup_wizard_step', String(currentStep));
        sessionStorage.setItem('setup_pending_google_auth', 'true');
        window.location.href = result.authUrl;
      } else {
        setError('Failed to get authentication URL');
        setIsConnecting(false);
      }
    } catch {
      setError('Failed to connect to server');
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!config.authenticated ? (
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-secondary/50 flex items-center justify-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Connect Google Drive</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Allow Cluebase AI to access your Google Drive to ingest documents and SOPs into the knowledge base.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              {error}
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-border shadow-sm hover:shadow-md transition-all font-medium"
          >
            {isConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {isConnecting ? 'Connecting...' : 'Connect with Google'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-success font-medium">Google Drive connected!</p>
              <p className="text-sm text-muted-foreground">
                Your Google Drive is now linked to this workspace.
              </p>
            </div>
          </div>

          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-purple-700 dark:text-purple-300">Private to Your Workspace</p>
                <p className="text-purple-600/80 dark:text-violet-400/80">
                  Your Google Drive connection and documents are completely private. Other Cluebase customers cannot access your files.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Documents synced from Google Drive will be organized by category and accessible to your bots.
      </p>
    </div>
  );
}

function KnowledgeSourcesStep({
  config,
  onUpdate,
  driveConfig,
}: {
  config: SetupConfig['knowledgeSources'];
  onUpdate: (data: Partial<SetupConfig['knowledgeSources']>) => void;
  driveConfig: SetupConfig['googleDrive'];
}) {
  return (
    <div className="space-y-6">
      {/* Google Drive Status */}
      {driveConfig.authenticated && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="text-success font-medium">Google Drive Connected</p>
              <p className="text-sm text-muted-foreground">
                Your workspace can now sync documents from Google Drive.
              </p>
            </div>
          </div>

          <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-purple-700 dark:text-purple-300">Per-Bot Document Access</p>
                <p className="text-purple-600/80 dark:text-violet-400/80">
                  Each bot can be configured to access specific document categories. You&apos;ll set this up when creating bots in the Bots dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Website Scraping */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="websiteEnabled"
            checked={config.websiteEnabled}
            onChange={(e) => onUpdate({ websiteEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-border text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
          />
          <label htmlFor="websiteEnabled" className="text-sm font-medium text-foreground cursor-pointer">
            Add Website Content
          </label>
        </div>

        {config.websiteEnabled && (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Website URL
              </label>
              <input
                type="url"
                value={config.websiteUrl}
                onChange={(e) => onUpdate({ websiteUrl: e.target.value })}
                placeholder="https://yourcompany.com"
                className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
              />
              <p className="text-xs text-muted-foreground">
                Cluebase AI will crawl and index your website content
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Maximum Pages to Scrape
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={50}
                  value={config.maxPages}
                  onChange={(e) => onUpdate({ maxPages: parseInt(e.target.value) })}
                  className="flex-1 accent-violet-500"
                />
                <span className="w-16 text-right font-mono text-sm">{config.maxPages}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Higher values provide more coverage but take longer to process
              </p>
            </div>
          </>
        )}
      </div>

      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-purple-700 dark:text-purple-300">Optional Step</p>
            <p className="text-purple-600/80 dark:text-violet-400/80">
              You can skip knowledge source selection and add them later from the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FirstBotStep({
  config,
  onUpdate,
}: {
  config: SetupConfig['bot'];
  onUpdate: (data: Partial<SetupConfig['bot']>) => void;
}) {
  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const selectedBotType = BOT_TYPE_INFO.find(t => t.value === config.botType) ?? BOT_TYPE_INFO[5];

  const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/50', text: 'text-blue-600 dark:text-blue-400' },
    pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/50', text: 'text-pink-600 dark:text-pink-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/50', text: 'text-orange-600 dark:text-orange-400' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/50', text: 'text-violet-600 dark:text-violet-400' },
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Bot Name
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => {
              onUpdate({ name: e.target.value, slug: generateSlug(e.target.value) });
            }}
            placeholder="Cluebase"
            className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Slug (URL-friendly)
          </label>
          <input
            type="text"
            value={config.slug}
            onChange={(e) => onUpdate({ slug: e.target.value })}
            placeholder="cluebase"
            className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
        </div>
      </div>

      {/* Bot Type Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          Bot Type
        </label>
        <p className="text-xs text-muted-foreground mb-3">
          Select the department this bot serves. Each type automatically accesses shared company knowledge plus documents relevant to its specialty.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {BOT_TYPE_INFO.map((type) => {
            const isSelected = config.botType === type.value;
            const colors = COLOR_CLASSES[type.color];
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onUpdate({ botType: type.value })}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all',
                  isSelected
                    ? `${colors.border} ${colors.bg} ring-1 ring-offset-0`
                    : 'border-border/50 bg-secondary/30 hover:bg-secondary/50 hover:border-border'
                )}
              >
                <span className={cn('text-sm font-medium', isSelected && colors.text)}>
                  {type.label}
                </span>
                {isSelected && <Check className="w-4 h-4 text-current" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Knowledge Access Info */}
      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-purple-700 dark:text-purple-300">
              {selectedBotType.label} Bot Knowledge Access
            </p>
            <p className="text-purple-600/80 dark:text-violet-400/80">
              This bot will automatically search documents in these categories:
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedBotType.categories.map(cat => (
                <span
                  key={cat}
                  className="px-2 py-0.5 rounded-full text-xs bg-white/50 dark:bg-black/20 text-purple-700 dark:text-purple-300 capitalize"
                >
                  {cat === 'shared' ? 'Company-Wide' : cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Personality
        </label>
        <input
          type="text"
          value={config.personality}
          onChange={(e) => onUpdate({ personality: e.target.value })}
          placeholder="Friendly and professional"
          className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
        />
        <p className="text-xs text-muted-foreground">
          How should the bot communicate? e.g., &quot;Casual and helpful&quot;, &quot;Formal and precise&quot;
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          System Instructions
        </label>
        <textarea
          value={config.instructions}
          onChange={(e) => onUpdate({ instructions: e.target.value })}
          placeholder="You are a helpful AI assistant for this organization. Help team members find information about company procedures, policies, and operations. Always be friendly and cite your sources."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/50 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Custom instructions that define how the bot should behave and respond
        </p>
      </div>

      {/* Channel Assignment Info */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300">Channel Assignment (After Setup)</p>
            <p className="text-amber-600/80 dark:text-amber-400/80">
              After completing setup, you can assign specific Slack channels to this bot from the Bots dashboard. By default, the bot responds in all channels where it&apos;s mentioned.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompleteStep({
  config,
  onLaunch,
  isLaunching,
  error,
}: {
  config: SetupConfig;
  onLaunch: () => void;
  isLaunching: boolean;
  error: string | null;
}) {
  // Knowledge source check: Google Drive OR website with URL
  const hasKnowledgeSource = config.googleDrive.authenticated ||
    (config.knowledgeSources.websiteEnabled && config.knowledgeSources.websiteUrl.length > 0);

  const checks = [
    { label: 'Workspace', passed: config.workspace.name.length > 0, icon: Building2 },
    { label: 'Slack', passed: config.slack.connected, icon: MessageSquare },
    { label: 'Google Drive', passed: config.googleDrive.authenticated, icon: FolderOpen, optional: true },
    { label: 'Bot', passed: config.bot.name.length > 0, icon: Bot },
  ];

  // All required checks must pass, plus at least one knowledge source
  const requiredPassed = checks.filter(c => !c.optional).every(c => c.passed);
  const allPassed = requiredPassed && hasKnowledgeSource;

  // Get bot type info for display
  const selectedBotType = BOT_TYPE_INFO.find(t => t.value === config.bot.botType) ?? BOT_TYPE_INFO[5];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {checks.map((check) => (
          <div
            key={check.label}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl border',
              check.passed
                ? 'bg-success/5 border-success/20'
                : 'bg-secondary/50 border-border/50'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                check.passed ? 'bg-success/10' : 'bg-secondary'
              )}
            >
              <check.icon
                className={cn(
                  'w-5 h-5',
                  check.passed ? 'text-success' : 'text-muted-foreground'
                )}
              />
            </div>
            <div className="flex-1">
              <p className="font-medium">{check.label}</p>
              <p className="text-xs text-muted-foreground">
                {check.passed ? 'Configured' : 'Not configured'}
              </p>
            </div>
            {check.passed ? (
              <CheckCircle2 className="w-5 h-5 text-success" />
            ) : (
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Bot Preview - Enhanced */}
      <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50 space-y-4">
        <h3 className="font-semibold">Your Bot</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-glow">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-semibold">{config.bot.name || 'Cluebase'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-purple-600 dark:text-violet-400 font-medium">
                {selectedBotType.label}
              </span>
              <span className="text-sm text-muted-foreground">{config.bot.personality || 'Friendly and professional'}</span>
            </div>
          </div>
        </div>

        {/* Knowledge Access */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Knowledge Access</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedBotType.categories.map(cat => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-full text-xs bg-violet-500/10 text-purple-600 dark:text-violet-400 capitalize"
              >
                {cat === 'shared' ? 'Company-Wide' : cat}
              </span>
            ))}
          </div>
        </div>

        {/* Channel Status */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Slack Channels</p>
          <p className="text-sm text-foreground">Responds in all channels (configurable after setup)</p>
        </div>
      </div>

      {/* Workspace Info */}
      <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
        <h3 className="font-semibold mb-4">Workspace</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-semibold">{config.workspace.name || 'Unnamed Workspace'}</p>
            <p className="text-sm text-muted-foreground font-mono">{config.workspace.slug || 'no-slug'}</p>
          </div>
        </div>
      </div>

      {/* Launch Button */}
      <div className="text-center space-y-4">
        {!allPassed && (
          <p className="text-sm text-purple-600 dark:text-violet-400">
            Complete all required configurations before launching.
          </p>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <p className="font-medium">Launch failed</p>
            <p className="mt-1 opacity-80">{error}</p>
          </div>
        )}
        <button
          onClick={onLaunch}
          disabled={!allPassed || isLaunching}
          className={cn(
            'inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-semibold text-lg transition-all duration-300',
            allPassed
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-glow hover:shadow-glow-lg hover:scale-[1.02]'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
          )}
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Launching...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              Launch Bot
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN WIZARD COMPONENT
// ============================================

function SetupWizardContent() {
  // Enforce authentication - redirects to signin if not authenticated
  const { session, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [config, setConfig] = useState<SetupConfig>({
    workspace: { name: '', slug: '' },
    slack: { botToken: '', appToken: '', signingSecret: '', connected: false, tested: false },
    googleDrive: { authenticated: false, selectedFolders: [] },
    knowledgeSources: { driveEnabled: true, websiteEnabled: false, websiteUrl: '', maxPages: 200 },
    bot: { name: 'Cluebase', slug: 'cluebase', botType: 'general' as BotType, personality: 'Friendly and professional', instructions: '' },
  });

  // Handle OAuth callback - restore state after Google redirect
  useEffect(() => {
    const googleAuthResult = searchParams.get('google_auth');
    const savedConfig = sessionStorage.getItem('setup_wizard_config');
    const savedStep = sessionStorage.getItem('setup_wizard_step');

    if (googleAuthResult && savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig) as SetupConfig;

        // Restore the saved config
        setConfig({
          ...parsedConfig,
          googleDrive: {
            ...parsedConfig.googleDrive,
            authenticated: googleAuthResult === 'success',
          },
        });

        // Restore to Google Drive step (step 3)
        if (savedStep) {
          setCurrentStep(parseInt(savedStep, 10));
        }

        // Clean up sessionStorage and URL
        sessionStorage.removeItem('setup_wizard_config');
        sessionStorage.removeItem('setup_wizard_step');
        sessionStorage.removeItem('setup_pending_google_auth');

        // Remove query params from URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      } catch (e) {
        console.error('Failed to restore setup wizard state:', e);
      }
    }
  }, [searchParams]);

  const updateConfig = useCallback(
    <K extends keyof SetupConfig>(key: K) =>
      (data: Partial<SetupConfig[K]>) => {
        setConfig((prev) => ({
          ...prev,
          [key]: { ...prev[key], ...data },
        }));
      },
    []
  );

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return config.workspace.name.length > 0 && config.workspace.slug.length > 0;
      case 2:
        return config.slack.connected;
      case 3:
        return true; // Google Drive is optional - can skip
      case 4:
        return true; // Knowledge sources are optional
      case 5:
        return config.bot.name && config.bot.slug;
      case 6:
        return true;
      default:
        return false;
    }
  }, [currentStep, config]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    setLaunchError(null);
    try {
      if (!session?.access_token) {
        setLaunchError('You must be signed in to complete setup. Please sign in and try again.');
        router.push('/auth/signin');
        return;
      }

      const response = await fetch(`${API_BASE}/api/setup/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config: {
            // workspaceId omitted - API will create workspace if needed
            workspace: config.workspace,
            slack: config.slack,
            googleDrive: config.googleDrive,
            website: config.knowledgeSources.websiteEnabled
              ? {
                url: config.knowledgeSources.websiteUrl,
                maxPages: config.knowledgeSources.maxPages,
              }
              : null,
            bot: config.bot,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        setIsComplete(true);
      } else {
        console.error('Setup failed:', result.error);
        setLaunchError(result.error || 'Setup failed. Please try again.');
      }
    } catch (error) {
      console.error('Setup failed:', error);
      setLaunchError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLaunching(false);
    }
  };

  // Show loading while auth is being checked (useRequireAuth handles redirect)
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Completion Animation
  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center space-y-6 max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-success to-emerald-600 shadow-lg mx-auto"
          >
            <Check className="w-16 h-16 text-white" strokeWidth={3} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-bold font-display"
          >
            You&apos;re All Set!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-muted-foreground"
          >
            Your bot is now running and ready to help your team.
          </motion.p>

          {/* Important: Invite bot to channels */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left"
          >
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-600 dark:text-amber-400">Next Step: Invite Your Bot to Channels</p>
                <p className="text-amber-600/80 dark:text-amber-400/80 text-sm">
                  In Slack, go to any channel where you want the bot to respond and type:
                </p>
                <code className="block px-3 py-2 bg-secondary rounded font-mono text-sm text-center">
                  /invite @{config.bot.name || 'YourBotName'}
                </code>
                <p className="text-amber-600/70 dark:text-amber-400/70 text-xs">
                  The bot will only respond in channels it&apos;s been invited to. You can also mention it directly with @{config.bot.name || 'YourBotName'}.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.a
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
            <ChevronRight className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with Progress */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => index < currentStep && setCurrentStep(index)}
                    disabled={index > currentStep}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200',
                      isActive && 'bg-violet-500/10',
                      index > currentStep && 'opacity-40 cursor-not-allowed',
                      index < currentStep && 'cursor-pointer hover:bg-secondary'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                        isActive && 'bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-glow',
                        isCompleted && 'bg-success text-white',
                        !isActive && !isCompleted && 'bg-secondary text-muted-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'hidden md:block text-sm font-medium',
                        isActive && 'text-foreground',
                        !isActive && 'text-muted-foreground'
                      )}
                    >
                      {step.name}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'w-8 lg:w-12 h-0.5 mx-1',
                        index < currentStep ? 'bg-success' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step Header */}
              {currentStep > 0 && (
                <div className="mb-8">
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold font-display mb-2"
                  >
                    {STEPS[currentStep].title}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-muted-foreground"
                  >
                    {STEPS[currentStep].description}
                  </motion.p>
                </div>
              )}

              {/* Step Content */}
              <div className="bg-card/50 rounded-2xl border border-border/50 p-6 md:p-8">
                {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
                {currentStep === 1 && (
                  <WorkspaceStep config={config.workspace} onUpdate={updateConfig('workspace')} />
                )}
                {currentStep === 2 && (
                  <SlackStep config={config.slack} onUpdate={updateConfig('slack')} />
                )}
                {currentStep === 3 && (
                  <GoogleDriveStep
                    config={config.googleDrive}
                    onUpdate={updateConfig('googleDrive')}
                    fullConfig={config}
                    currentStep={currentStep}
                  />
                )}
                {currentStep === 4 && (
                  <KnowledgeSourcesStep
                    config={config.knowledgeSources}
                    onUpdate={updateConfig('knowledgeSources')}
                    driveConfig={config.googleDrive}
                  />
                )}
                {currentStep === 5 && (
                  <FirstBotStep config={config.bot} onUpdate={updateConfig('bot')} />
                )}
                {currentStep === 6 && (
                  <CompleteStep config={config} onLaunch={handleLaunch} isLaunching={isLaunching} error={launchError} />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Navigation */}
      {currentStep > 0 && currentStep < STEPS.length - 1 && (
        <footer className="sticky bottom-0 bg-background/80 backdrop-blur-xl border-t border-border/50">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </div>

            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all',
                canProceed()
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-secondary text-muted-foreground cursor-not-allowed'
              )}
            >
              {currentStep === STEPS.length - 2 ? 'Review' : 'Continue'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

// ============================================
// PAGE EXPORT WITH SUSPENSE BOUNDARY
// ============================================

function SetupWizardFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground">Loading setup wizard...</p>
      </div>
    </div>
  );
}

export default function SetupWizard() {
  return (
    <Suspense fallback={<SetupWizardFallback />}>
      <SetupWizardContent />
    </Suspense>
  );
}
