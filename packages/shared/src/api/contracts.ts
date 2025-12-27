/**
 * Type-Safe API Contracts
 *
 * This provides tRPC-like end-to-end type safety between frontend and backend.
 * Each contract defines the endpoint, method, request schema, and response schema.
 *
 * Benefits:
 * - Single source of truth for API types
 * - Compile-time type checking on both ends
 * - Runtime validation with Zod schemas
 * - Auto-generated TypeScript types
 */

import { z } from 'zod';

// Import all schemas
import {
  HealthResponseSchema,
} from './common.js';

import {
  ListBotsResponseSchema,
  GetBotResponseSchema,
  CreateBotRequestSchema,
  CreateBotResponseSchema,
  UpdateBotRequestSchema,
  ListBotChannelsResponseSchema,
  AddBotChannelRequestSchema,
  AddBotChannelResponseSchema,
  ListBotFoldersResponseSchema,
  AddBotFolderRequestSchema,
  AddBotFolderResponseSchema,
  TestSlackCredentialsRequestSchema,
  TestSlackCredentialsResponseSchema,
  ListSlackChannelsResponseSchema,
  TriggerBotSyncResponseSchema,
} from './bots.js';

import {
  ListDocumentsResponseSchema,
  GetDocumentResponseSchema,
  UpdateDocumentRequestSchema,
  ToggleDocumentRequestSchema,
  SyncStatusResponseSchema,
  SyncResultResponseSchema,
  ScrapeStatusResponseSchema,
  ScrapeResultResponseSchema,
} from './documents.js';

import {
  OverviewResponseSchema,
  ActivityResponseSchema,
  EventsResponseSchema,
  LearnedFactsResponseSchema,
  CreateFactRequestSchema,
  LearnedFactSchema,
} from './analytics.js';

import {
  ListWorkspacesResponseSchema,
  GetWorkspaceResponseSchema,
  WorkspaceUsageResponseSchema,
  ListTeamMembersResponseSchema,
  ListTeamInvitesResponseSchema,
  InviteMemberRequestSchema,
  InviteMemberResponseSchema,
  BillingOverviewResponseSchema,
  CheckoutSessionRequestSchema,
  CheckoutSessionResponseSchema,
  PortalSessionResponseSchema,
} from './workspaces.js';

import {
  ListConversationsResponseSchema,
  GetConversationResponseSchema,
  ConversationStatsResponseSchema,
} from './conversations.js';

import {
  ListFeedbackResponseSchema,
  FeedbackAnalyticsResponseSchema,
  FeedbackStatsResponseSchema,
  MarkFeedbackReviewedRequestSchema,
} from './feedback.js';

import {
  AuthStatusResponseSchema,
  GoogleAuthUrlResponseSchema,
  DriveStatusResponseSchema,
  DriveFoldersResponseSchema,
} from './auth.js';

import {
  AdminStatsResponseSchema,
  AdminWorkspacesResponseSchema,
  AdminWorkspaceDetailResponseSchema,
  AdminGrowthResponseSchema,
  AdminUsersResponseSchema,
  CreateInternalWorkspaceRequestSchema,
  CreateInternalWorkspaceResponseSchema,
  UpdateAdminWorkspaceRequestSchema,
  ToggleAdminStatusRequestSchema,
} from './admin.js';

// ============================================================================
// Contract Definition Types
// ============================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiContract<
  TRequest extends z.ZodType | undefined = undefined,
  TResponse extends z.ZodType = z.ZodType
> {
  method: HttpMethod;
  path: string | ((params: Record<string, string>) => string);
  requestSchema?: TRequest;
  responseSchema: TResponse;
  auth: 'public' | 'required' | 'optional';
}

// Helper to create contracts with proper typing
function defineContract<
  TRequest extends z.ZodType | undefined,
  TResponse extends z.ZodType
>(contract: ApiContract<TRequest, TResponse>): ApiContract<TRequest, TResponse> {
  return contract;
}

// ============================================================================
// API Contracts Definition
// ============================================================================

