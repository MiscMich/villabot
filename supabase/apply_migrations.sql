-- ============================================================
-- CONSOLIDATED MIGRATIONS FOR CLUEBASE AI
-- Run this in PostgreSQL as postgres user (or supabase_admin)
-- Date: 2025-12-22
-- ============================================================

-- ============================================
-- MIGRATION 014: Platform Admin & Internal Accounts
-- ============================================

-- 1. Add platform admin flag to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

-- Index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin
ON user_profiles(is_platform_admin) WHERE is_platform_admin = TRUE;

-- 2. Add internal account flags to workspaces
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES user_profiles(id);

-- Index for internal workspace queries
CREATE INDEX IF NOT EXISTS idx_workspaces_internal
ON workspaces(is_internal) WHERE is_internal = TRUE;

-- 3. Platform-wide statistics view
CREATE OR REPLACE VIEW platform_stats AS
SELECT
  COUNT(DISTINCT w.id) AS total_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.is_internal = FALSE) AS paying_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.is_internal = TRUE) AS internal_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active') AS active_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'trialing') AS trialing_workspaces,
  COUNT(DISTINCT up.id) AS total_users,
  COUNT(DISTINCT up.id) FILTER (WHERE up.is_platform_admin = TRUE) AS admin_users,
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'starter' AND NOT w.is_internal) AS starter_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'pro' AND NOT w.is_internal) AS pro_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'business' AND NOT w.is_internal) AS business_workspaces,
  COALESCE(SUM(
    CASE
      WHEN s.status = 'active' AND NOT w.is_internal THEN
        CASE w.tier
          WHEN 'starter' THEN 24
          WHEN 'pro' THEN 66
          WHEN 'business' THEN 166
          ELSE 0
        END
      ELSE 0
    END
  ), 0) AS estimated_mrr,
  COUNT(DISTINCT d.id) AS total_documents,
  COUNT(DISTINCT ts.id) AS total_conversations,
  COUNT(DISTINCT b.id) AS total_bots,
  COUNT(DISTINCT w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '30 days') AS new_workspaces_30d,
  COUNT(DISTINCT w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '7 days') AS new_workspaces_7d
FROM workspaces w
LEFT JOIN user_profiles up ON TRUE
LEFT JOIN subscriptions s ON s.workspace_id = w.id AND s.status = 'active'
LEFT JOIN documents d ON d.workspace_id = w.id
LEFT JOIN thread_sessions ts ON ts.workspace_id = w.id
LEFT JOIN bots b ON b.workspace_id = w.id;

-- 4. Workspace details view for admin
CREATE OR REPLACE VIEW admin_workspace_details AS
SELECT
  w.id,
  w.name,
  w.slug,
  w.tier,
  w.status,
  w.is_internal,
  w.internal_notes,
  w.created_at,
  w.updated_at,
  w.trial_started_at,
  w.trial_ends_at,
  w.max_documents,
  w.max_queries_per_month,
  w.stripe_customer_id,
  w.stripe_subscription_id,
  (SELECT wm.user_id FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.role = 'owner' LIMIT 1) AS owner_id,
  (SELECT up.email FROM user_profiles up JOIN workspace_members wm ON up.id = wm.user_id WHERE wm.workspace_id = w.id AND wm.role = 'owner' LIMIT 1) AS owner_email,
  (SELECT up.full_name FROM user_profiles up JOIN workspace_members wm ON up.id = wm.user_id WHERE wm.workspace_id = w.id AND wm.role = 'owner' LIMIT 1) AS owner_name,
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
  (SELECT COUNT(*) FROM documents d WHERE d.workspace_id = w.id) AS document_count,
  (SELECT COUNT(*) FROM bots b WHERE b.workspace_id = w.id) AS bot_count,
  (SELECT COUNT(*) FROM thread_sessions ts WHERE ts.workspace_id = w.id) AS conversation_count,
  (SELECT COALESCE(SUM(ut.query_count), 0)
   FROM usage_tracking ut
   WHERE ut.workspace_id = w.id
   AND ut.period_start >= DATE_TRUNC('month', NOW())) AS queries_this_month,
  (SELECT MAX(ts.last_activity)
   FROM thread_sessions ts
   WHERE ts.workspace_id = w.id) AS last_activity
FROM workspaces w;

-- 5. Function to create internal workspace
CREATE OR REPLACE FUNCTION create_internal_workspace(
  p_name TEXT,
  p_owner_email TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM user_profiles WHERE email = p_owner_email;

  IF v_owner_id IS NULL THEN
    INSERT INTO user_profiles (email, full_name, is_platform_admin)
    VALUES (p_owner_email, SPLIT_PART(p_owner_email, '@', 1), FALSE)
    RETURNING id INTO v_owner_id;
  END IF;

  INSERT INTO workspaces (
    name, slug, tier, status, is_internal, internal_notes, created_by_admin,
    max_documents, max_queries_per_month, max_file_upload_mb, max_team_members, max_website_pages, max_bots
  )
  VALUES (
    p_name,
    LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '-', 'g')),
    'business', 'active', TRUE, p_notes, p_admin_id,
    999999, 999999, 1000, 999, 999999, 999
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_owner_id, 'owner');

  RETURN v_workspace_id;
END;
$$;

-- 6. Function to toggle platform admin status
CREATE OR REPLACE FUNCTION set_platform_admin(
  p_user_email TEXT,
  p_is_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET is_platform_admin = p_is_admin
  WHERE email = p_user_email;

  RETURN FOUND;
END;
$$;

-- 7. Audit log for admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);

