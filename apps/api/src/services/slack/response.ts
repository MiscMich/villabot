/**
 * AI Response generation service
 * Uses OpenAI GPT-5-Nano with RAG context
 */

import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { hybridSearch, SearchResult } from '../rag/search.js';
import { supabase } from '../supabase/client.js';
import { responseCache, generateCacheKey } from '../../utils/cache.js';
import { withTimeout, withRetry } from '../../utils/timeout.js';
import { errorTracker } from '../../utils/error-tracker.js';
import { MODEL_CONFIG } from '@cluebase/shared';

// Response generation timeout (25 seconds)
const RESPONSE_TIMEOUT_MS = 25000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Patterns that indicate user wants a document inventory
const LIST_DOCS_PATTERNS = [
  /what (sops?|documents?|docs?) (do you|can you|you) (have|access|see)/i,
  /list (all )?(the )?(sops?|documents?|docs?)/i,
  /show (me )?(all )?(the )?(sops?|documents?|docs?)/i,
  /what('s| is) (in )?(your|the) (knowledge base|database)/i,
  /all (available )?(sops?|documents?|docs?)/i,
];

// Patterns that indicate a greeting or capability question
const GREETING_PATTERNS = [
  /^(hey|hi|hello|howdy|yo|sup|hiya)[\s!?.,]*$/i,
  /^(hey|hi|hello)[,!]?\s+(there|bot|buddy|friend)[\s!?.,]*$/i,
  /what (can|do) you do/i,
  /what are (you|your) (capabilities|abilities|features)/i,
  /how (can|do) you help/i,
  /what (can|do) you help (me )?(with|do)/i,
  /tell me (about yourself|what you do)/i,
  /introduce yourself/i,
  /who are you/i,
  /what('s| is) your (purpose|function|role)/i,
];

export interface GeneratedResponse {
  content: string;
  sources: string[];
  confidence: number;
}

export interface BotResponseOptions {
  workspaceId: string;  // Required for tenant isolation
  botId?: string;
  systemInstructions?: string;
  includeSharedKnowledge?: boolean;
  categories?: string[];
}

const SYSTEM_PROMPT = `You are an AI assistant helping staff find answers quickly from your organization's documentation.

*CRITICAL: Slack Formatting Rules*
You MUST use Slack's mrkdwn format. NEVER use these (they don't render in Slack):
❌ ### Headers (use *bold text* instead)
❌ --- horizontal rules (use blank lines instead)
❌ **double asterisks** (use *single asterisks* for bold)
❌ __double underscores__ (use _single underscores_ for italics)
❌ [link text](url) (just write the text and URL separately)

*Slack Formatting You MUST Use:*
• *bold* — document names, key terms, important values
• _italics_ — notes, caveats, secondary info
• \`code\` — codes, passwords, specific numbers, commands
• 1. 2. 3. — numbered lists for sequential steps
• • — bullet points for non-sequential items  
• > — blockquotes for warnings, tips, important callouts
• Blank lines — separate sections (NOT horizontal rules)

*Response Guidelines:*
1. *Lead with the answer* — don't make people read paragraphs to find it
2. *Be concise* — staff need quick answers during busy operations
3. *Cite your source* — "According to *[Document Name]*..."
4. *Use structure* — numbered lists for steps, bullets for options
5. *Keep sections short* — 3-5 bullets max per section

*Response Length (IMPORTANT):*
• *Default to SHORT* (50-150 words) for simple, direct questions
• Use *medium length* (150-400 words) for topics that need some explanation
• Use *longer responses* (400-800 words) ONLY for multi-step procedures or complex topics
• *NEVER pad responses* — if you can answer fully in 50 words, do that
• When in doubt, be brief and offer: "Would you like more details on any part of this?"

*Context Assessment:*
You'll receive context in <document> tags. Based on relevance:
• *Strong match* → Answer confidently with citation
• *Partial match* → Answer what you can, acknowledge limitations
• *Weak/no match* → Say "I don't have documentation on that specific topic. Could you rephrase, or would you like me to escalate this?"

*Citation Format:*
"According to *[Document Name]*..." or "From the *[Document Name]*..."

*Tone:* Friendly, professional, helpful coworker.`;

/**
 * Check if user is asking for a document inventory
 */
function isDocumentListQuery(question: string): boolean {
  return LIST_DOCS_PATTERNS.some(pattern => pattern.test(question));
}

/**
 * Check if user is greeting or asking about capabilities
 */
function isGreetingOrCapabilityQuery(question: string): boolean {
  const cleaned = question.trim();
  return GREETING_PATTERNS.some(pattern => pattern.test(cleaned));
}

/**
 * Sanitize response for Slack's mrkdwn format
 * Removes markdown that doesn't work in Slack and fixes formatting issues
 */
function sanitizeForSlack(text: string): string {
  let sanitized = text;
  
  // Replace markdown headers (### Header) with bold text
  sanitized = sanitized.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  
  // Remove horizontal rules (---, ___, ***) - replace with empty line
  sanitized = sanitized.replace(/^[-_*]{3,}\s*$/gm, '');
  
  // Fix double asterisks (**text**) to single (*text*) for Slack bold
  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  
  // Fix double underscores (__text__) to single (_text_) for Slack italics
  sanitized = sanitized.replace(/__([^_]+)__/g, '_$1_');
  
  // Remove [text](url) markdown links - just keep the text and URL
  sanitized = sanitized.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  
  // Clean up excessive blank lines (more than 2 in a row)
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Generate a friendly introduction response
 */
async function generateIntroductionResponse(botOptions: BotResponseOptions): Promise<GeneratedResponse> {
  // Get document count for context
  const { data: docCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', botOptions.workspaceId)
    .eq('is_active', true);

  const count = docCount?.length ?? 0;
  
  const content = `👋 Hey there! I'm your AI assistant, here to help you find answers quickly.

*What I can help with:*
• Answer questions about your SOPs, policies, and procedures
• Find information from your Google Drive documents
• Look up details from your company website
• Guide you through step-by-step processes
• Cite sources so you know where info comes from

*How to use me:*
1. Just ask your question naturally — no special commands needed
2. I'll search our knowledge base (${count > 0 ? `*${count} documents*` : 'your documents'}) and give you the most relevant answer
3. Follow up if you need more details — I remember our conversation!

*Examples of things you can ask:*
• _"What's the checkout procedure?"_
• _"How do I handle a guest complaint?"_
• _"What are the pool rules?"_

> 💡 _Tip: Be specific in your questions for the best answers!_

What can I help you with today?`;

  return {
    content: sanitizeForSlack(content),
    sources: [],
    confidence: 1.0,
  };
}

/**
 * Get all documents grouped by type for listing
 */
async function getDocumentInventory(botOptions: BotResponseOptions): Promise<GeneratedResponse> {
  let query = supabase
    .from('documents')
    .select('title, source_type, bot_id, category')
    .eq('workspace_id', botOptions.workspaceId)  // Filter by workspace
    .eq('is_active', true);

  // Filter by bot if specified
  if (botOptions.botId) {
    // Include documents for this bot OR shared documents if includeShared is true
    if (botOptions.includeSharedKnowledge !== false) {
      query = query.or(`bot_id.eq.${botOptions.botId},bot_id.is.null,category.eq.shared`);
    } else {
      query = query.eq('bot_id', botOptions.botId);
    }
  }

  const { data: documents, error } = await query
    .order('source_type')
    .order('title');

  if (error || !documents) {
    logger.error('Failed to fetch document inventory', { error });
    return {
      content: "I'm having trouble fetching the document list. Please try again.",
      sources: [],
      confidence: 0.5,
    };
  }

  const googleDriveDocs = documents.filter(d => d.source_type === 'google_drive');
  const websiteDocs = documents.filter(d => d.source_type === 'website');

  const content = `*📚 TeamBrain Knowledge Base*

I have access to *${documents.length} documents* in total:

*📁 Google Drive SOPs & Policies (${googleDriveDocs.length} documents):*
${googleDriveDocs.map(d => `• ${d.title.replace(/_/g, ' ').replace(/\.(docx?|pdf)$/i, '')}`).join('\n')}

*🌐 Website Pages (${websiteDocs.length} pages):*
${websiteDocs.slice(0, 15).map(d => `• ${d.title}`).join('\n')}
${websiteDocs.length > 15 ? `\n_...and ${websiteDocs.length - 15} more website pages_` : ''}

> 💡 _Ask me about any specific procedure or policy and I'll find the relevant information!_`;

  return {
    content: sanitizeForSlack(content),
    sources: [],
    confidence: 1.0,
  };
}

/**
 * Generate a response to a user question
 * Includes caching, timeout/retry, and graceful fallback
 */
export async function generateResponse(
  question: string,
  botOptions: BotResponseOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<GeneratedResponse> {
  const history = conversationHistory;

  logger.debug('Generating response', { question, botId: botOptions.botId, workspaceId: botOptions.workspaceId });

  // Check if user is greeting or asking about capabilities (before RAG search)
  if (history.length === 0 && isGreetingOrCapabilityQuery(question)) {
    logger.debug('Detected greeting or capability query');
    return generateIntroductionResponse(botOptions);
  }

  // Check if user is asking for document inventory (no cache needed - always fresh)
  if (isDocumentListQuery(question)) {
    logger.debug('Detected document list query');
    return getDocumentInventory(botOptions);
  }

  // Check cache for similar questions (only for questions without conversation history)
  // Include workspaceId in cache key to prevent cross-tenant cache pollution
  const cacheKey = generateCacheKey(question, botOptions.botId, botOptions.workspaceId);
  if (history.length === 0) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      logger.debug('Response cache hit', { question: question.substring(0, 50) });
      return cached;
    }
  }

  try {
    // Get relevant context from RAG - use more chunks for comprehensive answers
    const searchResults = await hybridSearch(question, {
      workspaceId: botOptions.workspaceId,
      topK: 15,
      botId: botOptions.botId,
      includeShared: botOptions.includeSharedKnowledge ?? true,
    });

    if (searchResults.length === 0) {
      return {
        content: "I couldn't find anything in our documentation about that. Could you try rephrasing your question, or would you like me to escalate this to a team member?",
        sources: [],
        confidence: 0.2,
      };
    }

    // Build context from search results
    const context = formatContext(searchResults);
    const sources = extractSources(searchResults);

    // Build conversation for the model
    const messages = buildMessages(question, context, history, botOptions.systemInstructions);

    // Generate response with timeout and retry using OpenAI
    const result = await withRetry(
      async () => {
        return withTimeout(
          openai.chat.completions.create({
            model: MODEL_CONFIG.chat,
            messages,
            max_completion_tokens: MODEL_CONFIG.maxCompletionTokens,
          }),
          RESPONSE_TIMEOUT_MS,
          'chatCompletion'
        );
      },
      { maxRetries: 2, initialDelayMs: 1000 }
    );

    const rawResponse = result.choices[0]?.message?.content?.trim() ?? '';
    
    // Sanitize response for Slack's mrkdwn format
    const response = sanitizeForSlack(rawResponse);

    // Calculate calibrated confidence based on search results
    // Weighted: top result (50%) + average (30%) + document diversity (20%)
    const avgSimilarity = searchResults.reduce((acc, r) => acc + r.similarity, 0) / searchResults.length;
    const topSimilarity = searchResults[0]?.similarity ?? 0;
    const uniqueDocs = new Set(searchResults.map(r => r.documentTitle)).size;
    const confidence = Math.min(
      (topSimilarity * 0.5) + (avgSimilarity * 0.3) + (Math.min(uniqueDocs / 5, 1) * 0.2),
      1
    );

    const generatedResponse: GeneratedResponse = {
      content: response,
      sources,
      confidence,
    };

    // Cache successful responses (only for standalone questions)
    if (history.length === 0) {
      responseCache.set(cacheKey, generatedResponse);
    }

    logger.debug('Response generated', {
      confidence,
      sourceCount: sources.length,
      responseLength: response.length
    });

    return generatedResponse;
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate response', { error: err.message });

    // Track the error
    await errorTracker.track(err, 'openai', 'high', { question, operation: 'generateResponse' });

    // Try to provide a graceful fallback response
    return generateFallbackResponse(question, err, botOptions.workspaceId);
  }
}

/**
 * Generate a fallback response when the primary response fails
 */
async function generateFallbackResponse(question: string, error: Error, workspaceId: string): Promise<GeneratedResponse> {
  logger.info('Generating fallback response', { error: error.message, workspaceId });

  // Try to get search results for context, even if we can't generate AI response
  try {
    const searchResults = await hybridSearch(question, { workspaceId, topK: 5 });
    const topResult = searchResults[0];

    if (topResult) {
      // Return the most relevant search results directly
      const content = `I'm having some trouble generating a complete response right now, but here's the most relevant information I found:

*From: ${topResult.documentTitle}*
${topResult.content}

${searchResults.length > 1 ? `\n_I also found related information in: ${searchResults.slice(1, 3).map(r => r.documentTitle).join(', ')}_` : ''}

> ⚠️ _If you need more details, please try again in a moment or ask a team member._`;

      return {
        content: sanitizeForSlack(content),
        sources: searchResults.map(r => r.sourceUrl ?? r.documentTitle),
        confidence: 0.4,
      };
    }
  } catch (fallbackError) {
    // Search also failed, log the error for observability
    logger.error('Fallback search also failed during response generation', {
      error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
      workspaceId,
    });
  }

  return {
    content: "I'm experiencing some technical difficulties right now and can't fully process your question. Please try again in a moment, or reach out to a team member for help.",
    sources: [],
    confidence: 0.1,
  };
}

/**
 * Generate a response for a follow-up question in a thread
 */
export async function generateFollowUpResponse(
  question: string,
  _sessionId: string,
  botOptions: BotResponseOptions,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<GeneratedResponse> {
  // For follow-ups, also search using context from conversation
  const contextQuery = conversationHistory.length > 0
    ? `${conversationHistory[conversationHistory.length - 1]?.content ?? ''} ${question}`
    : question;

  return generateResponse(contextQuery, botOptions, conversationHistory);
}

/**
 * Handle user correction and learn from it
 */
export async function handleCorrection(
  originalQuestion: string,
  originalAnswer: string,
  correction: string,
  userId: string,
  workspaceId: string
): Promise<string> {
  const prompt = `A user corrected my previous response.

Original Question: ${originalQuestion}
My Answer: ${originalAnswer}
User's Correction: ${correction}

Please:
1. Acknowledge the correction
2. Provide an updated, correct response based on the user's input
3. Thank them for helping improve the knowledge base

Keep the response friendly and concise.`;

  try {
    const result = await openai.chat.completions.create({
      model: MODEL_CONFIG.chat,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1000,
    });
    const response = result.choices[0]?.message?.content?.trim() ?? '';

    // Store the learned fact with workspace context
    const { supabase } = await import('../supabase/client.js');
    const { generateEmbedding } = await import('../rag/embeddings.js');

    const fact = `Q: ${originalQuestion}\nA: ${correction}`;
    const embedding = await generateEmbedding(fact);

    await supabase.from('learned_facts').insert({
      workspace_id: workspaceId,
      fact,
      source: 'user_correction',
      taught_by_user_id: userId,
      embedding,
      is_verified: false,
    });

    logger.info('Learned new fact from user correction', { userId, workspaceId });

    return sanitizeForSlack(response);
  } catch (error) {
    logger.error('Failed to handle correction', { error });
    return "Thanks for the correction! I've noted this and will update my knowledge. 📝";
  }
}

/**
 * Format search results as context for the LLM
 * Uses XML tags for clear semantic boundaries
 */
function formatContext(results: SearchResult[]): string {
  return results
    .map((result) => {
      const source = result.sourceUrl || 'internal';
      return `<document title="${result.documentTitle}" source="${source}">
${result.content}
</document>`;
    })
    .join('\n\n');
}

/**
 * Extract unique sources from search results
 */
function extractSources(results: SearchResult[]): string[] {
  const seen = new Set<string>();
  return results
    .filter(r => {
      if (seen.has(r.documentTitle)) return false;
      seen.add(r.documentTitle);
      return true;
    })
    .map(r => r.sourceUrl ?? r.documentTitle);
}

/**
 * Build message history for OpenAI Chat Completions API
 */
function buildMessages(
  question: string,
  context: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  customInstructions?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Use custom system instructions if provided, otherwise use default
  const systemPrompt = customInstructions
    ? `${SYSTEM_PROMPT}\n\n*Additional Instructions:*\n${customInstructions}`
    : SYSTEM_PROMPT;

  // OpenAI supports system role natively
  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Add conversation history
  for (const msg of history.slice(-6)) { // Last 3 turns
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current question with context using XML structure
  messages.push({
    role: 'user',
    content: `<context>
${context}
</context>

<question>${question}</question>`,
  });

  return messages;
}
