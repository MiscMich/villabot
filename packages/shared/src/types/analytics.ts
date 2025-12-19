/**
 * Analytics and metrics types
 */

export type AnalyticsEventType =
  | 'question_asked'
  | 'response_sent'
  | 'feedback_received'
  | 'document_synced'
  | 'fact_learned'
  | 'error_occurred';

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  createdAt: Date;
}

export interface DashboardStats {
  questionsToday: number;
  questionsThisWeek: number;
  questionsThisMonth: number;
  averageResponseTime: number;
  averageFeedbackRating: number;
  totalDocuments: number;
  totalChunks: number;
  lastDriveSync: Date | null;
  lastWebsiteScrape: Date | null;
  botStatus: 'online' | 'offline' | 'degraded';
  errorCount24h: number;
}

export interface QuestionAnalytics {
  question: string;
  count: number;
  averageConfidence: number;
  averageFeedback: number;
  lastAsked: Date;
}

export interface KnowledgeGap {
  question: string;
  confidence: number;
  occurrences: number;
  suggestedAction: string;
}

export interface UsageTrend {
  date: string;
  questionCount: number;
  uniqueUsers: number;
  averageResponseTime: number;
  feedbackScore: number;
}
