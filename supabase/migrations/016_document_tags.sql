-- Migration: Add tags and drive_folder_id to documents table
-- This migration simplifies document categorization from business domains to custom tags

-- Add tags column for custom user-defined tags
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create GIN index for efficient tag searching
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags);

-- Track which Google Drive folder a document came from
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR;

-- Index for folder-based queries
CREATE INDEX IF NOT EXISTS idx_documents_drive_folder ON documents(drive_folder_id);

-- Add comments to deprecate old category approach
-- We keep the columns for backwards compatibility but stop using them for new features
COMMENT ON COLUMN documents.category IS 'DEPRECATED: Use tags array instead for custom categorization';
COMMENT ON COLUMN bots.categories IS 'DEPRECATED: Use bot_drive_folders table for document access control';

-- Update hybrid_search function to support tag filtering
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(768),
  query_text text,
  p_workspace_id uuid,
  p_bot_id uuid DEFAULT NULL,
  match_count int DEFAULT 15,
  p_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float,
  bm25_rank float,
  combined_score float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      1 - (dc.embedding <=> query_embedding) as similarity,
      0::float as bm25_rank,
      dc.metadata
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.workspace_id = p_workspace_id
      AND d.is_active = true
      AND (p_bot_id IS NULL OR d.bot_id = p_bot_id OR d.bot_id IS NULL)
      AND (p_tags IS NULL OR d.tags && p_tags)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      0::float as similarity,
      ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', query_text)) as bm25_rank,
      dc.metadata
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.workspace_id = p_workspace_id
      AND d.is_active = true
      AND (p_bot_id IS NULL OR d.bot_id = p_bot_id OR d.bot_id IS NULL)
      AND (p_tags IS NULL OR d.tags && p_tags)
      AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text)
    ORDER BY bm25_rank DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT
      COALESCE(v.id, k.id) as id,
      COALESCE(v.document_id, k.document_id) as document_id,
      COALESCE(v.content, k.content) as content,
      COALESCE(v.similarity, 0) as similarity,
      COALESCE(k.bm25_rank, 0) as bm25_rank,
      COALESCE(v.metadata, k.metadata) as metadata
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.similarity,
    c.bm25_rank,
    -- RRF (Reciprocal Rank Fusion) score
    (1.0 / (60 + ROW_NUMBER() OVER (ORDER BY c.similarity DESC))) +
    (1.0 / (60 + ROW_NUMBER() OVER (ORDER BY c.bm25_rank DESC))) as combined_score,
    c.metadata
  FROM combined c
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated, service_role;
