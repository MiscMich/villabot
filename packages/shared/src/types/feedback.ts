/**
 * Feedback types for bot response quality tracking
 */

export type FeedbackCategory =
  | 'incorrect'
  | 'incomplete'
  | 'confusing'
  | 'not_found'
  | 'other';

export interface ResponseFeedback {
  id: string;
  messageId: string | null;
  sessionId: string | null;
  botId: string | null;

  // Feedback details
  isHelpful: boolean;
  feedbackCategory: FeedbackCategory | null;
  feedbackText: string | null;

  // Context
  queryText: string | null;
  responseText: string | null;
  sourcesUsed: FeedbackSourceReference[];

  // Slack context
  slackUserId: string;
  slackChannelId: string;
  slackMessageTs: string | null;

  // Review status
  isReviewed: boolean;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;

  // Timestamps
  createdAt: Date;
}

export interface FeedbackSourceReference {
  documentId: string;
  documentTitle: string;
  category?: string;
}

export interface FeedbackSubmitInput {
  messageId?: string;
  sessionId?: string;
  slackMessageTs: string;
  slackUserId: string;
  slackChannelId: string;
  isHelpful: boolean;
  feedbackCategory?: FeedbackCategory;
  feedbackText?: string;
  queryText?: string;
  responseText?: string;
  sourcesUsed?: FeedbackSourceReference[];
  botId?: string;
}

export interface FeedbackStats {
  totalFeedback: number;
  helpfulCount: number;
  unhelpfulCount: number;
  satisfactionRate: number;  // Percentage 0-100
}

export interface FeedbackTrend {
  date: string;
  totalFeedback: number;
  helpfulCount: number;
  unhelpfulCount: number;
  satisfactionRate: number;
}

export interface FeedbackAnalytics {
  overall: FeedbackStats;
  byBot: Record<string, FeedbackStats>;
  trends: FeedbackTrend[];
  recentUnhelpful: ResponseFeedback[];
}

export interface FeedbackReviewInput {
  isReviewed: boolean;
  reviewedBy: string;
  reviewNotes?: string;
}
