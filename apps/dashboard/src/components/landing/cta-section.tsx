'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
import { GlowButton, GradientText, AnimatedSpotlight } from '@/components/design-system';
import { fadeInUp } from '@/lib/motion';

export function CTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 bg-mesh-purple opacity-40" />
      <AnimatedSpotlight className="-top-40 -left-40" color="purple" />
      <AnimatedSpotlight className="-bottom-40 -right-40" color="pink" />

      {/* Grid pattern */}
      <div className="grid-pattern opacity-50" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-white/80">Ready to get started?</span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Stop losing knowledge.
            <br />
            <GradientText as="span" className="text-4xl md:text-5xl lg:text-6xl font-bold">
              Start scaling wisdom.
            </GradientText>
          </h2>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto">
            Join hundreds of teams using Cluebase to make their institutional knowledge
            instantly accessible. Setup takes 5 minutes.
          </p>

          {/* CTAs */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate={isInView ? 'animate' : 'initial'}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/auth/signup">
              <GlowButton size="lg" className="min-w-[220px]">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-1" />
              </GlowButton>
            </Link>
            <Link href="/contact">
              <button className="ghost-button inline-flex items-center gap-2 px-6 py-3">
                Talk to Sales
              </button>
            </Link>
          </motion.div>

          {/* Trust note */}
          <p className="mt-8 text-sm text-white/40">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  );
}
