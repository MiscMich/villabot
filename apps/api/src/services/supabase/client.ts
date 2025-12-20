import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Database types - explicit definitions without self-references
export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          drive_file_id: string | null;
          title: string;
          file_type: string;
          source_type: string;
          source_url: string | null;
          content_hash: string;
          last_modified: string;
          last_synced: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          drive_file_id?: string | null;
          title: string;
          file_type: string;
          source_type: string;
          source_url?: string | null;
          content_hash: string;
          last_modified: string;
          last_synced?: string;
          is_active?: boolean;
        };
        Update: {
          drive_file_id?: string | null;
          title?: string;
          file_type?: string;
          source_type?: string;
          source_url?: string | null;
          content_hash?: string;
          last_modified?: string;
          last_synced?: string;
          is_active?: boolean;
        };
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          document_id: string;
          chunk_index: number;
          content: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          document_id?: string;
          chunk_index?: number;
          content?: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
        };
      };
      thread_sessions: {
        Row: {
          id: string;
          slack_channel_id: string;
          slack_thread_ts: string;
          started_by_user_id: string;
          is_active: boolean;
          created_at: string;
          last_activity: string;
        };
        Insert: {
          slack_channel_id: string;
          slack_thread_ts: string;
          started_by_user_id: string;
          is_active?: boolean;
        };
        Update: {
          slack_channel_id?: string;
          slack_thread_ts?: string;
          started_by_user_id?: string;
          is_active?: boolean;
          last_activity?: string;
        };
      };
      thread_messages: {
        Row: {
          id: string;
          session_id: string;
          slack_user_id: string;
          role: string;
          content: string;
          sources: Record<string, unknown>[];
          confidence_score: number | null;
          feedback_rating: number | null;
          created_at: string;
        };
        Insert: {
          session_id: string;
          slack_user_id: string;
          role: string;
          content: string;
          sources?: Record<string, unknown>[];
          confidence_score?: number | null;
        };
        Update: {
          session_id?: string;
          slack_user_id?: string;
          role?: string;
          content?: string;
          sources?: Record<string, unknown>[];
          confidence_score?: number | null;
          feedback_rating?: number | null;
        };
      };
      bot_config: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Record<string, unknown>;
        };
        Update: {
          key?: string;
          value?: Record<string, unknown>;
        };
      };
      analytics: {
        Row: {
          id: string;
          event_type: string;
          event_data: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          event_type: string;
          event_data: Record<string, unknown>;
        };
        Update: {
          event_type?: string;
          event_data?: Record<string, unknown>;
        };
      };
      learned_facts: {
        Row: {
          id: string;
          fact: string;
          source: string;
          taught_by_user_id: string | null;
          embedding: number[] | null;
          is_verified: boolean;
          created_at: string;
        };
        Insert: {
          fact: string;
          source: string;
          taught_by_user_id?: string | null;
          embedding?: number[] | null;
          is_verified?: boolean;
        };
        Update: {
          fact?: string;
          source?: string;
          taught_by_user_id?: string | null;
          embedding?: number[] | null;
          is_verified?: boolean;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_count?: number;
          vector_weight?: number;
          keyword_weight?: number;
        };
        Returns: {
          id: string;
          content: string;
          document_id: string;
          similarity: number;
          rank_score: number;
        }[];
      };
      search_learned_facts: {
        Args: {
          query_embedding: number[];
          match_count?: number;
        };
        Returns: {
          id: string;
          fact: string;
          source: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any> {
  if (!supabaseClient) {
    supabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    logger.info('Supabase client initialized');
  }
  return supabaseClient;
}

// Exported singleton for convenience (lazy-initialized on first access)
export const supabase = getSupabaseClient();

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from('bot_config').select('key').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist yet (before migration)
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('Supabase connection test failed', { error });
    return false;
  }
}