export const apiContracts = {
  // ====================
  // Health
  // ====================
  health: defineContract({
    method: 'GET',
    path: '/health',
    responseSchema: HealthResponseSchema,
    auth: 'public',
  }),

  // ====================
  // Bots
  // ====================
  'bots.list': defineContract({
    method: 'GET',
    path: '/api/bots',
    responseSchema: ListBotsResponseSchema,
    auth: 'required',
  }),

  'bots.get': defineContract({
    method: 'GET',
    path: (p) => `/api/bots/${p.id}`,
    responseSchema: GetBotResponseSchema,
    auth: 'required',
  }),

  'bots.create': defineContract({
    method: 'POST',
    path: '/api/bots',
    requestSchema: CreateBotRequestSchema,
    responseSchema: CreateBotResponseSchema,
    auth: 'required',
  }),

  'bots.update': defineContract({
    method: 'PATCH',
    path: (p) => `/api/bots/${p.id}`,
    requestSchema: UpdateBotRequestSchema,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.delete': defineContract({
    method: 'DELETE',
    path: (p) => `/api/bots/${p.id}`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.activate': defineContract({
    method: 'POST',
    path: (p) => `/api/bots/${p.id}/activate`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.deactivate': defineContract({
    method: 'POST',
    path: (p) => `/api/bots/${p.id}/deactivate`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.testSlack': defineContract({
    method: 'POST',
    path: '/api/bots/test-slack',
    requestSchema: TestSlackCredentialsRequestSchema,
    responseSchema: TestSlackCredentialsResponseSchema,
    auth: 'required',
  }),

  'bots.channels.list': defineContract({
    method: 'GET',
    path: (p) => `/api/bots/${p.botId}/channels`,
    responseSchema: ListBotChannelsResponseSchema,
    auth: 'required',
  }),

  'bots.channels.add': defineContract({
    method: 'POST',
    path: (p) => `/api/bots/${p.botId}/channels`,
    requestSchema: AddBotChannelRequestSchema,
    responseSchema: AddBotChannelResponseSchema,
    auth: 'required',
  }),

  'bots.channels.remove': defineContract({
    method: 'DELETE',
    path: (p) => `/api/bots/${p.botId}/channels/${p.channelId}`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.folders.list': defineContract({
    method: 'GET',
    path: (p) => `/api/bots/${p.botId}/folders`,
    responseSchema: ListBotFoldersResponseSchema,
    auth: 'required',
  }),

  'bots.folders.add': defineContract({
    method: 'POST',
    path: (p) => `/api/bots/${p.botId}/folders`,
    requestSchema: AddBotFolderRequestSchema,
    responseSchema: AddBotFolderResponseSchema,
    auth: 'required',
  }),

  'bots.folders.remove': defineContract({
    method: 'DELETE',
    path: (p) => `/api/bots/${p.botId}/folders/${p.folderId}`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'bots.slackChannels': defineContract({
    method: 'GET',
    path: (p) => `/api/bots/${p.botId}/slack-channels`,
    responseSchema: ListSlackChannelsResponseSchema,
    auth: 'required',
  }),

  'bots.sync': defineContract({
    method: 'POST',
    path: (p) => `/api/bots/${p.botId}/sync`,
    responseSchema: TriggerBotSyncResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Documents
  // ====================
  'documents.list': defineContract({
    method: 'GET',
    path: '/api/documents',
    responseSchema: ListDocumentsResponseSchema,
    auth: 'required',
  }),

  'documents.get': defineContract({
    method: 'GET',
    path: (p) => `/api/documents/${p.id}`,
    responseSchema: GetDocumentResponseSchema,
    auth: 'required',
  }),

  'documents.update': defineContract({
    method: 'PATCH',
    path: (p) => `/api/documents/${p.id}`,
    requestSchema: UpdateDocumentRequestSchema,
    responseSchema: z.object({ document: z.object({ id: z.string(), bot_id: z.string().nullable(), category: z.string() }) }),
    auth: 'required',
  }),

  'documents.toggleStatus': defineContract({
    method: 'PATCH',
    path: (p) => `/api/documents/${p.id}/status`,
    requestSchema: ToggleDocumentRequestSchema,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'documents.delete': defineContract({
    method: 'DELETE',
    path: (p) => `/api/documents/${p.id}`,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'documents.syncStatus': defineContract({
    method: 'GET',
    path: '/api/documents/sync/status',
    responseSchema: SyncStatusResponseSchema,
    auth: 'required',
  }),

  'documents.sync': defineContract({
    method: 'POST',
    path: '/api/documents/sync',
    responseSchema: SyncResultResponseSchema,
    auth: 'required',
  }),

  'documents.fullSync': defineContract({
    method: 'POST',
    path: '/api/documents/sync/full',
    responseSchema: SyncResultResponseSchema,
    auth: 'required',
  }),

  'documents.scrapeStatus': defineContract({
    method: 'GET',
    path: '/api/documents/scrape/status',
    responseSchema: ScrapeStatusResponseSchema,
    auth: 'required',
  }),

  'documents.scrape': defineContract({
    method: 'POST',
    path: '/api/documents/scrape/website',
    responseSchema: ScrapeResultResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Analytics
  // ====================
  'analytics.overview': defineContract({
    method: 'GET',
    path: '/api/analytics/overview',
    responseSchema: OverviewResponseSchema,
    auth: 'required',
  }),

  'analytics.activity': defineContract({
    method: 'GET',
    path: '/api/analytics/activity',
    responseSchema: ActivityResponseSchema,
    auth: 'required',
  }),

  'analytics.events': defineContract({
    method: 'GET',
    path: '/api/analytics/events',
    responseSchema: EventsResponseSchema,
    auth: 'required',
  }),

  'analytics.learnedFacts': defineContract({
    method: 'GET',
    path: '/api/analytics/learned-facts',
    responseSchema: LearnedFactsResponseSchema,
    auth: 'required',
  }),

  'analytics.createFact': defineContract({
    method: 'POST',
    path: '/api/analytics/learned-facts',
    requestSchema: CreateFactRequestSchema,
    responseSchema: LearnedFactSchema,
    auth: 'required',
  }),

  // ====================
  // Workspaces
  // ====================
  'workspaces.list': defineContract({
    method: 'GET',
    path: '/api/workspaces',
    responseSchema: ListWorkspacesResponseSchema,
    auth: 'required',
  }),

  'workspaces.get': defineContract({
    method: 'GET',
    path: (p) => `/api/workspaces/${p.id}`,
    responseSchema: GetWorkspaceResponseSchema,
    auth: 'required',
  }),

  'workspaces.usage': defineContract({
    method: 'GET',
    path: (p) => `/api/workspaces/${p.id}/usage`,
    responseSchema: WorkspaceUsageResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Team
  // ====================
  'team.members': defineContract({
    method: 'GET',
    path: '/api/team/members',
    responseSchema: ListTeamMembersResponseSchema,
    auth: 'required',
  }),

  'team.invites': defineContract({
    method: 'GET',
    path: '/api/team/invites',
    responseSchema: ListTeamInvitesResponseSchema,
    auth: 'required',
  }),

  'team.invite': defineContract({
    method: 'POST',
    path: '/api/team/invites',
    requestSchema: InviteMemberRequestSchema,
    responseSchema: InviteMemberResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Billing
  // ====================
  'billing.overview': defineContract({
    method: 'GET',
    path: '/api/billing',
    responseSchema: BillingOverviewResponseSchema,
    auth: 'required',
  }),

  'billing.checkout': defineContract({
    method: 'POST',
    path: '/api/billing/checkout',
    requestSchema: CheckoutSessionRequestSchema,
    responseSchema: CheckoutSessionResponseSchema,
    auth: 'required',
  }),

  'billing.portal': defineContract({
    method: 'POST',
    path: '/api/billing/portal',
    responseSchema: PortalSessionResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Conversations
  // ====================
  'conversations.list': defineContract({
    method: 'GET',
    path: '/api/conversations',
    responseSchema: ListConversationsResponseSchema,
    auth: 'required',
  }),

  'conversations.get': defineContract({
    method: 'GET',
    path: (p) => `/api/conversations/${p.id}`,
    responseSchema: GetConversationResponseSchema,
    auth: 'required',
  }),

  'conversations.stats': defineContract({
    method: 'GET',
    path: '/api/conversations/stats/summary',
    responseSchema: ConversationStatsResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Feedback
  // ====================
  'feedback.list': defineContract({
    method: 'GET',
    path: '/api/feedback',
    responseSchema: ListFeedbackResponseSchema,
    auth: 'required',
  }),

  'feedback.analytics': defineContract({
    method: 'GET',
    path: '/api/feedback/analytics',
    responseSchema: FeedbackAnalyticsResponseSchema,
    auth: 'required',
  }),

  'feedback.stats': defineContract({
    method: 'GET',
    path: '/api/feedback/stats',
    responseSchema: FeedbackStatsResponseSchema,
    auth: 'required',
  }),

  'feedback.markReviewed': defineContract({
    method: 'PATCH',
    path: (p) => `/api/feedback/${p.id}/review`,
    requestSchema: MarkFeedbackReviewedRequestSchema,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  // ====================
  // Auth
  // ====================
  'auth.status': defineContract({
    method: 'GET',
    path: '/auth/status',
    responseSchema: AuthStatusResponseSchema,
    auth: 'required',
  }),

  'auth.googleUrl': defineContract({
    method: 'GET',
    path: '/auth/google',
    responseSchema: GoogleAuthUrlResponseSchema,
    auth: 'required',
  }),

  'drive.status': defineContract({
    method: 'GET',
    path: '/api/drive/status',
    responseSchema: DriveStatusResponseSchema,
    auth: 'required',
  }),

  'drive.folders': defineContract({
    method: 'GET',
    path: '/api/drive/folders',
    responseSchema: DriveFoldersResponseSchema,
    auth: 'required',
  }),

  // ====================
  // Admin
  // ====================
  'admin.stats': defineContract({
    method: 'GET',
    path: '/api/admin/stats',
    responseSchema: AdminStatsResponseSchema,
    auth: 'required',
  }),

  'admin.workspaces': defineContract({
    method: 'GET',
    path: '/api/admin/workspaces',
    responseSchema: AdminWorkspacesResponseSchema,
    auth: 'required',
  }),

  'admin.workspace': defineContract({
    method: 'GET',
    path: (p) => `/api/admin/workspaces/${p.id}`,
    responseSchema: AdminWorkspaceDetailResponseSchema,
    auth: 'required',
  }),

  'admin.createInternal': defineContract({
    method: 'POST',
    path: '/api/admin/workspaces/internal',
    requestSchema: CreateInternalWorkspaceRequestSchema,
    responseSchema: CreateInternalWorkspaceResponseSchema,
    auth: 'required',
  }),

  'admin.updateWorkspace': defineContract({
    method: 'PATCH',
    path: (p) => `/api/admin/workspaces/${p.id}`,
    requestSchema: UpdateAdminWorkspaceRequestSchema,
    responseSchema: z.object({ success: z.boolean() }),
    auth: 'required',
  }),

  'admin.growth': defineContract({
    method: 'GET',
    path: '/api/admin/growth',
    responseSchema: AdminGrowthResponseSchema,
    auth: 'required',
  }),

  'admin.users': defineContract({
    method: 'GET',
    path: '/api/admin/users',
    responseSchema: AdminUsersResponseSchema,
    auth: 'required',
  }),

  'admin.toggleAdmin': defineContract({
    method: 'POST',
    path: (p) => `/api/admin/users/${p.userId}/admin`,
    requestSchema: ToggleAdminStatusRequestSchema,
    responseSchema: z.object({ message: z.string() }),
    auth: 'required',
  }),
} as const;

// ============================================================================
// Type Inference Helpers
// ============================================================================

/** Get all contract names */
export type ContractName = keyof typeof apiContracts;

/** Get the request type for a contract */
export type ContractRequest<T extends ContractName> =
  typeof apiContracts[T] extends { requestSchema: z.ZodType }
    ? z.infer<typeof apiContracts[T]['requestSchema']>
    : undefined;

/** Get the response type for a contract */
export type ContractResponse<T extends ContractName> =
  z.infer<typeof apiContracts[T]['responseSchema']>;

/** Get path parameters for a contract */
export type ContractParams<T extends ContractName> =
  typeof apiContracts[T]['path'] extends (params: infer P) => string
    ? P
    : Record<string, never>;
