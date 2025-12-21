-- TeamBrain AI - Database Extensions
-- Run before migrations to enable required extensions

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable trigram extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin for combined indexes
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify extensions
SELECT extname, extversion FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm', 'btree_gin', 'uuid-ossp');
