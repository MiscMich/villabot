'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Save,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Unlink,
  Settings,
  Cloud,
  Sparkles,
  User,
  LogOut,
  Mail,
  Shield,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, profile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // User display info
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || 'No email';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Sign out failed',
        description: error instanceof Error ? error.message : 'An error occurred while signing out.',
        variant: 'destructive',
      });
    } finally {
      setSigningOut(false);
    }
  };

  // Wait for workspace context before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const {
    data: config,
    isLoading: isConfigLoading,
    isError: configError,
    error: configErrorData,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['config', workspace?.id],
    queryFn: api.getConfig,
    enabled: !!workspace?.id,
  });

  const { data: authStatus } = useQuery({
    queryKey: ['authStatus', workspace?.id],
    queryFn: api.getAuthStatus,
    enabled: !!workspace?.id,
  });

  // Combined loading state
  const configLoading = isWorkspaceLoading || isConfigLoading;

  const [generalSettings, setGeneralSettings] = useState({
    timezone: 'America/Los_Angeles',
    weeklyDigest: false,
  });

  useEffect(() => {
    if (config?.config) {
      const general = config.config.general as { timezone?: string; weeklyDigest?: boolean } | undefined;
      if (general) {
        setGeneralSettings(prev => ({
          ...prev,
          timezone: general.timezone || prev.timezone,
          weeklyDigest: general.weeklyDigest || prev.weeklyDigest,
        }));
      }
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.updateConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ key: 'general', value: generalSettings });
      toast({
        title: 'Settings saved',
        description: 'General settings have been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'An error occurred while saving settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const { authUrl } = await api.getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to get auth URL', error);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (confirm('Disconnect Google Drive? This will stop syncing documents.')) {
      await api.disconnectGoogle();
      queryClient.invalidateQueries({ queryKey: ['authStatus'] });
    }
  };

  if (configError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-violet-500" />
            <h1 className="text-4xl font-display font-bold">Settings</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Configure your workspace and integrations
          </p>
        </div>
        <div className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load settings</h2>
              <p className="text-muted-foreground max-w-md">
                {configErrorData instanceof Error ? configErrorData.message : 'An error occurred while loading settings. Please try again.'}
              </p>
            </div>
            <Button
              onClick={() => refetchConfig()}
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

  if (configLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="h-96 bg-muted rounded-xl shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-violet-500" />
          <h1 className="text-4xl font-display font-bold">Settings</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Configure your AI knowledge assistant
        </p>
      </div>

      <Tabs defaultValue="account" className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="account" className="data-[state=active]:bg-background">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="general" className="data-[state=active]:bg-background">
            <Settings className="h-4 w-4 mr-2" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-background">
            <LinkIcon className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Account Settings */}
        <TabsContent value="account" className="mt-6 space-y-6">
          {/* User Profile Card */}
          <div className="glass-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                  <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Your Account</h2>
                  <p className="text-sm text-muted-foreground">Manage your personal account settings</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* User Avatar and Info */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border/50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-600 shadow-lg">
                  <span className="text-2xl font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate">{displayName}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm truncate">{displayEmail}</span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Authentication</p>
                      <p className="text-sm text-muted-foreground">Signed in with email</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Active
                  </span>
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="hover:border-red-500/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Sign out of your account on this device
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Workspace Settings */}
        <TabsContent value="general" className="mt-6">
          <div className="glass-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-subtle">
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Workspace Settings</h2>
                  <p className="text-sm text-muted-foreground">Configure your workspace preferences</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
                <Input
                  id="timezone"
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="border-border/50 focus:border-violet-500/50 focus:ring-violet-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  Used for scheduling, analytics, and timestamps
                </p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div>
                  <p className="font-medium">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary of bot activity</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generalSettings.weeklyDigest}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, weeklyDigest: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                </label>
              </div>
              <Button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="mt-6 space-y-6">
          {/* Google Drive */}
          <div className="glass-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
                    <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold">Google Drive</h2>
                    <p className="text-sm text-muted-foreground">Sync SOPs and documentation</p>
                  </div>
                </div>
                {authStatus?.google.connected ? (
                  <span className="flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                    <XCircle className="h-4 w-4" />
                    Not Connected
                  </span>
                )}
              </div>
            </div>
            <div className="p-6">
              {authStatus?.google.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">Connected to Google Drive</p>
                      <p className="text-sm text-green-600 dark:text-green-500">
                        Since {authStatus.google.connectedAt ? new Date(authStatus.google.connectedAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDisconnectGoogle}
                    className="hover:border-red-500/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Connect your Google Drive to automatically sync SOPs, guides, and documentation.
                  </p>
                  <Button
                    onClick={handleConnectGoogle}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Connect Google Drive
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Sources Info */}
          <div className="glass-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Knowledge Sources</h2>
                  <p className="text-sm text-muted-foreground">Configure what your bots know</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Each bot has its own knowledge base. Manage Drive folders and website sources in the Bots page.
                </p>
                <a
                  href="/bots"
                  className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Go to Bots
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
