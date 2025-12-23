-- Migration: Add workspace_id to bot_config table
-- This enables per-workspace configuration storage for setup wizard and other settings

-- Add workspace_id column to bot_config
ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Drop the old unique constraint on just 'key'
ALTER TABLE bot_config DROP CONSTRAINT IF EXISTS bot_config_key_key;

-- Add new unique constraint that's per-workspace
-- This allows the same key (e.g., 'setup_status') for different workspaces
ALTER TABLE bot_config ADD CONSTRAINT bot_config_workspace_key_unique UNIQUE (workspace_id, key);

-- Create index for faster lookups by workspace
CREATE INDEX IF NOT EXISTS idx_bot_config_workspace_id ON bot_config(workspace_id);

-- Enable RLS on bot_config
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access config for their workspace
CREATE POLICY "bot_config_workspace_isolation" ON bot_config
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow service role full access (for API operations)
CREATE POLICY "bot_config_service_role" ON bot_config
  FOR ALL USING (auth.role() = 'service_role');
