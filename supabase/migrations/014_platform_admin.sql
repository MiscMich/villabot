-- Migration: Platform Admin & Internal Accounts
-- Adds platform admin capabilities and internal/test account support

-- ============================================
-- 1. Add platform admin flag to user_profiles
-- ============================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

-- Index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin
ON user_profiles(is_platform_admin) WHERE is_platform_admin = TRUE;

-- ============================================
-- 2. Add internal account flag to workspaces
-- ============================================

-- Internal accounts bypass billing and have no usage limits
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES user_profiles(id);

-- Index for internal workspace queries
CREATE INDEX IF NOT EXISTS idx_workspaces_internal
ON workspaces(is_internal) WHERE is_internal = TRUE;

-- ============================================
-- 3. Platform-wide statistics view
-- ============================================

CREATE OR REPLACE VIEW platform_stats AS
SELECT
  -- Workspace counts
  COUNT(DISTINCT w.id) AS total_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.is_internal = FALSE) AS paying_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.is_internal = TRUE) AS internal_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active') AS active_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'trialing') AS trialing_workspaces,

  -- User counts
  COUNT(DISTINCT up.id) AS total_users,
  COUNT(DISTINCT up.id) FILTER (WHERE up.is_platform_admin = TRUE) AS admin_users,

  -- Subscription breakdown
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'starter' AND NOT w.is_internal) AS starter_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'pro' AND NOT w.is_internal) AS pro_workspaces,
  COUNT(DISTINCT w.id) FILTER (WHERE w.tier = 'business' AND NOT w.is_internal) AS business_workspaces,

  -- Revenue (from subscriptions table for accuracy)
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

  -- Activity metrics
  COUNT(DISTINCT d.id) AS total_documents,
  COUNT(DISTINCT ts.id) AS total_conversations,
  COUNT(DISTINCT b.id) AS total_bots,

  -- Time-based
  COUNT(DISTINCT w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '30 days') AS new_workspaces_30d,
  COUNT(DISTINCT w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '7 days') AS new_workspaces_7d

FROM workspaces w
LEFT JOIN user_profiles up ON TRUE
LEFT JOIN subscriptions s ON s.workspace_id = w.id AND s.status = 'active'
LEFT JOIN documents d ON d.workspace_id = w.id
LEFT JOIN thread_sessions ts ON ts.workspace_id = w.id
LEFT JOIN bots b ON b.workspace_id = w.id;

-- ============================================
-- 4. Workspace details view for admin
-- ============================================

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

  -- Owner info
  owner.id AS owner_id,
  owner.email AS owner_email,
  owner.full_name AS owner_name,

  -- Counts
  (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
  (SELECT COUNT(*) FROM documents d WHERE d.workspace_id = w.id) AS document_count,
  (SELECT COUNT(*) FROM bots b WHERE b.workspace_id = w.id) AS bot_count,
  (SELECT COUNT(*) FROM thread_sessions ts WHERE ts.workspace_id = w.id) AS conversation_count,

  -- Usage this month
  (SELECT COALESCE(SUM(ut.query_count), 0)
   FROM usage_tracking ut
   WHERE ut.workspace_id = w.id
   AND ut.period_start >= DATE_TRUNC('month', NOW())) AS queries_this_month,

  -- Last activity
  (SELECT MAX(ts.last_activity)
   FROM thread_sessions ts
   WHERE ts.workspace_id = w.id) AS last_activity

FROM workspaces w
LEFT JOIN user_profiles owner ON owner.id = w.owner_id;

-- ============================================
-- 5. Function to create internal workspace
-- ============================================

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
  -- Get or create owner profile
  SELECT id INTO v_owner_id FROM user_profiles WHERE email = p_owner_email;

  IF v_owner_id IS NULL THEN
    -- Create a placeholder profile (user will be created on first login)
    INSERT INTO user_profiles (email, full_name, is_platform_admin)
    VALUES (p_owner_email, SPLIT_PART(p_owner_email, '@', 1), FALSE)
    RETURNING id INTO v_owner_id;
  END IF;

  -- Create workspace with internal flag
  INSERT INTO workspaces (
    name,
    slug,
    owner_id,
    tier,
    status,
    is_internal,
    internal_notes,
    created_by_admin,
    -- Set unlimited limits for internal
    max_documents,
    max_queries_per_month,
    max_file_upload_mb,
    max_team_members,
    max_website_pages,
    max_bots
  )
  VALUES (
    p_name,
    LOWER(REGEXP_REPLACE(p_name, '[^a-zA-Z0-9]', '-', 'g')),
    v_owner_id,
    'business',  -- Give internal accounts business tier features
    'active',
    TRUE,
    p_notes,
    p_admin_id,
    -- Unlimited limits
    999999,
    999999,
    1000,
    999,
    999999,
    999
  )
  RETURNING id INTO v_workspace_id;

  -- Add owner as workspace member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_owner_id, 'owner');

  RETURN v_workspace_id;
END;
$$;

-- ============================================
-- 6. Function to toggle platform admin status
-- ============================================

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

-- ============================================
-- 7. RLS Policy for admin access
-- ============================================

-- Allow platform admins to read all workspaces
CREATE POLICY admin_read_all_workspaces ON workspaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = TRUE
    )
  );

-- Allow platform admins to read all user profiles
CREATE POLICY admin_read_all_users ON user_profiles
  FOR SELECT
  USING (
    is_platform_admin = TRUE
    OR id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = TRUE
    )
  );

-- ============================================
-- 8. Audit log for admin actions
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50), -- 'workspace', 'user', 'subscription'
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);

-- ============================================
-- 9. Grant permissions
-- ============================================

-- Grant access to service role
GRANT SELECT ON platform_stats TO service_role;
GRANT SELECT ON admin_workspace_details TO service_role;
GRANT ALL ON admin_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION create_internal_workspace TO service_role;
GRANT EXECUTE ON FUNCTION set_platform_admin TO service_role;

-- ============================================
-- Comments
-- ============================================

COMMENT ON COLUMN user_profiles.is_platform_admin IS 'Platform-wide admin access for TeamBrain staff';
COMMENT ON COLUMN workspaces.is_internal IS 'Internal/test account - bypasses billing, unlimited usage';
COMMENT ON VIEW platform_stats IS 'Aggregate statistics for platform admin dashboard';
COMMENT ON VIEW admin_workspace_details IS 'Detailed workspace view for admin panel';
COMMENT ON FUNCTION create_internal_workspace IS 'Creates internal workspace with unlimited access';
