/**
 * Stripe Billing Service
 * Handles Stripe integration for subscriptions, checkout, and customer portal
 */

import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../supabase/client.js';
import { TIER_CONFIGS } from '@cluebase/shared';
import type { SubscriptionTier } from '@cluebase/shared';

// Initialize Stripe client
let stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required for billing operations');
    }
    stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

// Map tiers to price IDs from environment
export function getPriceIdForTier(tier: SubscriptionTier): string {
  const priceIds: Record<SubscriptionTier, string | undefined> = {
    starter: env.STRIPE_STARTER_PRICE_ID,
    pro: env.STRIPE_PRO_PRICE_ID,
    business: env.STRIPE_BUSINESS_PRICE_ID,
  };

  const priceId = priceIds[tier];
  if (!priceId) {
    throw new Error(`No price ID configured for tier: ${tier}`);
  }
  return priceId;
}

export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  if (priceId === env.STRIPE_STARTER_PRICE_ID) return 'starter';
  if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === env.STRIPE_BUSINESS_PRICE_ID) return 'business';
  return null;
}

/**
 * Create or get a Stripe customer for a workspace
 */
export async function getOrCreateCustomer(
  workspaceId: string,
  email: string,
  name?: string
): Promise<string> {
  // Check if workspace already has a customer ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id, name')
    .eq('id', workspaceId)
    .single();

  if (workspace?.stripe_customer_id) {
    return workspace.stripe_customer_id;
  }

  // Create new Stripe customer
  const client = getStripeClient();
  const customer = await client.customers.create({
    email,
    name: name ?? workspace?.name,
    metadata: {
      workspace_id: workspaceId,
    },
  });

  // Store customer ID in workspace
  await supabase
    .from('workspaces')
    .update({ stripe_customer_id: customer.id })
    .eq('id', workspaceId);

  logger.info('Created Stripe customer', {
    workspaceId,
    customerId: customer.id,
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  workspaceId: string,
  userId: string,
  tier: SubscriptionTier,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const client = getStripeClient();
  const priceId = getPriceIdForTier(tier);
  const tierConfig = TIER_CONFIGS[tier];

  // Get user email for customer creation
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  if (!user?.user?.email) {
    throw new Error('User email not found');
  }

  // Get or create customer
  const customerId = await getOrCreateCustomer(
    workspaceId,
    user.user.email,
    user.user.user_metadata?.full_name
  );

  // Check if this is a trial-eligible tier
  const trialDays = tierConfig.trialDays > 0 ? tierConfig.trialDays : undefined;

  const session = await client.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: trialDays
      ? {
          trial_period_days: trialDays,
          metadata: {
            workspace_id: workspaceId,
            tier,
          },
        }
      : {
          metadata: {
            workspace_id: workspaceId,
            tier,
          },
        },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      workspace_id: workspaceId,
      user_id: userId,
      tier,
    },
    allow_promotion_codes: true,
  });

  logger.info('Created checkout session', {
    workspaceId,
    tier,
    sessionId: session.id,
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(
  workspaceId: string,
  returnUrl: string
): Promise<{ url: string }> {
  const client = getStripeClient();

  // Get workspace's customer ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_customer_id) {
    throw new Error('No Stripe customer found for workspace');
  }

  const session = await client.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: returnUrl,
  });

  logger.info('Created portal session', {
    workspaceId,
    customerId: workspace.stripe_customer_id,
  });

  return { url: session.url };
}

/**
 * Get subscription details from Stripe
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const client = getStripeClient();

  try {
    const subscription = await client.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice'],
    });
    return subscription;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
      return null;
    }
    throw error;
  }
}

/**
 * Update subscription to a new tier
 */
