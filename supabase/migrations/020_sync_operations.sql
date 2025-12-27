-- Migration: Add sync_operations table for real-time progress tracking
-- This enables SSE-based progress updates for Google Drive sync and website scraping

-- Create sync_operations table
CREATE TABLE sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('drive_sync', 'website_scrape', 'drive_full_sync')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  current_item VARCHAR(500),
  result JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for active operations lookup (most common query)
CREATE INDEX idx_sync_operations_workspace_active ON sync_operations(workspace_id, status)
  WHERE status IN ('pending', 'running');

-- Index for recent operations lookup
CREATE INDEX idx_sync_operations_workspace_recent ON sync_operations(workspace_id, created_at DESC);

-- Enable RLS
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access operations for their workspace
CREATE POLICY "sync_operations_workspace_isolation" ON sync_operations
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow service role full access (for API operations)
CREATE POLICY "sync_operations_service_role" ON sync_operations
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up old completed operations (keep last 100 per workspace)
CREATE OR REPLACE FUNCTION cleanup_old_sync_operations() RETURNS trigger AS $$
BEGIN
  DELETE FROM sync_operations
  WHERE workspace_id = NEW.workspace_id
    AND status IN ('completed', 'failed', 'cancelled')
    AND id NOT IN (
      SELECT id FROM sync_operations
      WHERE workspace_id = NEW.workspace_id
        AND status IN ('completed', 'failed', 'cancelled')
      ORDER BY created_at DESC
      LIMIT 100
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-cleanup on insert
CREATE TRIGGER trigger_cleanup_sync_operations
  AFTER INSERT ON sync_operations
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_sync_operations();

-- Add comment for documentation
COMMENT ON TABLE sync_operations IS 'Tracks progress of sync operations (Drive sync, website scrape) for real-time UI updates via SSE';
