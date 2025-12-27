/**
 * Platform Feedback API Zod schemas
 * Covers feature requests, bug reports, and admin management
 */

import { z } from 'zod';
import { NullableTimestampSchema } from './common.js';

// ============================================================================
// Platform Feedback Enums
// ============================================================================

export const PlatformFeedbackTypeSchema = z.enum(['feature_request', 'bug_report', 'improvement', 'question']);
export const PlatformFeedbackStatusSchema = z.enum(['new', 'under_review', 'planned', 'in_progress', 'completed', 'declined', 'duplicate']);
export const PlatformFeedbackPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// ============================================================================
// Platform Feedback Schemas
// ============================================================================

/** User info for feedback */
export const FeedbackUserSchema = z.object({
  email: z.string(),
  full_name: z.string().nullable(),
});

/** Platform feedback list item */
export const PlatformFeedbackListItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.string(),
  priority: z.string(),
  admin_response: z.string().nullable(),
  upvotes: z.number(),
  has_voted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  user: FeedbackUserSchema.optional(),
});

/** Platform feedback detail */
export const PlatformFeedbackDetailSchema = PlatformFeedbackListItemSchema.extend({
  responded_by: z.string().nullable(),
  responded_at: NullableTimestampSchema,
  browser_info: z.record(z.unknown()).nullable(),
  page_url: z.string().nullable(),
});

// ============================================================================
// Platform Feedback API Requests
// ============================================================================

/** List platform feedback filters */
export const PlatformFeedbackFiltersSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

/** Create platform feedback request */
export const CreatePlatformFeedbackRequestSchema = z.object({
  type: PlatformFeedbackTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  browser_info: z.record(z.unknown()).optional(),
  page_url: z.string().optional(),
});

/** Update platform feedback request */
export const UpdatePlatformFeedbackRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** Admin update platform feedback request */
export const AdminUpdatePlatformFeedbackRequestSchema = z.object({
  status: PlatformFeedbackStatusSchema.optional(),
  priority: PlatformFeedbackPrioritySchema.optional(),
  admin_response: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================================
// Platform Feedback API Responses
// ============================================================================

/** List platform feedback response */
export const ListPlatformFeedbackResponseSchema = z.object({
  data: z.array(PlatformFeedbackListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

/** Create platform feedback response */
export const CreatePlatformFeedbackResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  status: z.string(),
});

/** Vote response */
export const VotePlatformFeedbackResponseSchema = z.object({
  upvotes: z.number(),
  has_voted: z.boolean(),
});

/** Platform feedback stats response */
export const PlatformFeedbackStatsResponseSchema = z.object({
  total: z.number(),
  byType: z.record(z.number()),
  byStatus: z.record(z.number()),
  byPriority: z.record(z.number()),
  byCategory: z.record(z.number()),
  recentCount: z.number(),
  averageResponseTime: z.number().nullable(),
});

// ============================================================================
// Platform Feedback Notes
// ============================================================================

/** Feedback note admin info */
export const FeedbackNoteAdminSchema = z.object({
  email: z.string(),
  full_name: z.string().nullable(),
});

/** Platform feedback note */
export const PlatformFeedbackNoteSchema = z.object({
  id: z.string().uuid(),
  note: z.string(),
  created_at: z.string(),
  admin: FeedbackNoteAdminSchema.optional(),
});

/** List feedback notes response */
export const ListFeedbackNotesResponseSchema = z.object({
  notes: z.array(PlatformFeedbackNoteSchema),
});

/** Add feedback note response */
export const AddFeedbackNoteResponseSchema = z.object({
  id: z.string().uuid(),
  note: z.string(),
  created_at: z.string(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PlatformFeedbackType = z.infer<typeof PlatformFeedbackTypeSchema>;
export type PlatformFeedbackStatus = z.infer<typeof PlatformFeedbackStatusSchema>;
export type PlatformFeedbackPriority = z.infer<typeof PlatformFeedbackPrioritySchema>;
export type FeedbackUser = z.infer<typeof FeedbackUserSchema>;
export type PlatformFeedbackListItem = z.infer<typeof PlatformFeedbackListItemSchema>;
export type PlatformFeedbackDetail = z.infer<typeof PlatformFeedbackDetailSchema>;
export type PlatformFeedbackFilters = z.infer<typeof PlatformFeedbackFiltersSchema>;
export type CreatePlatformFeedbackRequest = z.infer<typeof CreatePlatformFeedbackRequestSchema>;
export type UpdatePlatformFeedbackRequest = z.infer<typeof UpdatePlatformFeedbackRequestSchema>;
export type AdminUpdatePlatformFeedbackRequest = z.infer<typeof AdminUpdatePlatformFeedbackRequestSchema>;
export type ListPlatformFeedbackResponse = z.infer<typeof ListPlatformFeedbackResponseSchema>;
export type CreatePlatformFeedbackResponse = z.infer<typeof CreatePlatformFeedbackResponseSchema>;
export type VotePlatformFeedbackResponse = z.infer<typeof VotePlatformFeedbackResponseSchema>;
export type PlatformFeedbackStatsResponse = z.infer<typeof PlatformFeedbackStatsResponseSchema>;
export type FeedbackNoteAdmin = z.infer<typeof FeedbackNoteAdminSchema>;
export type PlatformFeedbackNote = z.infer<typeof PlatformFeedbackNoteSchema>;
export type ListFeedbackNotesResponse = z.infer<typeof ListFeedbackNotesResponseSchema>;
export type AddFeedbackNoteResponse = z.infer<typeof AddFeedbackNoteResponseSchema>;
