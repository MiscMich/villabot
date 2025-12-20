-- TeamBrain AI - Add Workspace ID to Existing Tables
-- Adds tenant isolation to all existing data tables

-- ============================================
-- ADD WORKSPACE_ID TO EXISTING TABLES
-- ============================================

-- Documents table
ALTER TABLE documents
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Learned facts table
ALTER TABLE learned_facts
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Thread sessions table
ALTER TABLE thread_sessions
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Analytics table
ALTER TABLE analytics
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Error logs table
ALTER TABLE error_logs
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Bots table
ALTER TABLE bots
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Response feedback table
ALTER TABLE response_feedback
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- ============================================
-- CREATE INDEXES FOR WORKSPACE_ID
-- ============================================

CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_learned_facts_workspace ON learned_facts(workspace_id);
CREATE INDEX idx_thread_sessions_workspace ON thread_sessions(workspace_id);
CREATE INDEX idx_analytics_workspace ON analytics(workspace_id);
CREATE INDEX idx_error_logs_workspace ON error_logs(workspace_id);
CREATE INDEX idx_bots_workspace ON bots(workspace_id);
CREATE INDEX idx_response_feedback_workspace ON response_feedback(workspace_id);

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Documents by workspace and active status
CREATE INDEX idx_documents_workspace_active ON documents(workspace_id, is_active);

-- Bots by workspace and status
CREATE INDEX idx_bots_workspace_status ON bots(workspace_id, status);

-- Analytics by workspace and date
CREATE INDEX idx_analytics_workspace_created ON analytics(workspace_id, created_at);

-- Thread sessions by workspace and activity
CREATE INDEX idx_thread_sessions_workspace_activity ON thread_sessions(workspace_id, last_activity);

-- ============================================
-- UPDATE HYBRID SEARCH FOR WORKSPACE FILTERING
-- ============================================

-- Drop old function signature
DROP FUNCTION IF EXISTS hybrid_search(TEXT, VECTOR(768), INT, FLOAT, FLOAT, UUID, BOOLEAN);

-- Create new function with workspace filtering
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5,
  p_workspace_id UUID DEFAULT NULL,       -- Workspace filter (required for multi-tenant)
  p_bot_id UUID DEFAULT NULL,             -- Optional: Filter to specific bot's knowledge
  include_shared BOOLEAN DEFAULT true     -- Include shared documents
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_id UUID,
  similarity FLOAT,
  rank_score FLOAT,
  category document_category,
  source_title VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
  bot_categories document_category[];
BEGIN
  -- Get categories accessible by this bot
  IF p_bot_id IS NOT NULL THEN
    SELECT categories INTO bot_categories FROM bots WHERE bots.id = p_bot_id;
  END IF;

  RETURN QUERY
  WITH accessible_docs AS (
    -- Get document IDs this workspace/bot can access
    SELECT d.id as doc_id
    FROM documents d
    WHERE d.is_active = true
      -- Must belong to workspace (required for multi-tenant)
      AND (p_workspace_id IS NULL OR d.workspace_id = p_workspace_id)
      AND (
        -- Shared documents (if include_shared is true)
        (include_shared AND d.category = 'shared')
        -- Bot-specific documents
        OR (p_bot_id IS NOT NULL AND d.bot_id = p_bot_id)
        -- Documents in bot's accessible categories
        OR (p_bot_id IS NOT NULL AND d.category = ANY(bot_categories))
        -- If no bot specified, return all workspace documents
        OR p_bot_id IS NULL
      )
  ),
  vector_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS vector_rank
    FROM document_chunks dc
    INNER JOIN accessible_docs ad ON dc.document_id = ad.doc_id
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> query_embedding
    LIMIT 30
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      ts_rank(dc.fts, plainto_tsquery('english', query_text)) AS text_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(dc.fts, plainto_tsquery('english', query_text)) DESC) AS keyword_rank
    FROM document_chunks dc
    INNER JOIN accessible_docs ad ON dc.document_id = ad.doc_id
    WHERE dc.fts @@ plainto_tsquery('english', query_text)
    ORDER BY text_rank DESC
    LIMIT 30
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.similarity, 0::FLOAT) AS similarity,
      (vector_weight / (60 + COALESCE(v.vector_rank, 1000))) +
      (keyword_weight / (60 + COALESCE(k.keyword_rank, 1000))) AS rank_score
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT
    c.id,
    c.content,
    c.document_id,
    c.similarity,
    c.rank_score,
    d.category,
    d.title as source_title
  FROM combined c
  INNER JOIN documents d ON c.document_id = d.id
  ORDER BY
    CASE d.category WHEN 'shared' THEN 1 ELSE 0 END,  -- Prioritize bot-specific first
    d.priority DESC,
    c.rank_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- UPDATE BOT STATS FUNCTION FOR WORKSPACE
