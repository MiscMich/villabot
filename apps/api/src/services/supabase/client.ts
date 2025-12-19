import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Database types will be generated from Supabase
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
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['document_chunks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['document_chunks']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['thread_sessions']['Row'], 'id' | 'created_at' | 'last_activity'>;
        Update: Partial<Database['public']['Tables']['thread_sessions']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['thread_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['thread_messages']['Insert']>;
      };
      bot_config: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bot_config']['Row'], 'id' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bot_config']['Insert']>;
      };
      analytics: {
        Row: {
          id: string;
          event_type: string;
          event_data: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['analytics']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['analytics']['Insert']>;
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
        Insert: Omit<Database['public']['Tables']['learned_facts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['learned_facts']['Insert']>;
      };
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
    };
  };
};

let supabaseClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(
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
