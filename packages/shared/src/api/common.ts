/**
 * Common Zod schemas for API contracts
 * Shared types used across multiple API endpoints
 */

import { z } from 'zod';

// ============================================================================
// Base Response Schemas
// ============================================================================

/** Standard success response */
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/** Standard error response */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/** Pagination input */
export const PaginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

/** Pagination response metadata */
export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// ============================================================================
// Common Field Schemas
// ============================================================================

/** UUID string */
export const UUIDSchema = z.string().uuid();

/** ISO timestamp string */
export const TimestampSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

/** Nullable timestamp */
export const NullableTimestampSchema = z.string().nullable();

/** Slug pattern (lowercase letters, numbers, hyphens) */
export const SlugSchema = z.string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens');

// ============================================================================
// Enum Schemas (from database)
// ============================================================================

export const BotStatusSchema = z.enum(['active', 'inactive', 'configuring']);
export const BotTypeSchema = z.enum(['operations', 'marketing', 'sales', 'hr', 'technical', 'general']);
export const DocumentCategorySchema = z.enum(['shared', 'operations', 'marketing', 'sales', 'hr', 'technical', 'custom']);
export const DocumentSourceTypeSchema = z.enum(['google_drive', 'website']);
export const SubscriptionTierSchema = z.enum(['starter', 'pro', 'business']);
export const SubscriptionStatusSchema = z.enum(['active', 'inactive', 'past_due', 'canceled', 'trialing', 'paused']);
export const WorkspaceMemberRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

// ============================================================================
// Health Check
// ============================================================================

export const HealthResponseSchema = z.object({
  status: z.string(),
  uptime: z.number(),
  services: z.record(z.boolean()),
});

// ============================================================================
// Type Exports (inferred from Zod schemas)
// ============================================================================

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type PaginationInput = z.infer<typeof PaginationInputSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type BotStatus = z.infer<typeof BotStatusSchema>;
export type BotType = z.infer<typeof BotTypeSchema>;
export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;
export type DocumentSourceType = z.infer<typeof DocumentSourceTypeSchema>;
export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type WorkspaceMemberRole = z.infer<typeof WorkspaceMemberRoleSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
