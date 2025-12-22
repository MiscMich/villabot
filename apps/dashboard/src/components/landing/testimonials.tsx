'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { GlassCard, GradientText } from '@/components/design-system';
import { fadeInUp, staggerContainer } from '@/lib/motion';

const testimonials = [
  {
    quote:
      "Cluebase has transformed how our team accesses information. What used to take 30 minutes of searching now takes 30 seconds.",
    author: 'Sarah Chen',
    role: 'VP of Engineering',
    company: 'TechStart Inc.',
    avatar: 'SC',
    rating: 5,
  },
  {
    quote:
      "We reduced repeated questions by 80%. Our support team can finally focus on complex issues instead of answering the same FAQ over and over.",
    author: 'Michael Torres',
    role: 'Head of Customer Success',
    company: 'GrowthCo',
    avatar: 'MT',
    rating: 5,
  },
  {
    quote:
      "The Google Drive integration is seamless. Our entire knowledge base is now searchable through Slack. Game changer for remote teams.",
    author: 'Emily Rodriguez',
    role: 'Operations Manager',
    company: 'RemoteFirst',
    avatar: 'ER',
    rating: 5,
  },
];

export function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} id="testimonials" className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-mesh-center opacity-30" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
            <span className="text-sm font-medium text-violet-400">Testimonials</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Loved by{' '}
            <GradientText as="span" className="text-4xl md:text-5xl font-bold">
              teams everywhere
            </GradientText>
          </h2>

          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            See what our customers have to say about Cluebase
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate={isInView ? 'animate' : 'initial'}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              variants={fadeInUp}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard hover glow="purple" padding="lg" className="h-full">
                {/* Quote icon */}
                <div className="mb-4">
                  <Quote className="w-8 h-8 text-violet-500/50" />
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, j) => (
                    <Star
                      key={j}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote text */}
                <p className="text-white/80 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-white font-medium text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-white font-medium">{testimonial.author}</p>
                    <p className="text-sm text-white/50">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: '50K+', label: 'Documents Indexed' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '<2s', label: 'Avg Response' },
            { value: '500+', label: 'Happy Teams' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                {stat.value}
              </p>
              <p className="text-sm text-white/50">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
