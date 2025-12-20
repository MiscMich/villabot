/**
 * Slack Bot - Main message handler
 * Uses Bolt SDK with Socket Mode
 */

import pkg from '@slack/bolt';
const { App, LogLevel } = pkg;
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { detectIntent } from './intent.js';
import {
  getOrCreateSession,
  addMessage,
  getConversationContext,
  hasBotRespondedInThread,
  recordFeedback,
} from './threads.js';
import {
  generateResponse,
  generateFollowUpResponse,
  handleCorrection,
} from './response.js';
import { supabase } from '../supabase/client.js';
import { messageRateLimiter } from '../../utils/rate-limiter.js';
import { errorTracker } from '../../utils/error-tracker.js';
import { withTimeout, TimeoutError } from '../../utils/timeout.js';

// Response timeout in milliseconds
const RESPONSE_TIMEOUT_MS = 30000;

let slackApp: InstanceType<typeof App> | null = null;
let botUserId: string | null = null;

/**
 * Initialize the Slack bot
 */
export async function initializeSlackBot(): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_APP_TOKEN) {
    logger.warn('Slack credentials not configured, bot disabled');
    return;
  }

  slackApp = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // Get bot user ID
  const authResult = await slackApp.client.auth.test();
  botUserId = authResult.user_id ?? null;
  logger.info(`Slack bot initialized as ${authResult.user}`);

  // Register event handlers
  registerMentionHandler();
  registerMessageHandler();
  registerReactionHandlers();

  // Initialize error tracker
  await errorTracker.initialize();

  // Start the bot
  await slackApp.start();
  logger.info('Slack bot connected via Socket Mode');
}

/**
 * Register app mention handler - responds when @mentioned
 */
