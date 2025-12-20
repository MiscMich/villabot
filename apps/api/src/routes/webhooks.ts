/**
 * Webhook Routes
 * Handles external service webhooks (Stripe)
 *
 * IMPORTANT: This route requires raw body parsing for Stripe signature verification.
 * Configure express.raw() middleware for /webhooks/stripe path BEFORE JSON parsing.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getStripeClient, isStripeConfigured } from '../services/billing/stripe.js';
import { handleStripeWebhook } from '../services/billing/webhooks.js';

const router = Router();

/**
 * Stripe webhook endpoint
 *
 * This endpoint receives events from Stripe for subscription management.
 * It verifies the webhook signature to ensure the request is authentic.
 *
 * Required events to configure in Stripe:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.paid
 * - invoice.payment_failed
 * - payment_method.attached
 * - payment_method.detached
 * - customer.updated
 */
router.post('/stripe', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    logger.warn('Stripe webhook received but Stripe is not configured');
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(503).json({ error: 'Webhook secret not configured' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    logger.warn('Missing Stripe signature header');
    res.status(400).json({ error: 'Missing signature' });
    return;
  }

  let event: Stripe.Event;

  try {
    // Get raw body - should be configured in index.ts to preserve raw body for this route
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      // If rawBody isn't available, try using the body directly
      // This works if body-parser was configured correctly
      const bodyBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));

      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(
        bodyBuffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } else {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Webhook signature verification failed', { error: message });
    res.status(400).json({ error: `Webhook Error: ${message}` });
    return;
  }

  // Process the event
  try {
    await handleStripeWebhook(event);
    res.json({ received: true, eventId: event.id });
  } catch (error) {
    logger.error('Webhook processing failed', {
      eventId: event.id,
      eventType: event.type,
      error,
    });

    // Return 500 so Stripe will retry
    res.status(500).json({
      error: 'Webhook processing failed',
      eventId: event.id,
    });
  }
});

/**
 * Health check for webhook endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    stripe: isStripeConfigured(),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
  });
});

export default router;
