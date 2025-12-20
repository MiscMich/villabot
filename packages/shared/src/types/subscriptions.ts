// Subscription and billing types for TeamBrain AI

import type { SubscriptionTier, SubscriptionStatus } from './workspaces.js';

export interface Subscription {
  id: string;
  workspace_id: string;

  // Stripe IDs
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string;
  stripe_product_id: string | null;

  // Subscription Details
  tier: SubscriptionTier;
  status: SubscriptionStatus;

  // Billing Period
  current_period_start: string;
  current_period_end: string;

  // Trial Info
  trial_start: string | null;
  trial_end: string | null;

  // Cancellation Info
  cancel_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;

  // Payment Info
  latest_invoice_id: string | null;
  latest_invoice_status: string | null;

  // Metadata
  metadata: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'uncollectible'
  | 'void';

export interface Invoice {
  id: string;
  workspace_id: string;
  subscription_id: string | null;

  // Stripe IDs
  stripe_invoice_id: string;
  stripe_customer_id: string;

  // Invoice Details
  status: InvoiceStatus;
  amount_due: number; // in cents
  amount_paid: number;
  currency: string;

  // Period
  period_start: string | null;
  period_end: string | null;

  // URLs
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;

  // Timestamps
  created_at: string;
  paid_at: string | null;
}

export type PaymentMethodType = 'card' | 'bank_account' | 'sepa_debit';

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay';

export interface PaymentMethod {
  id: string;
  workspace_id: string;

  // Stripe IDs
  stripe_payment_method_id: string;
  stripe_customer_id: string;

  // Card Details (masked)
  type: PaymentMethodType;
  brand: CardBrand | null;
  last_four: string | null;
  exp_month: number | null;
  exp_year: number | null;

  // Status
  is_default: boolean;

  // Timestamps
  created_at: string;
}

export interface BillingEvent {
  id: string;
  workspace_id: string | null;
  event_type: string;
  stripe_event_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

// API request/response types

export interface CreateCheckoutSessionRequest {
  tier: SubscriptionTier;
  success_url: string;
  cancel_url: string;
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
}

export interface CreatePortalSessionRequest {
  return_url: string;
}

export interface CreatePortalSessionResponse {
  portal_url: string;
}

export interface ChangePlanRequest {
  tier: SubscriptionTier;
}

export interface ChangePlanResponse {
  subscription: Subscription;
  prorated_amount: number;
  next_invoice_date: string;
}

export interface CancelSubscriptionRequest {
  cancel_immediately?: boolean;
  feedback?: string;
}

export interface CancelSubscriptionResponse {
  subscription: Subscription;
  access_until: string;
}

export interface BillingOverview {
  subscription: Subscription | null;
  invoices: Invoice[];
  payment_methods: PaymentMethod[];
  upcoming_invoice: {
    amount: number;
    date: string;
  } | null;
}

// Stripe webhook event types we handle
export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.updated'
  | 'payment_method.attached'
  | 'payment_method.detached';
