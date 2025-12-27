-- Migration: Security Hardening
-- Fixes RLS gaps and adds search_path to SECURITY DEFINER functions

-- ============================================
-- 1. Enable RLS on admin_audit_log (was missing)
-- ============================================

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view audit logs
CREATE POLICY "Platform admins can view audit logs"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = true
    )
  );

-- Service role has full access for logging
CREATE POLICY "Service role full access to audit logs"
  ON admin_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 2. Fix SECURITY DEFINER functions with search_path
-- Prevents schema search path injection attacks
-- ============================================

-- Fix log_bot_health_event function
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO bot_health_history (
    bot_id,
    event_type,
    is_healthy,
    consecutive_failures,
    error_message
  ) VALUES (
    p_bot_id,
    p_event_type,
    p_is_healthy,
    p_consecutive_failures,
    p_error_message
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Fix create_internal_workspace function
CREATE OR REPLACE FUNCTION create_internal_workspace(
  p_name TEXT,
  p_owner_email TEXT,
  p_notes TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Fix set_platform_admin function
CREATE OR REPLACE FUNCTION set_platform_admin(
  p_user_email TEXT,
  p_is_admin BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE user_profiles
  SET is_platform_admin = p_is_admin
  WHERE email = p_user_email;

  RETURN FOUND;
END;
$$;

-- Fix cleanup_old_errors function
CREATE OR REPLACE FUNCTION cleanup_old_errors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM error_logs
  WHERE resolved = true
    AND created_at < NOW() - INTERVAL '30 days';

  -- Also cleanup very old unresolved errors (keep 90 days)
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Fix get_user_workspaces function
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

-- Fix get_user_workspace_role function
CREATE OR REPLACE FUNCTION get_user_workspace_role(p_workspace_id UUID)
RETURNS workspace_member_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND is_active = true;
$$;

-- Fix is_workspace_admin function
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

-- Fix update_feedback_vote_count trigger function
CREATE OR REPLACE FUNCTION update_feedback_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- ============================================
-- 3. Add missing indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
ON admin_audit_log(target_type, target_id);

-- ============================================
-- 4. Add comments
-- ============================================

COMMENT ON POLICY "Platform admins can view audit logs" ON admin_audit_log IS
  'Only platform administrators can view the audit log of admin actions';

COMMENT ON POLICY "Service role full access to audit logs" ON admin_audit_log IS
  'Service role needs full access for logging admin actions from the API';
