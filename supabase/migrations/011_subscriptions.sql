-- TeamBrain AI - Subscriptions Table
-- Detailed Stripe subscription tracking for billing management

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_subscription_id VARCHAR UNIQUE NOT NULL,
  stripe_customer_id VARCHAR NOT NULL,
  stripe_price_id VARCHAR NOT NULL,
  stripe_product_id VARCHAR,

  -- Subscription Details
  tier subscription_tier NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',

  -- Billing Period
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,

  -- Trial Info
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Cancellation Info
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Payment Info
  latest_invoice_id VARCHAR,
  latest_invoice_status VARCHAR,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICES TABLE (Optional: for invoice history)
-- ============================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Stripe IDs
  stripe_invoice_id VARCHAR UNIQUE NOT NULL,
  stripe_customer_id VARCHAR NOT NULL,

  -- Invoice Details
  status VARCHAR NOT NULL,  -- draft, open, paid, uncollectible, void
  amount_due INTEGER NOT NULL,  -- in cents
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'usd',

  -- Period
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- URLs
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================

CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Stripe IDs
  stripe_payment_method_id VARCHAR UNIQUE NOT NULL,
  stripe_customer_id VARCHAR NOT NULL,

  -- Card Details (masked)
  type VARCHAR NOT NULL,  -- card, bank_account, etc.
  brand VARCHAR,  -- visa, mastercard, amex, etc.
  last_four VARCHAR(4),
  exp_month INTEGER,
  exp_year INTEGER,

  -- Status
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BILLING EVENTS TABLE (Audit Log)
-- ============================================

CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,

  -- Event Details
  event_type VARCHAR NOT NULL,  -- subscription.created, invoice.paid, etc.
  stripe_event_id VARCHAR UNIQUE,

  -- Payload
  data JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

-- Subscriptions
CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Invoices
CREATE INDEX idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at);

-- Payment Methods
CREATE INDEX idx_payment_methods_workspace ON payment_methods(workspace_id);
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(workspace_id, is_default) WHERE is_default = true;

-- Billing Events
CREATE INDEX idx_billing_events_workspace ON billing_events(workspace_id);
CREATE INDEX idx_billing_events_stripe ON billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_created ON billing_events(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get active subscription for workspace
CREATE OR REPLACE FUNCTION get_workspace_subscription(p_workspace_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  tier subscription_tier,
  status subscription_status,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  is_trialing BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tier,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end,
    (s.trial_end IS NOT NULL AND s.trial_end > NOW()) AS is_trialing
  FROM subscriptions s
  WHERE s.workspace_id = p_workspace_id
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Check if workspace has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE workspace_id = p_workspace_id
      AND status IN ('active', 'trialing')
  );
$$;

-- Sync workspace status from subscription
CREATE OR REPLACE FUNCTION sync_workspace_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE workspaces
  SET
    tier = NEW.tier,
    status = NEW.status,
    stripe_subscription_id = NEW.stripe_subscription_id,
    updated_at = NOW()
  WHERE id = NEW.workspace_id;

  RETURN NEW;
END;
$$;

-- Trigger to sync workspace on subscription change
CREATE TRIGGER sync_workspace_on_subscription_change
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_workspace_from_subscription();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions: workspace members can view
CREATE POLICY "Users can view workspace subscriptions"
  ON subscriptions FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

CREATE POLICY "Service role full access to subscriptions"
  ON subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Invoices: workspace members can view
CREATE POLICY "Users can view workspace invoices"
  ON invoices FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspaces()));

CREATE POLICY "Service role full access to invoices"
  ON invoices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Payment Methods: admins can manage
CREATE POLICY "Admins can view payment methods"
  ON payment_methods FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "Admins can manage payment methods"
  ON payment_methods FOR ALL
  USING (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "Service role full access to payment_methods"
  ON payment_methods FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Billing Events: service role only
CREATE POLICY "Service role full access to billing_events"
  ON billing_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