export async function updateSubscription(
  workspaceId: string,
  newTier: SubscriptionTier
): Promise<{
  subscription: Stripe.Subscription;
  proratedAmount: number;
}> {
  const client = getStripeClient();
  const newPriceId = getPriceIdForTier(newTier);

  // Get workspace's subscription ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_subscription_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_subscription_id) {
    throw new Error('No active subscription found for workspace');
  }

  // Get current subscription to find the item ID
  const currentSubscription = await client.subscriptions.retrieve(
    workspace.stripe_subscription_id
  );

  const subscriptionItem = currentSubscription.items.data[0];
  if (!subscriptionItem) {
    throw new Error('No subscription items found');
  }

  // Preview the proration
  const invoice = await client.invoices.createPreview({
    customer: currentSubscription.customer as string,
    subscription: workspace.stripe_subscription_id,
    subscription_details: {
      items: [
        {
          id: subscriptionItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    },
  });

  // Perform the update
  const updatedSubscription = await client.subscriptions.update(
    workspace.stripe_subscription_id,
    {
      items: [
        {
          id: subscriptionItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...currentSubscription.metadata,
        tier: newTier,
      },
    }
  );

  logger.info('Updated subscription', {
    workspaceId,
    newTier,
    subscriptionId: workspace.stripe_subscription_id,
  });

  return {
    subscription: updatedSubscription,
    proratedAmount: invoice.amount_due,
  };
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  workspaceId: string,
  cancelImmediately: boolean = false
): Promise<Stripe.Subscription> {
  const client = getStripeClient();

  // Get workspace's subscription ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_subscription_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_subscription_id) {
    throw new Error('No active subscription found for workspace');
  }

  let subscription: Stripe.Subscription;

  if (cancelImmediately) {
    subscription = await client.subscriptions.cancel(
      workspace.stripe_subscription_id
    );
  } else {
    subscription = await client.subscriptions.update(
      workspace.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );
  }

  logger.info('Canceled subscription', {
    workspaceId,
    subscriptionId: workspace.stripe_subscription_id,
    cancelImmediately,
    cancelAt: subscription.cancel_at,
  });

  return subscription;
}

/**
 * Reactivate a canceled subscription (before period end)
 */
export async function reactivateSubscription(
  workspaceId: string
): Promise<Stripe.Subscription> {
  const client = getStripeClient();

  // Get workspace's subscription ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_subscription_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_subscription_id) {
    throw new Error('No subscription found for workspace');
  }

  const subscription = await client.subscriptions.update(
    workspace.stripe_subscription_id,
    {
      cancel_at_period_end: false,
    }
  );

  logger.info('Reactivated subscription', {
    workspaceId,
    subscriptionId: workspace.stripe_subscription_id,
  });

  return subscription;
}

/**
 * Get upcoming invoice for a workspace
 */
export async function getUpcomingInvoice(
  workspaceId: string
): Promise<Stripe.Invoice | null> {
  const client = getStripeClient();

  // Get workspace's customer ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_customer_id || !workspace?.stripe_subscription_id) {
    return null;
  }

  try {
    const invoice = await client.invoices.createPreview({
      customer: workspace.stripe_customer_id,
      subscription: workspace.stripe_subscription_id,
    });
    return invoice;
  } catch {
    return null;
  }
}

/**
 * List invoices for a workspace
 */
export async function listInvoices(
  workspaceId: string,
  limit: number = 12
): Promise<Stripe.Invoice[]> {
  const client = getStripeClient();

  // Get workspace's customer ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_customer_id) {
    return [];
  }

  const invoices = await client.invoices.list({
    customer: workspace.stripe_customer_id,
    limit,
  });

  return invoices.data;
}

/**
 * Get payment methods for a workspace
 */
export async function listPaymentMethods(
  workspaceId: string
): Promise<Stripe.PaymentMethod[]> {
  const client = getStripeClient();

  // Get workspace's customer ID
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.stripe_customer_id) {
    return [];
  }

  const paymentMethods = await client.paymentMethods.list({
    customer: workspace.stripe_customer_id,
    type: 'card',
  });

  return paymentMethods.data;
}
