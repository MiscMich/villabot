// Workspace and multi-tenancy types for Cluebase AI

export type SubscriptionTier = 'starter' | 'pro' | 'business';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;

  // Subscription
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;

  // Trial
  trial_ends_at: string | null;
  trial_started_at: string | null;

  // Limits (cached from tier)
  max_documents: number;
  max_queries_per_month: number;
  max_file_upload_mb: number;
  max_team_members: number;
  max_website_pages: number;
  max_bots: number;

  // Settings
  settings: WorkspaceSettings;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  brandColor: string;
  timezone: string;
  weeklyDigest: boolean;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  preferences: UserPreferences;
  default_workspace_id: string | null;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;

  // Joined fields (when fetched with user data)
  user?: UserProfile;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  invite_token: string;
  expires_at: string;
  invited_by: string | null;
  created_at: string;
  used_at: string | null;
}

// API request/response types

export interface CreateWorkspaceRequest {
  name: string;
  slug?: string; // Auto-generated if not provided
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
  membership: WorkspaceMember;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  logo_url?: string | null;
  settings?: Partial<WorkspaceSettings>;
}

export interface InviteMemberRequest {
  email: string;
  role?: WorkspaceMemberRole;
}

export interface InviteMemberResponse {
  invite: WorkspaceInvite;
  invite_link: string;
}

export interface AcceptInviteRequest {
  invite_token: string;
}

export interface WorkspaceStats {
  total_documents: number;
  total_chunks: number;
  total_bots: number;
  active_bots: number;
  total_conversations: number;
  total_messages: number;
  total_learned_facts: number;
  storage_used_bytes: number;
}

export interface WorkspaceWithMembership extends Workspace {
  membership: WorkspaceMember;
}

// Usage summary
export interface UsageSummary {
  queries_used: number;
  queries_limit: number;
  queries_percent: number;
  documents_used: number;
  documents_limit: number;
  documents_percent: number;
  team_members_used: number;
  team_members_limit: number;
  bots_used: number;
  bots_limit: number;
  period_start: string;
  period_end: string;
  days_remaining: number;
}

// Context for authenticated requests
export interface WorkspaceContext {
  workspace: Workspace;
  membership: WorkspaceMember;
  usage: UsageSummary;
}
