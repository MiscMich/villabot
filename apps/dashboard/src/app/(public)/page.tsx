'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Brain,
  Slack,
  FileText,
  Globe,
  Zap,
  Shield,
  Users,
  BarChart3,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  MessageSquare,
  Search,
  Bot,
  ChevronRight,
  Play,
} from 'lucide-react';

// =============================================================================
// NAVIGATION
// =============================================================================

function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
              <Brain className="relative h-8 w-8 text-amber-500" />
            </div>
            <span className="font-display text-xl font-bold text-white">
              Cluebase<span className="text-amber-500">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#testimonials" className="text-sm text-slate-400 hover:text-white transition-colors">
              Testimonials
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-full transition-all hover:shadow-lg hover:shadow-amber-500/25"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// =============================================================================
// HERO SECTION
// =============================================================================

function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-amber-500/5 to-transparent rounded-full" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Badge */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Now with GPT-4 & Gemini Support</span>
          </div>
        </div>

        {/* Main Headline */}
        <h1 className="text-center text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 animate-fade-in-up">
          <span className="text-white">Your team&apos;s knowledge,</span>
          <br />
          <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">
            instantly accessible
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-center text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Connect your docs, SOPs, and websites to create an AI assistant that actually
          knows your business. Get answers in Slack, not meetings.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Link
            href="/auth/signup"
            className="group flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-4 rounded-full text-lg transition-all hover:shadow-xl hover:shadow-amber-500/25 hover:-translate-y-0.5"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="group flex items-center gap-2 text-white font-medium px-8 py-4 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all">
            <Play className="w-5 h-5 text-amber-500" />
            Watch Demo
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          {[
            { value: '50K+', label: 'Documents Indexed' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '<2s', label: 'Response Time' },
            { value: '500+', label: 'Teams Active' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-display font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Hero Visual */}
        <div className="relative mt-20 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-900/80">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-slate-500">#general — Slack</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* User Message */}
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  JD
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">John Doe</span>
                    <span className="text-xs text-slate-500">2:34 PM</span>
                  </div>
                  <p className="text-slate-300">@Cluebase What&apos;s our refund policy for enterprise customers?</p>
                </div>
              </div>
              {/* Bot Response */}
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-amber-500">Cluebase</span>
                    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">APP</span>
                    <span className="text-xs text-slate-500">2:34 PM</span>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                    <p className="text-slate-300 mb-3">
                      Enterprise customers have a <strong className="text-white">30-day money-back guarantee</strong> for annual plans. Here&apos;s the full policy:
                    </p>
                    <ul className="text-slate-400 text-sm space-y-1 mb-3">
                      <li>• Full refund within 30 days, no questions asked</li>
                      <li>• Pro-rated refund available after 30 days</li>
                      <li>• Contact support@company.com for processing</li>
                    </ul>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-3 h-3" />
                      <span>Source: Enterprise-Refund-Policy.pdf</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// TRUST SECTION
// =============================================================================

function TrustSection() {
  const companies = [
    'Stripe', 'Notion', 'Linear', 'Vercel', 'Supabase', 'Prisma'
  ];

  return (
    <section className="py-16 border-y border-white/5 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-sm text-slate-500 mb-8">
          Trusted by forward-thinking teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((company) => (
            <div
              key={company}
              className="text-xl font-display font-semibold text-slate-600 hover:text-slate-400 transition-colors"
            >
              {company}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FEATURES SECTION
// =============================================================================

function FeaturesSection() {
  const features = [
    {
      icon: Slack,
      title: 'Native Slack Integration',
      description: 'Your team asks questions in Slack, gets instant answers. No context switching, no extra apps.',
      gradient: 'from-[#4A154B] to-[#611f69]',
    },
    {
      icon: FileText,
      title: 'Google Drive Sync',
      description: 'Connect your Drive folders and we automatically index PDFs, Docs, Sheets, and more.',
      gradient: 'from-blue-600 to-blue-700',
    },
    {
      icon: Globe,
      title: 'Website Scraping',
      description: 'Point us at your website or docs site. We\'ll crawl and index everything automatically.',
      gradient: 'from-emerald-600 to-emerald-700',
    },
    {
      icon: Search,
      title: 'Hybrid RAG Search',
      description: 'Semantic + keyword search with RRF fusion. Find exactly what you need, every time.',
      gradient: 'from-purple-600 to-purple-700',
    },
    {
      icon: Bot,
      title: 'Multi-Bot Architecture',
      description: 'Create specialized bots for different teams—ops, sales, support—each with their own knowledge.',
      gradient: 'from-amber-600 to-amber-700',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'SOC 2 compliant. Data encrypted at rest and in transit. Row-level security for multi-tenant isolation.',
      gradient: 'from-slate-600 to-slate-700',
    },
  ];

  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
            Features
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Everything you need to
            <br />
            <span className="text-amber-500">unlock your knowledge</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Built for teams who are tired of searching through docs, asking the same questions,
            and waiting for answers from busy colleagues.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative p-6 rounded-2xl border border-white/5 bg-slate-900/50 hover:bg-slate-900/80 hover:border-white/10 transition-all duration-300"
            >
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// HOW IT WORKS
// =============================================================================

function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Connect your sources',
      description: 'Link Google Drive, paste website URLs, or upload files directly. We handle the rest.',
      icon: FileText,
    },
    {
      number: '02',
      title: 'Deploy to Slack',
      description: 'Install our Slack app and configure which channels the bot should respond in.',
      icon: Slack,
    },
    {
      number: '03',
      title: 'Ask anything',
      description: 'Your team @mentions the bot with questions. Instant, sourced answers every time.',
      icon: MessageSquare,
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-900/0 via-slate-900/50 to-slate-900/0">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
            How it works
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Up and running in minutes
          </h2>
          <p className="text-lg text-slate-400">
            No complex setup. No training required. Just connect and go.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector Line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-amber-500/50 to-transparent" />
              )}

              <div className="relative bg-slate-900/80 rounded-2xl border border-white/5 p-8 hover:border-amber-500/30 transition-colors">
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-5xl font-display font-bold text-amber-500/20">
                    {step.number}
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10">
                    <step.icon className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// PRICING SECTION
// =============================================================================

function PricingSection() {
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      name: 'Starter',
      price: annual ? 24 : 29,
      description: 'Perfect for small teams getting started',
      features: [
        '1,000 documents',
        '500 queries/month',
        '3 team members',
        '1 bot',
        '30-day analytics',
        'Email support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Pro',
      price: annual ? 66 : 79,
      description: 'For growing teams with more knowledge',
      features: [
        '10,000 documents',
        '5,000 queries/month',
        '10 team members',
        '3 bots',
        'Custom instructions',
        '90-day analytics',
        '14-day free trial',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Business',
      price: annual ? 166 : 199,
      description: 'For organizations needing full control',
      features: [
        '50,000 documents',
        '25,000 queries/month',
        'Unlimited team members',
        '10 bots',
        'Custom instructions',
        'API access',
        '1-year analytics',
        'Dedicated support',
        'SSO & SAML',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Start free, upgrade when you&apos;re ready. No credit card required.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-slate-900 border border-white/5">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !annual ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                annual ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Annual
              <span className="ml-2 text-xs opacity-80">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-8 transition-all ${
                tier.popular
                  ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-slate-900/80 scale-105 shadow-xl shadow-amber-500/10'
                  : 'border-white/5 bg-slate-900/50 hover:border-white/10'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-amber-500 text-slate-900 text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">{tier.name}</h3>
                <p className="text-sm text-slate-400">{tier.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-display font-bold text-white">${tier.price}</span>
                <span className="text-slate-400">/mo</span>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.name === 'Business' ? '/contact' : '/auth/signup'}
                className={`block w-full text-center py-3 rounded-full font-medium transition-all ${
                  tier.popular
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                    : 'border border-white/10 text-white hover:bg-white/5'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// TESTIMONIALS SECTION
// =============================================================================

function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Cluebase has completely transformed how our support team handles internal questions. What used to take 15 minutes of searching now takes seconds.",
      author: 'Sarah Chen',
      role: 'Head of Operations',
      company: 'TechStart',
      avatar: 'SC',
    },
    {
      quote: "We connected our entire knowledge base in under an hour. The bot was answering questions accurately from day one. Incredible ROI.",
      author: 'Marcus Johnson',
      role: 'VP Engineering',
      company: 'ScaleUp Inc',
      avatar: 'MJ',
    },
    {
      quote: "Finally, an AI tool that actually understands our business context. The source citations give our team confidence in every answer.",
      author: 'Emily Rodriguez',
      role: 'Director of HR',
      company: 'GrowthCo',
      avatar: 'ER',
    },
  ];

  return (
    <section id="testimonials" className="py-24 bg-gradient-to-b from-slate-900/0 via-slate-900/50 to-slate-900/0">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
            Testimonials
          </div>
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Loved by teams everywhere
          </h2>
          <p className="text-lg text-slate-400">
            See what our customers have to say
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="relative p-8 rounded-2xl border border-white/5 bg-slate-900/50 hover:border-white/10 transition-all"
            >
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="text-slate-300 mb-6 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-medium text-white">{testimonial.author}</div>
                  <div className="text-sm text-slate-400">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// CTA SECTION
// =============================================================================

function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative rounded-3xl border border-white/5 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
          </div>

          <div className="relative px-8 py-16 md:px-16 md:py-24 text-center">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Ready to unlock your team&apos;s knowledge?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Start your 14-day free trial today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="group flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 py-4 rounded-full text-lg transition-all hover:shadow-xl hover:shadow-amber-500/25"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/signin"
                className="text-white font-medium px-8 py-4 rounded-full border border-white/10 hover:bg-white/5 transition-all"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER
// =============================================================================

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Brain className="h-7 w-7 text-amber-500" />
              <span className="font-display text-lg font-bold text-white">
                Cluebase<span className="text-amber-500">AI</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 mb-6">
              AI-powered knowledge assistant for modern teams.
            </p>
            <div className="flex gap-4">
              {['X', 'LI', 'GH'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-3">
              {['Features', 'Pricing', 'Integrations', 'Security', 'Roadmap'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              {['Documentation', 'API Reference', 'Blog', 'Changelog', 'Status'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-3">
              {['About', 'Careers', 'Contact', 'Privacy Policy', 'Terms of Service'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Cluebase AI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function LandingPage() {
  return (
    <>
      <Navigation />
      <main>
        <HeroSection />
        <TrustSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
