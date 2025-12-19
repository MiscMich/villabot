-- Function to search learned facts by vector similarity
CREATE OR REPLACE FUNCTION match_learned_facts(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  fact TEXT,
  source VARCHAR,
  taught_by_user_id VARCHAR,
  is_verified BOOLEAN,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lf.id,
    lf.fact,
    lf.source,
    lf.taught_by_user_id,
    lf.is_verified,
    1 - (lf.embedding <=> query_embedding) AS similarity
  FROM learned_facts lf
  WHERE lf.embedding IS NOT NULL
    AND lf.is_verified = true
  ORDER BY lf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search documents by vector similarity (for fallback search)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_id UUID,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.document_id,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE dc.embedding IS NOT NULL
    AND d.is_active = true
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
