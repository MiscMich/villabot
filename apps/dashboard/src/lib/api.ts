/**
 * API client for Cluebase AI Dashboard
 * Handles authenticated requests with workspace context
 */

import { getSupabase, isSupabaseConfigured } from './supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Workspace ID storage key (synced with WorkspaceContext)
const WORKSPACE_STORAGE_KEY = 'cluebase_current_workspace';

/**
 * Get current workspace ID from localStorage
 */
function getCurrentWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

/**
 * Get access token from Supabase session
 */
async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Core fetch function with auth and workspace headers
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const [accessToken, workspaceId] = await Promise.all([
    getAccessToken(),
    Promise.resolve(getCurrentWorkspaceId()),
  ]);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add auth header if available
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Add workspace header if available
  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));

    // Handle specific error codes
    if (res.status === 401) {
      // Unauthorized - session may have expired
      // Don't hard redirect here - let the auth context handle session refresh
      // A hard redirect causes loops when middleware and client disagree on auth state
      console.warn('API returned 401 - session may need refresh');

      // Try to refresh the session
      if (typeof window !== 'undefined' && isSupabaseConfigured()) {
        try {
          const supabase = getSupabase();
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Failed to refresh session:', refreshError.message);
          }
        } catch (e) {
          console.error('Session refresh error:', e);
        }
      }
    }

    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

/**
 * Fetch without auth (for public endpoints)
 */
