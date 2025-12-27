/**
 * Analytics API Zod schemas
 * Covers overview, activity, events, and learned facts
 */

import { z } from 'zod';

// ============================================================================
// Overview Schemas
// ============================================================================

/** Overview response */
export const OverviewResponseSchema = z.object({
  documents: z.object({
    total: z.number(),
    active: z.number(),
    chunks: z.number(),
  }),
  activity: z.object({
    messagesThisWeek: z.number(),
    responsesThisWeek: z.number(),
  }),
  feedback: z.object({
    positive: z.number(),
    negative: z.number(),
    satisfactionRate: z.number().nullable(),
  }),
  knowledge: z.object({
    learnedFacts: z.number(),
  }),
});

// ============================================================================
// Activity Schemas
// ============================================================================

/** Activity data point */
export const ActivityDataPointSchema = z.object({
  date: z.string(),
  messages: z.number(),
  responses: z.number(),
});

/** Activity response */
export const ActivityResponseSchema = z.object({
  data: z.array(ActivityDataPointSchema),
  period: z.object({
    start: z.string(),
    end: z.string(),
    days: z.number(),
  }),
});

// ============================================================================
// Events Schemas
// ============================================================================

/** Event schema */
export const EventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  event_data: z.record(z.unknown()),
  created_at: z.string(),
});

/** Events response */
export const EventsResponseSchema = z.object({
  events: z.array(EventSchema),
});

// ============================================================================
// Learned Facts Schemas
// ============================================================================

/** Learned fact schema */
export const LearnedFactSchema = z.object({
  id: z.string().uuid(),
  fact: z.string(),
  source: z.string(),
  is_verified: z.boolean(),
  created_at: z.string(),
});

/** Learned facts response */
export const LearnedFactsResponseSchema = z.object({
  facts: z.array(LearnedFactSchema),
});

/** Create fact request */
export const CreateFactRequestSchema = z.object({
  fact: z.string().min(1),
  source: z.string().optional(),
});

/** Verify fact request */
export const VerifyFactRequestSchema = z.object({
  is_verified: z.boolean(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type OverviewResponse = z.infer<typeof OverviewResponseSchema>;
export type ActivityDataPoint = z.infer<typeof ActivityDataPointSchema>;
export type ActivityResponse = z.infer<typeof ActivityResponseSchema>;
export type Event = z.infer<typeof EventSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
export type LearnedFact = z.infer<typeof LearnedFactSchema>;
export type LearnedFactsResponse = z.infer<typeof LearnedFactsResponseSchema>;
export type CreateFactRequest = z.infer<typeof CreateFactRequestSchema>;
export type VerifyFactRequest = z.infer<typeof VerifyFactRequestSchema>;
