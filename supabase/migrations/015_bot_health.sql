-- Migration: Bot Health Monitoring
-- Adds table for tracking bot health status and auto-restart history

-- Create bot_health table for real-time health tracking
CREATE TABLE IF NOT EXISTS bot_health (
  bot_id UUID PRIMARY KEY REFERENCES bots(id) ON DELETE CASCADE,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  is_running BOOLEAN NOT NULL DEFAULT false,
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_restart_at TIMESTAMPTZ,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for filtering unhealthy bots
CREATE INDEX idx_bot_health_unhealthy ON bot_health(is_healthy) WHERE NOT is_healthy;

-- Create index for finding bots needing restart
CREATE INDEX idx_bot_health_failures ON bot_health(consecutive_failures) WHERE consecutive_failures > 0;

-- Create bot_health_history table for historical tracking
CREATE TABLE IF NOT EXISTS bot_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('health_check', 'restart_attempt', 'restart_success', 'restart_failure', 'error')),
  is_healthy BOOLEAN NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for querying bot health history
CREATE INDEX idx_bot_health_history_bot_id ON bot_health_history(bot_id);
CREATE INDEX idx_bot_health_history_created_at ON bot_health_history(created_at DESC);

-- Enable RLS
ALTER TABLE bot_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_health_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for bot_health (only platform admins and workspace owners can view)
CREATE POLICY "Workspace owners can view their bot health"
  ON bot_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots b
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
      WHERE b.id = bot_health.bot_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can view all bot health"
  ON bot_health FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = true
    )
  );

-- Service role has full access
CREATE POLICY "Service role full access to bot_health"
  ON bot_health FOR ALL
  USING (auth.role() = 'service_role');

-- RLS policies for bot_health_history
CREATE POLICY "Workspace owners can view their bot health history"
  ON bot_health_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots b
      JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
      WHERE b.id = bot_health_history.bot_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can view all bot health history"
  ON bot_health_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_platform_admin = true
    )
  );

CREATE POLICY "Service role full access to bot_health_history"
  ON bot_health_history FOR ALL
  USING (auth.role() = 'service_role');

-- Function to log health history events
CREATE OR REPLACE FUNCTION log_bot_health_event(
  p_bot_id UUID,
  p_event_type TEXT,
  p_is_healthy BOOLEAN,
  p_consecutive_failures INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO bot_health_history (
    bot_id,
    event_type,
    is_healthy,
    consecutive_failures,
    error_message
  ) VALUES (
    p_bot_id,
    p_event_type,
    p_is_healthy,
    p_consecutive_failures,
    p_error_message
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Create view for bot health dashboard
CREATE OR REPLACE VIEW bot_health_summary AS
SELECT
  b.id,
  b.name,
  b.slug,
  b.workspace_id,
  b.status,
  COALESCE(bh.is_healthy, true) as is_healthy,
  COALESCE(bh.is_running, false) as is_running,
  COALESCE(bh.consecutive_failures, 0) as consecutive_failures,
  bh.last_check_at,
  bh.last_restart_at,
  bh.error_message,
  (
    SELECT COUNT(*)
    FROM bot_health_history bhh
    WHERE bhh.bot_id = b.id
    AND bhh.event_type = 'restart_success'
    AND bhh.created_at > now() - interval '24 hours'
  ) as restarts_last_24h
FROM bots b
LEFT JOIN bot_health bh ON bh.bot_id = b.id;

-- Grant access to the view
GRANT SELECT ON bot_health_summary TO authenticated;
GRANT SELECT ON bot_health_summary TO service_role;

COMMENT ON TABLE bot_health IS 'Real-time health status of each bot instance';
COMMENT ON TABLE bot_health_history IS 'Historical log of bot health events and restarts';
COMMENT ON VIEW bot_health_summary IS 'Aggregated bot health information for dashboard display';
