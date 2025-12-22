'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Bot, Sparkles, FileText, Search } from 'lucide-react';
import { FloatingElement } from '@/components/design-system';

export function ProductMockup() {
  return (
    <div className="relative max-w-5xl mx-auto">
      {/* Glow effect behind mockup */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-pink-600/20 to-cyan-600/20 blur-3xl opacity-50" />

      <div className="relative flex flex-col lg:flex-row gap-6 items-stretch justify-center">
        {/* Left card - Slack conversation */}
        <FloatingElement delay={0} duration={5} distance={8}>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="glass-card p-6 w-full lg:w-[380px]"
          >
            {/* Slack header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4A154B] to-[#611f69] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">#team-questions</p>
                <p className="text-xs text-white/50">Slack</p>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-4">
              {/* User message */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white/70 mb-1">
                    <span className="font-medium text-white">Sarah</span>{' '}
                    <span className="text-white/40 text-xs">2:34 PM</span>
                  </p>
                  <div className="bg-white/5 rounded-lg px-3 py-2 inline-block">
                    <p className="text-sm text-white/90">
                      What's our refund policy for enterprise customers?
                    </p>
                  </div>
                </div>
              </div>

              {/* Bot response */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white/70 mb-1">
                    <span className="font-medium text-white">CluebaseAI</span>{' '}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 ml-1">
                      APP
                    </span>{' '}
                    <span className="text-white/40 text-xs">2:34 PM</span>
                  </p>
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
                    <p className="text-sm text-white/90 mb-2">
                      Enterprise customers have a <strong>30-day full refund</strong> policy.
                      After 30 days, refunds are prorated based on usage.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <FileText className="w-3 h-3" />
                      <span>Source: Enterprise-Policies.pdf</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </FloatingElement>

        {/* Right card - AI Search interface */}
        <FloatingElement delay={0.5} duration={6} distance={10}>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="glass-card p-6 w-full lg:w-[420px]"
          >
            {/* Search header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <div className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white/60">
                  Ask me anything, press '/' for prompts
                </div>
              </div>
              <button className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white">
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            {/* Knowledge sources */}
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-3 uppercase tracking-wider">
                Connected Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {['Google Drive', 'Notion', 'Website'].map((source) => (
                  <div
                    key={source}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70"
                  >
                    {source}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Documents', value: '1,234' },
                { label: 'Questions', value: '5.2K' },
                { label: 'Accuracy', value: '98%' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-gradient mb-1">{stat.value}</p>
                  <p className="text-xs text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Decorative glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl opacity-50" />
          </motion.div>
        </FloatingElement>
      </div>
    </div>
  );
}
