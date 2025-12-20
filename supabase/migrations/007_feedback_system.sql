-- Villa Paraiso Bot - Feedback System
-- Tracks user feedback on bot responses for quality monitoring

-- ============================================
-- FEEDBACK TABLE
-- ============================================

CREATE TABLE response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References (nullable for flexibility)
  message_id UUID REFERENCES thread_messages(id) ON DELETE CASCADE,
  session_id UUID REFERENCES thread_sessions(id) ON DELETE SET NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,

  -- Feedback details
  is_helpful BOOLEAN NOT NULL,            -- true = 👍, false = 👎
  feedback_category VARCHAR(50),          -- 'incorrect', 'incomplete', 'confusing', 'other'
  feedback_text TEXT,                     -- Optional user comments

  -- Context for analysis (denormalized for easier querying)
  query_text TEXT,                        -- Original question
  response_text TEXT,                     -- Bot's response
  sources_used JSONB DEFAULT '[]',        -- Which sources were cited

  -- Slack context
  slack_user_id VARCHAR NOT NULL,
  slack_channel_id VARCHAR NOT NULL,
  slack_message_ts VARCHAR,               -- Slack message timestamp

  -- Review status
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by VARCHAR,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- For analytics queries
CREATE INDEX idx_feedback_bot_date ON response_feedback(bot_id, created_at);
CREATE INDEX idx_feedback_helpful ON response_feedback(is_helpful, created_at);
CREATE INDEX idx_feedback_session ON response_feedback(session_id);
CREATE INDEX idx_feedback_reviewed ON response_feedback(is_reviewed, created_at);

-- For finding feedback by message
CREATE INDEX idx_feedback_message ON response_feedback(message_id);
CREATE INDEX idx_feedback_slack_ts ON response_feedback(slack_message_ts);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View for satisfaction rate calculations
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
  bot_id,
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_feedback,
  COUNT(*) FILTER (WHERE is_helpful = true) AS helpful_count,
  COUNT(*) FILTER (WHERE is_helpful = false) AS unhelpful_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_helpful = true) / NULLIF(COUNT(*), 0),
    1
  ) AS satisfaction_rate
FROM response_feedback
GROUP BY bot_id, DATE_TRUNC('day', created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get overall satisfaction rate for a bot
CREATE OR REPLACE FUNCTION get_satisfaction_rate(
  p_bot_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_feedback BIGINT,
  helpful_count BIGINT,
  unhelpful_count BIGINT,
  satisfaction_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_feedback,
    COUNT(*) FILTER (WHERE is_helpful = true) AS helpful_count,
    COUNT(*) FILTER (WHERE is_helpful = false) AS unhelpful_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE is_helpful = true) / NULLIF(COUNT(*), 0),
      1
    ) AS satisfaction_rate
  FROM response_feedback
  WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_bot_id IS NULL OR bot_id = p_bot_id);
END;
$$;

-- Get recent unhelpful feedback for review
CREATE OR REPLACE FUNCTION get_unhelpful_feedback(
  p_bot_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_only_unreviewed BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  query_text TEXT,
  response_text TEXT,
  feedback_category VARCHAR,
  feedback_text TEXT,
  sources_used JSONB,
  created_at TIMESTAMPTZ,
  is_reviewed BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rf.id,
    rf.query_text,
    rf.response_text,
    rf.feedback_category,
    rf.feedback_text,
    rf.sources_used,
    rf.created_at,
    rf.is_reviewed
  FROM response_feedback rf
  WHERE rf.is_helpful = false
    AND (p_bot_id IS NULL OR rf.bot_id = p_bot_id)
    AND (NOT p_only_unreviewed OR rf.is_reviewed = false)
  ORDER BY rf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role
CREATE POLICY "Service role full access to feedback" ON response_feedback
  FOR ALL USING (true) WITH CHECK (true);
