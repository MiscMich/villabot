/**
 * Billing Routes
 * Handles subscription management, checkout, and billing portal
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { resolveWorkspace, requireWorkspaceAdmin } from '../middleware/workspace.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../services/supabase/client.js';
import {
  isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getUpcomingInvoice,
  listInvoices,
  listPaymentMethods,
} from '../services/billing/stripe.js';
import { TIER_CONFIGS } from '@cluebase/shared';
import type { SubscriptionTier } from '@cluebase/shared';
import type Stripe from 'stripe';

const router = Router();

/**
 * Helper to get period end from subscription
 * In Stripe SDK v20.1.0+, period dates are on SubscriptionItem, not Subscription
 */
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  const item = subscription.items.data[0];
  return item?.current_period_end ?? null;
}

/**
 * Check if billing is available
 */
router.get('/status', authenticate, async (_req: Request, res: Response) => {
  res.json({
    enabled: isStripeConfigured(),
    tiers: Object.entries(TIER_CONFIGS).map(([key, config]) => ({
      slug: key,
      name: config.name,
      price: config.price,
      features: config.features,
      trialDays: config.trialDays,
    })),
  });
});

/**
 * Get billing overview for current workspace
 */
router.get(
  '/overview',
  authenticate,
  resolveWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.workspace!.id;

      // Get subscription from database
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get recent invoices from database
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(12);

      // Get payment methods from database
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_default', { ascending: false });

      // Get upcoming invoice if subscription exists
      let upcomingInvoice = null;
      if (subscription && isStripeConfigured()) {
        try {
          const upcoming = await getUpcomingInvoice(workspaceId);
          if (upcoming) {
            upcomingInvoice = {
              amount: upcoming.amount_due,
              date: upcoming.next_payment_attempt
                ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
                : null,
            };
          }
        } catch {
          // Ignore errors for upcoming invoice
        }
      }

      res.json({
        subscription,
        invoices: invoices ?? [],
        paymentMethods: paymentMethods ?? [],
        upcomingInvoice,
        currentTier: req.workspace!.tier,
        tierConfig: TIER_CONFIGS[req.workspace!.tier as SubscriptionTier],
      });
    } catch (error) {
      logger.error('Failed to get billing overview', { error });
      res.status(500).json({
        error: 'Failed to get billing overview',
        code: 'BILLING_ERROR',
      });
    }
  }
);

/**
 * Create checkout session for new subscription
 */
router.post(
  '/checkout',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: 'Billing is not configured',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      const { tier, successUrl, cancelUrl } = req.body as {
        tier: SubscriptionTier;
        successUrl: string;
        cancelUrl: string;
      };

      // Validate tier
      if (!tier || !['starter', 'pro', 'business'].includes(tier)) {
        res.status(400).json({
          error: 'Invalid tier',
          code: 'INVALID_TIER',
          validTiers: ['starter', 'pro', 'business'],
        });
        return;
      }

      // Check if workspace already has an active subscription
      if (req.workspace!.stripe_subscription_id) {
        res.status(400).json({
          error: 'Workspace already has an active subscription. Use /billing/change-plan to upgrade or downgrade.',
          code: 'SUBSCRIPTION_EXISTS',
        });
        return;
      }

      const session = await createCheckoutSession(
        req.workspace!.id,
        req.user!.id,
        tier,
        successUrl,
        cancelUrl
      );

      logger.info('Created checkout session', {
        workspaceId: req.workspace!.id,
        tier,
        sessionId: session.sessionId,
      });

      res.json({
        checkoutUrl: session.url,
        sessionId: session.sessionId,
      });
    } catch (error) {
      logger.error('Failed to create checkout session', { error });
      res.status(500).json({
        error: 'Failed to create checkout session',
        code: 'CHECKOUT_ERROR',
      });
    }
  }
);

/**
 * Create customer portal session
 */
router.post(
  '/portal',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: 'Billing is not configured',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      const { returnUrl } = req.body as { returnUrl: string };

      if (!req.workspace!.stripe_customer_id) {
        res.status(400).json({
          error: 'No billing account found. Please start a subscription first.',
          code: 'NO_CUSTOMER',
        });
        return;
      }

      const session = await createPortalSession(req.workspace!.id, returnUrl);

      logger.info('Created portal session', {
        workspaceId: req.workspace!.id,
      });

      res.json({
        portalUrl: session.url,
      });
    } catch (error) {
      logger.error('Failed to create portal session', { error });
      res.status(500).json({
        error: 'Failed to create portal session',
        code: 'PORTAL_ERROR',
      });
    }
  }
);

