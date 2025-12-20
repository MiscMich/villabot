-- TeamBrain AI - Usage Tracking
-- Monthly usage metrics per workspace for subscription enforcement

-- ============================================
-- USAGE TRACKING TABLE
-- ============================================

CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Period (monthly)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Query Usage
  queries_count INTEGER DEFAULT 0,
  queries_limit INTEGER NOT NULL,

  -- Document Usage
  documents_count INTEGER DEFAULT 0,
  documents_limit INTEGER NOT NULL,

  -- Storage Usage (in bytes)
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT NOT NULL,

  -- Website Pages
  website_pages_count INTEGER DEFAULT 0,
  website_pages_limit INTEGER NOT NULL,

  -- Team Members
  team_members_count INTEGER DEFAULT 0,
  team_members_limit INTEGER NOT NULL,

  -- Bots
  bots_count INTEGER DEFAULT 0,
  bots_limit INTEGER NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per workspace per period
  UNIQUE(workspace_id, period_start)
);

-- ============================================
-- DAILY USAGE SNAPSHOTS (For analytics)
-- ============================================

CREATE TABLE usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Daily Metrics
  queries_count INTEGER DEFAULT 0,
  documents_added INTEGER DEFAULT 0,
  documents_removed INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,

  -- Unique per workspace per day
  UNIQUE(workspace_id, date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_usage_tracking_workspace ON usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_period ON usage_tracking(period_start, period_end);
CREATE INDEX idx_usage_tracking_workspace_period ON usage_tracking(workspace_id, period_start);

CREATE INDEX idx_usage_daily_workspace ON usage_daily(workspace_id);
CREATE INDEX idx_usage_daily_date ON usage_daily(date);
CREATE INDEX idx_usage_daily_workspace_date ON usage_daily(workspace_id, date);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get or create current month's usage tracking
CREATE OR REPLACE FUNCTION get_or_create_usage_tracking(p_workspace_id UUID)
RETURNS usage_tracking
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_workspace workspaces%ROWTYPE;
  v_usage usage_tracking%ROWTYPE;
BEGIN
  -- Get first day of current month
  v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Get workspace limits
  SELECT * INTO v_workspace FROM workspaces WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;

  -- Try to get existing record
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE workspace_id = p_workspace_id
    AND period_start = v_period_start;

  IF FOUND THEN
    RETURN v_usage;
  END IF;

  -- Create new record
  INSERT INTO usage_tracking (
    workspace_id,
    period_start,
    period_end,
    queries_limit,
    documents_limit,
    storage_limit_bytes,
    website_pages_limit,
    team_members_limit,
    bots_limit
  ) VALUES (
    p_workspace_id,
    v_period_start,
    v_period_end,
    v_workspace.max_queries_per_month,
    v_workspace.max_documents,
    v_workspace.max_file_upload_mb * 1024 * 1024 * 100,  -- 100x file limit for total storage
    v_workspace.max_website_pages,
    v_workspace.max_team_members,
    v_workspace.max_bots
  )
  RETURNING * INTO v_usage;

  RETURN v_usage;
END;
$$;

-- Increment query count
CREATE OR REPLACE FUNCTION increment_query_count(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_usage usage_tracking%ROWTYPE;
BEGIN
  -- Get or create current month's usage
  v_usage := get_or_create_usage_tracking(p_workspace_id);

  -- Check if over limit
  IF v_usage.queries_count >= v_usage.queries_limit THEN
    RETURN false;
  END IF;

  -- Increment count
  UPDATE usage_tracking
  SET
    queries_count = queries_count + 1,
    updated_at = NOW()
  WHERE id = v_usage.id;

  -- Also record in daily usage
  INSERT INTO usage_daily (workspace_id, date, queries_count)
  VALUES (p_workspace_id, CURRENT_DATE, 1)
  ON CONFLICT (workspace_id, date)
  DO UPDATE SET queries_count = usage_daily.queries_count + 1;

  RETURN true;
END;
$$;

-- Check if workspace can add more documents
CREATE OR REPLACE FUNCTION can_add_document(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_usage usage_tracking%ROWTYPE;
BEGIN
  v_usage := get_or_create_usage_tracking(p_workspace_id);
  RETURN v_usage.documents_count < v_usage.documents_limit;
END;
$$;

-- Check if workspace can add more bots
CREATE OR REPLACE FUNCTION can_add_bot(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_usage usage_tracking%ROWTYPE;
BEGIN
  v_usage := get_or_create_usage_tracking(p_workspace_id);
  RETURN v_usage.bots_count < v_usage.bots_limit;
END;
$$;

-- Check if workspace can add more team members
CREATE OR REPLACE FUNCTION can_add_team_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_usage usage_tracking%ROWTYPE;
BEGIN
  v_usage := get_or_create_usage_tracking(p_workspace_id);
  RETURN v_usage.team_members_count < v_usage.team_members_limit;
END;
$$;

-- Update document count
CREATE OR REPLACE FUNCTION update_document_count(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_usage usage_tracking%ROWTYPE;
BEGIN
  -- Get actual count
  SELECT COUNT(*) INTO v_count
  FROM documents
  WHERE workspace_id = p_workspace_id AND is_active = true;

  -- Update usage
  v_usage := get_or_create_usage_tracking(p_workspace_id);

  UPDATE usage_tracking
  SET
    documents_count = v_count,
    updated_at = NOW()
  WHERE id = v_usage.id;
END;
$$;

-- Update team member count
CREATE OR REPLACE FUNCTION update_team_member_count(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_usage usage_tracking%ROWTYPE;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND is_active = true;

  v_usage := get_or_create_usage_tracking(p_workspace_id);

  UPDATE usage_tracking
  SET
    team_members_count = v_count,
    updated_at = NOW()
  WHERE id = v_usage.id;
END;
$$;

-- Update bot count
CREATE OR REPLACE FUNCTION update_bot_count(p_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_usage usage_tracking%ROWTYPE;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM bots
  WHERE workspace_id = p_workspace_id;

  v_usage := get_or_create_usage_tracking(p_workspace_id);

  UPDATE usage_tracking
  SET
    bots_count = v_count,
    updated_at = NOW()
  WHERE id = v_usage.id;
END;
$$;

-- Get usage summary for workspace
CREATE OR REPLACE FUNCTION get_usage_summary(p_workspace_id UUID)
RETURNS TABLE (
  queries_used INTEGER,
  queries_limit INTEGER,
  queries_percent NUMERIC,
  documents_used INTEGER,
  documents_limit INTEGER,
  documents_percent NUMERIC,
  team_members_used INTEGER,
  team_members_limit INTEGER,
  bots_used INTEGER,
  bots_limit INTEGER,
  period_start DATE,
  period_end DATE,
  days_remaining INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_usage usage_tracking%ROWTYPE;
BEGIN
  v_usage := get_or_create_usage_tracking(p_workspace_id);

  RETURN QUERY
  SELECT
    v_usage.queries_count,
    v_usage.queries_limit,
    ROUND(100.0 * v_usage.queries_count / NULLIF(v_usage.queries_limit, 0), 1),
    v_usage.documents_count,
    v_usage.documents_limit,
    ROUND(100.0 * v_usage.documents_count / NULLIF(v_usage.documents_limit, 0), 1),
    v_usage.team_members_count,
    v_usage.team_members_limit,
    v_usage.bots_count,
    v_usage.bots_limit,
    v_usage.period_start,
    v_usage.period_end,
    (v_usage.period_end - CURRENT_DATE)::INTEGER;
END;
$$;

-- ============================================
-- TRIGGERS FOR AUTOMATIC COUNT UPDATES
-- ============================================

-- Update document count on document changes
CREATE OR REPLACE FUNCTION trigger_update_document_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_document_count(OLD.workspace_id);
    RETURN OLD;
  ELSE
    PERFORM update_document_count(NEW.workspace_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER documents_usage_update
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_document_count();

-- Update team member count on member changes
CREATE OR REPLACE FUNCTION trigger_update_team_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_team_member_count(OLD.workspace_id);
    RETURN OLD;
  ELSE
    PERFORM update_team_member_count(NEW.workspace_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER workspace_members_usage_update
  AFTER INSERT OR UPDATE OR DELETE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_team_member_count();

-- Update bot count on bot changes
CREATE OR REPLACE FUNCTION trigger_update_bot_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_bot_count(OLD.workspace_id);
    RETURN OLD;
  ELSE
    PERFORM update_bot_count(NEW.workspace_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER bots_usage_update
  AFTER INSERT OR UPDATE OR DELETE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_bot_count();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace's usage
CREATE POLICY "Users can view workspace usage"
  ON usage_tracking FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

CREATE POLICY "Service role full access to usage_tracking"
  ON usage_tracking FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view workspace daily usage"
  ON usage_daily FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

CREATE POLICY "Service role full access to usage_daily"
  ON usage_daily FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
