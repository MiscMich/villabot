/**
 * Shared constants for Cluebase AI
 */

import type { SubscriptionTier } from './types/workspaces.js';

// ============================================
// SUBSCRIPTION TIERS
// ============================================

export interface TierLimits {
  documents: number;
  queriesPerMonth: number;
  fileUploadMb: number;
  teamMembers: number;
  websitePages: number;
  bots: number;
  customInstructions: boolean;
  analyticsRetentionDays: number;
  apiAccess: boolean;
}

export interface TierConfig {
  name: string;
  slug: SubscriptionTier;
  price: number; // Monthly price in dollars
  stripePriceId: string | null; // Set from environment
  trialDays: number;
  limits: TierLimits;
  features: string[];
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  starter: {
    name: 'Starter',
    slug: 'starter',
    price: 29,
    stripePriceId: null, // Set from STRIPE_STARTER_PRICE_ID
    trialDays: 0,
    limits: {
      documents: 1000,
      queriesPerMonth: 500,
      fileUploadMb: 10,
      teamMembers: 3,
      websitePages: 100,
      bots: 1,
      customInstructions: false,
      analyticsRetentionDays: 30,
      apiAccess: false,
    },
    features: [
      '1,000 documents',
      '500 queries/month',
      '3 team members',
      '1 bot',
      '30-day analytics',
    ],
  },
  pro: {
    name: 'Pro',
    slug: 'pro',
    price: 79,
    stripePriceId: null, // Set from STRIPE_PRO_PRICE_ID
    trialDays: 14,
    limits: {
      documents: 10000,
      queriesPerMonth: 5000,
      fileUploadMb: 50,
      teamMembers: 10,
      websitePages: 1000,
      bots: 3,
      customInstructions: true,
      analyticsRetentionDays: 90,
      apiAccess: false,
    },
    features: [
      '10,000 documents',
      '5,000 queries/month',
      '10 team members',
      '3 bots',
      'Custom instructions',
      '90-day analytics',
      '14-day free trial',
    ],
  },
  business: {
    name: 'Business',
    slug: 'business',
    price: 199,
    stripePriceId: null, // Set from STRIPE_BUSINESS_PRICE_ID
    trialDays: 0,
    limits: {
      documents: 50000,
      queriesPerMonth: 25000,
      fileUploadMb: 200,
      teamMembers: 999999, // Unlimited
      websitePages: 5000,
      bots: 10,
      customInstructions: true,
      analyticsRetentionDays: 365,
      apiAccess: true,
    },
    features: [
      '50,000 documents',
      '25,000 queries/month',
      'Unlimited team members',
      '10 bots',
      'Custom instructions',
      'API access',
      '1-year analytics',
    ],
  },
} as const;

// Helper to get tier by price ID
export function getTierByPriceId(priceId: string): SubscriptionTier | null {
  for (const [tier, config] of Object.entries(TIER_CONFIGS)) {
    if (config.stripePriceId === priceId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
}

// Helper to check if a tier supports a feature
export function tierSupportsFeature(
  tier: SubscriptionTier,
  feature: keyof TierLimits
): boolean {
  const config = TIER_CONFIGS[tier];
  const value = config.limits[feature];
  return typeof value === 'boolean' ? value : value > 0;
}

// ============================================
// CHUNKING CONFIGURATION
// ============================================

// Chunking configuration
export const CHUNK_CONFIG = {
  chunkSize: 512,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ' ', ''],
} as const;

// Embedding configuration
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-004',
  dimensions: 768,
  batchSize: 100,
} as const;

// RAG configuration
export const RAG_CONFIG = {
  topK: 15,              // Increased from 5 to return more relevant chunks
  vectorWeight: 0.5,
  keywordWeight: 0.5,
  minSimilarity: 0.2,    // Lowered from 0.3 to include more potential matches
} as const;

// Rate limiting
export const RATE_LIMITS = {
  questionsPerUserPerMinute: 5,
  syncJobsPerHour: 12,
} as const;

// Thread configuration
export const THREAD_CONFIG = {
  maxMessagesInContext: 10,
  sessionTimeoutHours: 24,
} as const;

// Heuristics for question detection
export const QUESTION_HEURISTICS = {
  questionWords: ['what', 'how', 'when', 'where', 'why', 'who', 'which', 'can', 'does', 'is', 'are', 'do', 'should', 'would', 'could'],
  minLength: 10,
  maxLength: 500,
} as const;

// File size limits
export const FILE_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  maxPagesPerDocument: 100,
} as const;

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.google-apps.document': 'google_doc',
  'application/vnd.google-apps.spreadsheet': 'google_sheet',
  'text/plain': 'txt',
  'text/html': 'html',
} as const;
