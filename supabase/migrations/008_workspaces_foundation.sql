-- TeamBrain AI - Workspaces Foundation
-- Core multi-tenancy tables for SaaS platform

-- ============================================
-- SUBSCRIPTION TIER ENUM
-- ============================================

CREATE TYPE subscription_tier AS ENUM (
  'starter',    -- $29/month
  'pro',        -- $79/month
  'business'    -- $199/month
);

CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid'
);

CREATE TYPE workspace_member_role AS ENUM (
  'owner',
  'admin',
  'member'
);

-- ============================================
-- WORKSPACES TABLE (Tenants)
-- ============================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,  -- URL-friendly identifier
  logo_url TEXT,

  -- Subscription Info (synced from Stripe)
  tier subscription_tier DEFAULT 'starter',
  status subscription_status DEFAULT 'trialing',
  stripe_customer_id VARCHAR UNIQUE,
  stripe_subscription_id VARCHAR UNIQUE,

  -- Trial Management
  trial_ends_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,

  -- Feature Limits (cached from tier for quick access)
  max_documents INTEGER DEFAULT 1000,
  max_queries_per_month INTEGER DEFAULT 500,
  max_file_upload_mb INTEGER DEFAULT 10,
  max_team_members INTEGER DEFAULT 3,
  max_website_pages INTEGER DEFAULT 100,
  max_bots INTEGER DEFAULT 1,

  -- Settings
  settings JSONB DEFAULT '{
    "brandColor": "#f59e0b",
    "timezone": "America/New_York",
    "weeklyDigest": true
  }',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROFILES (Extends auth.users)
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile Info
  full_name VARCHAR(100),
  avatar_url TEXT,

  -- Preferences
  preferences JSONB DEFAULT '{
    "theme": "system",
    "notifications": true
  }',

  -- Default Workspace
  default_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WORKSPACE MEMBERS (User-Workspace Relationship)
-- ============================================

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role and Permissions
  role workspace_member_role DEFAULT 'member',

  -- Invite Info
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique user per workspace
  UNIQUE(workspace_id, user_id)
);

-- ============================================
-- PENDING INVITES (For users not yet registered)
-- ============================================

CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Invite Details
  email VARCHAR(255) NOT NULL,
  role workspace_member_role DEFAULT 'member',

  -- Token and Expiry
  invite_token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Tracking
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,

  -- Unique per workspace
  UNIQUE(workspace_id, email)
);

-- ============================================
-- INDEXES
-- ============================================

-- Workspaces
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_stripe_customer ON workspaces(stripe_customer_id);
CREATE INDEX idx_workspaces_status ON workspaces(status);
CREATE INDEX idx_workspaces_tier ON workspaces(tier);

-- User Profiles
CREATE INDEX idx_user_profiles_default_workspace ON user_profiles(default_workspace_id);

-- Workspace Members
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(workspace_id, role);

-- Invites
CREATE INDEX idx_workspace_invites_token ON workspace_invites(invite_token);
CREATE INDEX idx_workspace_invites_email ON workspace_invites(email);
CREATE INDEX idx_workspace_invites_workspace ON workspace_invites(workspace_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all workspace IDs a user has access to
CREATE OR REPLACE FUNCTION get_user_workspaces()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$;

-- Get user's role in a workspace
CREATE OR REPLACE FUNCTION get_user_workspace_role(p_workspace_id UUID)
RETURNS workspace_member_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND is_active = true;
$$;

-- Check if user is workspace owner or admin
CREATE OR REPLACE FUNCTION is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

-- Update tier limits based on subscription tier
CREATE OR REPLACE FUNCTION update_workspace_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  CASE NEW.tier
    WHEN 'starter' THEN
      NEW.max_documents := 1000;
      NEW.max_queries_per_month := 500;
      NEW.max_file_upload_mb := 10;
      NEW.max_team_members := 3;
      NEW.max_website_pages := 100;
      NEW.max_bots := 1;
    WHEN 'pro' THEN
      NEW.max_documents := 10000;
      NEW.max_queries_per_month := 5000;
      NEW.max_file_upload_mb := 50;
      NEW.max_team_members := 10;
      NEW.max_website_pages := 1000;
      NEW.max_bots := 3;
    WHEN 'business' THEN
      NEW.max_documents := 50000;
      NEW.max_queries_per_month := 25000;
      NEW.max_file_upload_mb := 200;
      NEW.max_team_members := 999999;  -- Unlimited
      NEW.max_website_pages := 5000;
      NEW.max_bots := 10;
  END CASE;

  RETURN NEW;
END;
$$;

-- Trigger to update limits when tier changes
CREATE TRIGGER update_limits_on_tier_change
  BEFORE INSERT OR UPDATE OF tier ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_limits();

-- ============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
