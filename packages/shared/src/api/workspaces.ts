/**
 * Workspace API Zod schemas
 * Covers workspaces, team members, invites, and billing
 */

import { z } from 'zod';
import { NullableTimestampSchema, SubscriptionTierSchema, WorkspaceMemberRoleSchema } from './common.js';

// ============================================================================
// Workspace Core Schemas
// ============================================================================

/** Workspace list item schema */
export const WorkspaceListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  tier: z.string(),
  status: z.string(),
  role: z.string(),
});

/** Workspace detail schema */
export const WorkspaceDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  tier: z.string(),
  status: z.string(),
  settings: z.record(z.unknown()),
});

/** Workspace membership schema */
export const WorkspaceMembershipSchema = z.object({
  role: z.string(),
});

// ============================================================================
// Workspace API Responses
// ============================================================================

/** List workspaces response */
export const ListWorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceListItemSchema),
});

/** Get workspace response */
export const GetWorkspaceResponseSchema = z.object({
  workspace: WorkspaceDetailSchema,
  membership: WorkspaceMembershipSchema,
});

/** Workspace usage response */
export const WorkspaceUsageResponseSchema = z.object({
  usage: z.object({
    queries_used: z.number(),
    queries_limit: z.number(),
    queries_percent: z.number(),
    documents_used: z.number(),
    documents_limit: z.number(),
    documents_percent: z.number(),
    bots_used: z.number(),
    bots_limit: z.number(),
  }),
});

// ============================================================================
// Team Schemas
// ============================================================================

/** Team member user info */
export const TeamMemberUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email: z.string().optional(),
});

/** Team member schema */
export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.string(),
  is_active: z.boolean(),
  invited_at: z.string(),
  accepted_at: NullableTimestampSchema,
  user: TeamMemberUserSchema.nullable(),
});

/** Team invite schema */
export const TeamInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});

/** List team members response */
export const ListTeamMembersResponseSchema = z.object({
  members: z.array(TeamMemberSchema),
});

/** List team invites response */
export const ListTeamInvitesResponseSchema = z.object({
  invites: z.array(TeamInviteSchema),
});

/** Invite member request */
export const InviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: WorkspaceMemberRoleSchema.default('member'),
});

/** Invite member response */
export const InviteMemberResponseSchema = z.object({
  invite: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }),
  invite_link: z.string(),
});

/** Update member role request */
export const UpdateMemberRoleRequestSchema = z.object({
  role: WorkspaceMemberRoleSchema,
});

// ============================================================================
// Billing Schemas
// ============================================================================

/** Subscription schema */
export const SubscriptionSchema = z.object({
  tier: z.string(),
  status: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
});

/** Invoice schema */
export const InvoiceSchema = z.object({
  id: z.string(),
  amount_due: z.number(),
  status: z.string(),
  created_at: z.string(),
  hosted_invoice_url: z.string().nullable(),
});

/** Payment method schema */
export const PaymentMethodSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last_four: z.string(),
  is_default: z.boolean(),
});

/** Billing overview response */
export const BillingOverviewResponseSchema = z.object({
  subscription: SubscriptionSchema.nullable(),
  invoices: z.array(InvoiceSchema),
  payment_methods: z.array(PaymentMethodSchema),
});

/** Checkout session request */
export const CheckoutSessionRequestSchema = z.object({
  tier: SubscriptionTierSchema,
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

/** Checkout session response */
export const CheckoutSessionResponseSchema = z.object({
  checkout_url: z.string(),
  session_id: z.string(),
});

/** Portal session response */
export const PortalSessionResponseSchema = z.object({
  portal_url: z.string(),
});

/** Change plan request */
export const ChangePlanRequestSchema = z.object({
  tier: SubscriptionTierSchema,
});

/** Change plan response */
export const ChangePlanResponseSchema = z.object({
  success: z.boolean(),
  subscription: z.unknown(),
});

/** Cancel subscription request */
export const CancelSubscriptionRequestSchema = z.object({
  cancel_immediately: z.boolean().default(false),
});

/** Cancel subscription response */
export const CancelSubscriptionResponseSchema = z.object({
  success: z.boolean(),
  access_until: z.string(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type WorkspaceListItem = z.infer<typeof WorkspaceListItemSchema>;
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;
export type WorkspaceMembership = z.infer<typeof WorkspaceMembershipSchema>;
export type ListWorkspacesResponse = z.infer<typeof ListWorkspacesResponseSchema>;
export type GetWorkspaceResponse = z.infer<typeof GetWorkspaceResponseSchema>;
export type WorkspaceUsageResponse = z.infer<typeof WorkspaceUsageResponseSchema>;
export type TeamMemberUser = z.infer<typeof TeamMemberUserSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type TeamInvite = z.infer<typeof TeamInviteSchema>;
export type ListTeamMembersResponse = z.infer<typeof ListTeamMembersResponseSchema>;
export type ListTeamInvitesResponse = z.infer<typeof ListTeamInvitesResponseSchema>;
export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;
export type InviteMemberResponse = z.infer<typeof InviteMemberResponseSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof UpdateMemberRoleRequestSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type BillingOverviewResponse = z.infer<typeof BillingOverviewResponseSchema>;
export type CheckoutSessionRequest = z.infer<typeof CheckoutSessionRequestSchema>;
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;
export type PortalSessionResponse = z.infer<typeof PortalSessionResponseSchema>;
export type ChangePlanRequest = z.infer<typeof ChangePlanRequestSchema>;
export type ChangePlanResponse = z.infer<typeof ChangePlanResponseSchema>;
export type CancelSubscriptionRequest = z.infer<typeof CancelSubscriptionRequestSchema>;
export type CancelSubscriptionResponse = z.infer<typeof CancelSubscriptionResponseSchema>;
