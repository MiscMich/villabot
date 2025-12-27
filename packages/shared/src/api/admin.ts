/**
 * Admin API Zod schemas
 * Covers platform admin operations
 */

import { z } from 'zod';

// ============================================================================
// Admin Stats Schemas
// ============================================================================

/** Admin stats response */
export const AdminStatsResponseSchema = z.object({
  stats: z.object({
    totalWorkspaces: z.number(),
    payingWorkspaces: z.number(),
    internalWorkspaces: z.number(),
    activeWorkspaces: z.number(),
    trialingWorkspaces: z.number(),
    totalUsers: z.number(),
    adminUsers: z.number(),
    starterWorkspaces: z.number(),
    proWorkspaces: z.number(),
    businessWorkspaces: z.number(),
    estimatedMrr: z.number(),
    totalDocuments: z.number(),
    totalConversations: z.number(),
    totalBots: z.number(),
    newWorkspaces30d: z.number(),
    newWorkspaces7d: z.number(),
  }),
});

// ============================================================================
// Admin Workspace Schemas
// ============================================================================

/** Admin workspace list item */
export const AdminWorkspaceListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  tier: z.string(),
  status: z.string(),
  isInternal: z.boolean(),
  createdAt: z.string(),
  ownerEmail: z.string(),
  ownerName: z.string().optional(),
  memberCount: z.number(),
  documentCount: z.number(),
  botCount: z.number(),
  queriesThisMonth: z.number(),
  lastActivity: z.string().optional(),
});

/** Admin workspace filters */
export const AdminWorkspaceFiltersSchema = z.object({
  search: z.string().optional(),
  tier: z.string().optional(),
  status: z.string().optional(),
  isInternal: z.boolean().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

/** Admin workspaces response */
export const AdminWorkspacesResponseSchema = z.object({
  data: z.array(AdminWorkspaceListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

/** Admin workspace detail member */
export const AdminWorkspaceMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string(),
  fullName: z.string().optional(),
  role: z.string(),
  joinedAt: z.string(),
});

/** Admin workspace detail bot */
export const AdminWorkspaceBotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

/** Admin workspace detail */
export const AdminWorkspaceDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  tier: z.string(),
  status: z.string(),
  isInternal: z.boolean(),
  internalNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trialStartedAt: z.string().optional(),
  trialEndsAt: z.string().optional(),
  maxDocuments: z.number(),
  maxQueriesPerMonth: z.number(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  ownerId: z.string().uuid(),
  ownerEmail: z.string(),
  ownerName: z.string().optional(),
  memberCount: z.number(),
  documentCount: z.number(),
  botCount: z.number(),
  conversationCount: z.number(),
  queriesThisMonth: z.number(),
  lastActivity: z.string().optional(),
});

/** Admin workspace detail response */
export const AdminWorkspaceDetailResponseSchema = z.object({
  workspace: AdminWorkspaceDetailSchema,
  members: z.array(AdminWorkspaceMemberSchema),
  bots: z.array(AdminWorkspaceBotSchema),
  usage: z.object({
    documents: z.number(),
    conversations: z.number(),
    queriesThisMonth: z.number(),
    totalStorage: z.number(),
  }),
});

/** Create internal workspace request */
export const CreateInternalWorkspaceRequestSchema = z.object({
  name: z.string().min(1),
  ownerEmail: z.string().email(),
  notes: z.string().optional(),
});

/** Create internal workspace response */
export const CreateInternalWorkspaceResponseSchema = z.object({
  workspace: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    isInternal: z.boolean(),
  }),
});

/** Update admin workspace request */
export const UpdateAdminWorkspaceRequestSchema = z.object({
  name: z.string().optional(),
  tier: z.string().optional(),
  status: z.string().optional(),
  isInternal: z.boolean().optional(),
  internalNotes: z.string().optional(),
});

// ============================================================================
// Admin Growth Schemas
// ============================================================================

/** Growth data point */
export const GrowthDataPointSchema = z.object({
  date: z.string(),
  newWorkspaces: z.number(),
  totalWorkspaces: z.number(),
});

/** Admin growth response */
export const AdminGrowthResponseSchema = z.object({
  data: z.array(GrowthDataPointSchema),
});

// ============================================================================
// Admin User Schemas
// ============================================================================

/** Admin user schema */
export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
  createdAt: z.string(),
  lastSignInAt: z.string().nullable(),
});

/** Admin user filters */
export const AdminUserFiltersSchema = z.object({
  search: z.string().optional(),
  isAdmin: z.boolean().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

/** Admin users response */
export const AdminUsersResponseSchema = z.object({
  data: z.array(AdminUserSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

/** Toggle admin status request */
export const ToggleAdminStatusRequestSchema = z.object({
  isAdmin: z.boolean(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;
export type AdminWorkspaceListItem = z.infer<typeof AdminWorkspaceListItemSchema>;
export type AdminWorkspaceFilters = z.infer<typeof AdminWorkspaceFiltersSchema>;
export type AdminWorkspacesResponse = z.infer<typeof AdminWorkspacesResponseSchema>;
export type AdminWorkspaceMember = z.infer<typeof AdminWorkspaceMemberSchema>;
export type AdminWorkspaceBot = z.infer<typeof AdminWorkspaceBotSchema>;
export type AdminWorkspaceDetail = z.infer<typeof AdminWorkspaceDetailSchema>;
export type AdminWorkspaceDetailResponse = z.infer<typeof AdminWorkspaceDetailResponseSchema>;
export type CreateInternalWorkspaceRequest = z.infer<typeof CreateInternalWorkspaceRequestSchema>;
export type CreateInternalWorkspaceResponse = z.infer<typeof CreateInternalWorkspaceResponseSchema>;
export type UpdateAdminWorkspaceRequest = z.infer<typeof UpdateAdminWorkspaceRequestSchema>;
export type GrowthDataPoint = z.infer<typeof GrowthDataPointSchema>;
export type AdminGrowthResponse = z.infer<typeof AdminGrowthResponseSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserFilters = z.infer<typeof AdminUserFiltersSchema>;
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;
export type ToggleAdminStatusRequest = z.infer<typeof ToggleAdminStatusRequestSchema>;
