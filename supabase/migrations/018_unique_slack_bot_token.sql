-- Migration: Add unique constraint on slack_bot_token
-- Purpose: Prevent the same Slack bot from being registered to multiple workspaces
-- Risk: Same bot token used across workspaces could cause data leaks and mixed knowledge bases

-- Add unique constraint on slack_bot_token (globally unique across ALL workspaces)
-- This prevents the same Slack bot from being registered by different users/workspaces
ALTER TABLE bots
ADD CONSTRAINT bots_slack_bot_token_unique
UNIQUE (slack_bot_token);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT bots_slack_bot_token_unique ON bots IS
  'Prevents same Slack bot from being registered to multiple workspaces - each bot has isolated knowledge base';
