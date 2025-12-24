/**
 * Intent detection service
 * Tiered classification to minimize API costs
 */

import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { QUESTION_HEURISTICS, MODEL_CONFIG } from '@cluebase/shared';

// Initialize OpenAI for classification
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export type IntentType =
  | 'question'      // User asking a question the bot should answer
  | 'greeting'      // Casual greeting
  | 'feedback'      // User providing feedback on a response
  | 'correction'    // User correcting the bot
  | 'ignore';       // Regular conversation, not for the bot

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  shouldRespond: boolean;
  needsMoreContext?: boolean;
}

// Keywords that strongly suggest a question
const QUESTION_KEYWORDS = new Set([
  'how', 'what', 'when', 'where', 'why', 'who', 'which',
  'can', 'could', 'would', 'should', 'does', 'do', 'is', 'are',
  'tell me', 'explain', 'help', 'show me', 'find',
]);

// Keywords related to company operations (boost these)
const DOMAIN_KEYWORDS = new Set([
  'policy', 'procedure', 'sop', 'process', 'how to', 'what is the',
  'document', 'documentation', 'guide', 'manual', 'instructions',
  'protocol', 'guidelines', 'workflow', 'steps', 'help',
]);

// Phrases that indicate feedback
const FEEDBACK_PHRASES = [
  'thank', 'thanks', 'helpful', 'not helpful', 'wrong', 'incorrect',
  'that\'s right', 'that\'s wrong', 'actually', 'no, ',
];

/**
 * Detect intent using tiered classification
 * Tier 1: Heuristics (fast, no API call)
 * Tier 2: Keyword matching (fast, no API call)
 * Tier 3: AI classification (accurate, API call)
 */
export async function detectIntent(
  message: string,
  isThreadReply: boolean = false,
  previousBotMessage: boolean = false
): Promise<IntentResult> {
  const normalizedMessage = message.toLowerCase().trim();

  // Very short messages are likely not questions
  if (normalizedMessage.length < QUESTION_HEURISTICS.minLength) {
    return { intent: 'ignore', confidence: 0.9, shouldRespond: false };
  }

  // If this is a reply in a thread where bot previously responded
  if (isThreadReply && previousBotMessage) {
    // Check for feedback/correction patterns
    if (isFeedback(normalizedMessage)) {
      return { intent: 'feedback', confidence: 0.8, shouldRespond: true };
    }
    if (isCorrection(normalizedMessage)) {
      return { intent: 'correction', confidence: 0.8, shouldRespond: true };
    }
    // Follow-up question in thread
    return { intent: 'question', confidence: 0.8, shouldRespond: true };
  }

  // If this is a thread reply but we couldn't verify previous bot message,
  // still be lenient if it looks like a question (user might be following up)
  if (isThreadReply && !previousBotMessage) {
    logger.info('Thread reply without verified bot message, checking if question-like');
    // If it ends with ? or starts with question word, treat as follow-up
    if (normalizedMessage.endsWith('?') || /^(how|what|when|where|why|who|can|could|would|should|does|do|is|are)\b/.test(normalizedMessage)) {
      logger.info('Thread reply looks like a question, responding');
      return { intent: 'question', confidence: 0.7, shouldRespond: true };
    }
    // Also respond if it contains domain keywords (likely about villa operations)
    const hasDomainKeyword = [...DOMAIN_KEYWORDS].some(kw => normalizedMessage.includes(kw));
    if (hasDomainKeyword) {
      logger.info('Thread reply contains domain keywords, responding');
      return { intent: 'question', confidence: 0.65, shouldRespond: true };
    }
  }

  // Tier 1: Quick heuristics
  const heuristicResult = applyHeuristics(normalizedMessage);
  if (heuristicResult.confidence > 0.8) {
    logger.debug('Intent detected via heuristics', { intent: heuristicResult.intent });
    return heuristicResult;
  }

  // Tier 2: Keyword matching
  const keywordResult = matchKeywords(normalizedMessage);
  if (keywordResult.confidence > 0.7) {
    logger.debug('Intent detected via keywords', { intent: keywordResult.intent });
    return keywordResult;
  }

  // Tier 3: AI classification (only for ambiguous cases)
  if (keywordResult.confidence > 0.4) {
    logger.debug('Using AI for intent classification');
    return classifyWithAI(message);
  }

  // Default to ignore for completely unrelated messages
  return { intent: 'ignore', confidence: 0.6, shouldRespond: false };
}

/**
 * Tier 1: Apply fast heuristics
 */
