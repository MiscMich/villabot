/**
 * Shared constants for Cluebase AI
 */

import type { SubscriptionTier } from './types/workspaces.js';
import type { BotType } from './types/bots.js';

// Re-export BotType for convenience when importing with BOT_TYPE_CONFIGS
export type { BotType } from './types/bots.js';

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
  chunkSize: 1200,      // Larger chunks for better context preservation
  chunkOverlap: 100,    // More overlap for continuity between chunks
  separators: ['\n\n', '\n', '. ', ' ', ''],
} as const;

// Embedding configuration (OpenAI text-embedding-3-small)
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 768,  // Reduced from 1536 for compatibility with existing vectors
  batchSize: 100,
} as const;

// RAG configuration (2025 best practices)
export const RAG_CONFIG = {
  topK: 15,              // Return more relevant chunks for context
  vectorWeight: 0.7,     // Prioritize semantic similarity (captures meaning)
  keywordWeight: 0.3,    // Support keyword matching (exact terms, acronyms)
  minSimilarity: 0.35,   // Increased threshold for higher precision
} as const;

// AI Model Configuration (OpenAI GPT-5-Nano)
export const MODEL_CONFIG = {
  chat: 'gpt-5-nano',
  intent: 'gpt-5-nano',
  embedding: 'text-embedding-3-small',
  maxCompletionTokens: 4000,
  intentMaxTokens: 50,   // Supports JSON output for intent classification
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

// ============================================
// BOT TYPE CONFIGURATION
// ============================================

export interface BotTypeConfig {
  label: string;
  description: string;
  systemInstructions: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  documentCategory: 'operations' | 'marketing' | 'sales' | 'hr' | 'technical' | 'shared';
}

export const BOT_TYPE_CONFIGS: Record<BotType, BotTypeConfig> = {
  operations: {
    label: 'Operations',
    description: 'Handles day-to-day operational questions, SOPs, procedures, and workflow inquiries.',
    systemInstructions: `You are an Operations Assistant for this company. Your role is to help team members with:
- Standard Operating Procedures (SOPs) and workflows
- Day-to-day operational questions and processes
- Policy clarifications and procedural guidance
- Task coordination and process optimization

Be precise and actionable in your responses. When referencing procedures, cite the specific document and section. If a process has multiple steps, present them clearly numbered. Always prioritize accuracy - if you're unsure about a specific procedure, say so and suggest who might know.`,
    icon: 'Settings',
    color: 'blue',
    documentCategory: 'operations',
  },
  marketing: {
    label: 'Marketing',
    description: 'Assists with brand guidelines, campaign information, marketing materials, and creative assets.',
    systemInstructions: `You are a Marketing Assistant for this company. Your role is to help team members with:
- Brand guidelines and messaging consistency
- Campaign information and marketing strategies
- Content guidelines and creative direction
- Marketing materials and asset locations

Maintain brand voice in your responses. When discussing campaigns or initiatives, provide context about goals and target audiences. Help team members find the right assets and ensure brand consistency. Be creative but always aligned with established brand guidelines.`,
    icon: 'Megaphone',
    color: 'pink',
    documentCategory: 'marketing',
  },
  sales: {
    label: 'Sales',
    description: 'Supports sales processes, product information, pricing, and customer-facing materials.',
    systemInstructions: `You are a Sales Assistant for this company. Your role is to help team members with:
- Product information and feature details
- Pricing structures and discount policies
- Sales processes and pipeline stages
- Customer objection handling and competitive positioning
- Contract terms and proposal templates

Be confident and clear in your responses. Help sales team members quickly find the information they need to close deals. When discussing pricing or terms, be precise about policies. Provide competitive insights when relevant but focus on our strengths.`,
    icon: 'TrendingUp',
    color: 'green',
    documentCategory: 'sales',
  },
  hr: {
    label: 'HR & People',
    description: 'Answers questions about policies, benefits, onboarding, and employee resources.',
    systemInstructions: `You are an HR & People Assistant for this company. Your role is to help team members with:
- Company policies and employee handbook questions
- Benefits information and enrollment procedures
- Onboarding processes and new hire resources
- Time off policies and leave procedures
- Performance review processes

Be warm, approachable, and confidential in your responses. Employee matters require sensitivity. When discussing policies, be clear about requirements while being supportive. Always direct employees to HR for sensitive personal matters or situations requiring human judgment.`,
    icon: 'Users',
    color: 'purple',
    documentCategory: 'hr',
  },
  technical: {
    label: 'Technical',
    description: 'Provides technical documentation, API references, development guidelines, and system information.',
    systemInstructions: `You are a Technical Assistant for this company. Your role is to help team members with:
- Technical documentation and system architecture
- API references and integration guides
- Development standards and coding guidelines
- Troubleshooting and debugging assistance
- Infrastructure and deployment procedures

Be precise and technical in your responses. Use code examples when helpful. Reference specific documentation sections. For complex issues, break down solutions step by step. If something requires elevated access or could impact production systems, make that clear.`,
    icon: 'Code',
    color: 'orange',
    documentCategory: 'technical',
  },
  general: {
    label: 'General',
    description: 'A versatile assistant that can help with any company knowledge and cross-functional questions.',
    systemInstructions: `You are a Knowledge Assistant for this company. Your role is to help team members find information across all company resources and answer general questions about:
- Company policies and procedures
- Cross-functional processes
- General company knowledge
- Finding the right resources or people

Be helpful and thorough in your responses. When questions span multiple departments, provide a comprehensive answer drawing from all relevant sources. If a question is better suited for a specialized team, point them in the right direction.`,
    icon: 'Bot',
    color: 'violet',
    documentCategory: 'shared',
  },
} as const;

// Helper to get bot type config
export function getBotTypeConfig(botType: BotType): BotTypeConfig {
  return BOT_TYPE_CONFIGS[botType] || BOT_TYPE_CONFIGS.general;
}

// Get document categories for a bot type (always includes shared)
export function getBotTypeCategories(botType: BotType): string[] {
  const config = getBotTypeConfig(botType);
  if (config.documentCategory === 'shared') {
    return ['shared'];
  }
  return ['shared', config.documentCategory];
}
