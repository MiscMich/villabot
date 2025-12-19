/**
 * AI Response generation service
 * Uses Gemini with RAG context
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { hybridSearch, SearchResult } from '../rag/search.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface GeneratedResponse {
  content: string;
  sources: string[];
  confidence: number;
}

const SYSTEM_PROMPT = `You are VillaBot, a helpful AI assistant for the Villa Paraiso Vacation Rentals team. Your job is to answer questions about company procedures, policies, and operations based on the provided context.

Guidelines:
- Be friendly, professional, and concise
- Only answer based on the provided context. If the context doesn't contain relevant information, say "I don't have information about that in our documentation. Let me know if you'd like me to escalate this to a team member."
- When referencing procedures, mention the source document
- Use bullet points or numbered lists for multi-step procedures
- If you're unsure, express appropriate uncertainty
- Keep responses focused and avoid unnecessary repetition`;

/**
 * Generate a response to a user question
 */
export async function generateResponse(
  question: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<GeneratedResponse> {
  logger.debug('Generating response', { question });

  try {
    // Get relevant context from RAG
    const searchResults = await hybridSearch(question, { topK: 5 });

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
    const messages = buildMessages(question, context, conversationHistory);

    // Generate response
    const result = await model.generateContent({
      contents: messages,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    const response = result.response.text().trim();

    // Calculate confidence based on search results
    const avgSimilarity = searchResults.reduce((acc, r) => acc + r.similarity, 0) / searchResults.length;
    const confidence = Math.min(avgSimilarity + 0.2, 1);

    logger.debug('Response generated', {
      confidence,
      sourceCount: sources.length,
      responseLength: response.length
    });

    return {
      content: response,
      sources,
      confidence,
    };
  } catch (error) {
    logger.error('Failed to generate response', { error });
    throw error;
  }
}

/**
 * Generate a response for a follow-up question in a thread
 */
export async function generateFollowUpResponse(
  question: string,
  sessionId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<GeneratedResponse> {
  // For follow-ups, also search using context from conversation
  const contextQuery = conversationHistory.length > 0
    ? `${conversationHistory[conversationHistory.length - 1]?.content ?? ''} ${question}`
    : question;

  return generateResponse(contextQuery, conversationHistory);
}

/**
 * Handle user correction and learn from it
 */
export async function handleCorrection(
  originalQuestion: string,
  originalAnswer: string,
  correction: string,
  userId: string
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

    // Store the learned fact
    const { supabase } = await import('../supabase/client.js');
    const { generateEmbedding } = await import('../rag/embeddings.js');

    const fact = `Q: ${originalQuestion}\nA: ${correction}`;
    const embedding = await generateEmbedding(fact);

    await supabase.from('learned_facts').insert({
      fact,
      source: 'user_correction',
      taught_by_user_id: userId,
      embedding,
      is_verified: false,
    });

    logger.info('Learned new fact from user correction', { userId });

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
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const messages: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // System prompt as first user message (Gemini doesn't have system role)
  messages.push({
    role: 'user',
    parts: [{ text: SYSTEM_PROMPT }],
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
