/**
 * Feedback API Zod schemas
 * Covers response feedback and analytics
 */

import { z } from 'zod';

// ============================================================================
// Feedback Core Schemas
// ============================================================================

/** Response feedback schema */
export const ResponseFeedbackSchema = z.object({
  id: z.string().uuid(),
  is_helpful: z.boolean(),
  feedback_category: z.string().nullable(),
  feedback_text: z.string().nullable(),
  query_text: z.string().nullable(),
  response_text: z.string().nullable(),
  sources_used: z.array(z.string()),
  slack_user_id: z.string(),
  slack_channel_id: z.string(),
  is_reviewed: z.boolean(),
  created_at: z.string(),
});

/** Unhelpful feedback item (for analytics) */
export const UnhelpfulFeedbackItemSchema = z.object({
  id: z.string().uuid(),
  is_helpful: z.boolean(),
  feedback_text: z.string().nullable(),
  query_text: z.string().nullable(),
  created_at: z.string(),
});

// ============================================================================
// Feedback API Responses
// ============================================================================

/** List feedback response */
export const ListFeedbackResponseSchema = z.object({
  feedback: z.array(ResponseFeedbackSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/** Feedback analytics response */
export const FeedbackAnalyticsResponseSchema = z.object({
  overall: z.object({
    total_feedback: z.number(),
    helpful_count: z.number(),
    unhelpful_count: z.number(),
    satisfaction_rate: z.number(),
  }),
  byBot: z.record(z.object({
    botName: z.string(),
    stats: z.object({
      satisfaction_rate: z.number(),
    }),
  })),
  recentUnhelpful: z.array(UnhelpfulFeedbackItemSchema),
});

/** Feedback stats response */
export const FeedbackStatsResponseSchema = z.object({
  stats: z.object({
    totalFeedback: z.number(),
    averageRating: z.number().nullable(),
    positiveCount: z.number(),
    negativeCount: z.number(),
    responseQuality: z.record(z.number()),
    sourceQuality: z.record(z.number()),
  }),
});

/** Mark feedback reviewed request */
export const MarkFeedbackReviewedRequestSchema = z.object({
  isReviewed: z.boolean(),
  reviewedBy: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ResponseFeedback = z.infer<typeof ResponseFeedbackSchema>;
export type UnhelpfulFeedbackItem = z.infer<typeof UnhelpfulFeedbackItemSchema>;
export type ListFeedbackResponse = z.infer<typeof ListFeedbackResponseSchema>;
export type FeedbackAnalyticsResponse = z.infer<typeof FeedbackAnalyticsResponseSchema>;
export type FeedbackStatsResponse = z.infer<typeof FeedbackStatsResponseSchema>;
export type MarkFeedbackReviewedRequest = z.infer<typeof MarkFeedbackReviewedRequestSchema>;
