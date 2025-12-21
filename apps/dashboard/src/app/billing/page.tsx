'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TIER_CONFIGS } from '@teambrain/shared';
import type { SubscriptionTier } from '@teambrain/shared';

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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Billing & Subscription</h1>
        <p className="text-slate-400">Manage your subscription and billing details</p>
      </div>

      {showSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>Your subscription has been updated successfully!</span>
        </div>
      )}

      {/* Current Plan */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-100">Current Plan</CardTitle>
              <CardDescription className="text-slate-400">
                {workspace?.name ?? 'Your workspace'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${
                  tier === 'business'
                    ? 'border-purple-500 text-purple-400'
                    : tier === 'pro'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-slate-500 text-slate-400'
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
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Monthly price</p>
              <p className="text-2xl font-bold text-slate-100">
                ${TIER_CONFIGS[tier].price}
                <span className="text-sm text-slate-400 font-normal">/month</span>
              </p>
            </div>
            {billing?.subscription?.current_period_end && (
              <div className="space-y-1">
                <p className="text-sm text-slate-400">
                  {billing.subscription.cancel_at_period_end
                    ? 'Access until'
                    : 'Next billing date'}
                </p>
                <p className="text-lg font-medium text-slate-100">
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
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div className="grid gap-6 md:grid-cols-3">
        {(Object.entries(TIER_CONFIGS) as [SubscriptionTier, typeof TIER_CONFIGS.starter][]).map(
          ([tierKey, config]) => {
            const isCurrent = tier === tierKey;
            const isUpgrade = TIER_CONFIGS[tierKey].price > TIER_CONFIGS[tier].price;

            return (
              <Card
                key={tierKey}
                className={`bg-slate-800/50 border-slate-700 ${
                  isCurrent ? 'ring-2 ring-amber-500/50' : ''
                } ${tierKey === 'pro' ? 'relative overflow-hidden' : ''}`}
              >
                {tierKey === 'pro' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {tierIcons[tierKey]}
                    <CardTitle className="text-slate-100">{config.name}</CardTitle>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-100">${config.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {config.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
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
                          ? 'bg-slate-700 text-slate-400 cursor-default'
                          : tierKey === 'pro'
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
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
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      {/* Payment Methods */}
      {billing?.payment_methods && billing.payment_methods.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Payment Methods</CardTitle>
            <CardDescription className="text-slate-400">
              Manage your payment methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {billing.payment_methods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-100 capitalize">
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
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      {billing?.invoices && billing.invoices.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Invoice History</CardTitle>
            <CardDescription className="text-slate-400">
              View and download your invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {billing.invoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {new Date(invoice.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-xs text-slate-400">
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
                        className="text-amber-500 hover:text-amber-400"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BillingLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
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