-- 8. Grant permissions
GRANT SELECT ON platform_stats TO service_role;
GRANT SELECT ON admin_workspace_details TO service_role;
GRANT ALL ON admin_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION create_internal_workspace TO service_role;
GRANT EXECUTE ON FUNCTION set_platform_admin TO service_role;

-- ============================================
-- MIGRATION 015: Bot Health Monitoring
-- ============================================

-- 1. Create bot_health table
CREATE TABLE IF NOT EXISTS bot_health (
  bot_id UUID PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  is_running BOOLEAN NOT NULL DEFAULT false,
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_restart_at TIMESTAMPTZ,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_health_unhealthy ON bot_health(is_healthy) WHERE NOT is_healthy;
CREATE INDEX IF NOT EXISTS idx_bot_health_failures ON bot_health(consecutive_failures) WHERE consecutive_failures > 0;

-- 2. Create bot_health_history table
CREATE TABLE IF NOT EXISTS bot_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('health_check', 'restart_attempt', 'restart_success', 'restart_failure', 'error')),
  is_healthy BOOLEAN NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_health_history_bot_id ON bot_health_history(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_health_history_created_at ON bot_health_history(created_at DESC);

-- 3. Enable RLS on bot health tables
ALTER TABLE bot_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_health_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for bot_health
CREATE POLICY "Workspace owners can view their bot health"
  ON bot_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots b
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
      WHERE b.id = bot_health.bot_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can view all bot health"
  ON bot_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = true
    )
  );

CREATE POLICY "Service role full access to bot_health"
  ON bot_health FOR ALL
  USING (auth.role() = 'service_role');

-- 5. RLS policies for bot_health_history
CREATE POLICY "Workspace owners can view their bot health history"
  ON bot_health_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots b
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
      WHERE b.id = bot_health_history.bot_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can view all bot health history"
  ON bot_health_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = true
    )
  );

CREATE POLICY "Service role full access to bot_health_history"
  ON bot_health_history FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Function to log health history events
CREATE OR REPLACE FUNCTION log_bot_health_event(
  p_bot_id UUID,
  p_event_type TEXT,
  p_is_healthy BOOLEAN,
  p_consecutive_failures INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO bot_health_history (
    bot_id, event_type, is_healthy, consecutive_failures, error_message
  ) VALUES (
    p_bot_id, p_event_type, p_is_healthy, p_consecutive_failures, p_error_message
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- 7. Create view for bot health dashboard
CREATE OR REPLACE VIEW bot_health_summary AS
SELECT
  b.id,
  b.name,
  b.slug,
  b.workspace_id,
  b.status,
  COALESCE(bh.is_healthy, true) as is_healthy,
  COALESCE(bh.is_running, false) as is_running,
  COALESCE(bh.consecutive_failures, 0) as consecutive_failures,
  bh.last_check_at,
  bh.last_restart_at,
  bh.error_message,
  (
    SELECT COUNT(*)
    FROM bot_health_history bhh
    WHERE bhh.bot_id = b.id
    AND bhh.event_type = 'restart_success'
    AND bhh.created_at > now() - interval '24 hours'
  ) as restarts_last_24h
FROM bots b
LEFT JOIN bot_health bh ON bh.bot_id = b.id;

GRANT SELECT ON bot_health_summary TO authenticated;
GRANT SELECT ON bot_health_summary TO service_role;

-- ============================================
-- ADDITIONAL FIXES
-- ============================================

-- Enable RLS on bot_config table
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage config for workspace bots"
ON bot_config FOR ALL
USING (
  bot_id IN (
    SELECT id FROM bots b
    JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
    WHERE wm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role full access to bot_config"
ON bot_config FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- CLEANUP: Delete orphan data
-- ============================================

-- Delete orphan workspaces (no members)
DELETE FROM workspaces
WHERE id IN ('04d2e584-0a74-4102-b5da-5e1746336ea0', '7670c6ca-ac71-49e3-ad89-b4bc400ea60a');

-- Note: Orphan auth.users need to be deleted via Supabase Auth API:
-- - 4c99ded0-0099-463d-8180-753fc9dd6e8c (testuser@cluebase.ai)
-- - 31ca5996-4fa4-4c19-95cd-8abb17e83899 (mlopez0104788@gmail.com)

-- ============================================
-- SET PLATFORM ADMIN
-- ============================================

-- Set admin@cluebase.ai as platform admin
UPDATE user_profiles
SET is_platform_admin = true
WHERE id = 'ea8f9257-d630-4007-8468-fdf41fba81fa';

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Verify tables exist
SELECT 'bot_health' as table_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_health') as exists
UNION ALL
SELECT 'bot_health_history', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_health_history')
UNION ALL
SELECT 'admin_audit_log', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_log');

-- Verify columns exist
SELECT 'user_profiles.is_platform_admin' as column_path,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_platform_admin') as exists
UNION ALL
SELECT 'workspaces.is_internal',
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'is_internal');

-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('bot_config', 'bot_health', 'bot_health_history');

-- Verify admin set
SELECT id, email, is_platform_admin FROM user_profiles WHERE is_platform_admin = true;

-- Verify orphans deleted
SELECT COUNT(*) as orphan_workspaces FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.id IS NULL;

-- Done!
SELECT 'Migration complete!' as status;