function registerMentionHandler(): void {
  if (!slackApp) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slackApp.event('app_mention', async ({ event, say }: { event: any; say: any }) => {
    const messageText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim(); // Remove mention
    const channelId = event.channel;
    const userId = event.user;
    const threadTs = event.thread_ts ?? event.ts;

    logger.info('Bot mentioned', { user: userId, channel: channelId, text: messageText });

    // Check rate limit
    const rateCheck = messageRateLimiter.check(userId);
    if (!rateCheck.allowed) {
      await errorTracker.trackRateLimit(userId, rateCheck.resetIn);
      await say({
        text: `⏳ You're asking questions too quickly. Please wait ${Math.ceil(rateCheck.resetIn / 1000)} seconds before asking again.`,
        thread_ts: threadTs,
      });
      return;
    }

    try {
      // Log analytics
      await supabase.from('analytics').insert({
        event_type: 'mention_received',
        event_data: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      // Get or create session
      const sessionId = await getOrCreateSession(channelId, threadTs, userId);

      // Add user message to session
      await addMessage(sessionId, userId, 'user', messageText);

      // Generate response with timeout
      const response = await withTimeout(
        generateResponse(messageText),
        RESPONSE_TIMEOUT_MS,
        'generateResponse'
      );

      // Add bot response to session
      const messageId = await addMessage(
        sessionId,
        botUserId!,
        'assistant',
        response.content,
        response.sources,
        response.confidence
      );

      // Send response in thread
      await say({
        text: response.content,
        thread_ts: threadTs,
        unfurl_links: false,
        blocks: buildResponseBlocks(response.content, response.sources, response.confidence),
      });

      // Log response analytics
      await supabase.from('analytics').insert({
        event_type: 'response_sent',
        event_data: {
          session_id: sessionId,
          message_id: messageId,
          confidence: response.confidence,
          source_count: response.sources.length,
          triggered_by: 'mention',
        },
      });

    } catch (error) {
      const err = error as Error;

      // Track error based on type
      if (err instanceof TimeoutError) {
        await errorTracker.trackTimeout('generateResponse', RESPONSE_TIMEOUT_MS, { userId, messageText });
        await say({
          text: "⏱️ My response is taking too long. Please try again or simplify your question.",
          thread_ts: threadTs,
        });
      } else {
        await errorTracker.track(err, 'slack', 'high', { userId, messageText, handler: 'mention' });
        await say({
          text: "I'm having trouble processing your request right now. Please try again in a moment.",
          thread_ts: threadTs,
        });
      }
    }
  });
}

/**
 * Register message event handler
 */
function registerMessageHandler(): void {
  if (!slackApp) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slackApp.message(async ({ message, say, client: _client }: { message: any; say: any; client: any }) => {
    // Type guard for regular messages
    if (message.subtype || !('text' in message) || !message.text) {
      return;
    }

    // Ignore bot's own messages
    if (message.user === botUserId) {
      return;
    }

    // Skip messages that mention the bot - these are handled by app_mention handler
    if (botUserId && message.text.includes(`<@${botUserId}>`)) {
      logger.info('Skipping message with bot mention (handled by app_mention)');
      return;
    }

    const messageText = message.text;
    const channelId = message.channel;
    const userId = message.user;
    const threadTs = message.thread_ts ?? message.ts;
    const isThreadReply = !!message.thread_ts;

    logger.info('Message received', {
      isThreadReply,
      threadTs,
      messageTs: message.ts,
      textPreview: messageText.substring(0, 50),
    });

    try {
      // Check if we've responded in this thread before
      const previousBotMessage = isThreadReply
        ? await hasBotRespondedInThread(threadTs)
        : false;

      logger.info('Thread check result', {
        isThreadReply,
        previousBotMessage,
        threadTs,
      });

      // Detect intent
      const intent = await detectIntent(messageText, isThreadReply, previousBotMessage);

      logger.info('Intent detected', {
        intent: intent.intent,
        confidence: intent.confidence,
        shouldRespond: intent.shouldRespond,
        isThreadReply,
        previousBotMessage,
      });

      if (!intent.shouldRespond) {
        logger.info('Not responding - intent check failed', { intent: intent.intent, confidence: intent.confidence });
        return;
      }

      // Check rate limit
      const rateCheck = messageRateLimiter.check(userId);
      if (!rateCheck.allowed) {
        await errorTracker.trackRateLimit(userId, rateCheck.resetIn);
        await say({
          text: `⏳ You're asking questions too quickly. Please wait ${Math.ceil(rateCheck.resetIn / 1000)} seconds before asking again.`,
          thread_ts: threadTs,
        });
        return;
      }

      // Log analytics
      await supabase.from('analytics').insert({
        event_type: 'message_received',
        event_data: {
          channel_id: channelId,
          intent: intent.intent,
          confidence: intent.confidence,
          is_thread: isThreadReply,
        },
      });

      // Get or create session
      const sessionId = await getOrCreateSession(channelId, threadTs, userId);

      // Add user message to session
      await addMessage(sessionId, userId, 'user', messageText);

      // Generate response based on intent with timeout
      let response;

      if (intent.intent === 'correction') {
        // Get previous messages for context
        const context = await getConversationContext(threadTs);
        const previousMessages = context?.messages ?? [];

        // Find the last bot message and user question
        const lastBotMsg = [...previousMessages].reverse().find(m => m.role === 'assistant');
        const lastUserQuestion = [...previousMessages].reverse().find(m => m.role === 'user');

        if (lastBotMsg && lastUserQuestion) {
          const correctionResponse = await withTimeout(
            handleCorrection(lastUserQuestion.content, lastBotMsg.content, messageText, userId),
            RESPONSE_TIMEOUT_MS,
            'handleCorrection'
          );
          response = { content: correctionResponse, sources: [], confidence: 0.9 };
        } else {
          response = await withTimeout(
            generateResponse(messageText),
            RESPONSE_TIMEOUT_MS,
            'generateResponse'
          );
        }
      } else if (isThreadReply && previousBotMessage) {
        // Follow-up question in existing conversation
        const context = await getConversationContext(threadTs);
        response = await withTimeout(
          generateFollowUpResponse(messageText, sessionId, context?.messages ?? []),
          RESPONSE_TIMEOUT_MS,
          'generateFollowUpResponse'
        );
      } else {
        // New question
        response = await withTimeout(
          generateResponse(messageText),
          RESPONSE_TIMEOUT_MS,
          'generateResponse'
        );
      }

      // Add bot response to session
      const messageId = await addMessage(
        sessionId,
        botUserId!,
        'assistant',
        response.content,
        response.sources,
        response.confidence
      );

      // Send response in thread
      await say({
        text: response.content,
        thread_ts: threadTs,
        unfurl_links: false,
        blocks: buildResponseBlocks(response.content, response.sources, response.confidence),
      });

      // Log response analytics
      await supabase.from('analytics').insert({
        event_type: 'response_sent',
        event_data: {
          session_id: sessionId,
          message_id: messageId,
          confidence: response.confidence,
          source_count: response.sources.length,
        },
      });

    } catch (error) {
      const err = error as Error;

      // Track error based on type
      if (err instanceof TimeoutError) {
        await errorTracker.trackTimeout('messageHandler', RESPONSE_TIMEOUT_MS, { userId, messageText });
        await say({
          text: "⏱️ My response is taking too long. Please try again or simplify your question.",
          thread_ts: threadTs,
        });
      } else {
        await errorTracker.track(err, 'slack', 'high', { userId, messageText, handler: 'message' });
        await say({
          text: "I'm having trouble processing your request right now. Please try again in a moment.",
          thread_ts: threadTs,
        });
      }
    }
  });
}

/**
 * Register reaction handlers for feedback
 */
function registerReactionHandlers(): void {
  if (!slackApp) return;

  // Thumbs up = positive feedback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slackApp.event('reaction_added', async ({ event }: { event: any }) => {
    if (event.reaction === '+1' || event.reaction === 'thumbsup') {
      await handleFeedbackReaction(event.item.ts, 1);
    } else if (event.reaction === '-1' || event.reaction === 'thumbsdown') {
      await handleFeedbackReaction(event.item.ts, -1);
    }
  });
}

