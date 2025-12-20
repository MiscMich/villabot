/**
 * Platform Admin Types
 * Types for admin panel functionality
 */

// Platform-wide statistics
export interface PlatformStats {
  // Workspace counts
  totalWorkspaces: number;
  payingWorkspaces: number;
  internalWorkspaces: number;
  activeWorkspaces: number;
  trialingWorkspaces: number;

  // User counts
  totalUsers: number;
  adminUsers: number;

  // Subscription breakdown
  starterWorkspaces: number;
  proWorkspaces: number;
  businessWorkspaces: number;

  // Revenue
  estimatedMrr: number;

  // Activity
  totalDocuments: number;
  totalConversations: number;
  totalBots: number;

  // Growth
  newWorkspaces30d: number;
  newWorkspaces7d: number;
}

// Workspace details for admin view
export interface AdminWorkspaceDetails {
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

  // Owner
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;

  // Counts
  memberCount: number;
  documentCount: number;
  botCount: number;
  conversationCount: number;

  // Usage
  queriesThisMonth: number;
  lastActivity?: string;
}

// Admin user profile
export interface AdminUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  lastSignInAt?: string;
}

// Create internal workspace request
export interface CreateInternalWorkspaceRequest {
  name: string;
  ownerEmail: string;
  notes?: string;
}

// Workspace list filters for admin
export interface AdminWorkspaceFilters {
  search?: string;
  tier?: string;
  status?: string;
  isInternal?: boolean;
  sortBy?: 'created_at' | 'name' | 'member_count' | 'document_count' | 'queries_this_month';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Admin audit log entry
export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType?: 'workspace' | 'user' | 'subscription';
  targetId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

// Admin actions
export type AdminAction =
  | 'create_internal_workspace'
  | 'update_workspace'
  | 'delete_workspace'
  | 'set_platform_admin'
  | 'impersonate_workspace'
  | 'view_workspace_details'
  | 'extend_trial'
  | 'cancel_subscription'
  | 'refund_invoice';
