'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { GlassCard, GlowButton, GradientText } from '@/components/design-system';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    monthlyPrice: 49,
    yearlyPrice: 39,
    features: [
      '1 Slack workspace',
      '1 bot instance',
      '5,000 documents',
      '1,000 questions/month',
      'Google Drive sync',
      'Email support',
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Professional',
    description: 'For growing teams with more needs',
    monthlyPrice: 149,
    yearlyPrice: 119,
    features: [
      '3 Slack workspaces',
      '5 bot instances',
      '50,000 documents',
      '10,000 questions/month',
      'Website scraping',
      'Analytics dashboard',
      'Priority support',
      'Custom training',
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      'Unlimited workspaces',
      'Unlimited bots',
      'Unlimited documents',
      'Unlimited questions',
      'SSO / SAML',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export function PricingCards() {
  const [isYearly, setIsYearly] = useState(true);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} id="pricing" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-mesh-purple opacity-20" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <span className="text-sm font-medium text-violet-400">Pricing</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, transparent{' '}
            <GradientText as="span" className="text-4xl md:text-5xl font-bold">
              pricing
            </GradientText>
          </h2>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-8">
            Start free, upgrade when you need. No hidden fees.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 p-1.5 rounded-full bg-white/5 border border-white/10">
            <button
              onClick={() => setIsYearly(false)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                !isYearly ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all inline-flex items-center gap-2',
                isYearly ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
              )}
            >
              Yearly
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate={isInView ? 'animate' : 'initial'}
          className="grid md:grid-cols-3 gap-6"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeInUp}
              transition={{ delay: i * 0.1 }}
              className={plan.popular ? 'relative' : ''}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              <GlassCard
                hover
                glow={plan.popular ? 'purple' : 'none'}
                variant={plan.popular ? 'elevated' : 'default'}
                padding="lg"
                className={cn('h-full flex flex-col', plan.popular && 'border-violet-500/30')}
              >
                {/* Plan header */}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-white/60">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {plan.monthlyPrice !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">
                        ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      </span>
                      <span className="text-white/60">/month</span>
                    </div>
                  ) : (
                    <div className="text-4xl font-bold text-white">Custom</div>
                  )}
                  {isYearly && plan.monthlyPrice && (
                    <p className="text-sm text-white/40 mt-1">
                      Billed annually (${plan.yearlyPrice! * 12}/year)
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={plan.name === 'Enterprise' ? '/contact' : '/auth/signup'}>
                  <GlowButton
                    variant={plan.popular ? 'primary' : 'secondary'}
                    fullWidth
                  >
                    {plan.cta}
                  </GlowButton>
                </Link>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
