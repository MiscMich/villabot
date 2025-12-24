-- Migration: Platform Feedback System
-- Description: Add platform-level user feedback for feature requests, bug reports, and general suggestions
-- This is distinct from response_feedback which tracks individual bot response quality

-- Create feedback type enum
CREATE TYPE platform_feedback_type AS ENUM (
  'feature_request',
  'bug_report',
  'improvement',
  'question',
  'other'
);

-- Create feedback status enum
CREATE TYPE platform_feedback_status AS ENUM (
  'new',
  'under_review',
  'planned',
  'in_progress',
  'completed',
  'declined',
  'duplicate'
);

-- Create priority enum
CREATE TYPE platform_feedback_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Platform feedback table
CREATE TABLE IF NOT EXISTS platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feedback content
  type platform_feedback_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,

  -- Categorization
  category VARCHAR(50), -- 'dashboard', 'bots', 'documents', 'search', 'billing', 'other'
  tags TEXT[] DEFAULT '{}',

  -- Status tracking
  status platform_feedback_status NOT NULL DEFAULT 'new',
  priority platform_feedback_priority DEFAULT 'medium',

  -- Admin response
  admin_response TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,

  -- Voting/engagement
  upvotes INTEGER DEFAULT 0,

  -- System metadata
  browser_info JSONB, -- User agent, platform info for bugs
  page_url TEXT, -- Where feedback was submitted from

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track who upvoted (prevent duplicate votes)
CREATE TABLE IF NOT EXISTS platform_feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES platform_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

-- Admin notes/internal comments on feedback
CREATE TABLE IF NOT EXISTS platform_feedback_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES platform_feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_platform_feedback_workspace ON platform_feedback(workspace_id);
CREATE INDEX idx_platform_feedback_user ON platform_feedback(user_id);
CREATE INDEX idx_platform_feedback_type ON platform_feedback(type);
CREATE INDEX idx_platform_feedback_status ON platform_feedback(status);
CREATE INDEX idx_platform_feedback_priority ON platform_feedback(priority);
CREATE INDEX idx_platform_feedback_created ON platform_feedback(created_at DESC);
CREATE INDEX idx_platform_feedback_votes_feedback ON platform_feedback_votes(feedback_id);
CREATE INDEX idx_platform_feedback_notes_feedback ON platform_feedback_notes(feedback_id);

-- Enable RLS
ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_feedback_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_feedback_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_feedback

-- Users can view all feedback in their workspace
CREATE POLICY "Users can view workspace feedback"
  ON platform_feedback FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can create feedback in their workspace
CREATE POLICY "Users can create feedback"
  ON platform_feedback FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can update their own feedback (limited fields handled at API level)
CREATE POLICY "Users can update own feedback"
  ON platform_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own feedback
CREATE POLICY "Users can delete own feedback"
  ON platform_feedback FOR DELETE
  USING (user_id = auth.uid());

-- Platform admins can do everything
CREATE POLICY "Platform admins full access"
  ON platform_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_platform_admin' = 'true'
    )
  );

-- RLS Policies for platform_feedback_votes

-- Users can view votes in their workspace's feedback
CREATE POLICY "Users can view votes"
  ON platform_feedback_votes FOR SELECT
  USING (
    feedback_id IN (
      SELECT id FROM platform_feedback
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can vote on workspace feedback
CREATE POLICY "Users can vote"
  ON platform_feedback_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    feedback_id IN (
      SELECT id FROM platform_feedback
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can remove their vote
CREATE POLICY "Users can remove own vote"
  ON platform_feedback_votes FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for platform_feedback_notes (admin only)

CREATE POLICY "Admins can view notes"
  ON platform_feedback_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.role = 'admin'
      AND wm.workspace_id IN (
        SELECT workspace_id FROM platform_feedback WHERE id = feedback_id
      )
    )
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'is_platform_admin' = 'true'
    )
  );

CREATE POLICY "Admins can create notes"
  ON platform_feedback_notes FOR INSERT
  WITH CHECK (
    admin_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.workspace_id IN (
          SELECT workspace_id FROM platform_feedback WHERE id = feedback_id
        )
      )
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'is_platform_admin' = 'true'
      )
    )
  );

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_feedback_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE platform_feedback
    SET upvotes = upvotes + 1
    WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE platform_feedback
    SET upvotes = upvotes - 1
    WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update vote counts
CREATE TRIGGER trigger_update_feedback_votes
  AFTER INSERT OR DELETE ON platform_feedback_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_vote_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_platform_feedback_updated_at
  BEFORE UPDATE ON platform_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_feedback_updated_at();

-- Add comment for documentation
COMMENT ON TABLE platform_feedback IS 'User-submitted feedback about the platform (feature requests, bugs, suggestions). Distinct from response_feedback which tracks individual bot response quality.';