function applyHeuristics(message: string): IntentResult {
  // Check for question mark
  if (message.endsWith('?')) {
    // Check if it contains domain keywords
    const hasDomainKeyword = [...DOMAIN_KEYWORDS].some(kw => message.includes(kw));
    return {
      intent: 'question',
      confidence: hasDomainKeyword ? 0.9 : 0.7,
      shouldRespond: hasDomainKeyword,
    };
  }

  // Check for question word at start
  const firstWord = message.split(/\s+/)[0] ?? '';
  if (QUESTION_KEYWORDS.has(firstWord)) {
    const hasDomainKeyword = [...DOMAIN_KEYWORDS].some(kw => message.includes(kw));
    return {
      intent: 'question',
      confidence: hasDomainKeyword ? 0.85 : 0.6,
      shouldRespond: hasDomainKeyword,
    };
  }

  return { intent: 'ignore', confidence: 0.3, shouldRespond: false };
}

/**
 * Tier 2: Keyword matching
 */
function matchKeywords(message: string): IntentResult {
  // Count domain keyword matches
  const domainMatches = [...DOMAIN_KEYWORDS].filter(kw => message.includes(kw)).length;
  const questionMatches = [...QUESTION_KEYWORDS].filter(kw => message.includes(kw)).length;

  if (domainMatches >= 2 || (domainMatches >= 1 && questionMatches >= 1)) {
    return {
      intent: 'question',
      confidence: Math.min(0.5 + domainMatches * 0.15, 0.85),
      shouldRespond: true,
    };
  }

  if (questionMatches >= 2) {
    return {
      intent: 'question',
      confidence: 0.5,
      shouldRespond: false,
      needsMoreContext: true,
    };
  }

  return { intent: 'ignore', confidence: 0.4, shouldRespond: false };
}

/**
 * Tier 3: AI classification for ambiguous cases
 * Uses JSON output for structured response with confidence scoring
 */
async function classifyWithAI(message: string): Promise<IntentResult> {
  try {
    const result = await openai.chat.completions.create({
      model: MODEL_CONFIG.intent,
      messages: [
        {
          role: 'system',
          content: `Classify workplace Slack messages. Output JSON only:
{"intent": "question|greeting|ignore", "confidence": 0.0-1.0}

Intent definitions:
- question: User asking about company procedures, policies, documentation, or operations
- greeting: Casual greeting, thanks, or social chat
- ignore: Team conversation not directed at a knowledge bot

Confidence guidelines:
- 0.9-1.0: Very clear intent
- 0.7-0.9: Likely this intent
- 0.5-0.7: Uncertain, best guess`,
        },
        {
          role: 'user',
          content: `Classify: "${message}"`,
        },
      ],
      max_completion_tokens: MODEL_CONFIG.intentMaxTokens,
    });

    const responseText = result.choices[0]?.message?.content?.trim() ?? '';

    // Parse JSON response
    let intent: IntentType = 'ignore';
    let confidence = 0.5;

    try {
      const parsed = JSON.parse(responseText);
      const intentMap: Record<string, IntentType> = {
        'question': 'question',
        'greeting': 'greeting',
        'ignore': 'ignore',
      };
      intent = intentMap[parsed.intent?.toLowerCase()] ?? 'ignore';
      confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7;
    } catch {
      // Fallback: try to parse as single word (backwards compatibility)
      const word = responseText.toUpperCase();
      if (word.includes('QUESTION')) {
        intent = 'question';
        confidence = 0.7;
      } else if (word.includes('GREETING')) {
        intent = 'greeting';
        confidence = 0.7;
      }
      logger.debug('AI classification returned non-JSON, using fallback parsing', { responseText });
    }

    return {
      intent,
      confidence,
      shouldRespond: intent === 'question',
    };
  } catch (error) {
    logger.error('AI classification failed', { error });
    // Fallback to ignore on error
    return { intent: 'ignore', confidence: 0.5, shouldRespond: false };
  }
}

/**
 * Check if message is feedback
 */
function isFeedback(message: string): boolean {
  return FEEDBACK_PHRASES.some(phrase => message.includes(phrase));
}

/**
 * Check if message is a correction
 */
function isCorrection(message: string): boolean {
  const correctionPatterns = [
    /^no[,.]?\s/i,
    /^actually[,.]?\s/i,
    /that'?s (?:not |in)?correct/i,
    /that'?s wrong/i,
    /^wrong/i,
  ];
  return correctionPatterns.some(pattern => pattern.test(message));
}