-- ============================================

DROP FUNCTION IF EXISTS get_bot_stats(UUID);

CREATE OR REPLACE FUNCTION get_bot_stats(p_bot_id UUID, p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_documents BIGINT,
  total_chunks BIGINT,
  total_conversations BIGINT,
  total_messages BIGINT,
  active_channels BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM documents d
     WHERE (d.bot_id = p_bot_id OR (d.category = 'shared' AND (SELECT include_shared_knowledge FROM bots WHERE id = p_bot_id)))
       AND (p_workspace_id IS NULL OR d.workspace_id = p_workspace_id)),
    (SELECT COUNT(*) FROM document_chunks dc
     INNER JOIN documents d ON dc.document_id = d.id
     WHERE (d.bot_id = p_bot_id OR d.category = 'shared')
       AND (p_workspace_id IS NULL OR d.workspace_id = p_workspace_id)),
    (SELECT COUNT(*) FROM thread_sessions
     WHERE bot_id = p_bot_id
       AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)),
    (SELECT COUNT(*) FROM thread_messages tm
     INNER JOIN thread_sessions ts ON tm.session_id = ts.id
     WHERE ts.bot_id = p_bot_id
       AND (p_workspace_id IS NULL OR ts.workspace_id = p_workspace_id)),
    (SELECT COUNT(*) FROM bot_channels WHERE bot_id = p_bot_id AND is_active = true);
END;
$$;

-- ============================================
-- UPDATE GET BOT FOR CHANNEL FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS get_bot_for_channel(VARCHAR);

CREATE OR REPLACE FUNCTION get_bot_for_channel(channel_id VARCHAR, p_workspace_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  found_bot_id UUID;
BEGIN
  -- First check explicit channel mapping
  SELECT bc.bot_id INTO found_bot_id
  FROM bot_channels bc
  INNER JOIN bots b ON bc.bot_id = b.id
  WHERE bc.slack_channel_id = channel_id
    AND bc.is_active = true
    AND b.status = 'active'
    AND (p_workspace_id IS NULL OR b.workspace_id = p_workspace_id)
  LIMIT 1;

  -- If no mapping, return default bot for workspace
  IF found_bot_id IS NULL THEN
    SELECT id INTO found_bot_id
    FROM bots
    WHERE is_default = true
      AND status = 'active'
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
    LIMIT 1;
  END IF;

  RETURN found_bot_id;
END;
$$;

-- ============================================
-- WORKSPACE STATS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_workspace_stats(p_workspace_id UUID)
RETURNS TABLE (
  total_documents BIGINT,
  total_chunks BIGINT,
  total_bots BIGINT,
  active_bots BIGINT,
  total_conversations BIGINT,
  total_messages BIGINT,
  total_learned_facts BIGINT,
  storage_used_bytes BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM documents WHERE workspace_id = p_workspace_id AND is_active = true),
    (SELECT COUNT(*) FROM document_chunks dc
     INNER JOIN documents d ON dc.document_id = d.id
     WHERE d.workspace_id = p_workspace_id),
    (SELECT COUNT(*) FROM bots WHERE workspace_id = p_workspace_id),
    (SELECT COUNT(*) FROM bots WHERE workspace_id = p_workspace_id AND status = 'active'),
    (SELECT COUNT(*) FROM thread_sessions WHERE workspace_id = p_workspace_id),
    (SELECT COUNT(*) FROM thread_messages tm
     INNER JOIN thread_sessions ts ON tm.session_id = ts.id
     WHERE ts.workspace_id = p_workspace_id),
    (SELECT COUNT(*) FROM learned_facts WHERE workspace_id = p_workspace_id),
    (SELECT COALESCE(SUM(LENGTH(dc.content)), 0)::BIGINT FROM document_chunks dc
     INNER JOIN documents d ON dc.document_id = d.id
     WHERE d.workspace_id = p_workspace_id);
END;
$$;
