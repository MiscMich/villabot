-- Error logs table for dashboard visibility
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}',
  service TEXT NOT NULL CHECK (service IN ('slack', 'rag', 'google_drive', 'openai', 'supabase', 'api')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- Auto-cleanup old resolved errors (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_errors()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE resolved = true
    AND created_at < NOW() - INTERVAL '30 days';

  -- Also cleanup very old unresolved errors (keep 90 days)
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate sessions (fixes race condition)
ALTER TABLE thread_sessions
  DROP CONSTRAINT IF EXISTS unique_thread_ts;

ALTER TABLE thread_sessions
  ADD CONSTRAINT unique_thread_ts UNIQUE (slack_thread_ts);
