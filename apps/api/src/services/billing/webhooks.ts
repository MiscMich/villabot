/**
 * Stripe Webhook Event Handlers
 * Processes Stripe webhook events to sync subscription state
 */

import Stripe from 'stripe';
import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';
import { getTierFromPriceId, getStripeClient } from './stripe.js';
import { TIER_CONFIGS } from '@villa-paraiso/shared';
import type { SubscriptionStatus, SubscriptionTier } from '@villa-paraiso/shared';

/**
 * Log billing event for audit trail
 */
async function logBillingEvent(
  eventType: string,
  stripeEventId: string | null,
  workspaceId: string | null,
  data: Record<string, unknown>
): Promise<void> {
  await supabase.from('billing_events').insert({
    event_type: eventType,
    stripe_event_id: stripeEventId,
    workspace_id: workspaceId,
    data,
    processed_at: new Date().toISOString(),
  });
}

/**
 * Map Stripe subscription status to our status
 */
function mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'active', // Treat as active, will update when payment confirmed
    incomplete_expired: 'canceled',
    paused: 'canceled', // Treat paused as canceled for simplicity
  };
  return statusMap[stripeStatus] ?? 'active';
}

/**
 * Update workspace with new subscription data
 */
async function syncWorkspaceSubscription(
  workspaceId: string,
  subscription: Stripe.Subscription,
  tier: SubscriptionTier
): Promise<void> {
  const tierConfig = TIER_CONFIGS[tier];
  const status = mapSubscriptionStatus(subscription.status);

  await supabase
    .from('workspaces')
    .update({
      tier,
      status,
      stripe_subscription_id: subscription.id,
      // Update cached limits from tier
      max_documents: tierConfig.limits.documents,
      max_queries_per_month: tierConfig.limits.queriesPerMonth,
      max_file_upload_mb: tierConfig.limits.fileUploadMb,
      max_team_members: tierConfig.limits.teamMembers,
      max_website_pages: tierConfig.limits.websitePages,
      max_bots: tierConfig.limits.bots,
      // Update trial info
      trial_started_at: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  logger.info('Synced workspace subscription', {
    workspaceId,
    tier,
    status,
    subscriptionId: subscription.id,
  });
}

/**
 * Upsert subscription record in database
 */
async function upsertSubscription(
  workspaceId: string,
  subscription: Stripe.Subscription,
  tier: SubscriptionTier
): Promise<void> {
  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id;

  await supabase.from('subscriptions').upsert(
    {
      workspace_id: workspaceId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      stripe_price_id: priceId ?? '',
      stripe_product_id: subscriptionItem?.price.product as string,
      tier,
      status: mapSubscriptionStatus(subscription.status),
      // Period dates are now on subscription items
      current_period_start: subscriptionItem
        ? new Date(subscriptionItem.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscriptionItem
        ? new Date(subscriptionItem.current_period_end * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      metadata: subscription.metadata as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'stripe_subscription_id',
    }
  );
}

/**
 * Helper to get subscription ID from invoice (new Stripe API structure)
 */
function getSubscriptionFromInvoice(invoice: Stripe.Invoice): string | null {
  // In new Stripe API, subscription is under parent.subscription_details
  if (invoice.parent?.subscription_details?.subscription) {
    const sub = invoice.parent.subscription_details.subscription;
    return typeof sub === 'string' ? sub : sub.id;
  }
  return null;
}

/**
 * Upsert invoice record in database
 */
async function upsertInvoice(
  workspaceId: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const subscriptionId = getSubscriptionFromInvoice(invoice);

  await supabase.from('invoices').upsert(
    {
      workspace_id: workspaceId,
      subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer as string,
      status: invoice.status ?? 'draft',
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      paid_at: invoice.status === 'paid' ? new Date().toISOString() : null,
    },
    {
      onConflict: 'stripe_invoice_id',
    }
  );
}

/**
 * Handle checkout.session.completed
 * Creates subscription and links to workspace
 */
export async function handleCheckoutSessionCompleted(
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  const workspaceId = session.metadata?.workspace_id;
  const tier = session.metadata?.tier as SubscriptionTier | undefined;

  if (!workspaceId || !tier) {
    logger.error('Checkout session missing workspace_id or tier', {
      sessionId: session.id,
    });
    return;
  }

  // Get full subscription details
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // Update workspace
  await syncWorkspaceSubscription(workspaceId, subscription, tier);

  // Store subscription record
  await upsertSubscription(workspaceId, subscription, tier);

  // Log billing event
  await logBillingEvent('checkout.session.completed', event.id, workspaceId, {
    session_id: session.id,
    subscription_id: subscription.id,
    tier,
    amount_total: session.amount_total,
  });

  logger.info('Processed checkout.session.completed', {
    workspaceId,
    tier,
    subscriptionId: subscription.id,
  });
}

/**
 * Handle customer.subscription.created
 */
export async function handleSubscriptionCreated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const workspaceId = subscription.metadata?.workspace_id;
  const tierFromMetadata = subscription.metadata?.tier as SubscriptionTier | undefined;

  if (!workspaceId) {
    // Try to find workspace by customer ID
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!workspace) {
      logger.warn('Could not find workspace for subscription', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = tierFromMetadata ?? getTierFromPriceId(priceId ?? '') ?? 'starter';

  const targetWorkspaceId = workspaceId ?? (await getWorkspaceByCustomer(subscription.customer as string));
  if (!targetWorkspaceId) return;

  await syncWorkspaceSubscription(targetWorkspaceId, subscription, tier);
  await upsertSubscription(targetWorkspaceId, subscription, tier);
  await logBillingEvent('customer.subscription.created', event.id, targetWorkspaceId, {
    subscription_id: subscription.id,
    tier,
    status: subscription.status,
  });

  logger.info('Processed customer.subscription.created', {
    workspaceId: targetWorkspaceId,
    tier,
  });
}

/**
 * Handle customer.subscription.updated
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const workspaceId = await getWorkspaceBySubscription(subscription.id);
  if (!workspaceId) {
    logger.warn('Could not find workspace for subscription update', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId ?? '') ?? 'starter';

  await syncWorkspaceSubscription(workspaceId, subscription, tier);
  await upsertSubscription(workspaceId, subscription, tier);
  await logBillingEvent('customer.subscription.updated', event.id, workspaceId, {
    subscription_id: subscription.id,
    tier,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
  });

  logger.info('Processed customer.subscription.updated', {
    workspaceId,
    tier,
    status: subscription.status,
  });
}

/**
 * Handle customer.subscription.deleted
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const workspaceId = await getWorkspaceBySubscription(subscription.id);
  if (!workspaceId) {
    logger.warn('Could not find workspace for subscription deletion', {
      subscriptionId: subscription.id,
    });
    return;
  }

  // Update workspace to canceled status
  await supabase
    .from('workspaces')
    .update({
      status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  // Update subscription record
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  await logBillingEvent('customer.subscription.deleted', event.id, workspaceId, {
    subscription_id: subscription.id,
  });

  logger.info('Processed customer.subscription.deleted', {
    workspaceId,
    subscriptionId: subscription.id,
  });
}

/**
 * Handle invoice.paid
 */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  const workspaceId = await getWorkspaceByCustomer(invoice.customer as string);
  if (!workspaceId) {
    logger.warn('Could not find workspace for invoice', {
      invoiceId: invoice.id,
    });
    return;
  }

  // Store invoice record
  await upsertInvoice(workspaceId, invoice);

  const subscriptionId = getSubscriptionFromInvoice(invoice);

  // If subscription was past_due, update to active
  if (subscriptionId) {
    await supabase
      .from('workspaces')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId)
      .eq('status', 'past_due');
  }

  await logBillingEvent('invoice.paid', event.id, workspaceId, {
    invoice_id: invoice.id,
    amount_paid: invoice.amount_paid,
    subscription_id: subscriptionId,
  });

  logger.info('Processed invoice.paid', {
    workspaceId,
    invoiceId: invoice.id,
    amountPaid: invoice.amount_paid,
  });
}

/**
 * Handle invoice.payment_failed
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  const workspaceId = await getWorkspaceByCustomer(invoice.customer as string);
  if (!workspaceId) {
    logger.warn('Could not find workspace for invoice', {
      invoiceId: invoice.id,
    });
    return;
  }

  // Update workspace status to past_due
  await supabase
    .from('workspaces')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);

  // Store invoice record
  await upsertInvoice(workspaceId, invoice);

  await logBillingEvent('invoice.payment_failed', event.id, workspaceId, {
    invoice_id: invoice.id,
    amount_due: invoice.amount_due,
    attempt_count: invoice.attempt_count,
  });

  logger.info('Processed invoice.payment_failed', {
    workspaceId,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
  });
}

/**
 * Handle payment_method.attached
 */
export async function handlePaymentMethodAttached(
  event: Stripe.Event
): Promise<void> {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;

  const workspaceId = await getWorkspaceByCustomer(paymentMethod.customer as string);
  if (!workspaceId) return;

  // Store payment method
  await supabase.from('payment_methods').upsert(
    {
      workspace_id: workspaceId,
      stripe_payment_method_id: paymentMethod.id,
      stripe_customer_id: paymentMethod.customer as string,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand ?? null,
      last_four: paymentMethod.card?.last4 ?? null,
      exp_month: paymentMethod.card?.exp_month ?? null,
      exp_year: paymentMethod.card?.exp_year ?? null,
      is_default: false, // Will be updated by customer.updated event
    },
    {
      onConflict: 'stripe_payment_method_id',
    }
  );

  await logBillingEvent('payment_method.attached', event.id, workspaceId, {
    payment_method_id: paymentMethod.id,
    type: paymentMethod.type,
  });

  logger.info('Processed payment_method.attached', {
    workspaceId,
    paymentMethodId: paymentMethod.id,
  });
}

/**
 * Handle payment_method.detached
 */
export async function handlePaymentMethodDetached(
  event: Stripe.Event
): Promise<void> {
  const paymentMethod = event.data.object as Stripe.PaymentMethod;

  // Remove from database
  await supabase
    .from('payment_methods')
    .delete()
    .eq('stripe_payment_method_id', paymentMethod.id);

  await logBillingEvent('payment_method.detached', null, null, {
    payment_method_id: paymentMethod.id,
  });

  logger.info('Processed payment_method.detached', {
    paymentMethodId: paymentMethod.id,
  });
}

/**
 * Handle customer.updated (for default payment method changes)
 */
export async function handleCustomerUpdated(event: Stripe.Event): Promise<void> {
  const customer = event.data.object as Stripe.Customer;

  const workspaceId = await getWorkspaceByCustomer(customer.id);
  if (!workspaceId) return;

  const defaultPaymentMethod =
    customer.invoice_settings?.default_payment_method as string | null;

  if (defaultPaymentMethod) {
    // Set all other payment methods as non-default
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('workspace_id', workspaceId);

    // Set the default one
    await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('stripe_payment_method_id', defaultPaymentMethod);
  }

  await logBillingEvent('customer.updated', event.id, workspaceId, {
    default_payment_method: defaultPaymentMethod,
  });

  logger.info('Processed customer.updated', {
    workspaceId,
    defaultPaymentMethod,
  });
}

// Helper functions

async function getWorkspaceBySubscription(
  subscriptionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();
  return data?.id ?? null;
}

async function getWorkspaceByCustomer(
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
  return data?.id ?? null;
}

/**
 * Main event router
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  logger.info('Processing Stripe webhook', {
    eventType: event.type,
    eventId: event.id,
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event);
      break;
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event);
      break;
    case 'payment_method.attached':
      await handlePaymentMethodAttached(event);
      break;
    case 'payment_method.detached':
      await handlePaymentMethodDetached(event);
      break;
    case 'customer.updated':
      await handleCustomerUpdated(event);
      break;
    default:
      logger.debug('Unhandled webhook event type', { eventType: event.type });
  }
}