async function fetchPublic<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Health & Status
export const api = {
  // Health (public)
  getHealth: () => fetchPublic<{
    status: string;
    uptime: number;
    services: Record<string, boolean>;
  }>('/health'),

  // Setup (public - for initial setup wizard)
  // Supports optional workspaceId for checking setup status of specific workspace
  getSetupStatus: (workspaceId?: string) => {
    const url = workspaceId
      ? `/api/setup/status?workspaceId=${encodeURIComponent(workspaceId)}`
      : '/api/setup/status';
    return fetchPublic<{
      completed: boolean;
      completedAt: string | null;
      steps: {
        workspace: boolean;
        slack: boolean;
        googleDrive: boolean;
        bot: boolean;
      };
    }>(url);
  },

  testDatabase: (url: string, serviceKey: string) =>
    fetchPublic<{ success: boolean; message?: string; error?: string }>('/api/setup/test-database', {
      method: 'POST',
      body: JSON.stringify({ url, serviceKey }),
    }),

  testAI: (geminiKey: string) =>
    fetchPublic<{ success: boolean; message?: string; error?: string }>('/api/setup/test-ai', {
      method: 'POST',
      body: JSON.stringify({ geminiKey }),
    }),

  testSlack: (botToken: string, appToken: string) =>
    fetchPublic<{ success: boolean; message?: string; workspace?: string; botUser?: string; error?: string }>('/api/setup/test-slack', {
      method: 'POST',
      body: JSON.stringify({ botToken, appToken }),
    }),

  getGoogleSetupAuthUrl: () =>
    fetchPublic<{ authUrl: string }>('/api/setup/google-auth-url'),

  completeSetup: (config: {
    database: { url: string; serviceKey: string };
    ai: { geminiKey: string };
    slack: { botToken: string; appToken: string; signingSecret?: string };
    googleDrive?: { authenticated: boolean; selectedFolders?: string[] };
    website?: { url: string; maxPages?: number };
    bot: { name: string; slug: string; personality?: string; instructions?: string };
    workspaceId: string;
  }) =>
    fetchPublic<{ success: boolean; message: string; bot?: { id: string; name: string } }>('/api/setup/complete', {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),

  // Config (authenticated)
  getConfig: () => fetchApi<{ config: Record<string, unknown> }>('/api/config'),
  updateConfig: (key: string, value: unknown) =>
    fetchApi(`/api/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // Documents
  getDocuments: (params?: { category?: string }) => fetchApi<{
    documents: Array<{
      id: string;
      title: string;
      file_type: string;
      source_type: string;
      source_url?: string;
      last_modified: string;
      last_synced: string;
      is_active: boolean;
      category: 'shared' | 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'custom' | null;
      bot_id?: string | null;
      drive_folder_id?: string | null;
      tags?: string[] | null;
    }>;
    total: number;
  }>(`/api/documents${params?.category ? `?category=${params.category}` : ''}`),

  getDocument: (id: string) => fetchApi<{
    id: string;
    title: string;
    chunks: Array<{ id: string; content: string; chunk_index: number }>;
    chunk_count: number;
  }>(`/api/documents/${id}`),

  toggleDocument: (id: string, isActive: boolean) =>
    fetchApi(`/api/documents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),

  updateDocument: (id: string, data: { bot_id?: string | null; category?: string }) =>
    fetchApi<{ document: { id: string; bot_id: string | null; category: string } }>(
      `/api/documents/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  deleteDocument: (id: string) =>
    fetchApi(`/api/documents/${id}`, { method: 'DELETE' }),

  getSyncStatus: () => fetchApi<{
    lastSync: string | null;
    documentCount: number;
    chunkCount: number;
    driveConnected: boolean;
  }>('/api/documents/sync/status'),

  triggerSync: () => fetchApi<{
    success: boolean;
    added: number;
    updated: number;
    removed: number;
    errors: string[];
  }>('/api/documents/sync', { method: 'POST' }),

  triggerFullSync: () => fetchApi<{
    success: boolean;
    added: number;
    updated: number;
    removed: number;
    errors: string[];
  }>('/api/documents/sync/full', { method: 'POST' }),

  // Website scraping
  getScrapeStatus: () => fetchApi<{
    websiteConfigured: boolean;
    websiteUrl: string | null;
    lastScrape: string | null;
    lastScrapeResult: { pagesScraped: number; chunksCreated: number; errors: string[] } | null;
    documentCount: number;
  }>('/api/documents/scrape/status'),

  triggerWebsiteScrape: () => fetchApi<{
    success: boolean;
    pagesScraped: number;
    chunksCreated: number;
    errors: string[];
  }>('/api/documents/scrape/website', { method: 'POST' }),

  // Analytics
  getOverview: () => fetchApi<{
    documents: { total: number; active: number; chunks: number };
    activity: { messagesThisWeek: number; responsesThisWeek: number };
    feedback: { positive: number; negative: number; satisfactionRate: number | null };
    knowledge: { learnedFacts: number };
  }>('/api/analytics/overview'),

  getActivity: (days = 14) => fetchApi<{
    data: Array<{ date: string; messages: number; responses: number }>;
    period: { start: string; end: string; days: number };
  }>(`/api/analytics/activity?days=${days}`),

  getEvents: (limit = 50) => fetchApi<{
    events: Array<{
      id: string;
      event_type: string;
      event_data: Record<string, unknown>;
      created_at: string;
    }>;
  }>(`/api/analytics/events?limit=${limit}`),

  getLearnedFacts: () => fetchApi<{
    facts: Array<{
      id: string;
      fact: string;
      source: string;
      is_verified: boolean;
      created_at: string;
    }>;
  }>('/api/analytics/learned-facts'),

  verifyFact: (id: string, verified: boolean) =>
    fetchApi(`/api/analytics/learned-facts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_verified: verified }),
    }),

  deleteFact: (id: string) =>
    fetchApi(`/api/analytics/learned-facts/${id}`, { method: 'DELETE' }),

  createFact: (data: { fact: string; source?: string }) =>
    fetchApi<{
      id: string;
      fact: string;
      source: string;
      is_verified: boolean;
      created_at: string;
    }>('/api/analytics/learned-facts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Auth (Google Drive OAuth - legacy)
  getAuthStatus: () => fetchApi<{
    google: { connected: boolean; connectedAt: string | null };
  }>('/auth/status'),

  getGoogleAuthUrl: () => fetchApi<{ authUrl: string }>('/auth/google'),

  disconnectGoogle: () => fetchApi('/auth/google', { method: 'DELETE' }),

  // Google Drive (workspace-scoped)
  getDriveStatus: () => fetchApi<{
    connected: boolean;
    connectedAt: string | null;
    legacy?: boolean;
  }>('/api/drive/status'),

  getDriveFolders: (parentId?: string, pageToken?: string) => {
    const params = new URLSearchParams();
    if (parentId) params.append('parentId', parentId);
    if (pageToken) params.append('pageToken', pageToken);
    const queryString = params.toString();
    return fetchApi<{
      folders: Array<{
        id: string;
        name: string;
        modifiedTime: string;
        parentId?: string;
      }>;
      nextPageToken?: string;
    }>(`/api/drive/folders${queryString ? `?${queryString}` : ''}`);
  },

  // Conversations
  getConversations: (page = 1, limit = 20) => fetchApi<{
    conversations: Array<{
      id: string;
      slack_channel_id: string;
      slack_thread_ts: string;
      started_by_user_id: string;
      is_active: boolean;
      created_at: string;
      last_activity: string;
      messageCount: number;
      lastMessage: {
        content: string;
        role: 'user' | 'assistant';
        created_at: string;
      } | null;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/api/conversations?page=${page}&limit=${limit}`),

  getConversation: (id: string) => fetchApi<{
    conversation: {
      id: string;
      slack_channel_id: string;
      slack_thread_ts: string;
      started_by_user_id: string;
      is_active: boolean;
      created_at: string;
      last_activity: string;
      messages: Array<{
        id: string;
        slack_user_id: string;
        role: 'user' | 'assistant';
        content: string;
        sources: string[];
        confidence_score: number | null;
        feedback_rating: number | null;
        created_at: string;
      }>;
    };
  }>(`/api/conversations/${id}`),

  getConversationStats: () => fetchApi<{
    stats: {
      totalConversations: number;
      activeConversations: number;
      totalMessages: number;
      avgMessagesPerConversation: number;
    };
  }>('/api/conversations/stats/summary'),

  // Bots
  getBots: () => fetchApi<{
    bots: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      status: 'active' | 'inactive' | 'error';
      is_default: boolean;
      bot_type: 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';
      system_prompt: string | null;
      created_at: string;
      updated_at: string;
    }>;
    total: number;
  }>('/api/bots'),

  getBot: (id: string) => fetchApi<{
    bot: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      status: 'active' | 'inactive' | 'error';
      is_default: boolean;
      bot_type: 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';
      system_prompt: string | null;
      slack_bot_token: string | null;
      slack_app_token: string | null;
      created_at: string;
      updated_at: string;
    };
  }>(`/api/bots/${id}`),

  createBot: (data: {
    name: string;
    slug: string;
    bot_type?: 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';
    description?: string;
    system_prompt?: string;
    categories?: string[];
    slack_bot_token?: string;
    slack_app_token?: string;
    slack_signing_secret?: string;
  }) => fetchApi<{ bot: { id: string; name: string; slug: string; bot_type?: string } }>('/api/bots', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateBot: (id: string, data: {
    name?: string;
    bot_type?: 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'general';
    description?: string;
    system_prompt?: string;
    categories?: string[];
    status?: 'active' | 'inactive';
  }) => fetchApi(`/api/bots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  deleteBot: (id: string) => fetchApi(`/api/bots/${id}`, { method: 'DELETE' }),

  activateBot: (id: string) => fetchApi(`/api/bots/${id}/activate`, { method: 'POST' }),

  deactivateBot: (id: string) => fetchApi(`/api/bots/${id}/deactivate`, { method: 'POST' }),

  // Bot Slack Testing
  testSlackCredentials: (data: {
    botToken: string;
    appToken: string;
    signingSecret?: string;
  }) => fetchApi<{
    valid: boolean;
    teamName?: string;
    error?: string;
  }>('/api/bots/test-slack', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Bot Folders
  getBotFolders: (botId: string) => fetchApi<{
    folders: Array<{
      id: string;
      drive_folder_id: string;
      folder_name: string;
      category: string;
      is_active: boolean;
      last_synced: string | null;
      created_at: string;
    }>;
  }>(`/api/bots/${botId}/folders`),

  addBotFolder: (botId: string, data: {
    driveFolderId: string;
    folderName: string;
    category?: string;
  }) => fetchApi<{
    folder: {
      id: string;
      drive_folder_id: string;
      folder_name: string;
    };
  }>(`/api/bots/${botId}/folders`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  removeBotFolder: (botId: string, folderId: string) =>
    fetchApi(`/api/bots/${botId}/folders/${folderId}`, { method: 'DELETE' }),

  // Bot Channels
  getBotChannels: (botId: string) => fetchApi<{
    channels: Array<{
      id: string;
      slack_channel_id: string;
      channel_name: string | null;
      is_enabled: boolean;
      created_at: string;
    }>;
  }>(`/api/bots/${botId}/channels`),

  addBotChannel: (botId: string, data: {
    slackChannelId: string;
    channelName?: string;
  }) => fetchApi<{
    channel: {
      id: string;
      slack_channel_id: string;
      channel_name: string | null;
    };
  }>(`/api/bots/${botId}/channels`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  removeBotChannel: (botId: string, channelId: string) =>
    fetchApi(`/api/bots/${botId}/channels/${channelId}`, { method: 'DELETE' }),

  // Fetch available Slack channels for the bot
  getSlackChannels: (botId: string) => fetchApi<{
    channels: Array<{
      id: string;
      name: string;
      isPrivate: boolean;
      isMember: boolean;
      numMembers?: number;
      isAssigned: boolean;
    }>;
  }>(`/api/bots/${botId}/slack-channels`),

  // Bot Sync
  triggerBotSync: (botId: string) => fetchApi<{
    success: boolean;
    added: number;
    updated: number;
    removed: number;
    errors: string[];
  }>(`/api/bots/${botId}/sync`, { method: 'POST' }),

  // Feedback
  getFeedback: (options: { limit?: number; offset?: number } = {}) => fetchApi<{
    feedback: Array<{
      id: string;
      is_helpful: boolean;
      feedback_category: string | null;
      feedback_text: string | null;
      query_text: string | null;
      response_text: string | null;
      sources_used: string[];
      slack_user_id: string;
      slack_channel_id: string;
      is_reviewed: boolean;
      created_at: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>(`/api/feedback?limit=${options.limit ?? 20}&offset=${options.offset ?? 0}`),

  getFeedbackAnalytics: () => fetchApi<{
    overall: {
      total_feedback: number;
      helpful_count: number;
      unhelpful_count: number;
      satisfaction_rate: number;
    };
    byBot: Record<string, { botName: string; stats: { satisfaction_rate: number } }>;
    recentUnhelpful: Array<{
      id: string;
      is_helpful: boolean;
      feedback_text: string | null;
      query_text: string | null;
      created_at: string;
    }>;
  }>('/api/feedback/analytics'),

  markFeedbackReviewed: (id: string, isReviewed: boolean, reviewedBy?: string) =>
    fetchApi(`/api/feedback/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ isReviewed, reviewedBy: reviewedBy ?? 'dashboard-user' }),
    }),

  getFeedbackStats: () => fetchApi<{
    stats: {
      totalFeedback: number;
      averageRating: number | null;
      positiveCount: number;
      negativeCount: number;
      responseQuality: Record<string, number>;
      sourceQuality: Record<string, number>;
    };
  }>('/api/feedback/stats'),

  // Workspaces
  getWorkspaces: () => fetchApi<{
    workspaces: Array<{
      id: string;
      name: string;
      slug: string;
      tier: string;
      status: string;
      role: string;
    }>;
  }>('/api/workspaces'),

  getWorkspace: (id: string) => fetchApi<{
    workspace: {
      id: string;
      name: string;
      slug: string;
      tier: string;
      status: string;
      settings: Record<string, unknown>;
    };
    membership: {
      role: string;
    };
  }>(`/api/workspaces/${id}`),

  getWorkspaceUsage: (id: string) => fetchApi<{
    usage: {
      queries_used: number;
      queries_limit: number;
      queries_percent: number;
      documents_used: number;
      documents_limit: number;
      documents_percent: number;
      bots_used: number;
      bots_limit: number;
    };
  }>(`/api/workspaces/${id}/usage`),

  // Team
  getTeamMembers: () => fetchApi<{
    members: Array<{
      id: string;
      user_id: string;
      role: string;
      is_active: boolean;
      invited_at: string;
      accepted_at: string | null;
      user: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        email?: string;
      } | null;
    }>;
  }>('/api/team/members'),

  getTeamInvites: () => fetchApi<{
    invites: Array<{
      id: string;
      email: string;
      role: string;
      created_at: string;
      expires_at: string;
    }>;
  }>('/api/team/invites'),

  inviteMember: (email: string, role: string = 'member') =>
    fetchApi<{ invite: { id: string; email: string }; invite_link: string }>('/api/team/invites', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  revokeInvite: (inviteId: string) =>
    fetchApi(`/api/team/invites/${inviteId}`, { method: 'DELETE' }),

  removeMember: (memberId: string) =>
    fetchApi(`/api/team/members/${memberId}`, { method: 'DELETE' }),

  updateMemberRole: (memberId: string, role: string) =>
    fetchApi(`/api/team/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  // Billing
  getBillingOverview: () => fetchApi<{
    subscription: {
      tier: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
    } | null;
    invoices: Array<{
      id: string;
      amount_due: number;
      status: string;
      created_at: string;
      hosted_invoice_url: string | null;
    }>;
    payment_methods: Array<{
      id: string;
      brand: string;
      last_four: string;
      is_default: boolean;
    }>;
  }>('/api/billing'),

  createCheckoutSession: (tier: string) =>
    fetchApi<{ checkout_url: string; session_id: string }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({
        tier,
        success_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/billing?success=true`,
        cancel_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/billing?canceled=true`,
      }),
    }),

  createPortalSession: () =>
    fetchApi<{ portal_url: string }>('/api/billing/portal', {
      method: 'POST',
      body: JSON.stringify({
        return_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/billing`,
      }),
    }),

  changePlan: (tier: string) =>
    fetchApi<{ success: boolean; subscription: unknown }>('/api/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  cancelSubscription: (immediately = false) =>
    fetchApi<{ success: boolean; access_until: string }>('/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ cancel_immediately: immediately }),
    }),

  // Admin (Platform Admin Only)
  getAdminStats: () => fetchApi<{
    stats: {
      totalWorkspaces: number;
      payingWorkspaces: number;
      internalWorkspaces: number;
      activeWorkspaces: number;
      trialingWorkspaces: number;
      totalUsers: number;
      adminUsers: number;
      starterWorkspaces: number;
      proWorkspaces: number;
      businessWorkspaces: number;
      estimatedMrr: number;
      totalDocuments: number;
      totalConversations: number;
      totalBots: number;
      newWorkspaces30d: number;
      newWorkspaces7d: number;
    };
  }>('/api/admin/stats'),

  getAdminWorkspaces: (filters?: {
    search?: string;
    tier?: string;
    status?: string;
    isInternal?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tier) params.append('tier', filters.tier);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.isInternal !== undefined) params.append('isInternal', String(filters.isInternal));
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    return fetchApi<{
      data: Array<{
        id: string;
        name: string;
        slug: string;
        tier: string;
        status: string;
        isInternal: boolean;
        createdAt: string;
        ownerEmail: string;
        ownerName?: string;
        memberCount: number;
        documentCount: number;
        botCount: number;
        queriesThisMonth: number;
        lastActivity?: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/admin/workspaces?${params.toString()}`);
  },

  getAdminWorkspaceDetails: (id: string) => fetchApi<{
    workspace: {
      id: string;
      name: string;
      slug: string;
      tier: string;
      status: string;
      isInternal: boolean;
      internalNotes?: string;
      createdAt: string;
      updatedAt: string;
      trialStartedAt?: string;
      trialEndsAt?: string;
      maxDocuments: number;
      maxQueriesPerMonth: number;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      ownerId: string;
      ownerEmail: string;
      ownerName?: string;
      memberCount: number;
      documentCount: number;
      botCount: number;
      conversationCount: number;
      queriesThisMonth: number;
      lastActivity?: string;
    };
    members: Array<{
      id: string;
      userId: string;
      email: string;
      fullName?: string;
      role: string;
      joinedAt: string;
    }>;
    bots: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      createdAt: string;
    }>;
    usage: {
      documents: number;
      conversations: number;
      queriesThisMonth: number;
      totalStorage: number;
    };
  }>(`/api/admin/workspaces/${id}`),

  createInternalWorkspace: (data: {
    name: string;
    ownerEmail: string;
    notes?: string;
  }) => fetchApi<{
    workspace: {
      id: string;
      name: string;
      slug: string;
      isInternal: boolean;
    };
  }>('/api/admin/workspaces/internal', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateAdminWorkspace: (id: string, data: {
    name?: string;
    tier?: string;
    status?: string;
    isInternal?: boolean;
    internalNotes?: string;
  }) => fetchApi(`/api/admin/workspaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getAdminGrowth: (days = 30) => fetchApi<{
    data: Array<{
      date: string;
      newWorkspaces: number;
      totalWorkspaces: number;
    }>;
  }>(`/api/admin/growth?days=${days}`),

  // Admin User Management
  getAdminUsers: (filters?: {
    search?: string;
    isAdmin?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isAdmin !== undefined) params.append('isAdmin', String(filters.isAdmin));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    return fetchApi<{
      data: Array<{
        id: string;
        email: string;
        fullName: string | null;
        avatarUrl: string | null;
        isPlatformAdmin: boolean;
        createdAt: string;
        lastSignInAt: string | null;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/admin/users?${params.toString()}`);
  },

  toggleAdminStatus: (userId: string, isAdmin: boolean) =>
    fetchApi<{ message: string }>(`/api/admin/users/${userId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ isAdmin }),
    }),
};