/**
 * Handle feedback reaction
 */
async function handleFeedbackReaction(messageTs: string, rating: number): Promise<void> {
  try {
    // Find the message in our database
    const { data: sessions } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('slack_thread_ts', messageTs);

    const session = sessions?.[0];
    if (session) {
      const { data: messages } = await supabase
        .from('thread_messages')
        .select('id, session_id')
        .eq('session_id', session.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      const message = messages?.[0];
      if (message) {
        await recordFeedback(message.session_id, message.id, rating);
        logger.info('Recorded feedback', { rating, messageId: message.id });
      }
    }
  } catch (error) {
    logger.error('Failed to record feedback', { error });
  }
}

/**
 * Split text into chunks at natural break points (paragraphs, sentences)
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // Try to split at paragraph break first
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);

    // If no paragraph break, try single newline
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }

    // If no newline, try sentence break
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf('. ', maxLength);
      if (splitIndex !== -1) splitIndex += 1; // Include the period
    }

    // If no sentence break, try word break
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }

    // Fallback to hard break
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Build Slack blocks for response
 * Handles long messages by splitting into multiple blocks (Slack limit: 3000 chars per block)
 */
function buildResponseBlocks(
  content: string,
  sources: string[],
  confidence: number
): any[] {
  const blocks: any[] = [];
  const MAX_BLOCK_LENGTH = 2900; // Leave buffer for safety

  // Split long content into multiple blocks
  if (content.length > MAX_BLOCK_LENGTH) {
    const chunks = splitTextIntoChunks(content, MAX_BLOCK_LENGTH);
    for (const chunk of chunks) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: chunk,
        },
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: content,
      },
    });
  }

  // Add sources if available
  if (sources.length > 0) {
    const sourceLinks = sources
      .map((s, i) => s.startsWith('http') ? `<${s}|Source ${i + 1}>` : s)
      .join(' • ');

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📚 ${sourceLinks}`,
        },
      ],
    });
  }

  // Add confidence indicator for low confidence
  if (confidence < 0.5) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '⚠️ _I\'m not very confident about this answer. Please verify with a team member._',
        },
      ],
    });
  }

  return blocks;
}

/**
 * Get bot status
 */
export function isSlackBotRunning(): boolean {
  return slackApp !== null;
}

/**
 * Shutdown the bot
 */
export async function shutdownSlackBot(): Promise<void> {
  if (slackApp) {
    await slackApp.stop();
    slackApp = null;
    logger.info('Slack bot stopped');
  }
}
