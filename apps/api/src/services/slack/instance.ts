/**
 * Slack Bot Instance
 * Represents a single bot connection with its own credentials and channel assignments
 */

import pkg from '@slack/bolt';
const { App, LogLevel } = pkg;
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../supabase/client.js';
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
import { messageRateLimiter } from '../../utils/rate-limiter.js';
import { errorTracker } from '../../utils/error-tracker.js';
import { withTimeout, TimeoutError } from '../../utils/timeout.js';
import { trackQueryUsage } from '../../middleware/rateLimit.js';
import type { Bot } from '@cluebase/shared';

// Response timeout in milliseconds
const RESPONSE_TIMEOUT_MS = 30000;

export interface BotInstanceConfig {
  bot: Bot;
  assignedChannels: string[];
}

export class BotInstance {
  private app: InstanceType<typeof App> | null = null;
  private botUserId: string | null = null;
  private config: BotInstanceConfig;
  private isRunning = false;

  constructor(config: BotInstanceConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.bot.id;
  }

  get name(): string {
    return this.config.bot.name;
  }

  get slug(): string {
    return this.config.bot.slug;
  }

  get channels(): string[] {
    return this.config.assignedChannels;
  }

  get running(): boolean {
    return this.isRunning;
  }

  get workspaceId(): string {
    return this.config.bot.workspaceId;
  }

  /**
   * Check if this bot should handle messages in a given channel
   */
  handlesChannel(channelId: string): boolean {
    // If no channels assigned, this bot handles all channels (legacy mode)
    if (this.config.assignedChannels.length === 0) {
      return this.config.bot.isDefault;
    }
    return this.config.assignedChannels.includes(channelId);
  }

  /**
   * Initialize and start the bot
   */
  async start(): Promise<void> {
    const { bot } = this.config;

    if (!bot.slackBotToken || !bot.slackAppToken) {
      logger.warn(`Bot ${bot.name} has no Slack credentials, skipping`);
      return;
    }

    try {
      this.app = new App({
        token: bot.slackBotToken,
        appToken: bot.slackAppToken,
        socketMode: true,
        logLevel: env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      });

      // Get bot user ID
      const authResult = await this.app.client.auth.test();
      this.botUserId = authResult.user_id ?? null;
      logger.info(`Bot ${bot.name} initialized as ${authResult.user}`);

      // Register handlers
      this.registerMentionHandler();
      this.registerMessageHandler();
      this.registerReactionHandlers();
      this.registerFeedbackActionHandlers();

      // Start the bot
      await this.app.start();
      this.isRunning = true;
      logger.info(`Bot ${bot.name} connected via Socket Mode`);
    } catch (error) {
      logger.error(`Failed to start bot ${bot.name}`, { error });
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = null;
      this.isRunning = false;
      logger.info(`Bot ${this.config.bot.name} stopped`);
    }
  }

