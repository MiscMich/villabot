'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Zap,
  Building,
  Rocket,
} from 'lucide-react';
import { TIER_CONFIGS } from '@cluebase/shared';
import type { SubscriptionTier } from '@cluebase/shared';

interface BillingOverview {
  subscription: {
    tier: string;
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  } | null;
  invoices: Array<{
    id: string;
    amount_due: number;
    status: string;
    created_at: string;
    hosted_invoice_url: string | null;
  }>;
  payment_methods: Array<{
    id: string;
    brand: string;
    last_four: string;
    is_default: boolean;
  }>;
}

const tierIcons: Record<SubscriptionTier, React.ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  pro: <Rocket className="h-5 w-5" />,
  business: <Building className="h-5 w-5" />,
};

function BillingContent() {
  const { workspace, tier, isTrialing, trialDaysRemaining, canManageBilling } = useWorkspace();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  // Fetch billing data
  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const data = await api.getBillingOverview();
        setBilling(data);
      } catch (error) {
        console.error('Failed to fetch billing:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBilling();
  }, []);

  const handleUpgrade = async (newTier: SubscriptionTier) => {
    setSelectedTier(newTier);
    setIsUpgrading(true);

    try {
      const { checkout_url } = await api.createCheckoutSession(newTier);
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      setIsUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const { portal_url } = await api.createPortalSession();
      window.location.href = portal_url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
          <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
        </div>
        <div className="h-48 bg-muted rounded-xl shimmer" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-64 bg-muted rounded-xl shimmer" />
          <div className="h-64 bg-muted rounded-xl shimmer" />
          <div className="h-64 bg-muted rounded-xl shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Billing & Subscription</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      {showSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>Your subscription has been updated successfully!</span>
        </div>
      )}

      {/* Current Plan */}
      <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Current Plan</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {workspace?.name ?? 'Your workspace'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${
                  tier === 'business'
                    ? 'border-purple-500 text-purple-400'
                    : tier === 'pro'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-white/20 text-muted-foreground'
                }`}
              >
                {tierIcons[tier]}
                <span className="ml-1">{TIER_CONFIGS[tier].name}</span>
              </Badge>
              {isTrialing && (
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  Trial - {trialDaysRemaining} days left
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Monthly price</p>
              <p className="text-2xl font-bold text-foreground">
                ${TIER_CONFIGS[tier].price}
                <span className="text-sm text-muted-foreground font-normal">/month</span>
              </p>
            </div>
            {billing?.subscription?.current_period_end && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {billing.subscription.cancel_at_period_end
                    ? 'Access until'
                    : 'Next billing date'}
                </p>
                <p className="text-lg font-medium text-foreground">
                  {new Date(billing.subscription.current_period_end).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {canManageBilling && billing?.subscription && (
            <div className="mt-6">
              <Button
                onClick={handleManageBilling}
                variant="outline"
                className="border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="grid gap-6 md:grid-cols-3">
        {(Object.entries(TIER_CONFIGS) as [SubscriptionTier, typeof TIER_CONFIGS.starter][]).map(
          ([tierKey, config], index) => {
            const isCurrent = tier === tierKey;
            const isUpgrade = TIER_CONFIGS[tierKey].price > TIER_CONFIGS[tier].price;

            return (
              <div
                key={tierKey}
                className={`premium-card opacity-0 animate-fade-in-up ${
                  isCurrent ? 'ring-2 ring-violet-500/50' : ''
                } ${tierKey === 'pro' ? 'relative overflow-hidden' : ''}`}
                style={{ animationDelay: `${150 + index * 50}ms` }}
              >
                {tierKey === 'pro' && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <div className="p-6 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {tierIcons[tierKey]}
                    <h3 className="font-display text-lg font-semibold">{config.name}</h3>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">${config.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <ul className="space-y-2">
                    {config.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {canManageBilling && (
                    <Button
                      onClick={() => handleUpgrade(tierKey)}
                      disabled={isCurrent || isUpgrading}
                      className={`w-full ${
                        isCurrent
                          ? 'bg-white/10 text-muted-foreground cursor-default'
                          : tierKey === 'pro'
                          ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple'
                          : 'bg-white/10 hover:bg-white/20 text-foreground'
                      }`}
                    >
                      {isUpgrading && selectedTier === tierKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : isUpgrade ? (
                        'Upgrade'
                      ) : (
                        'Downgrade'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Payment Methods */}
      {billing?.payment_methods && billing.payment_methods.length > 0 && (
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="p-6 border-b border-border/50">
            <h2 className="font-display text-xl font-semibold">Payment Methods</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your payment methods
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {billing.payment_methods.map((method, index) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg opacity-0 animate-fade-in"
                  style={{ animationDelay: `${350 + index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {method.brand} ending in {method.last_four}
                      </p>
                    </div>
                  </div>
                  {method.is_default && (
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      Default
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invoice History */}
      {billing?.invoices && billing.invoices.length > 0 && (
        <div className="premium-card opacity-0 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <div className="p-6 border-b border-border/50">
            <h2 className="font-display text-xl font-semibold">Invoice History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              View and download your invoices
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {billing.invoices.slice(0, 5).map((invoice, index) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg opacity-0 animate-fade-in"
                  style={{ animationDelay: `${400 + index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(invoice.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${(invoice.amount_due / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        invoice.status === 'paid'
                          ? 'border-green-500 text-green-400'
                          : 'border-yellow-500 text-yellow-400'
                      }
                    >
                      {invoice.status}
                    </Badge>
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillingLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
        <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
      </div>
      <div className="h-48 bg-muted rounded-xl shimmer" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="h-64 bg-muted rounded-xl shimmer" />
        <div className="h-64 bg-muted rounded-xl shimmer" />
        <div className="h-64 bg-muted rounded-xl shimmer" />
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoading />}>
      <BillingContent />
    </Suspense>
  );
}
