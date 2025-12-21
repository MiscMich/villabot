# Cluebase AI - Database Schema

PostgreSQL database schema with pgvector extension for semantic search.

## Overview

The database uses:
- **PostgreSQL 15+** via Supabase
- **pgvector** extension for vector embeddings
- **Row Level Security (RLS)** for multi-tenant isolation

## Core Tables

### workspaces

Multi-tenant workspace configuration.

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,

  -- Subscription
  tier subscription_tier DEFAULT 'starter',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'trialing',

  -- Limits (from tier or custom)
  max_documents INTEGER,
  max_queries_per_month INTEGER,
  max_team_members INTEGER,
  max_bots INTEGER,

  -- Internal workspace (bypasses billing)
  is_internal BOOLEAN DEFAULT FALSE,
  internal_notes TEXT,

  -- OAuth tokens (encrypted)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_profiles

User profiles linked to Supabase Auth.

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  is_platform_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### workspace_members

Junction table for workspace membership.

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role workspace_role DEFAULT 'member',
  invited_by UUID REFERENCES user_profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

### documents

Document metadata from Google Drive and scraped websites.

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Source info
  drive_file_id VARCHAR(255),
  source_type VARCHAR(50) DEFAULT 'google_drive',
  source_url TEXT,

  -- Document info
  title VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  category document_category DEFAULT 'company_knowledge',

  -- Sync tracking
  content_hash VARCHAR(64),
  last_modified TIMESTAMPTZ,
  last_synced TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, drive_file_id)
);
```

### document_chunks

Chunked content with vector embeddings for RAG.

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,

  -- Content
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,

  -- Embeddings (Gemini text-embedding-004 = 768 dimensions)
  embedding VECTOR(768),

  -- Full-text search
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN (fts);
CREATE INDEX idx_chunks_workspace ON document_chunks(workspace_id);
```

### bots

Bot configuration per workspace.

```sql
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  -- Bot info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  system_prompt TEXT,

  -- Slack credentials
  slack_bot_token TEXT,
  slack_app_token TEXT,
  slack_team_id VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_connected_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### thread_sessions

Slack conversation threads.

```sql
CREATE TABLE thread_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  bot_id UUID REFERENCES bots(id),

  slack_channel_id VARCHAR(50) NOT NULL,
  slack_thread_ts VARCHAR(50) NOT NULL,
  started_by_user_id VARCHAR(50),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_id, slack_thread_ts)
);
```

### thread_messages

Individual messages within threads.

```sql
CREATE TABLE thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  session_id UUID REFERENCES thread_sessions(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id),

  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
  content TEXT NOT NULL,
  slack_user_id VARCHAR(50),

  -- RAG info
  sources JSONB DEFAULT '[]',
  confidence_score FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### response_feedback

User feedback on bot responses.

```sql
CREATE TABLE response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  message_id UUID REFERENCES thread_messages(id),
  bot_id UUID REFERENCES bots(id),

  is_helpful BOOLEAN NOT NULL,
  feedback_text TEXT,

  query_text TEXT,
  response_text TEXT,
  sources_used JSONB DEFAULT '[]',

  slack_user_id VARCHAR(50),
  is_reviewed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### learned_facts

User-taught corrections and additions.

```sql
CREATE TABLE learned_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),

  fact TEXT NOT NULL,
  embedding VECTOR(768),

  source VARCHAR(50) DEFAULT 'user_feedback',
  taught_by_user_id VARCHAR(50),
  is_verified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### analytics

Usage tracking and metrics.

```sql
CREATE TABLE analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  bot_id UUID REFERENCES bots(id),

  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_workspace_time ON analytics(workspace_id, created_at);
```

## Enums

```sql
CREATE TYPE subscription_tier AS ENUM ('starter', 'pro', 'business');
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE document_category AS ENUM (
  'company_knowledge',
  'internal_sops',
  'marketing',
  'sales',
  'operations',
  'hr_policies',
  'technical',
  'custom'
);
```

## Key Functions

### hybrid_search

Combined vector + keyword search with RRF fusion.

```sql
CREATE FUNCTION hybrid_search(
  p_workspace_id UUID,
  p_query_text TEXT,
  p_query_embedding VECTOR(768),
  p_top_k INTEGER DEFAULT 15,
  p_category_filter document_category[] DEFAULT NULL
) RETURNS TABLE (...)
```

### get_satisfaction_rate

Calculate feedback satisfaction rate.

```sql
CREATE FUNCTION get_satisfaction_rate(
  p_workspace_id UUID,
  p_bot_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
) RETURNS FLOAT
```

## Row Level Security

All tables have RLS enabled with policies based on workspace membership:

```sql
-- Example policy for documents
CREATE POLICY "Users can view documents in their workspaces"
  ON documents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

## Migrations

Migrations are in `supabase/migrations/` and should be run in order:

1. `001_documents.sql` - Core document tables
2. `002_document_chunks.sql` - Vector embeddings
3. ... (see SETUP.md for full list)

## Backup

For self-hosted deployments, use pg_dump:

```bash
pg_dump -h localhost -U postgres -d postgres > backup.sql
```