/**
 * Change subscription plan (upgrade/downgrade)
 */
router.post(
  '/change-plan',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: 'Billing is not configured',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      const { tier } = req.body as { tier: SubscriptionTier };

      // Validate tier
      if (!tier || !['starter', 'pro', 'business'].includes(tier)) {
        res.status(400).json({
          error: 'Invalid tier',
          code: 'INVALID_TIER',
          validTiers: ['starter', 'pro', 'business'],
        });
        return;
      }

      // Check if workspace has a subscription
      if (!req.workspace!.stripe_subscription_id) {
        res.status(400).json({
          error: 'No active subscription. Please start a subscription first.',
          code: 'NO_SUBSCRIPTION',
        });
        return;
      }

      // Check if already on this tier
      if (req.workspace!.tier === tier) {
        res.status(400).json({
          error: 'Already on this tier',
          code: 'SAME_TIER',
        });
        return;
      }

      const result = await updateSubscription(req.workspace!.id, tier);

      logger.info('Changed subscription plan', {
        workspaceId: req.workspace!.id,
        fromTier: req.workspace!.tier,
        toTier: tier,
      });

      const periodEnd = getSubscriptionPeriodEnd(result.subscription);
      res.json({
        success: true,
        tier,
        proratedAmount: result.proratedAmount,
        nextInvoiceDate: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
      });
    } catch (error) {
      logger.error('Failed to change plan', { error });
      res.status(500).json({
        error: 'Failed to change plan',
        code: 'CHANGE_PLAN_ERROR',
      });
    }
  }
);

/**
 * Cancel subscription
 */
router.post(
  '/cancel',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: 'Billing is not configured',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      const { cancelImmediately, feedback } = req.body as {
        cancelImmediately?: boolean;
        feedback?: string;
      };

      if (!req.workspace!.stripe_subscription_id) {
        res.status(400).json({
          error: 'No active subscription',
          code: 'NO_SUBSCRIPTION',
        });
        return;
      }

      const subscription = await cancelSubscription(
        req.workspace!.id,
        cancelImmediately ?? false
      );

      // Store cancellation feedback if provided
      if (feedback) {
        await supabase.from('billing_events').insert({
          workspace_id: req.workspace!.id,
          event_type: 'cancellation_feedback',
          data: { feedback },
        });
      }

      const cancelPeriodEnd = getSubscriptionPeriodEnd(subscription);
      logger.info('Canceled subscription', {
        workspaceId: req.workspace!.id,
        cancelImmediately,
        accessUntil: subscription.cancel_at || cancelPeriodEnd,
      });

      res.json({
        success: true,
        accessUntil: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : cancelPeriodEnd
            ? new Date(cancelPeriodEnd * 1000).toISOString()
            : null,
        canceledImmediately: cancelImmediately ?? false,
      });
    } catch (error) {
      logger.error('Failed to cancel subscription', { error });
      res.status(500).json({
        error: 'Failed to cancel subscription',
        code: 'CANCEL_ERROR',
      });
    }
  }
);

/**
 * Reactivate canceled subscription (before period end)
 */
router.post(
  '/reactivate',
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  async (req: Request, res: Response) => {
    try {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: 'Billing is not configured',
          code: 'BILLING_NOT_CONFIGURED',
        });
        return;
      }

      if (!req.workspace!.stripe_subscription_id) {
        res.status(400).json({
          error: 'No subscription to reactivate',
          code: 'NO_SUBSCRIPTION',
        });
        return;
      }

      const subscription = await reactivateSubscription(req.workspace!.id);

      logger.info('Reactivated subscription', {
        workspaceId: req.workspace!.id,
      });

      const reactivatePeriodEnd = getSubscriptionPeriodEnd(subscription);
      res.json({
        success: true,
        status: subscription.status,
        nextBillingDate: reactivatePeriodEnd
          ? new Date(reactivatePeriodEnd * 1000).toISOString()
          : null,
      });
    } catch (error) {
      logger.error('Failed to reactivate subscription', { error });
      res.status(500).json({
        error: 'Failed to reactivate subscription',
        code: 'REACTIVATE_ERROR',
      });
    }
  }
);

