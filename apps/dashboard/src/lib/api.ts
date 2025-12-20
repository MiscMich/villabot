const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    cache: 'no-store', // Disable caching to prevent 304 issues
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
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
  // Health
  getHealth: () => fetchApi<{
    status: string;
    uptime: number;
    services: Record<string, boolean>;
  }>('/health'),

  // Config
  getConfig: () => fetchApi<{ config: Record<string, unknown> }>('/api/config'),
  updateConfig: (key: string, value: unknown) =>
    fetchApi(`/api/config/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  // Documents
  getDocuments: () => fetchApi<{
    documents: Array<{
      id: string;
      title: string;
      file_type: string;
      source_type: string;
      source_url?: string;
      last_modified: string;
      last_synced: string;
      is_active: boolean;
    }>;
    total: number;
  }>('/api/documents'),

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

  // Auth
  getAuthStatus: () => fetchApi<{
    google: { connected: boolean; connectedAt: string | null };
  }>('/auth/status'),

  getGoogleAuthUrl: () => fetchApi<{ authUrl: string }>('/auth/google'),

  disconnectGoogle: () => fetchApi('/auth/google', { method: 'DELETE' }),

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
};
