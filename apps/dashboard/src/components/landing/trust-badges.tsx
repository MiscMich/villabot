'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { fadeInUp, staggerContainer } from '@/lib/motion';

const integrations = [
  { name: 'Slack', logo: '/logos/slack.svg' },
  { name: 'Google Drive', logo: '/logos/google-drive.svg' },
  { name: 'Notion', logo: '/logos/notion.svg' },
  { name: 'Supabase', logo: '/logos/supabase.svg' },
];

export function TrustBadges() {
  return (
    <section className="py-16 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-void via-void-light/50 to-void" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center"
        >
          <motion.p
            variants={fadeInUp}
            className="text-sm text-white/50 mb-10 uppercase tracking-wider"
          >
            Integrates seamlessly with your favorite tools
          </motion.p>

          {/* Logo grid */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8"
          >
            {integrations.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group flex items-center gap-3 text-white/40 hover:text-white/80 transition-all duration-300"
              >
                <div className="relative w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity">
                  <Image
                    src={item.logo}
                    alt={item.name}
                    fill
                    className="object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <span className="text-sm font-medium">{item.name}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Animated marquee for larger displays */}
          <motion.div
            variants={fadeInUp}
            className="mt-12 pt-12 border-t border-white/5"
          >
            <p className="text-xs text-white/30 mb-6">
              Trusted by forward-thinking teams at companies like
            </p>
            <div className="marquee-container h-8">
              <div className="flex animate-marquee">
                {[...Array(2)].map((_, setIndex) => (
                  <div key={setIndex} className="flex items-center gap-16 px-8">
                    {['TechCorp', 'StartupXYZ', 'Agency Pro', 'DevTeam', 'Enterprise Co', 'Scale Inc'].map(
                      (company) => (
                        <span
                          key={`${setIndex}-${company}`}
                          className="text-white/20 text-sm font-medium whitespace-nowrap"
                        >
                          {company}
                        </span>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
