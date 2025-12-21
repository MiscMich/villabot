'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  Cpu,
  Cloud,
  RefreshCw,
  Slack,
  Sparkles,
  Sliders,
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });

  const { data: authStatus } = useQuery({
    queryKey: ['authStatus'],
    queryFn: api.getAuthStatus,
  });

  const [generalSettings, setGeneralSettings] = useState({
    botName: 'Cluebase',
    timezone: 'America/Los_Angeles',
  });

  const [aiSettings, setAiSettings] = useState({
    model: 'gemini-1.5-flash',
    temperature: 0.3,
    maxResponseLength: 2000,
  });

  const [syncSettings, setSyncSettings] = useState({
    drivePollIntervalMs: 300000,
    websiteScrapeSchedule: '0 0 * * 0',
  });

  useEffect(() => {
    if (config?.config) {
      if (config.config.general) {
        setGeneralSettings(config.config.general as typeof generalSettings);
      }
      if (config.config.ai) {
        setAiSettings(config.config.ai as typeof aiSettings);
      }
      if (config.config.sync) {
        setSyncSettings(config.config.sync as typeof syncSettings);
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

  const handleSaveAI = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ key: 'ai', value: aiSettings });
      toast({
        title: 'Settings saved',
        description: 'AI settings have been updated successfully.',
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

  const handleSaveSync = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ key: 'sync', value: syncSettings });
      toast({
        title: 'Settings saved',
        description: 'Sync settings have been updated successfully.',
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
          <Settings className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Settings</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Configure your AI knowledge assistant
        </p>
      </div>

      <Tabs defaultValue="general" className="opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-background">
            <Sliders className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-background">
            <Cpu className="h-4 w-4 mr-2" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-background">
            <LinkIcon className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-background">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6">
          <div className="premium-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-subtle">
                  <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">General Settings</h2>
                  <p className="text-sm text-muted-foreground">Basic configuration for your bot</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="botName" className="text-sm font-medium">Bot Name</Label>
                <Input
                  id="botName"
                  value={generalSettings.botName}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, botName: e.target.value })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  The name your bot will use when responding
                </p>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="timezone" className="text-sm font-medium">Timezone</Label>
                <Input
                  id="timezone"
                  value={generalSettings.timezone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  Used for scheduling and timestamps
                </p>
              </div>
              <Button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="mt-6">
          <div className="premium-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
                  <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">AI Configuration</h2>
                  <p className="text-sm text-muted-foreground">Customize how the AI generates responses</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="model" className="text-sm font-medium">Model</Label>
                <Input
                  id="model"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  Gemini model to use for responses
                </p>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature" className="text-sm font-medium">Temperature</Label>
                  <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">{aiSettings.temperature}</span>
                </div>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiSettings.temperature}
                  onChange={(e) => setAiSettings({ ...aiSettings, temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>More focused</span>
                  <span>More creative</span>
                </div>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="maxLength" className="text-sm font-medium">Max Response Length</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={aiSettings.maxResponseLength}
                  onChange={(e) => setAiSettings({ ...aiSettings, maxResponseLength: parseInt(e.target.value) })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum characters in bot responses
                </p>
              </div>
              <Button
                onClick={handleSaveAI}
                disabled={saving}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
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
          <div className="premium-card">
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

          {/* Slack Status */}
          <div className="premium-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Slack className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Slack</h2>
                  <p className="text-sm text-muted-foreground">Bot connection status</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  Slack credentials are configured via environment variables.
                  Check the API server logs to verify connection status.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Sync Settings */}
        <TabsContent value="sync" className="mt-6">
          <div className="premium-card">
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                  <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Sync Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure sync frequency and schedules</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="pollInterval" className="text-sm font-medium">Drive Poll Interval (minutes)</Label>
                <Input
                  id="pollInterval"
                  type="number"
                  value={syncSettings.drivePollIntervalMs / 60000}
                  onChange={(e) => setSyncSettings({ ...syncSettings, drivePollIntervalMs: parseInt(e.target.value) * 60000 })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20"
                />
                <p className="text-sm text-muted-foreground">
                  How often to check Google Drive for changes
                </p>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="scrapeSchedule" className="text-sm font-medium">Website Scrape Schedule</Label>
                <Input
                  id="scrapeSchedule"
                  value={syncSettings.websiteScrapeSchedule}
                  onChange={(e) => setSyncSettings({ ...syncSettings, websiteScrapeSchedule: e.target.value })}
                  className="border-border/50 focus:border-amber-500/50 focus:ring-amber-500/20 font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Cron expression for website scraping (default: weekly on Sunday at midnight)
                </p>
              </div>
              <Button
                onClick={handleSaveSync}
                disabled={saving}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
