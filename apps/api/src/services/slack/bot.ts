/**
 * Slack Bot - Main message handler
 * Uses Bolt SDK with Socket Mode
 */

import { App, LogLevel } from '@slack/bolt';
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

let slackApp: App | null = null;
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
  registerMessageHandler();
  registerReactionHandlers();

  // Start the bot
  await slackApp.start();
  logger.info('Slack bot connected via Socket Mode');
}

/**
 * Register message event handler
 */
function registerMessageHandler(): void {
  if (!slackApp) return;

  slackApp.message(async ({ message, say, client }) => {
    // Type guard for regular messages
    if (message.subtype || !('text' in message) || !message.text) {
      return;
    }

    // Ignore bot's own messages
    if (message.user === botUserId) {
      return;
    }

    const messageText = message.text;
    const channelId = message.channel;
    const userId = message.user;
    const threadTs = message.thread_ts ?? message.ts;
    const isThreadReply = !!message.thread_ts;

    try {
      // Check if we've responded in this thread before
      const previousBotMessage = isThreadReply
        ? await hasBotRespondedInThread(threadTs)
        : false;

      // Detect intent
      const intent = await detectIntent(messageText, isThreadReply, previousBotMessage);

      logger.debug('Intent detected', {
        intent: intent.intent,
        confidence: intent.confidence,
        shouldRespond: intent.shouldRespond,
      });

      if (!intent.shouldRespond) {
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

      // Show typing indicator
      // Note: Bolt doesn't have a direct typing indicator, but we can add reactions
      // or use the web API if needed

      // Get or create session
      const sessionId = await getOrCreateSession(channelId, threadTs, userId);

      // Add user message to session
      await addMessage(sessionId, userId, 'user', messageText);

      // Generate response based on intent
      let response;

      if (intent.intent === 'correction') {
        // Get previous messages for context
        const context = await getConversationContext(threadTs);
        const previousMessages = context?.messages ?? [];

        // Find the last bot message and user question
        const lastBotMsg = [...previousMessages].reverse().find(m => m.role === 'assistant');
        const lastUserQuestion = [...previousMessages].reverse().find(m => m.role === 'user');

        if (lastBotMsg && lastUserQuestion) {
          const correctionResponse = await handleCorrection(
            lastUserQuestion.content,
            lastBotMsg.content,
            messageText,
            userId
          );
          response = { content: correctionResponse, sources: [], confidence: 0.9 };
        } else {
          response = await generateResponse(messageText);
        }
      } else if (isThreadReply && previousBotMessage) {
        // Follow-up question in existing conversation
        const context = await getConversationContext(threadTs);
        response = await generateFollowUpResponse(
          messageText,
          sessionId,
          context?.messages ?? []
        );
      } else {
        // New question
        response = await generateResponse(messageText);
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
      const slackMessage = await say({
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
      logger.error('Error handling message', { error, messageText });

      // Send error response
      await say({
        text: "I'm having trouble processing your request right now. Please try again in a moment.",
        thread_ts: threadTs,
      });
    }
  });
}

/**
 * Register reaction handlers for feedback
 */
function registerReactionHandlers(): void {
  if (!slackApp) return;

  // Thumbs up = positive feedback
  slackApp.event('reaction_added', async ({ event }) => {
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

    if (sessions && sessions.length > 0) {
      const { data: messages } = await supabase
        .from('thread_messages')
        .select('id, session_id')
        .eq('session_id', sessions[0].id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      if (messages && messages.length > 0) {
        await recordFeedback(messages[0].session_id, messages[0].id, rating);
        logger.info('Recorded feedback', { rating, messageId: messages[0].id });
      }
    }
  } catch (error) {
    logger.error('Failed to record feedback', { error });
  }
}

/**
 * Build Slack blocks for response
 */
function buildResponseBlocks(
  content: string,
  sources: string[],
  confidence: number
): any[] {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: content,
      },
    },
  ];

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
