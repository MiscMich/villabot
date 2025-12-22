'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  MessageSquare,
  FileText,
  Globe,
  Search,
  Bot,
  Shield,
} from 'lucide-react';
import { GlassCard, GradientText } from '@/components/design-system';
import { fadeInUp, staggerContainer, staggerDelay } from '@/lib/motion';

const features = [
  {
    title: 'Native Slack Integration',
    description:
      'Your team asks questions in Slack, gets instant AI-powered answers with source citations.',
    icon: MessageSquare,
    gradient: 'from-[#4A154B] to-[#7C3AED]',
    large: true,
  },
  {
    title: 'Google Drive Sync',
    description: 'Auto-index PDFs, Docs, Sheets, and Slides. Always up-to-date.',
    icon: FileText,
    gradient: 'from-blue-600 to-cyan-500',
  },
  {
    title: 'Website Scraping',
    description: 'Point us at your website—we index everything automatically.',
    icon: Globe,
    gradient: 'from-emerald-600 to-teal-500',
  },
  {
    title: 'Hybrid RAG Search',
    description: 'Semantic + keyword search with RRF fusion for accurate results.',
    icon: Search,
    gradient: 'from-violet-600 to-pink-500',
  },
  {
    title: 'Multi-Bot Architecture',
    description: 'Specialized bots for different teams with separate knowledge bases.',
    icon: Bot,
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    title: 'Enterprise Security',
    description: 'SOC 2 compliant. Row-level security. Your data stays yours.',
    icon: Shield,
    gradient: 'from-slate-600 to-slate-400',
    large: true,
  },
];

export function FeaturesBento() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} id="features" className="py-24 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-mesh-blue opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <span className="text-sm font-medium text-violet-400">Features</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Everything you need to
            <br />
            <GradientText as="span" className="text-4xl md:text-5xl font-bold">
              unlock your knowledge
            </GradientText>
          </h2>

          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Stop losing institutional knowledge. Cluebase indexes your docs and answers
            questions instantly.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate={isInView ? 'animate' : 'initial'}
          className="bento-grid"
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              transition={{ delay: staggerDelay(i) }}
              className={feature.large ? 'bento-item-large' : ''}
            >
              <GlassCard
                hover
                glow="purple"
                padding="lg"
                className="h-full group"
              >
                {/* Icon */}
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative gradient on hover */}
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
