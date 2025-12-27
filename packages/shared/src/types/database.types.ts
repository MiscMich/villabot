/**
 * Database Types - Auto-generated from Supabase
 *
 * Generated via: mcp__supabase__generate_typescript_types
 * To regenerate: Use Supabase MCP or run `npx supabase gen types typescript`
 *
 * @see supabase/migrations/
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string | null
          data: Json
          event_type: string
          id: string
          processed_at: string | null
          stripe_event_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          stripe_event_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          stripe_event_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_channels: {
        Row: {
          bot_id: string | null
          channel_name: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          slack_channel_id: string
        }
        Insert: {
          bot_id?: string | null
          channel_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          slack_channel_id: string
        }
        Update: {
          bot_id?: string | null
          channel_name?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          slack_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_channels_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
          workspace_id: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
          workspace_id?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_drive_folders: {
        Row: {
          bot_id: string | null
          category: Database["public"]["Enums"]["document_category"] | null
          created_at: string | null
          drive_folder_id: string
          folder_name: string
          id: string
          is_active: boolean | null
          last_synced: string | null
          workspace_id: string
        }
        Insert: {
          bot_id?: string | null
          category?: Database["public"]["Enums"]["document_category"] | null
          created_at?: string | null
          drive_folder_id: string
          folder_name: string
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          workspace_id: string
        }
        Update: {
          bot_id?: string | null
          category?: Database["public"]["Enums"]["document_category"] | null
          created_at?: string | null
          drive_folder_id?: string
          folder_name?: string
          id?: string
          is_active?: boolean | null
          last_synced?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_drive_folders_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_drive_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_health: {
        Row: {
          bot_id: string
          checked_at: string
          consecutive_failures: number
          created_at: string
          error_message: string | null
          is_healthy: boolean
          is_running: boolean
          last_check_at: string
          last_restart_at: string | null
        }
        Insert: {
          bot_id: string
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          error_message?: string | null
          is_healthy?: boolean
          is_running?: boolean
          last_check_at?: string
          last_restart_at?: string | null
        }
        Update: {
          bot_id?: string
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          error_message?: string | null
          is_healthy?: boolean
          is_running?: boolean
          last_check_at?: string
          last_restart_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_health_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_health_history: {
        Row: {
          bot_id: string
          consecutive_failures: number
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          is_healthy: boolean
        }
        Insert: {
          bot_id: string
          consecutive_failures?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          is_healthy: boolean
        }
        Update: {
          bot_id?: string
          consecutive_failures?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          is_healthy?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bot_health_history_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          avatar_url: string | null
          bot_type: Database["public"]["Enums"]["bot_type"] | null
          categories: Database["public"]["Enums"]["document_category"][] | null
          created_at: string | null
          description: string | null
          id: string
          include_shared_knowledge: boolean | null
          is_default: boolean | null
          max_response_length: number | null
          name: string
          personality: string | null
          slack_app_token: string | null
          slack_bot_token: string | null
          slack_bot_user_id: string | null
          slack_signing_secret: string | null
          slug: string
          status: Database["public"]["Enums"]["bot_status"] | null
          system_instructions: string | null
          temperature: number | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bot_type?: Database["public"]["Enums"]["bot_type"] | null
          categories?: Database["public"]["Enums"]["document_category"][] | null
          created_at?: string | null
          description?: string | null
          id?: string
          include_shared_knowledge?: boolean | null
          is_default?: boolean | null
          max_response_length?: number | null
          name: string
          personality?: string | null
          slack_app_token?: string | null
          slack_bot_token?: string | null
          slack_bot_user_id?: string | null
          slack_signing_secret?: string | null
          slug: string
          status?: Database["public"]["Enums"]["bot_status"] | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bot_type?: Database["public"]["Enums"]["bot_type"] | null
          categories?: Database["public"]["Enums"]["document_category"][] | null
          created_at?: string | null
          description?: string | null
          id?: string
          include_shared_knowledge?: boolean | null
          is_default?: boolean | null
          max_response_length?: number | null
          name?: string
          personality?: string | null
          slack_app_token?: string | null
          slack_bot_token?: string | null
          slack_bot_user_id?: string | null
          slack_signing_secret?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["bot_status"] | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          fts: unknown
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bot_id: string | null
          category: Database["public"]["Enums"]["document_category"] | null
          content_hash: string
          created_at: string | null
          drive_file_id: string | null
          drive_folder_id: string | null
          file_type: string
          id: string
          is_active: boolean | null
          last_modified: string | null
          last_synced: string | null
          priority: number | null
          source_type: string | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          bot_id?: string | null
          category?: Database["public"]["Enums"]["document_category"] | null
          content_hash: string
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          file_type: string
          id?: string
          is_active?: boolean | null
          last_modified?: string | null
          last_synced?: string | null
          priority?: number | null
          source_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          bot_id?: string | null
          category?: Database["public"]["Enums"]["document_category"] | null
          content_hash?: string
          created_at?: string | null
          drive_file_id?: string | null
          drive_folder_id?: string | null
          file_type?: string
          id?: string
          is_active?: boolean | null
          last_modified?: string | null
          last_synced?: string | null
          priority?: number | null
          source_type?: string | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_type: string
          id: string
          message: string
          resolved: boolean | null
          service: string
          severity: string
          stack: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_type: string
          id?: string
          message: string
          resolved?: boolean | null
          service: string
          severity: string
          stack?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_type?: string
          id?: string
          message?: string
          resolved?: boolean | null
          service?: string
          severity?: string
          stack?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string | null
          currency: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_customer_id: string
          stripe_invoice_id: string
          subscription_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string | null
          currency?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status: string
          stripe_customer_id: string
          stripe_invoice_id: string
          subscription_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          currency?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_invoice_id?: string
          subscription_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_facts: {
        Row: {
          created_at: string | null
          embedding: string | null
          fact: string
          id: string
          is_verified: boolean | null
          source: string | null
          taught_by_user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          fact: string
          id?: string
          is_verified?: boolean | null
          source?: string | null
          taught_by_user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          fact?: string
          id?: string
          is_verified?: boolean | null
          source?: string | null
          taught_by_user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learned_facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last_four: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
          workspace_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
          workspace_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedback: {
        Row: {
          admin_response: string | null
          browser_info: Json | null
          category: string | null
          created_at: string
          description: string
          id: string
          page_url: string | null
          priority:
            | Database["public"]["Enums"]["platform_feedback_priority"]
            | null
          responded_at: string | null
          responded_by: string | null
          status: Database["public"]["Enums"]["platform_feedback_status"]
          tags: string[] | null
          title: string
          type: Database["public"]["Enums"]["platform_feedback_type"]
          updated_at: string
          upvotes: number | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          admin_response?: string | null
          browser_info?: Json | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          priority?:
            | Database["public"]["Enums"]["platform_feedback_priority"]
            | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["platform_feedback_status"]
          tags?: string[] | null
          title: string
          type: Database["public"]["Enums"]["platform_feedback_type"]
          updated_at?: string
          upvotes?: number | null
          user_id: string
          workspace_id: string
        }
        Update: {
          admin_response?: string | null
          browser_info?: Json | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          priority?:
            | Database["public"]["Enums"]["platform_feedback_priority"]
            | null
          responded_at?: string | null
          responded_by?: string | null
          status?: Database["public"]["Enums"]["platform_feedback_status"]
          tags?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["platform_feedback_type"]
          updated_at?: string
          upvotes?: number | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedback_notes: {
        Row: {
          admin_id: string
          created_at: string
          feedback_id: string
          id: string
          note: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          feedback_id: string
          id?: string
          note: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          feedback_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedback_notes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "platform_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feedback_votes: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_feedback_votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "platform_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      response_feedback: {
        Row: {
          bot_id: string | null
          created_at: string | null
          feedback_category: string | null
          feedback_text: string | null
          id: string
          is_helpful: boolean
          is_reviewed: boolean | null
          message_id: string | null
          query_text: string | null
          response_text: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string | null
          slack_channel_id: string
          slack_message_ts: string | null
          slack_user_id: string
          sources_used: Json | null
          workspace_id: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          is_helpful: boolean
          is_reviewed?: boolean | null
          message_id?: string | null
          query_text?: string | null
          response_text?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          slack_channel_id: string
          slack_message_ts?: string | null
          slack_user_id: string
          sources_used?: Json | null
          workspace_id?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          feedback_category?: string | null
          feedback_text?: string | null
          id?: string
          is_helpful?: boolean
          is_reviewed?: boolean | null
          message_id?: string | null
          query_text?: string | null
          response_text?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string | null
          slack_channel_id?: string
          slack_message_ts?: string | null
          slack_user_id?: string
          sources_used?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "response_feedback_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "thread_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          latest_invoice_id: string | null
          latest_invoice_status: string | null
          metadata: Json | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_price_id: string
          stripe_product_id: string | null
          stripe_subscription_id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          latest_invoice_id?: string | null
          latest_invoice_status?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_price_id: string
          stripe_product_id?: string | null
          stripe_subscription_id: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          cancel_at?: string | null
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          latest_invoice_id?: string | null
          latest_invoice_status?: string | null
          metadata?: Json | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_product_id?: string | null
          stripe_subscription_id?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_operations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_item: string | null
          error_message: string | null
          id: string
          operation_type: string
          processed_items: number | null
          progress: number | null
          result: Json | null
          started_at: string | null
          status: string
          total_items: number | null
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_item?: string | null
          error_message?: string | null
          id?: string
          operation_type: string
          processed_items?: number | null
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          total_items?: number | null
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_item?: string | null
          error_message?: string | null
          id?: string
          operation_type?: string
          processed_items?: number | null
          progress?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          total_items?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_operations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          confidence_score: number | null
          content: string
          created_at: string | null
          feedback_rating: number | null
          id: string
          role: string
          session_id: string | null
          slack_user_id: string
          sources: Json | null
        }
        Insert: {
          confidence_score?: number | null
          content: string
          created_at?: string | null
          feedback_rating?: number | null
          id?: string
          role: string
          session_id?: string | null
          slack_user_id: string
          sources?: Json | null
        }
        Update: {
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          feedback_rating?: number | null
          id?: string
          role?: string
          session_id?: string | null
          slack_user_id?: string
          sources?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "thread_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_sessions: {
        Row: {
          bot_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_activity: string | null
          slack_channel_id: string
          slack_thread_ts: string
          started_by_user_id: string
          workspace_id: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          slack_channel_id: string
          slack_thread_ts: string
          started_by_user_id: string
          workspace_id?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          slack_channel_id?: string
          slack_thread_ts?: string
          started_by_user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_sessions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_daily: {
        Row: {
          active_users: number | null
          date: string
          documents_added: number | null
          documents_removed: number | null
          id: string
          messages_received: number | null
          queries_count: number | null
          workspace_id: string
        }
        Insert: {
          active_users?: number | null
          date: string
          documents_added?: number | null
          documents_removed?: number | null
          id?: string
          messages_received?: number | null
          queries_count?: number | null
          workspace_id: string
        }
        Update: {
          active_users?: number | null
          date?: string
          documents_added?: number | null
          documents_removed?: number | null
          id?: string
          messages_received?: number | null
          queries_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          bots_count: number | null
          bots_limit: number
          created_at: string | null
          documents_count: number | null
          documents_limit: number
          id: string
          period_end: string
          period_start: string
          queries_count: number | null
          queries_limit: number
          storage_limit_bytes: number
          storage_used_bytes: number | null
          team_members_count: number | null
          team_members_limit: number
          updated_at: string | null
          website_pages_count: number | null
          website_pages_limit: number
          workspace_id: string
        }
        Insert: {
          bots_count?: number | null
          bots_limit: number
          created_at?: string | null
          documents_count?: number | null
          documents_limit: number
          id?: string
          period_end: string
          period_start: string
          queries_count?: number | null
          queries_limit: number
          storage_limit_bytes: number
          storage_used_bytes?: number | null
          team_members_count?: number | null
          team_members_limit: number
          updated_at?: string | null
          website_pages_count?: number | null
          website_pages_limit: number
          workspace_id: string
        }
        Update: {
          bots_count?: number | null
          bots_limit?: number
          created_at?: string | null
          documents_count?: number | null
          documents_limit?: number
          id?: string
          period_end?: string
          period_start?: string
          queries_count?: number | null
          queries_limit?: number
          storage_limit_bytes?: number
          storage_used_bytes?: number | null
          team_members_count?: number | null
          team_members_limit?: number
          updated_at?: string | null
          website_pages_count?: number | null
          website_pages_limit?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_workspace_id: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_workspace_id?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_workspace_id?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_workspace_id_fkey"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_member_role"] | null
          used_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invite_token: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"] | null
          used_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"] | null
          used_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          role: Database["public"]["Enums"]["workspace_member_role"] | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["workspace_member_role"] | null
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["workspace_member_role"] | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          created_by_admin: string | null
          id: string
          internal_notes: string | null
          is_internal: boolean | null
          logo_url: string | null
          max_bots: number | null
          max_documents: number | null
          max_file_upload_mb: number | null
          max_queries_per_month: number | null
          max_team_members: number | null
          max_website_pages: number | null
          name: string
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_admin?: string | null
          id?: string
          internal_notes?: string | null
          is_internal?: boolean | null
          logo_url?: string | null
          max_bots?: number | null
          max_documents?: number | null
          max_file_upload_mb?: number | null
          max_queries_per_month?: number | null
          max_team_members?: number | null
          max_website_pages?: number | null
          name: string
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_admin?: string | null
          id?: string
          internal_notes?: string | null
          is_internal?: boolean | null
          logo_url?: string | null
          max_bots?: number | null
          max_documents?: number | null
          max_file_upload_mb?: number | null
          max_queries_per_month?: number | null
          max_team_members?: number | null
          max_website_pages?: number | null
          name?: string
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["subscription_status"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_admin_fkey"
            columns: ["created_by_admin"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_errors: { Args: Record<string, never>; Returns: undefined }
      get_or_create_usage_tracking: {
        Args: { p_workspace_id: string }
        Returns: Database["public"]["Tables"]["usage_tracking"]["Row"]
      }
      get_user_workspace_role: {
        Args: { p_workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_member_role"]
      }
      get_user_workspaces: { Args: Record<string, never>; Returns: string[] }
      hybrid_search: {
        Args: {
          include_shared?: boolean
          keyword_weight?: number
          match_count?: number
          p_bot_id?: string
          p_workspace_id?: string
          query_embedding: string
          query_text: string
          vector_weight?: number
        }
        Returns: {
          category: string
          content: string
          document_id: string
          id: string
          rank_score: number
          similarity: number
          source_title: string
        }[]
      }
      increment_query_count: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: Record<string, never>; Returns: boolean }
      is_workspace_admin: { Args: { p_workspace_id: string }; Returns: boolean }
      match_documents: {
        Args: {
          match_count?: number
          p_workspace_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      match_learned_facts: {
        Args: {
          match_count?: number
          p_workspace_id?: string
          query_embedding: string
        }
        Returns: {
          fact: string
          id: string
          similarity: number
        }[]
      }
      update_bot_count: { Args: { p_workspace_id: string }; Returns: undefined }
      update_document_count: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      update_team_member_count: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bot_status: "active" | "inactive" | "configuring"
      bot_type:
        | "operations"
        | "marketing"
        | "sales"
        | "hr"
        | "technical"
        | "general"
      document_category:
        | "shared"
        | "operations"
        | "marketing"
        | "sales"
        | "hr"
        | "technical"
        | "custom"
      platform_feedback_priority: "low" | "medium" | "high" | "critical"
      platform_feedback_status:
        | "new"
        | "under_review"
        | "planned"
        | "in_progress"
        | "completed"
        | "declined"
        | "duplicate"
      platform_feedback_type:
        | "feature_request"
        | "bug_report"
        | "improvement"
        | "question"
        | "other"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
      subscription_tier: "starter" | "pro" | "business"
      workspace_member_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// =============================================================================
// HELPER TYPES
// =============================================================================

type DefaultSchema = Database["public"]

/** Get Row type for a table */
export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

/** Get Insert type for a table */
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

/** Get Update type for a table */
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

/** Get enum type */
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]

// Convenience type aliases
export type WorkspaceRow = Tables<"workspaces">
export type BotRow = Tables<"bots">
export type DocumentRow = Tables<"documents">
export type DocumentChunkRow = Tables<"document_chunks">
export type ThreadSessionRow = Tables<"thread_sessions">
export type ThreadMessageRow = Tables<"thread_messages">
export type SyncOperationRow = Tables<"sync_operations">
export type SubscriptionRow = Tables<"subscriptions">
export type ResponseFeedbackRow = Tables<"response_feedback">
export type UserProfileRow = Tables<"user_profiles">
export type WorkspaceMemberRow = Tables<"workspace_members">
export type BotHealthRow = Tables<"bot_health">
export type ErrorLogRow = Tables<"error_logs">
export type AnalyticsRow = Tables<"analytics">
