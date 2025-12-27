-- Migration: Add bot_type column to bots table
-- This column was expected by the codebase but never existed in the schema
-- Fixes: Bot create/update operations that include bot_type field

-- Add bot_type column with default value
ALTER TABLE bots ADD COLUMN IF NOT EXISTS bot_type VARCHAR(50) DEFAULT 'general';

-- Add comment explaining the column
COMMENT ON COLUMN bots.bot_type IS 'Bot purpose type: general, operations, marketing, sales, hr, technical. Used for UI categorization and default system prompts.';

-- Create index for filtering by bot type
CREATE INDEX IF NOT EXISTS idx_bots_type ON bots(bot_type);

-- Backfill existing bots with 'general' type (redundant with DEFAULT but explicit)
UPDATE bots SET bot_type = 'general' WHERE bot_type IS NULL;
