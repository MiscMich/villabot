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
let defaultWorkspaceId: string | null = null;
let defaultBotId: string | null = null;

/**
 * Get or create a default workspace for legacy single-bot mode
 */
async function getOrCreateDefaultWorkspace(): Promise<{ workspaceId: string; botId: string | null }> {
  // First, check if there's a default workspace
  const { data: existingWorkspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  let workspaceId: string;
  if (existingWorkspace) {
    workspaceId = existingWorkspace.id;
  } else {
    // Create a default workspace for legacy mode
    const { data: newWorkspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: 'Default Workspace',
        slug: 'default',
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !newWorkspace) {
      throw new Error('Failed to create default workspace');
    }
    workspaceId = newWorkspace.id;
    logger.info('Created default workspace for legacy bot mode', { workspaceId });
  }

  // Get the default bot for this workspace (if any)
  const { data: defaultBot } = await supabase
    .from('bots')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .single();

  return { workspaceId, botId: defaultBot?.id ?? null };
}

/**
 * Initialize the Slack bot
 */
export async function initializeSlackBot(): Promise<void> {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_APP_TOKEN) {
    logger.warn('Slack credentials not configured, bot disabled');
    return;
  }

  // Get or create default workspace for legacy single-bot mode
  const { workspaceId, botId } = await getOrCreateDefaultWorkspace();
  defaultWorkspaceId = workspaceId;
  defaultBotId = botId;
  logger.info('Legacy bot using workspace', { workspaceId, botId });

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
  registerFeedbackActionHandlers();

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
      // Ensure workspace context exists
      if (!defaultWorkspaceId) {
        throw new Error('No workspace configured for legacy bot');
      }

      // Log analytics
      await supabase.from('analytics').insert({
        workspace_id: defaultWorkspaceId,
        event_type: 'mention_received',
        event_data: {
          channel_id: channelId,
          user_id: userId,
        },
      });

      // Get or create session
      const sessionId = await getOrCreateSession(channelId, threadTs, userId, defaultWorkspaceId, defaultBotId ?? undefined);

      // Add user message to session
      await addMessage(sessionId, userId, 'user', messageText);

      // Generate response with timeout
      const botOptions = {
        workspaceId: defaultWorkspaceId,
        botId: defaultBotId ?? undefined,
      };
      const response = await withTimeout(
        generateResponse(messageText, botOptions),
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

      // Send response in thread with feedback buttons
      const sentMessage = await say({
        text: response.content,
        thread_ts: threadTs,
        unfurl_links: false,
        blocks: buildResponseBlocks(response.content, response.sources, response.confidence, {
          threadTs,
          queryText: messageText,
        }),
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
          slack_message_ts: sentMessage?.ts,
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

      // Ensure workspace context exists
      if (!defaultWorkspaceId) {
        throw new Error('No workspace configured for legacy bot');
      }

      // Log analytics
      await supabase.from('analytics').insert({
        workspace_id: defaultWorkspaceId,
        event_type: 'message_received',
        event_data: {
          channel_id: channelId,
          intent: intent.intent,
          confidence: intent.confidence,
          is_thread: isThreadReply,
        },
      });

      // Get or create session
      const sessionId = await getOrCreateSession(channelId, threadTs, userId, defaultWorkspaceId, defaultBotId ?? undefined);

      // Add user message to session
      await addMessage(sessionId, userId, 'user', messageText);

      // Create bot options for response generation
      const botOptions = {
        workspaceId: defaultWorkspaceId,
        botId: defaultBotId ?? undefined,
      };

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
            handleCorrection(lastUserQuestion.content, lastBotMsg.content, messageText, userId, defaultWorkspaceId),
            RESPONSE_TIMEOUT_MS,
            'handleCorrection'
          );
          response = { content: correctionResponse, sources: [], confidence: 0.9 };
        } else {
          response = await withTimeout(
            generateResponse(messageText, botOptions),
            RESPONSE_TIMEOUT_MS,
            'generateResponse'
          );
        }
      } else if (isThreadReply && previousBotMessage) {
        // Follow-up question in existing conversation
        const context = await getConversationContext(threadTs);
        response = await withTimeout(
          generateFollowUpResponse(messageText, sessionId, botOptions, context?.messages ?? []),
          RESPONSE_TIMEOUT_MS,
          'generateFollowUpResponse'
        );
      } else {
        // New question
        response = await withTimeout(
          generateResponse(messageText, botOptions),
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

      // Send response in thread with feedback buttons
      const sentMessage = await say({
        text: response.content,
        thread_ts: threadTs,
        unfurl_links: false,
        blocks: buildResponseBlocks(response.content, response.sources, response.confidence, {
          threadTs,
          queryText: messageText,
        }),
      });

      // Log response analytics
      await supabase.from('analytics').insert({
        workspace_id: defaultWorkspaceId,
        event_type: 'response_sent',
        event_data: {
          session_id: sessionId,
          message_id: messageId,
          confidence: response.confidence,
          source_count: response.sources.length,
          slack_message_ts: sentMessage?.ts,
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
      if (message && defaultWorkspaceId) {
        await recordFeedback(message.session_id, message.id, rating, defaultWorkspaceId);
        logger.info('Recorded feedback', { rating, messageId: message.id });
      }
    }
  } catch (error) {
    logger.error('Failed to record feedback', { error });
  }
}

/**
 * Register feedback action handlers for button clicks
 */
function registerFeedbackActionHandlers(): void {
  if (!slackApp) return;

  // Handle helpful feedback button
  slackApp.action('feedback_helpful', async ({ body, ack, client }) => {
    await ack();
    await handleFeedbackAction(body, true, client);
  });

  // Handle unhelpful feedback button
  slackApp.action('feedback_unhelpful', async ({ body, ack, client }) => {
    await ack();
    await handleFeedbackAction(body, false, client);
  });
}

/**
 * Handle feedback action from button click
 */
async function handleFeedbackAction(
  body: any,
  isHelpful: boolean,
  client: any
): Promise<void> {
  try {
    const action = body.actions?.[0];
    if (!action?.value) return;

    const metadata = JSON.parse(action.value);
    const userId = body.user?.id;
    const channelId = body.channel?.id;
    const messageTs = body.message?.ts;

    // Find the session for this thread
    const { data: sessions } = await supabase
      .from('thread_sessions')
      .select('id')
      .eq('slack_thread_ts', metadata.threadTs);

    const session = sessions?.[0];
    let messageId: string | null = null;

    if (session) {
      // Find the most recent bot message in this session
      const { data: messages } = await supabase
        .from('thread_messages')
        .select('id')
        .eq('session_id', session.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1);

      messageId = messages?.[0]?.id ?? null;

      // Also record in the old feedback system for compatibility
      if (messageId && defaultWorkspaceId) {
        await recordFeedback(session.id, messageId, isHelpful ? 1 : -1, defaultWorkspaceId);
      }
    }

    // Submit to the new response_feedback table
    const sourcesUsed = (metadata.sources ?? []).map((s: string, i: number) => ({
      documentId: `source-${i}`,
      documentTitle: s.startsWith('http') ? new URL(s).hostname : s,
    }));

    const { error } = await supabase
      .from('response_feedback')
      .insert({
        workspace_id: defaultWorkspaceId,
        message_id: messageId,
        session_id: session?.id ?? null,
        is_helpful: isHelpful,
        query_text: metadata.queryText,
        response_text: metadata.responseText,
        sources_used: sourcesUsed,
        slack_user_id: userId,
        slack_channel_id: channelId,
        slack_message_ts: messageTs,
      });

    if (error) {
      logger.error('Failed to insert feedback', { error });
    } else {
      logger.info('Feedback recorded via button', { isHelpful, userId, messageTs });
    }

    // Update the message to show feedback was received
    if (messageTs && channelId) {
      try {
        // Get the original message blocks
        const originalBlocks = body.message?.blocks ?? [];

        // Remove the actions block and add a confirmation
        const updatedBlocks = originalBlocks.filter(
          (block: any) => block.type !== 'actions'
        );

        updatedBlocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: isHelpful
                ? '✅ Thanks for your feedback! Glad this was helpful.'
                : '📝 Thanks for your feedback! We\'ll use this to improve.',
            },
          ],
        });

        await client.chat.update({
          channel: channelId,
          ts: messageTs,
          text: body.message?.text ?? '',
          blocks: updatedBlocks,
        });
      } catch (updateError) {
        logger.error('Failed to update message after feedback', { updateError });
      }
    }
  } catch (error) {
    logger.error('Failed to handle feedback action', { error });
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
  confidence: number,
  feedbackMetadata?: {
    threadTs: string;
    queryText: string;
  }
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

  // Add feedback buttons
  if (feedbackMetadata) {
    // Encode metadata in button value (truncate to stay within Slack limits)
    const buttonValue = JSON.stringify({
      threadTs: feedbackMetadata.threadTs,
      queryText: feedbackMetadata.queryText.slice(0, 500),
      responseText: content.slice(0, 500),
      sources: sources.slice(0, 5),
    });

    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👍 Helpful',
            emoji: true,
          },
          action_id: 'feedback_helpful',
          value: buttonValue,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👎 Not Helpful',
            emoji: true,
          },
          action_id: 'feedback_unhelpful',
          value: buttonValue,
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
