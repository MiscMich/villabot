-- TeamBrain AI - Enforce Workspace Isolation
-- CRITICAL: Adds NOT NULL constraints to workspace_id columns for data isolation
-- Also adds workspace_id to bot_channels and bot_drive_folders for direct workspace reference

-- ============================================
-- STEP 1: CREATE DEFAULT WORKSPACE FOR EXISTING DATA
-- ============================================

-- Create a default workspace if none exists (for migrating existing data)
INSERT INTO workspaces (
  id,
  name,
  slug,
  tier,
  status,
  max_documents,
  max_queries_per_month,
  max_file_upload_mb,
  max_team_members,
  max_website_pages,
  max_bots,
  settings
)
SELECT
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Default Workspace',
  'default',
  'pro',
  'active',
  10000,
  5000,
  50,
  10,
  1000,
  3,
  '{"brandColor": "#f59e0b", "timezone": "America/Chicago", "weeklyDigest": false}'::JSONB
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces LIMIT 1
);

-- ============================================
-- STEP 2: UPDATE EXISTING ROWS WITH DEFAULT WORKSPACE
-- ============================================

-- Get the default workspace ID (either existing or the one we just created)
DO $$
DECLARE
  default_ws_id UUID;
BEGIN
  -- Get the first workspace as default
  SELECT id INTO default_ws_id FROM workspaces LIMIT 1;

  IF default_ws_id IS NULL THEN
    RAISE EXCEPTION 'No workspace exists. Cannot proceed with migration.';
  END IF;

  -- Update documents with NULL workspace_id
  UPDATE documents SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update learned_facts with NULL workspace_id
  UPDATE learned_facts SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update thread_sessions with NULL workspace_id
  UPDATE thread_sessions SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update analytics with NULL workspace_id
  UPDATE analytics SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update error_logs with NULL workspace_id
  UPDATE error_logs SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update bots with NULL workspace_id
  UPDATE bots SET workspace_id = default_ws_id WHERE workspace_id IS NULL;

  -- Update response_feedback with NULL workspace_id
  UPDATE response_feedback SET workspace_id = default_ws_id WHERE workspace_id IS NULL;
END $$;

-- ============================================
-- STEP 3: ADD NOT NULL CONSTRAINTS
-- ============================================

-- Documents - workspace_id required
ALTER TABLE documents ALTER COLUMN workspace_id SET NOT NULL;

-- Learned facts - workspace_id required
ALTER TABLE learned_facts ALTER COLUMN workspace_id SET NOT NULL;

-- Thread sessions - workspace_id required
ALTER TABLE thread_sessions ALTER COLUMN workspace_id SET NOT NULL;

-- Analytics - workspace_id required
ALTER TABLE analytics ALTER COLUMN workspace_id SET NOT NULL;

-- Error logs - workspace_id required
ALTER TABLE error_logs ALTER COLUMN workspace_id SET NOT NULL;

-- Bots - workspace_id required
ALTER TABLE bots ALTER COLUMN workspace_id SET NOT NULL;

-- Response feedback - workspace_id required
ALTER TABLE response_feedback ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================
-- STEP 4: ADD WORKSPACE_ID TO BOT SUB-TABLES
-- ============================================

-- Add workspace_id to bot_channels
ALTER TABLE bot_channels
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add workspace_id to bot_drive_folders
ALTER TABLE bot_drive_folders
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Populate workspace_id from parent bots table
UPDATE bot_channels bc
SET workspace_id = b.workspace_id
FROM bots b
WHERE bc.bot_id = b.id;

UPDATE bot_drive_folders bdf
SET workspace_id = b.workspace_id
FROM bots b
WHERE bdf.bot_id = b.id;

-- Now add NOT NULL constraints to the new columns
ALTER TABLE bot_channels ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE bot_drive_folders ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================
-- STEP 5: CREATE INDEXES FOR NEW COLUMNS
-- ============================================

CREATE INDEX idx_bot_channels_workspace ON bot_channels(workspace_id);
CREATE INDEX idx_bot_drive_folders_workspace ON bot_drive_folders(workspace_id);

-- Composite indexes for common queries
CREATE INDEX idx_bot_channels_workspace_active ON bot_channels(workspace_id, is_active);
CREATE INDEX idx_bot_drive_folders_workspace_active ON bot_drive_folders(workspace_id, is_active);

-- ============================================
-- STEP 6: UPDATE RLS POLICIES FOR BOT SUB-TABLES
-- ============================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Service role full access to bot_channels" ON bot_channels;
DROP POLICY IF EXISTS "Service role full access to bot_drive_folders" ON bot_drive_folders;

-- Create workspace-aware RLS policies for bot_channels
CREATE POLICY "Users can view own workspace bot_channels"
  ON bot_channels FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage own workspace bot_channels"
  ON bot_channels FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

