/**
 * AI Response generation service
 * Uses Gemini with RAG context
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { hybridSearch, SearchResult } from '../rag/search.js';
import { supabase } from '../supabase/client.js';
import { responseCache, generateCacheKey } from '../../utils/cache.js';
import { withTimeout, withRetry } from '../../utils/timeout.js';
import { errorTracker } from '../../utils/error-tracker.js';

// Response generation timeout (25 seconds)
const RESPONSE_TIMEOUT_MS = 25000;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Patterns that indicate user wants a document inventory
const LIST_DOCS_PATTERNS = [
  /what (sops?|documents?|docs?) (do you|can you|you) (have|access|see)/i,
  /list (all )?(the )?(sops?|documents?|docs?)/i,
  /show (me )?(all )?(the )?(sops?|documents?|docs?)/i,
  /what('s| is) (in )?(your|the) (knowledge base|database)/i,
  /all (available )?(sops?|documents?|docs?)/i,
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

const SYSTEM_PROMPT = `You are TeamBrain, the AI assistant for your organization's operations team. You help staff quickly find answers about SOPs, policies, procedures, and documentation.

*Your Knowledge Base:*
• Google Drive documents covering: procedures, protocols, policies, guidelines, troubleshooting guides
• Website pages with: company information, FAQs, and resources

*Response Style:*
1. Be CONCISE - staff need quick answers during busy operations
2. Lead with the answer, then provide details if needed
3. Always cite your source: "According to *[Document Name]*..."
4. For multi-step procedures, use numbered lists
5. Highlight critical info with > blockquotes

*Slack Formatting (ALWAYS use):*
• *bold* for document names, key terms, important values
• _italics_ for notes, caveats, or secondary info
• \`code\` for codes, passwords, specific numbers
• Numbered lists (1. 2. 3.) for sequential steps
• Bullet points (•) for non-sequential items
• > for warnings, important callouts, or tips
• Line breaks between sections for readability

*How to Answer:*
- If context contains the answer → Give a direct, helpful response with source citation
- If context is partially relevant → Answer what you can, acknowledge gaps
- If context doesn't help → Say: "I don't have that in my documentation. You might want to check with the relevant team or I can escalate this."
- For follow-up questions → Reference the previous context and build on it

*Tone:* Friendly, professional, like a knowledgeable coworker who wants to help you succeed.`;

/**
 * Check if user is asking for a document inventory
 */
function isDocumentListQuery(question: string): boolean {
  return LIST_DOCS_PATTERNS.some(pattern => pattern.test(question));
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
    content,
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
        content: "I don't have any information about that in our documentation. Could you rephrase your question, or would you like me to escalate this to a team member?",
        sources: [],
        confidence: 0.2,
      };
    }

    // Build context from search results
    const context = formatContext(searchResults);
    const sources = extractSources(searchResults);

    // Build conversation for the model
    const messages = buildMessages(question, context, history, botOptions.systemInstructions);

    // Generate response with timeout and retry
    const result = await withRetry(
      async () => {
        return withTimeout(
          model.generateContent({
            contents: messages,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4000,
            },
          }),
          RESPONSE_TIMEOUT_MS,
          'generateContent'
        );
      },
      { maxRetries: 2, initialDelayMs: 1000 }
    );

    const response = result.response.text().trim();

    // Calculate confidence based on search results
    const avgSimilarity = searchResults.reduce((acc, r) => acc + r.similarity, 0) / searchResults.length;
    const confidence = Math.min(avgSimilarity + 0.2, 1);

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
    await errorTracker.track(err, 'gemini', 'high', { question, operation: 'generateResponse' });

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
        content,
        sources: searchResults.map(r => r.sourceUrl ?? r.documentTitle),
        confidence: 0.4,
      };
    }
  } catch {
    // Search also failed, provide generic fallback
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
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

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

    return response;
  } catch (error) {
    logger.error('Failed to handle correction', { error });
    return "Thanks for the correction! I've noted this and will update my knowledge. 📝";
  }
}

/**
 * Format search results as context for the LLM
 */
function formatContext(results: SearchResult[]): string {
  return results
    .map((result, index) => {
      return `[Document ${index + 1}: ${result.documentTitle}]
${result.content}`;
    })
    .join('\n\n---\n\n');
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
 * Build message history for the model
 */
function buildMessages(
  question: string,
  context: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  customInstructions?: string
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Use custom system instructions if provided, otherwise use default
  const systemPrompt = customInstructions
    ? `${SYSTEM_PROMPT}\n\n*Additional Instructions:*\n${customInstructions}`
    : SYSTEM_PROMPT;

  // System prompt as first user message (Gemini doesn't have system role)
  messages.push({
    role: 'user',
    parts: [{ text: systemPrompt }],
  });
  messages.push({
    role: 'model',
    parts: [{ text: 'Understood. I will answer questions based on the provided context and follow the guidelines.' }],
  });

  // Add conversation history
  for (const msg of history.slice(-6)) { // Last 3 turns
    messages.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // Add current question with context
  messages.push({
    role: 'user',
    parts: [{
      text: `Context from company documentation:\n${context}\n\nUser Question: ${question}`
    }],
  });

  return messages;
}
