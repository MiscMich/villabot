-- Villa Paraiso Bot - Multi-Bot Platform Schema
-- Enables multiple specialized bots with shared and bot-specific knowledge

-- ============================================
-- ENUMS
-- ============================================

-- Document category types
CREATE TYPE document_category AS ENUM (
  'shared',           -- Available to ALL bots (website scrape, company-wide SOPs)
  'operations',       -- Operations team specific
  'marketing',        -- Marketing team specific
  'sales',            -- Sales team specific
  'hr',               -- HR policies and procedures
  'technical',        -- Technical documentation
  'custom'            -- Custom category for future use
);

-- Bot status
CREATE TYPE bot_status AS ENUM (
  'active',
  'inactive',
  'configuring'
);

-- ============================================
-- BOTS TABLE
-- ============================================

CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- URL-friendly identifier (e.g., 'marketing-bot')
  description TEXT,
  avatar_url TEXT,

  -- Slack Configuration
  slack_bot_token VARCHAR,           -- xoxb-... token for this bot
  slack_app_token VARCHAR,           -- xapp-... token for socket mode
  slack_signing_secret VARCHAR,
  slack_bot_user_id VARCHAR,         -- Bot's Slack user ID once connected

  -- AI Configuration
  system_instructions TEXT DEFAULT 'You are a helpful assistant for Villa Paraiso Vacation Rentals.',
  personality TEXT DEFAULT 'friendly and professional',
  temperature FLOAT DEFAULT 0.3,
  max_response_length INTEGER DEFAULT 2000,

  -- Knowledge Configuration
  include_shared_knowledge BOOLEAN DEFAULT true,  -- Access to shared docs/website scrape
  categories document_category[] DEFAULT '{}',    -- Bot-specific categories to access

  -- Status
  status bot_status DEFAULT 'configuring',
  is_default BOOLEAN DEFAULT false,  -- The main VillaBot

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BOT DRIVE FOLDERS
-- ============================================

-- Maps Google Drive folders to bots
CREATE TABLE bot_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  drive_folder_id VARCHAR NOT NULL,
  folder_name VARCHAR NOT NULL,
  category document_category DEFAULT 'custom',
  is_active BOOLEAN DEFAULT true,
  last_synced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(bot_id, drive_folder_id)
);

-- ============================================
-- BOT CHANNELS
-- ============================================

-- Maps Slack channels to bots
CREATE TABLE bot_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR NOT NULL,
  channel_name VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(bot_id, slack_channel_id)
);

-- ============================================
-- UPDATE DOCUMENTS TABLE
-- ============================================

-- Add bot and category references to documents
ALTER TABLE documents
  ADD COLUMN bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  ADD COLUMN category document_category DEFAULT 'shared',
  ADD COLUMN priority INTEGER DEFAULT 5;  -- 1-10, higher = more important in search results

-- ============================================
-- UPDATE THREAD SESSIONS
-- ============================================

-- Track which bot handled a conversation
ALTER TABLE thread_sessions
  ADD COLUMN bot_id UUID REFERENCES bots(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_bots_slug ON bots(slug);
CREATE INDEX idx_bots_status ON bots(status);
CREATE INDEX idx_bots_is_default ON bots(is_default) WHERE is_default = true;

CREATE INDEX idx_bot_drive_folders_bot ON bot_drive_folders(bot_id);
CREATE INDEX idx_bot_drive_folders_folder ON bot_drive_folders(drive_folder_id);

CREATE INDEX idx_bot_channels_bot ON bot_channels(bot_id);
CREATE INDEX idx_bot_channels_channel ON bot_channels(slack_channel_id);

CREATE INDEX idx_documents_bot ON documents(bot_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_bot_category ON documents(bot_id, category);

CREATE INDEX idx_thread_sessions_bot ON thread_sessions(bot_id);

-- ============================================
-- UPDATED HYBRID SEARCH WITH BOT FILTERING
-- ============================================

-- Drop old function and create new one with bot filtering
DROP FUNCTION IF EXISTS hybrid_search(TEXT, VECTOR(768), INT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5,
  p_bot_id UUID DEFAULT NULL,              -- Filter to specific bot's knowledge
  include_shared BOOLEAN DEFAULT true       -- Include shared documents
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
    -- Get document IDs this bot can access
    SELECT d.id as doc_id
    FROM documents d
    WHERE d.is_active = true
      AND (
        -- Shared documents (if include_shared is true)
        (include_shared AND d.category = 'shared')
        -- Bot-specific documents
        OR (p_bot_id IS NOT NULL AND d.bot_id = p_bot_id)
        -- Documents in bot's accessible categories
        OR (p_bot_id IS NOT NULL AND d.category = ANY(bot_categories))
        -- If no bot specified, return all active documents
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
-- HELPER FUNCTIONS
-- ============================================

-- Get bot by channel
CREATE OR REPLACE FUNCTION get_bot_for_channel(channel_id VARCHAR)
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
  LIMIT 1;

  -- If no mapping, return default bot
  IF found_bot_id IS NULL THEN
    SELECT id INTO found_bot_id
    FROM bots
    WHERE is_default = true AND status = 'active'
    LIMIT 1;
  END IF;

  RETURN found_bot_id;
END;
$$;

-- Get bot statistics
CREATE OR REPLACE FUNCTION get_bot_stats(p_bot_id UUID)
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
    (SELECT COUNT(*) FROM documents WHERE bot_id = p_bot_id OR (category = 'shared' AND (SELECT include_shared_knowledge FROM bots WHERE id = p_bot_id))),
    (SELECT COUNT(*) FROM document_chunks dc INNER JOIN documents d ON dc.document_id = d.id WHERE d.bot_id = p_bot_id OR d.category = 'shared'),
    (SELECT COUNT(*) FROM thread_sessions WHERE bot_id = p_bot_id),
    (SELECT COUNT(*) FROM thread_messages tm INNER JOIN thread_sessions ts ON tm.session_id = ts.id WHERE ts.bot_id = p_bot_id),
    (SELECT COUNT(*) FROM bot_channels WHERE bot_id = p_bot_id AND is_active = true);
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update bot timestamp on changes
CREATE TRIGGER bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INSERT DEFAULT BOT (VillaBot)
-- ============================================

INSERT INTO bots (
  name,
  slug,
  description,
  system_instructions,
  personality,
  include_shared_knowledge,
  categories,
  status,
  is_default
) VALUES (
  'VillaBot',
  'villabot',
  'The main Villa Paraiso assistant for general company questions and operations.',
  'You are VillaBot, the helpful AI assistant for Villa Paraiso Vacation Rentals. You help team members find information about company procedures, policies, and operations. Always be friendly, professional, and cite your sources when answering questions.',
  'friendly and professional',
  true,
  ARRAY['shared', 'operations']::document_category[],
  'active',
  true
);

-- ============================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- ============================================

-- Enable RLS on sensitive tables
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_channels ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (API uses service role key)
CREATE POLICY "Service role full access to bots" ON bots
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to bot_drive_folders" ON bot_drive_folders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to bot_channels" ON bot_channels
  FOR ALL USING (true) WITH CHECK (true);
