-- ============================================
-- FIX DATABASE ISSUES
-- Run this in Supabase Studio SQL Editor
-- Last Updated: 2025-12-23
-- ============================================

-- ============================================
-- PART 1: Fix trigger function for NULL workspace_id
-- ============================================

-- Fix trigger function to handle NULL workspace_id gracefully
CREATE OR REPLACE FUNCTION public.trigger_update_bot_count()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Only update if workspace_id is not null
    IF OLD.workspace_id IS NOT NULL THEN
      PERFORM update_bot_count(OLD.workspace_id);
    END IF;
    RETURN OLD;
  ELSE
    -- Only update if workspace_id is not null
    IF NEW.workspace_id IS NOT NULL THEN
      PERFORM update_bot_count(NEW.workspace_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;

-- ============================================
-- PART 2: Fix integer overflow in usage tracking
-- ============================================

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
  -- Early return for NULL workspace_id
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace ID cannot be NULL';
  END IF;

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

  -- Create new record (FIX: Use explicit BIGINT cast to prevent overflow)
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
    (v_workspace.max_file_upload_mb::BIGINT * 1024 * 1024 * 100),  -- FIXED: Cast to BIGINT first
    v_workspace.max_website_pages,
    v_workspace.max_team_members,
    v_workspace.max_bots
  )
  RETURNING * INTO v_usage;

  RETURN v_usage;
END;
$$;

-- ============================================
-- PART 3: Clean up orphaned data
-- ============================================

-- Delete orphan bots (workspace_id IS NULL)
DELETE FROM bot_health WHERE bot_id IN (
  SELECT id FROM bots WHERE workspace_id IS NULL
);
DELETE FROM bot_health_history WHERE bot_id IN (
  SELECT id FROM bots WHERE workspace_id IS NULL
);
DELETE FROM bots WHERE workspace_id IS NULL;

-- Delete orphan workspaces (no owner in workspace_members)
-- First, get the list of orphan workspace IDs
WITH orphan_workspaces AS (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
)
DELETE FROM bot_config WHERE workspace_id IN (SELECT id FROM orphan_workspaces);

WITH orphan_workspaces AS (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
)
DELETE FROM usage_tracking WHERE workspace_id IN (SELECT id FROM orphan_workspaces);

WITH orphan_workspaces AS (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
)
DELETE FROM usage_daily WHERE workspace_id IN (SELECT id FROM orphan_workspaces);

WITH orphan_workspaces AS (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
)
DELETE FROM subscriptions WHERE workspace_id IN (SELECT id FROM orphan_workspaces);

WITH orphan_workspaces AS (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
)
DELETE FROM workspace_invites WHERE workspace_id IN (SELECT id FROM orphan_workspaces);

-- Finally delete the orphan workspaces
DELETE FROM workspaces WHERE id IN (
  SELECT w.id
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id IS NULL
);

-- ============================================
-- PART 4: Verification
-- ============================================

SELECT '=== CLEANUP RESULTS ===' as info;

SELECT 'Remaining workspaces' as check_type, COUNT(*) as count FROM workspaces
UNION ALL
SELECT 'Remaining bots', COUNT(*) FROM bots
UNION ALL
SELECT 'Remaining workspace_members', COUNT(*) FROM workspace_members;

-- Show remaining workspaces with their owners
SELECT
  w.id,
  w.name,
  w.slug,
  w.tier,
  w.status,
  wm.user_id as owner_id,
  wm.role
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
ORDER BY w.created_at DESC;
