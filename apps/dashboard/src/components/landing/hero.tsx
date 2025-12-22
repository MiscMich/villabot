'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import {
  GlowButton,
  GradientText,
  MultiSpotlight,
  FloatingElement,
} from '@/components/design-system';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { ProductMockup } from './product-mockup';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-16">
      {/* Background layers */}
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-0 bg-mesh-purple" />
      <MultiSpotlight />

      {/* Grid pattern */}
      <div className="grid-pattern" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-white/80">Powered by Google Gemini AI</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
          >
            Your team's knowledge,
            <br />
            <GradientText as="span" className="text-5xl md:text-6xl lg:text-7xl font-bold">
              instantly accessible
            </GradientText>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10"
          >
            Connect your docs, SOPs, and websites. Get instant AI-powered answers
            directly in Slack. Stop repeating yourself—let Cluebase remember for your team.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/auth/signup">
              <GlowButton size="lg" className="min-w-[200px]">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-1" />
              </GlowButton>
            </Link>
            <button className="ghost-button inline-flex items-center gap-2 px-6 py-3">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </motion.div>

          {/* Floating decorative elements */}
          <div className="absolute top-1/4 left-10 opacity-30 hidden lg:block">
            <FloatingElement delay={0} duration={5}>
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 backdrop-blur-sm border border-white/10" />
            </FloatingElement>
          </div>
          <div className="absolute top-1/3 right-10 opacity-30 hidden lg:block">
            <FloatingElement delay={1} duration={6}>
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border border-white/10" />
            </FloatingElement>
          </div>
          <div className="absolute bottom-1/3 left-20 opacity-20 hidden lg:block">
            <FloatingElement delay={2} duration={7} direction="diagonal">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20 backdrop-blur-sm border border-white/10" />
            </FloatingElement>
          </div>

          {/* Product Mockup */}
          <motion.div
            variants={fadeInUp}
            className="relative mt-8"
          >
            <ProductMockup />
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-void to-transparent" />
    </section>
  );
}