/**
 * Get invoices (fetch latest from Stripe)
 */
router.get(
  '/invoices',
  authenticate,
  resolveWorkspace,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 12;

      // Try to get from Stripe first if configured
      if (isStripeConfigured() && req.workspace!.stripe_customer_id) {
        const invoices = await listInvoices(req.workspace!.id, limit);

        res.json({
          invoices: invoices.map((inv) => ({
            id: inv.id,
            status: inv.status,
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            currency: inv.currency,
            periodStart: inv.period_start
              ? new Date(inv.period_start * 1000).toISOString()
              : null,
            periodEnd: inv.period_end
              ? new Date(inv.period_end * 1000).toISOString()
              : null,
            hostedInvoiceUrl: inv.hosted_invoice_url,
            invoicePdf: inv.invoice_pdf,
            createdAt: new Date(inv.created * 1000).toISOString(),
          })),
        });
        return;
      }

      // Fall back to database
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('workspace_id', req.workspace!.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      res.json({ invoices: invoices ?? [] });
    } catch (error) {
      logger.error('Failed to get invoices', { error });
      res.status(500).json({
        error: 'Failed to get invoices',
        code: 'INVOICES_ERROR',
      });
    }
  }
);

/**
 * Get payment methods
 */
router.get(
  '/payment-methods',
  authenticate,
  resolveWorkspace,
  async (req: Request, res: Response) => {
    try {
      // Try to get from Stripe first if configured
      if (isStripeConfigured() && req.workspace!.stripe_customer_id) {
        const methods = await listPaymentMethods(req.workspace!.id);

        res.json({
          paymentMethods: methods.map((pm) => ({
            id: pm.id,
            type: pm.type,
            brand: pm.card?.brand,
            lastFour: pm.card?.last4,
            expMonth: pm.card?.exp_month,
            expYear: pm.card?.exp_year,
          })),
        });
        return;
      }

      // Fall back to database
      const { data: methods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('workspace_id', req.workspace!.id)
        .order('is_default', { ascending: false });

      res.json({ paymentMethods: methods ?? [] });
    } catch (error) {
      logger.error('Failed to get payment methods', { error });
      res.status(500).json({
        error: 'Failed to get payment methods',
        code: 'PAYMENT_METHODS_ERROR',
      });
    }
  }
);

/**
 * Get usage summary for billing
 */
router.get(
  '/usage',
  authenticate,
  resolveWorkspace,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = req.workspace!.id;

      // Get current period (subscription period or calendar month)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get query count for this period
      const { count: queriesUsed } = await supabase
        .from('usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('metric', 'query')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());

      // Get document count
      const { count: documentsUsed } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      // Get team member count
      const { count: teamMembersUsed } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);

      // Get bot count
      const { count: botsUsed } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      const tierConfig = TIER_CONFIGS[req.workspace!.tier as SubscriptionTier];

      res.json({
        queries: {
          used: queriesUsed ?? 0,
          limit: tierConfig.limits.queriesPerMonth,
          percent: tierConfig.limits.queriesPerMonth > 0
            ? Math.round(((queriesUsed ?? 0) / tierConfig.limits.queriesPerMonth) * 100)
            : 0,
        },
        documents: {
          used: documentsUsed ?? 0,
          limit: tierConfig.limits.documents,
          percent: tierConfig.limits.documents > 0
            ? Math.round(((documentsUsed ?? 0) / tierConfig.limits.documents) * 100)
            : 0,
        },
        teamMembers: {
          used: teamMembersUsed ?? 0,
          limit: tierConfig.limits.teamMembers,
          percent: tierConfig.limits.teamMembers > 0
            ? Math.round(((teamMembersUsed ?? 0) / tierConfig.limits.teamMembers) * 100)
            : 0,
        },
        bots: {
          used: botsUsed ?? 0,
          limit: tierConfig.limits.bots,
          percent: tierConfig.limits.bots > 0
            ? Math.round(((botsUsed ?? 0) / tierConfig.limits.bots) * 100)
            : 0,
        },
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
          daysRemaining: Math.ceil(
            (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
      });
    } catch (error) {
      logger.error('Failed to get usage', { error });
      res.status(500).json({
        error: 'Failed to get usage',
        code: 'USAGE_ERROR',
      });
    }
  }
);

export default router;