  /**
   * Register app mention handler
   */
  private registerMentionHandler(): void {
    if (!this.app) return;

    this.app.event('app_mention', async ({ event, say }: { event: any; say: any }) => {
      const messageText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      const channelId = event.channel;
      const userId = event.user;
      const threadTs = event.thread_ts ?? event.ts;

      // Check if this bot should handle this channel
      if (!this.handlesChannel(channelId)) {
        logger.debug(`Bot ${this.name} ignoring mention in channel ${channelId}`);
        return;
      }

      logger.info(`Bot ${this.name} mentioned`, { user: userId, channel: channelId });

      // Rate limit check
      const rateCheck = messageRateLimiter.check(userId);
      if (!rateCheck.allowed) {
        await errorTracker.trackRateLimit(userId, rateCheck.resetIn);
        await say({
          text: `⏳ You're asking questions too quickly. Please wait ${Math.ceil(rateCheck.resetIn / 1000)} seconds.`,
          thread_ts: threadTs,
        });
        return;
      }

      try {
        // Log analytics with workspace context
        await supabase.from('analytics').insert({
          workspace_id: this.workspaceId,
          event_type: 'mention_received',
          event_data: {
            channel_id: channelId,
            user_id: userId,
            bot_id: this.id,
            bot_name: this.name,
          },
        });

        // Get or create session with bot ID and workspace context
        const sessionId = await getOrCreateSession(channelId, threadTs, userId, this.workspaceId, this.id);

        // Add user message
        await addMessage(sessionId, userId, 'user', messageText);

        // Generate response with bot-specific and workspace context
        const response = await withTimeout(
          generateResponse(messageText, {
            workspaceId: this.workspaceId,
            botId: this.id,
            systemInstructions: this.config.bot.systemInstructions,
            includeSharedKnowledge: this.config.bot.includeSharedKnowledge,
            categories: this.config.bot.categories,
          }),
          RESPONSE_TIMEOUT_MS,
          'generateResponse'
        );

        // Add bot response
        const messageId = await addMessage(
          sessionId,
          this.botUserId!,
          'assistant',
          response.content,
          response.sources,
          response.confidence
        );

        // Send response with feedback buttons
        const sentMessage = await say({
          text: response.content,
          thread_ts: threadTs,
          unfurl_links: false,
          blocks: this.buildResponseBlocks(response.content, response.sources, response.confidence, {
            threadTs,
            queryText: messageText,
          }),
        });

        // Track query usage for rate limiting
        await trackQueryUsage(this.workspaceId);

        // Log response analytics with workspace context
        await supabase.from('analytics').insert({
          workspace_id: this.workspaceId,
          event_type: 'response_sent',
          event_data: {
            session_id: sessionId,
            message_id: messageId,
            bot_id: this.id,
            confidence: response.confidence,
            source_count: response.sources.length,
            triggered_by: 'mention',
            slack_message_ts: sentMessage?.ts,
          },
        });
      } catch (error) {
        const err = error as Error;
        if (err instanceof TimeoutError) {
          await errorTracker.trackTimeout('generateResponse', RESPONSE_TIMEOUT_MS, { userId, messageText });
          await say({
            text: "⏱️ My response is taking too long. Please try again or simplify your question.",
            thread_ts: threadTs,
          });
        } else {
          await errorTracker.track(err, 'slack', 'high', { userId, messageText, handler: 'mention', botId: this.id });
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
  private registerMessageHandler(): void {
    if (!this.app) return;

    this.app.message(async ({ message, say, client: _client }: { message: any; say: any; client: any }) => {
      if (message.subtype || !('text' in message) || !message.text) return;
      if (message.user === this.botUserId) return;

      // Check if message contains a mention of this bot
      const isMention = this.botUserId && message.text.includes(`<@${this.botUserId}>`);

      // Strip bot mention from text if present
      const messageText = isMention
        ? message.text.replace(/<@[A-Z0-9]+>/g, '').trim()
        : message.text;
      const channelId = message.channel;
      const userId = message.user;
      const threadTs = message.thread_ts ?? message.ts;
      const isThreadReply = !!message.thread_ts;

      // Check if this bot should handle this channel
      if (!this.handlesChannel(channelId)) {
        // If this is a mention, log that we're ignoring it (for debugging)
        if (isMention) {
          logger.debug(`Bot ${this.name} ignoring mention in unassigned channel ${channelId}`);
        }
        return;
      }

      try {
        // Check if bot has previously responded in this thread (needed for follow-ups)
        const previousBotMessage = isThreadReply
          ? await hasBotRespondedInThread(threadTs)
          : false;

        // If this is a direct mention, always respond (like app_mention handler)
        let intent;
        if (isMention) {
          logger.info(`Bot ${this.name} mentioned in message`, { user: userId, channel: channelId });
          intent = { intent: 'question' as const, confidence: 1.0, shouldRespond: true };
        } else {
          intent = await detectIntent(messageText, isThreadReply, previousBotMessage);
        }

        if (!intent.shouldRespond) return;

        const rateCheck = messageRateLimiter.check(userId);
        if (!rateCheck.allowed) {
          await errorTracker.trackRateLimit(userId, rateCheck.resetIn);
          await say({
            text: `⏳ You're asking questions too quickly. Please wait ${Math.ceil(rateCheck.resetIn / 1000)} seconds.`,
            thread_ts: threadTs,
          });
          return;
        }

        await supabase.from('analytics').insert({
          workspace_id: this.workspaceId,
          event_type: isMention ? 'mention_received' : 'message_received',
          event_data: {
            channel_id: channelId,
            intent: intent.intent,
            bot_id: this.id,
            bot_name: this.name,
            is_thread: isThreadReply,
            triggered_by: isMention ? 'mention_via_message' : 'message',
          },
        });

        const sessionId = await getOrCreateSession(channelId, threadTs, userId, this.workspaceId, this.id);
        await addMessage(sessionId, userId, 'user', messageText);

        let response;
        if (intent.intent === 'correction') {
          const context = await getConversationContext(threadTs);
          const previousMessages = context?.messages ?? [];
          const lastBotMsg = [...previousMessages].reverse().find(m => m.role === 'assistant');
          const lastUserQuestion = [...previousMessages].reverse().find(m => m.role === 'user');

          if (lastBotMsg && lastUserQuestion) {
            const correctionResponse = await withTimeout(
              handleCorrection(lastUserQuestion.content, lastBotMsg.content, messageText, userId, this.workspaceId),
              RESPONSE_TIMEOUT_MS,
              'handleCorrection'
            );
            response = { content: correctionResponse, sources: [], confidence: 0.9 };
          } else {
            response = await withTimeout(
              generateResponse(messageText, {
                workspaceId: this.workspaceId,
                botId: this.id,
                systemInstructions: this.config.bot.systemInstructions,
                includeSharedKnowledge: this.config.bot.includeSharedKnowledge,
                categories: this.config.bot.categories,
              }),
              RESPONSE_TIMEOUT_MS,
              'generateResponse'
            );
          }
        } else if (isThreadReply && previousBotMessage) {
          const context = await getConversationContext(threadTs);
          response = await withTimeout(
            generateFollowUpResponse(messageText, sessionId, {
              workspaceId: this.workspaceId,
              botId: this.id,
              systemInstructions: this.config.bot.systemInstructions,
              includeSharedKnowledge: this.config.bot.includeSharedKnowledge,
              categories: this.config.bot.categories,
            }, context?.messages ?? []),
            RESPONSE_TIMEOUT_MS,
            'generateFollowUpResponse'
          );
        } else {
          response = await withTimeout(
            generateResponse(messageText, {
              workspaceId: this.workspaceId,
              botId: this.id,
              systemInstructions: this.config.bot.systemInstructions,
              includeSharedKnowledge: this.config.bot.includeSharedKnowledge,
              categories: this.config.bot.categories,
            }),
            RESPONSE_TIMEOUT_MS,
            'generateResponse'
          );
        }

        const messageId = await addMessage(
          sessionId,
          this.botUserId!,
          'assistant',
          response.content,
          response.sources,
          response.confidence
        );

        const sentMessage = await say({
          text: response.content,
          thread_ts: threadTs,
          unfurl_links: false,
          blocks: this.buildResponseBlocks(response.content, response.sources, response.confidence, {
            threadTs,
            queryText: messageText,
          }),
        });

        // Track query usage for rate limiting
        await trackQueryUsage(this.workspaceId);

        await supabase.from('analytics').insert({
          workspace_id: this.workspaceId,
          event_type: 'response_sent',
          event_data: {
            session_id: sessionId,
            message_id: messageId,
            bot_id: this.id,
            confidence: response.confidence,
            source_count: response.sources.length,
            slack_message_ts: sentMessage?.ts,
            triggered_by: isMention ? 'mention_via_message' : 'message',
          },
        });
      } catch (error) {
        const err = error as Error;
        if (err instanceof TimeoutError) {
          await errorTracker.trackTimeout('messageHandler', RESPONSE_TIMEOUT_MS, { userId, messageText, isMention });
          await say({
            text: "⏱️ My response is taking too long. Please try again or simplify your question.",
            thread_ts: threadTs,
          });
        } else {
          await errorTracker.track(err, 'slack', 'high', { userId, messageText, handler: isMention ? 'mention' : 'message', botId: this.id });
          await say({
            text: "I'm having trouble processing your request right now. Please try again in a moment.",
            thread_ts: threadTs,
          });
        }
      }
    });
  }

  /**
   * Register reaction handlers
   */
  private registerReactionHandlers(): void {
    if (!this.app) return;

    this.app.event('reaction_added', async ({ event }: { event: any }) => {
      if (event.reaction === '+1' || event.reaction === 'thumbsup') {
        await this.handleFeedbackReaction(event.item.ts, 1);
      } else if (event.reaction === '-1' || event.reaction === 'thumbsdown') {
        await this.handleFeedbackReaction(event.item.ts, -1);
      }
    });
  }

  /**
   * Handle feedback reaction
   */
  private async handleFeedbackReaction(messageTs: string, rating: number): Promise<void> {
    try {
      const { data: sessions } = await supabase
        .from('thread_sessions')
        .select('id')
        .eq('slack_thread_ts', messageTs)
        .eq('workspace_id', this.workspaceId);

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
          await recordFeedback(message.session_id, message.id, rating, this.workspaceId);
          logger.info('Recorded feedback', { rating, messageId: message.id, botId: this.id });
        }
      }
    } catch (error) {
      logger.error('Failed to record feedback', { error, botId: this.id });
    }
  }

  /**
   * Register feedback action handlers
   */
  private registerFeedbackActionHandlers(): void {
    if (!this.app) return;

    this.app.action('feedback_helpful', async ({ body, ack, client }) => {
      await ack();
      await this.handleFeedbackAction(body, true, client);
    });

    this.app.action('feedback_unhelpful', async ({ body, ack, client }) => {
      await ack();
      await this.handleFeedbackAction(body, false, client);
    });
  }

  /**
   * Handle feedback action from button click
   */
  private async handleFeedbackAction(body: any, isHelpful: boolean, client: any): Promise<void> {
    try {
      const action = body.actions?.[0];
      if (!action?.value) return;

      const metadata = JSON.parse(action.value);
      const userId = body.user?.id;
      const channelId = body.channel?.id;
      const messageTs = body.message?.ts;

      const { data: sessions } = await supabase
        .from('thread_sessions')
        .select('id')
        .eq('slack_thread_ts', metadata.threadTs)
        .eq('workspace_id', this.workspaceId);

      const session = sessions?.[0];
      let messageId: string | null = null;

      if (session) {
        const { data: messages } = await supabase
          .from('thread_messages')
          .select('id')
          .eq('session_id', session.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1);

        messageId = messages?.[0]?.id ?? null;

        if (messageId) {
          await recordFeedback(session.id, messageId, isHelpful ? 1 : -1, this.workspaceId);
        }
      }

      const sourcesUsed = (metadata.sources ?? []).map((s: string, i: number) => ({
        documentId: `source-${i}`,
        documentTitle: s.startsWith('http') ? new URL(s).hostname : s,
      }));

      const { error } = await supabase
        .from('response_feedback')
        .insert({
          workspace_id: this.workspaceId,
          message_id: messageId,
          session_id: session?.id ?? null,
          bot_id: this.id,
          is_helpful: isHelpful,
          query_text: metadata.queryText,
          response_text: metadata.responseText,
          sources_used: sourcesUsed,
          slack_user_id: userId,
          slack_channel_id: channelId,
          slack_message_ts: messageTs,
        });

      if (error) {
        logger.error('Failed to insert feedback', { error, botId: this.id });
      } else {
        logger.info('Feedback recorded via button', { isHelpful, userId, botId: this.id });
      }

      if (messageTs && channelId) {
        try {
          const originalBlocks = body.message?.blocks ?? [];
          const updatedBlocks = originalBlocks.filter((block: any) => block.type !== 'actions');

          updatedBlocks.push({
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: isHelpful
                ? '✅ Thanks for your feedback! Glad this was helpful.'
                : '📝 Thanks for your feedback! We\'ll use this to improve.',
            }],
          });

          await client.chat.update({
            channel: channelId,
            ts: messageTs,
            text: body.message?.text ?? '',
            blocks: updatedBlocks,
          });
        } catch (updateError) {
          logger.error('Failed to update message after feedback', { updateError, botId: this.id });
        }
      }
    } catch (error) {
      logger.error('Failed to handle feedback action', { error, botId: this.id });
    }
  }

  /**
   * Build response blocks with feedback buttons
   */
  private buildResponseBlocks(
    content: string,
    sources: string[],
    confidence: number,
    feedbackMetadata?: { threadTs: string; queryText: string }
  ): any[] {
    const blocks: any[] = [];
    const MAX_BLOCK_LENGTH = 2900;

    // Split long content
    if (content.length > MAX_BLOCK_LENGTH) {
      const chunks = this.splitTextIntoChunks(content, MAX_BLOCK_LENGTH);
      for (const chunk of chunks) {
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: chunk },
        });
      }
    } else {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: content },
      });
    }

    // Add sources
    if (sources.length > 0) {
      const sourceLinks = sources
        .map((s, i) => s.startsWith('http') ? `<${s}|Source ${i + 1}>` : s)
        .join(' • ');

      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `📚 ${sourceLinks}` }],
      });
    }

    // Low confidence warning
    if (confidence < 0.5) {
      blocks.push({
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: '⚠️ _I\'m not very confident about this answer. Please verify with a team member._',
        }],
      });
    }

    // Feedback buttons
    if (feedbackMetadata) {
      const buttonValue = JSON.stringify({
        threadTs: feedbackMetadata.threadTs,
        queryText: feedbackMetadata.queryText.slice(0, 500),
        responseText: content.slice(0, 500),
        sources: sources.slice(0, 5),
      });

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '👍 Helpful', emoji: true },
            action_id: 'feedback_helpful',
            value: buttonValue,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '👎 Not Helpful', emoji: true },
            action_id: 'feedback_unhelpful',
            value: buttonValue,
          },
        ],
      });
    }

    return blocks;
  }

  /**
   * Split text into chunks
   */
  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > maxLength) {
      let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = remaining.lastIndexOf('\n', maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = remaining.lastIndexOf('. ', maxLength);
        if (splitIndex !== -1) splitIndex += 1;
      }
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }
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
}
