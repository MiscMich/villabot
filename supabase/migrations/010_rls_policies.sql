-- TeamBrain AI - Row Level Security Policies
-- Complete RLS policy set for multi-tenant isolation

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Note: bots, bot_drive_folders, bot_channels already have RLS from migration 006

-- ============================================
-- WORKSPACES POLICIES
-- ============================================

-- Users can view workspaces they belong to
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT get_user_workspaces()));

-- Only owners can update workspace settings
CREATE POLICY "Owners can update workspaces"
  ON workspaces FOR UPDATE
  USING (id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ))
  WITH CHECK (id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ));

-- Service role can do anything (for API operations)
CREATE POLICY "Service role full access to workspaces"
  ON workspaces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- USER PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can view profiles of workspace members
CREATE POLICY "Users can view workspace member profiles"
  ON user_profiles FOR SELECT
  USING (id IN (
    SELECT wm.user_id FROM workspace_members wm
    WHERE wm.workspace_id IN (SELECT get_user_workspaces())
  ));

-- Service role full access
CREATE POLICY "Service role full access to user_profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- WORKSPACE MEMBERS POLICIES
-- ============================================

-- Users can view members of their workspaces
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Admins can add/remove members
CREATE POLICY "Admins can manage workspace members"
  ON workspace_members FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

-- Service role full access
CREATE POLICY "Service role full access to workspace_members"
  ON workspace_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- WORKSPACE INVITES POLICIES
-- ============================================

-- Admins can manage invites
CREATE POLICY "Admins can manage invites"
  ON workspace_invites FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

-- Anyone can view invite by token (for redemption)
CREATE POLICY "Anyone can view invite by token"
  ON workspace_invites FOR SELECT
  USING (true);

-- Service role full access
CREATE POLICY "Service role full access to workspace_invites"
  ON workspace_invites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================

-- Users can view documents from their workspaces
CREATE POLICY "Users can view workspace documents"
  ON documents FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Admins can manage documents
CREATE POLICY "Admins can manage documents"
  ON documents FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

-- Service role full access
CREATE POLICY "Service role full access to documents"
  ON documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DOCUMENT CHUNKS POLICIES
-- ============================================

-- Users can view chunks from their workspace's documents
CREATE POLICY "Users can view workspace document chunks"
  ON document_chunks FOR SELECT
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (SELECT get_user_workspaces())
  ));

-- Admins can manage chunks
CREATE POLICY "Admins can manage document chunks"
  ON document_chunks FOR ALL
  USING (document_id IN (
    SELECT id FROM documents WHERE is_workspace_admin(workspace_id)
  ))
  WITH CHECK (document_id IN (
    SELECT id FROM documents WHERE is_workspace_admin(workspace_id)
  ));

-- Service role full access
CREATE POLICY "Service role full access to document_chunks"
  ON document_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- LEARNED FACTS POLICIES
-- ============================================

-- Users can view learned facts from their workspaces
CREATE POLICY "Users can view workspace learned facts"
  ON learned_facts FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Users can create learned facts in their workspaces
CREATE POLICY "Users can create learned facts"
  ON learned_facts FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_user_workspaces()));

-- Admins can manage learned facts
CREATE POLICY "Admins can manage learned facts"
  ON learned_facts FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

-- Service role full access
CREATE POLICY "Service role full access to learned_facts"
  ON learned_facts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- THREAD SESSIONS POLICIES
-- ============================================

-- Users can view thread sessions from their workspaces
CREATE POLICY "Users can view workspace thread sessions"
  ON thread_sessions FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Service role full access (for Slack bot operations)
CREATE POLICY "Service role full access to thread_sessions"
  ON thread_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- THREAD MESSAGES POLICIES
-- ============================================

-- Users can view messages from their workspace sessions
CREATE POLICY "Users can view workspace thread messages"
  ON thread_messages FOR SELECT
  USING (session_id IN (
    SELECT id FROM thread_sessions WHERE workspace_id IN (SELECT get_user_workspaces())
  ));

-- Service role full access
CREATE POLICY "Service role full access to thread_messages"
  ON thread_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ANALYTICS POLICIES
-- ============================================

-- Users can view analytics from their workspaces
CREATE POLICY "Users can view workspace analytics"
  ON analytics FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Service role full access
CREATE POLICY "Service role full access to analytics"
  ON analytics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ERROR LOGS POLICIES
-- ============================================

-- Admins can view error logs from their workspaces
CREATE POLICY "Admins can view workspace error logs"
  ON error_logs FOR SELECT
  USING (is_workspace_admin(workspace_id));

-- Service role full access
CREATE POLICY "Service role full access to error_logs"
  ON error_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- UPDATE EXISTING BOTS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Service role full access to bots" ON bots;
DROP POLICY IF EXISTS "Service role full access to bot_drive_folders" ON bot_drive_folders;
DROP POLICY IF EXISTS "Service role full access to bot_channels" ON bot_channels;

-- Users can view bots from their workspaces
CREATE POLICY "Users can view workspace bots"
  ON bots FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Admins can manage bots
CREATE POLICY "Admins can manage bots"
  ON bots FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

-- Service role full access
CREATE POLICY "Service role full access to bots"
  ON bots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bot drive folders
CREATE POLICY "Users can view workspace bot folders"
  ON bot_drive_folders FOR SELECT
  USING (bot_id IN (
    SELECT id FROM bots WHERE workspace_id IN (SELECT get_user_workspaces())
  ));

CREATE POLICY "Admins can manage bot folders"
  ON bot_drive_folders FOR ALL
  USING (bot_id IN (
    SELECT id FROM bots WHERE is_workspace_admin(workspace_id)
  ))
  WITH CHECK (bot_id IN (
    SELECT id FROM bots WHERE is_workspace_admin(workspace_id)
  ));

CREATE POLICY "Service role full access to bot_drive_folders"
  ON bot_drive_folders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bot channels
CREATE POLICY "Users can view workspace bot channels"
  ON bot_channels FOR SELECT
  USING (bot_id IN (
    SELECT id FROM bots WHERE workspace_id IN (SELECT get_user_workspaces())
  ));

CREATE POLICY "Admins can manage bot channels"
  ON bot_channels FOR ALL
  USING (bot_id IN (
    SELECT id FROM bots WHERE is_workspace_admin(workspace_id)
  ))
  WITH CHECK (bot_id IN (
    SELECT id FROM bots WHERE is_workspace_admin(workspace_id)
  ));

CREATE POLICY "Service role full access to bot_channels"
  ON bot_channels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RESPONSE FEEDBACK POLICIES
-- ============================================

-- Users can view feedback from their workspaces
CREATE POLICY "Users can view workspace feedback"
  ON response_feedback FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to feedback" ON response_feedback;
CREATE POLICY "Service role full access to response_feedback"
  ON response_feedback FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
