/**
 * Platform Feedback types for user-submitted feature requests, bug reports, and suggestions
 * This is distinct from ResponseFeedback which tracks individual bot response quality
 */

export type PlatformFeedbackType =
  | 'feature_request'
  | 'bug_report'
  | 'improvement'
  | 'question'
  | 'other';

export type PlatformFeedbackStatus =
  | 'new'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'duplicate';

export type PlatformFeedbackPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type PlatformFeedbackCategory =
  | 'dashboard'
  | 'bots'
  | 'documents'
  | 'search'
  | 'billing'
  | 'integrations'
  | 'performance'
  | 'security'
  | 'other';

export interface PlatformFeedback {
  id: string;
  workspace_id: string;
  user_id: string;

  // Feedback content
  type: PlatformFeedbackType;
  title: string;
  description: string;

  // Categorization
  category: PlatformFeedbackCategory | null;
  tags: string[];

  // Status tracking
  status: PlatformFeedbackStatus;
  priority: PlatformFeedbackPriority;

  // Admin response
  admin_response: string | null;
  responded_by: string | null;
  responded_at: Date | null;

  // Voting
  upvotes: number;
  has_voted?: boolean; // Client-side: whether current user voted

  // System metadata
  browser_info: BrowserInfo | null;
  page_url: string | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;

  // Joined data (optional)
  user?: {
    email: string;
    full_name: string | null;
  };
  workspace?: {
    name: string;
    slug: string;
  };
}

export interface BrowserInfo {
  userAgent?: string;
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface PlatformFeedbackNote {
  id: string;
  feedback_id: string;
  admin_id: string;
  note: string;
  created_at: Date;
  admin?: {
    email: string;
    full_name: string | null;
  };
}

export interface PlatformFeedbackVote {
  id: string;
  feedback_id: string;
  user_id: string;
  created_at: Date;
}

// Input types for API endpoints

export interface CreatePlatformFeedbackInput {
  type: PlatformFeedbackType;
  title: string;
  description: string;
  category?: PlatformFeedbackCategory;
  tags?: string[];
  browser_info?: BrowserInfo;
  page_url?: string;
}

export interface UpdatePlatformFeedbackInput {
  title?: string;
  description?: string;
  category?: PlatformFeedbackCategory;
  tags?: string[];
}

export interface AdminUpdatePlatformFeedbackInput {
  status?: PlatformFeedbackStatus;
  priority?: PlatformFeedbackPriority;
  admin_response?: string;
  category?: PlatformFeedbackCategory;
  tags?: string[];
}

export interface AddFeedbackNoteInput {
  note: string;
}

// Analytics/Stats types

export interface PlatformFeedbackStats {
  total: number;
  byType: Record<PlatformFeedbackType, number>;
  byStatus: Record<PlatformFeedbackStatus, number>;
  byPriority: Record<PlatformFeedbackPriority, number>;
  byCategory: Record<string, number>;
  recentCount: number; // Last 7 days
  averageResponseTime: number | null; // Hours to first admin response
}

export interface PlatformFeedbackFilters {
  type?: PlatformFeedbackType;
  status?: PlatformFeedbackStatus;
  priority?: PlatformFeedbackPriority;
  category?: PlatformFeedbackCategory;
  search?: string;
  user_id?: string;
  from_date?: string;
  to_date?: string;
  sort_by?: 'created_at' | 'upvotes' | 'priority' | 'status';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedPlatformFeedback {
  data: PlatformFeedback[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