-- Create workspace-aware RLS policies for bot_drive_folders
CREATE POLICY "Users can view own workspace bot_drive_folders"
  ON bot_drive_folders FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage own workspace bot_drive_folders"
  ON bot_drive_folders FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

-- Service role bypass policies (for API with service role key)
CREATE POLICY "Service role bypass for bot_channels"
  ON bot_channels FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role bypass for bot_drive_folders"
  ON bot_drive_folders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- STEP 7: UPDATE FUNCTIONS FOR WORKSPACE CONSISTENCY
-- ============================================

-- Update get_bot_for_channel to also return workspace_id
DROP FUNCTION IF EXISTS get_bot_for_channel(VARCHAR, UUID);

CREATE OR REPLACE FUNCTION get_bot_for_channel(channel_id VARCHAR, p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE (
  bot_id UUID,
  workspace_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  found_bot_id UUID;
  found_workspace_id UUID;
BEGIN
  -- First check explicit channel mapping
  SELECT bc.bot_id, bc.workspace_id INTO found_bot_id, found_workspace_id
  FROM bot_channels bc
  INNER JOIN bots b ON bc.bot_id = b.id
  WHERE bc.slack_channel_id = channel_id
    AND bc.is_active = true
    AND b.status = 'active'
    AND (p_workspace_id IS NULL OR bc.workspace_id = p_workspace_id)
  LIMIT 1;

  -- If no mapping, return default bot for workspace
  IF found_bot_id IS NULL AND p_workspace_id IS NOT NULL THEN
    SELECT b.id, b.workspace_id INTO found_bot_id, found_workspace_id
    FROM bots b
    WHERE b.is_default = true
      AND b.status = 'active'
      AND b.workspace_id = p_workspace_id
    LIMIT 1;
  END IF;

  -- If still no bot and no workspace specified, return any default bot
  IF found_bot_id IS NULL AND p_workspace_id IS NULL THEN
    SELECT b.id, b.workspace_id INTO found_bot_id, found_workspace_id
    FROM bots b
    WHERE b.is_default = true
      AND b.status = 'active'
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT found_bot_id, found_workspace_id;
END;
$$;

-- ============================================
-- STEP 8: TRIGGER TO AUTO-SET WORKSPACE_ID ON BOT SUB-TABLES
-- ============================================

-- Function to automatically set workspace_id from parent bot
CREATE OR REPLACE FUNCTION set_workspace_from_bot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If workspace_id not set, get it from the parent bot
  IF NEW.workspace_id IS NULL AND NEW.bot_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM bots WHERE id = NEW.bot_id;
  END IF;

  -- Ensure consistency: workspace_id must match parent bot's workspace
  IF NEW.workspace_id IS NOT NULL AND NEW.bot_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM bots
      WHERE id = NEW.bot_id AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'Bot does not belong to the specified workspace';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to bot_channels
DROP TRIGGER IF EXISTS bot_channels_set_workspace ON bot_channels;
CREATE TRIGGER bot_channels_set_workspace
  BEFORE INSERT OR UPDATE ON bot_channels
  FOR EACH ROW
  EXECUTE FUNCTION set_workspace_from_bot();

-- Apply trigger to bot_drive_folders
DROP TRIGGER IF EXISTS bot_drive_folders_set_workspace ON bot_drive_folders;
CREATE TRIGGER bot_drive_folders_set_workspace
  BEFORE INSERT OR UPDATE ON bot_drive_folders
  FOR EACH ROW
  EXECUTE FUNCTION set_workspace_from_bot();

-- ============================================
-- VERIFICATION QUERY (Run manually to check)
-- ============================================

-- Check for any NULL workspace_id values (should return 0 rows)
-- SELECT 'documents' as table_name, COUNT(*) FROM documents WHERE workspace_id IS NULL
-- UNION ALL SELECT 'learned_facts', COUNT(*) FROM learned_facts WHERE workspace_id IS NULL
-- UNION ALL SELECT 'thread_sessions', COUNT(*) FROM thread_sessions WHERE workspace_id IS NULL
-- UNION ALL SELECT 'analytics', COUNT(*) FROM analytics WHERE workspace_id IS NULL
-- UNION ALL SELECT 'error_logs', COUNT(*) FROM error_logs WHERE workspace_id IS NULL
-- UNION ALL SELECT 'bots', COUNT(*) FROM bots WHERE workspace_id IS NULL
-- UNION ALL SELECT 'response_feedback', COUNT(*) FROM response_feedback WHERE workspace_id IS NULL
-- UNION ALL SELECT 'bot_channels', COUNT(*) FROM bot_channels WHERE workspace_id IS NULL
-- UNION ALL SELECT 'bot_drive_folders', COUNT(*) FROM bot_drive_folders WHERE workspace_id IS NULL;
