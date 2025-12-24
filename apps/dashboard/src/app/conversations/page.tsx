'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  MessageSquare,
  User,
  Bot,
  Clock,
  ChevronRight,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  slack_user_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string[];
  confidence_score: number | null;
  feedback_rating: number | null;
  created_at: string;
}

interface Conversation {
  id: string;
  slack_channel_id: string;
  slack_thread_ts: string;
  started_by_user_id: string;
  is_active: boolean;
  created_at: string;
  last_activity: string;
  messageCount: number;
  lastMessage: {
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
  } | null;
}

function ConversationCard({
  conversation,
  isExpanded,
  onToggle,
}: {
  conversation: Conversation;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: details, isLoading } = useQuery({
    queryKey: ['conversation', conversation.id],
    queryFn: () => api.getConversation(conversation.id),
    enabled: isExpanded,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="premium-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-sm">
                Thread #{conversation.slack_thread_ts.slice(-6)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  conversation.is_active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {conversation.is_active ? 'Active' : 'Closed'}
              </span>
            </div>
            {conversation.lastMessage && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                <span className="font-medium">
                  {conversation.lastMessage.role === 'user' ? 'User' : 'Bot'}:
                </span>{' '}
                {truncateContent(conversation.lastMessage.content)}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(conversation.last_activity)}
              </span>
              <span>{conversation.messageCount} messages</span>
            </div>
          </div>
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg shimmer" />
              ))}
            </div>
          ) : details?.conversation.messages ? (
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {details.conversation.messages.map((message: Message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'assistant'
                        ? 'bg-amber-100 dark:bg-amber-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div
                    className={`flex-1 max-w-[80%] ${
                      message.role === 'assistant' ? '' : 'text-right'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-xl ${
                        message.role === 'assistant'
                          ? 'bg-secondary text-left'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-left'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {message.role === 'assistant' && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {message.confidence_score !== null && (
                              <span
                                className={`flex items-center gap-1 ${
                                  message.confidence_score >= 0.7
                                    ? 'text-green-600 dark:text-green-400'
                                    : message.confidence_score >= 0.4
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {message.confidence_score >= 0.7 ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <AlertCircle className="w-3 h-3" />
                                )}
                                {Math.round(message.confidence_score * 100)}% confident
                              </span>
                            )}
                            {message.feedback_rating !== null && (
                              <span className="flex items-center gap-1">
                                {message.feedback_rating > 0 ? (
                                  <ThumbsUp className="w-3 h-3 text-green-500" />
                                ) : (
                                  <ThumbsDown className="w-3 h-3 text-red-500" />
                                )}
                              </span>
                            )}
                            {message.sources.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" />
                                {message.sources.length} sources
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No messages found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-10 w-48 bg-muted rounded-lg shimmer" />
        <div className="h-5 w-64 bg-muted rounded-lg shimmer" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl shimmer" />
        ))}
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl shimmer" />
        ))}
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Wait for workspace context before making API calls
  const { workspace, isLoading: isWorkspaceLoading } = useWorkspace();

  const {
    data: conversationsData,
    isLoading: isConversationsLoading,
    isError: conversationsError,
    error: conversationsErrorData,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ['conversations', page, workspace?.id],
    queryFn: () => api.getConversations(page, 20),
    enabled: !!workspace?.id,
  });

  const { data: statsData } = useQuery({
    queryKey: ['conversationStats', workspace?.id],
    queryFn: api.getConversationStats,
    enabled: !!workspace?.id,
  });

  // Combined loading state
  const conversationsLoading = isWorkspaceLoading || isConversationsLoading;

  if (conversationsError) {
    return (
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-8 h-8 text-amber-500" />
            <h1 className="text-4xl font-display font-bold">Conversations</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Browse and review bot interactions with your team
          </p>
        </div>
        <div className="premium-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Failed to load conversations</h2>
              <p className="text-muted-foreground max-w-md">
                {conversationsErrorData instanceof Error ? conversationsErrorData.message : 'An error occurred while loading conversations. Please try again.'}
              </p>
            </div>
            <Button
              onClick={() => refetchConversations()}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (conversationsLoading) {
    return <LoadingSkeleton />;
  }

  const conversations = conversationsData?.conversations ?? [];
  const pagination = conversationsData?.pagination;
  const stats = statsData?.stats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="opacity-0 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="w-8 h-8 text-amber-500" />
          <h1 className="text-4xl font-display font-bold">Conversations</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Browse and review bot interactions with your team
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="premium-card p-4">
            <p className="text-sm text-muted-foreground">Total Conversations</p>
            <p className="text-2xl font-bold">{stats.totalConversations}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-sm text-muted-foreground">Active (24h)</p>
            <p className="text-2xl font-bold">{stats.activeConversations}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-sm text-muted-foreground">Total Messages</p>
            <p className="text-2xl font-bold">{stats.totalMessages}</p>
          </div>
          <div className="premium-card p-4">
            <p className="text-sm text-muted-foreground">Avg Messages/Thread</p>
            <p className="text-2xl font-bold">{stats.avgMessagesPerConversation}</p>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="space-y-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
        <div className="section-header">
          <h2 className="font-display">Recent Conversations</h2>
          <div className="divider" />
        </div>

        {conversations.length === 0 ? (
          <div className="premium-card p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No conversations yet</h3>
            <p className="text-muted-foreground">
              Conversations will appear here once users start interacting with the bot
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                isExpanded={expandedId === conversation.id}
                onToggle={() =>
                  setExpandedId(expandedId === conversation.id ? null : conversation.id)
                }
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-muted-foreground">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
