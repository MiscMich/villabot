# Cluebase AI - Database Schema

PostgreSQL database schema with pgvector extension for semantic search.

## Overview

The database uses:
- **PostgreSQL 15+** via Supabase Cloud
- **pgvector** extension for vector embeddings (768 dimensions, OpenAI text-embedding-3-small)
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

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note**: Google OAuth tokens are stored per-bot in `bot_config.google_drive_tokens`, not at the workspace level.

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

  -- Embeddings (OpenAI text-embedding-3-small = 768 dimensions)
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

---

## Additional Tables

### bot_channels

Slack channel assignments per bot.

```sql
CREATE TABLE bot_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(50) NOT NULL,
  channel_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id, slack_channel_id)
);
```

### bot_drive_folders

Google Drive folder mappings per bot.

```sql
CREATE TABLE bot_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  folder_id VARCHAR(255) NOT NULL,
  folder_name VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### bot_config

Legacy bot configuration (JSONB storage for various settings).

```sql
CREATE TABLE bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Google Drive OAuth tokens (stored here, not in workspaces)
  google_drive_tokens JSONB, -- { access_token, refresh_token, expiry_date }
  google_drive_folder_id VARCHAR(255),
  
  -- Website scraping config
  website_url TEXT,
  scrape_limit INTEGER DEFAULT 50,
  
  -- Other settings
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### bot_health

Real-time health monitoring for bots.

```sql
CREATE TABLE bot_health (
  bot_id UUID PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  is_healthy BOOLEAN DEFAULT FALSE,
  is_running BOOLEAN DEFAULT FALSE,
  last_check_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  total_restart_attempts INTEGER DEFAULT 0,
  permanently_disabled BOOLEAN DEFAULT FALSE,
  last_restart_at TIMESTAMPTZ,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);
```

### workspace_invites

Team invitation tracking.

```sql
CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role workspace_role DEFAULT 'member',
  invited_by UUID REFERENCES user_profiles(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### usage_tracking

Real-time usage tracking for rate limiting.

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  period_start DATE NOT NULL,
  query_count INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, period_start)
);
```

### usage_daily

Daily aggregated usage statistics.

```sql
CREATE TABLE usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  date DATE NOT NULL,
  queries INTEGER DEFAULT 0,
  successful_responses INTEGER DEFAULT 0,
  failed_responses INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);
```

### subscriptions

Stripe subscription data.

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),
  status VARCHAR(50),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### billing_events

Stripe webhook event log.

```sql
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### platform_feedback

Platform-wide feedback system.

```sql
CREATE TABLE platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  workspace_id UUID REFERENCES workspaces(id),
  
  type VARCHAR(50) NOT NULL, -- 'feature_request', 'bug_report', 'general'
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'closed'
  
  vote_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### platform_feedback_votes

User votes on platform feedback.

```sql
CREATE TABLE platform_feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES platform_feedback(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);
```

### admin_audit_log

Platform admin action audit trail.

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES user_profiles(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50), -- 'workspace', 'user', 'subscription'
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### error_logs

Error tracking and monitoring.

```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  bot_id UUID REFERENCES bots(id),
  
  service VARCHAR(50) NOT NULL, -- 'slack', 'api', 'sync', 'rag'
  severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  error_message TEXT NOT NULL,
  error_stack TEXT,
  context JSONB,
  
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_workspace ON error_logs(workspace_id, created_at);
CREATE INDEX idx_error_logs_severity ON error_logs(severity, created_at);
```

## Enums

```sql
CREATE TYPE subscription_tier AS ENUM ('starter', 'pro', 'business');
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE document_category AS ENUM (
  'shared',        -- General company knowledge accessible to all bots
  'operations',    -- Operations procedures and workflows
  'marketing',     -- Marketing materials and guidelines
  'sales',         -- Sales collateral and processes
  'technical',     -- Technical documentation
  'hr',            -- HR policies and procedures
  'custom'         -- User-defined categories
);
```

**Note**: Categories are assigned per-document. Each bot can be configured to access specific categories (e.g., Sales bot → sales + shared).

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
