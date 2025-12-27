-- Villa Paraiso Bot - Initial Schema
-- Run this migration to set up the database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Documents metadata
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id VARCHAR UNIQUE,
  title VARCHAR NOT NULL,
  file_type VARCHAR NOT NULL,
  source_type VARCHAR DEFAULT 'google_drive',
  source_url TEXT,
  content_hash VARCHAR NOT NULL,
  last_modified TIMESTAMP WITH TIME ZONE,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks with embeddings + full-text search
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thread sessions for multi-turn conversations
CREATE TABLE thread_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id VARCHAR NOT NULL,
  slack_thread_ts VARCHAR NOT NULL UNIQUE,
  started_by_user_id VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual messages within threads
CREATE TABLE thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES thread_sessions(id) ON DELETE CASCADE,
  slack_user_id VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  confidence_score FLOAT,
  feedback_rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot configuration
CREATE TABLE bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics and metrics
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learned facts (self-learning)
CREATE TABLE learned_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact TEXT NOT NULL,
  source VARCHAR DEFAULT 'user_feedback',
  taught_by_user_id VARCHAR,
  embedding VECTOR(768),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_drive_file_id ON documents(drive_file_id);
CREATE INDEX idx_documents_source_type ON documents(source_type);
CREATE INDEX idx_documents_is_active ON documents(is_active);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN (fts);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_thread_sessions_thread_ts ON thread_sessions(slack_thread_ts);
CREATE INDEX idx_thread_sessions_channel ON thread_sessions(slack_channel_id);
CREATE INDEX idx_thread_messages_session ON thread_messages(session_id);

CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);

CREATE INDEX idx_learned_facts_embedding ON learned_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_learned_facts_verified ON learned_facts(is_verified);

-- Hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_id UUID,
  similarity FLOAT,
  rank_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding) AS vector_rank
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> query_embedding
    LIMIT 20
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.content,
      dc.document_id,
      ts_rank(dc.fts, plainto_tsquery('english', query_text)) AS text_rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(dc.fts, plainto_tsquery('english', query_text)) DESC) AS keyword_rank
    FROM document_chunks dc
    WHERE dc.fts @@ plainto_tsquery('english', query_text)
    ORDER BY text_rank DESC
    LIMIT 20
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
  SELECT c.id, c.content, c.document_id, c.similarity, c.rank_score
  FROM combined c
  ORDER BY c.rank_score DESC
  LIMIT match_count;
END;
$$;

-- Function to update document timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for documents updated_at
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default bot configuration
INSERT INTO bot_config (key, value) VALUES
  ('general', '{"botName": "VillaBot", "timezone": "America/Los_Angeles"}'),
  ('ai', '{"model": "gpt-5-nano", "temperature": 0.3, "maxResponseLength": 2000}'),
  ('sync', '{"drivePollIntervalMs": 300000, "websiteScrapeSchedule": "0 0 * * 0"}'),
  ('defaults', '{"confidenceThreshold": 0.7, "responseDelay": 1000, "responseStyle": "friendly"}')
ON CONFLICT (key) DO NOTHING;
