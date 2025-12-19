'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  Save,
  ExternalLink,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
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
    botName: 'VillaBot',
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

  // Update local state when config loads
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
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAI = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ key: 'ai', value: aiSettings });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSync = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ key: 'sync', value: syncSettings });
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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your VillaBot AI assistant
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Basic configuration for your bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="botName">Bot Name</Label>
                <Input
                  id="botName"
                  value={generalSettings.botName}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      botName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={generalSettings.timezone}
                  onChange={(e) =>
                    setGeneralSettings({
                      ...generalSettings,
                      timezone: e.target.value,
                    })
                  }
                />
              </div>
              <Button onClick={handleSaveGeneral} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>
                Customize how the AI generates responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={aiSettings.model}
                  onChange={(e) =>
                    setAiSettings({ ...aiSettings, model: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Gemini model to use for responses
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="temperature">
                  Temperature: {aiSettings.temperature}
                </Label>
                <Input
                  id="temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiSettings.temperature}
                  onChange={(e) =>
                    setAiSettings({
                      ...aiSettings,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Lower = more focused, Higher = more creative
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxLength">Max Response Length</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={aiSettings.maxResponseLength}
                  onChange={(e) =>
                    setAiSettings({
                      ...aiSettings,
                      maxResponseLength: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <Button onClick={handleSaveAI} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          {/* Google Drive */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Google Drive
                {authStatus?.google.connected ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not Connected</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Connect Google Drive to sync SOPs and documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {authStatus?.google.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-5 w-5" />
                    <span>
                      Connected since{' '}
                      {authStatus.google.connectedAt
                        ? new Date(
                            authStatus.google.connectedAt
                          ).toLocaleDateString()
                        : 'Unknown'}
                    </span>
                  </div>
                  <Button variant="destructive" onClick={handleDisconnectGoogle}>
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button onClick={handleConnectGoogle}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Connect Google Drive
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Slack Status */}
          <Card>
            <CardHeader>
              <CardTitle>Slack</CardTitle>
              <CardDescription>
                Slack bot connection status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Slack credentials are configured via environment variables.
                Check the API server logs to verify connection status.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Settings */}
        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
              <CardDescription>
                Configure how often to sync with external sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="pollInterval">
                  Drive Poll Interval (minutes)
                </Label>
                <Input
                  id="pollInterval"
                  type="number"
                  value={syncSettings.drivePollIntervalMs / 60000}
                  onChange={(e) =>
                    setSyncSettings({
                      ...syncSettings,
                      drivePollIntervalMs: parseInt(e.target.value) * 60000,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  How often to check Google Drive for changes
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scrapeSchedule">Website Scrape Schedule</Label>
                <Input
                  id="scrapeSchedule"
                  value={syncSettings.websiteScrapeSchedule}
                  onChange={(e) =>
                    setSyncSettings({
                      ...syncSettings,
                      websiteScrapeSchedule: e.target.value,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Cron expression for website scraping (default: weekly on
                  Sunday)
                </p>
              </div>
              <Button onClick={handleSaveSync} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
