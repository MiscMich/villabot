'use client';

/**
 * useSyncProgress Hook
 * Provides real-time sync progress updates via SSE
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  SyncEventSource,
  SyncProgressEvent,
  SyncOperationType,
  getActiveOperations,
} from '@/lib/sync-events';

export interface SyncState {
  // Active operations by type
  driveSync: SyncProgressEvent | null;
  websiteScrape: SyncProgressEvent | null;

  // Connection state
  isConnected: boolean;
  connectionError: string | null;

  // Recent completed operations
  recentOperations: SyncProgressEvent[];
}

export interface UseSyncProgressReturn extends SyncState {
  // Refresh active operations
  refresh: () => Promise<void>;

  // Check if a specific type is syncing
  isSyncing: (type: SyncOperationType) => boolean;

  // Get progress for a specific type
  getProgress: (type: SyncOperationType) => number;
}

const initialState: SyncState = {
  driveSync: null,
  websiteScrape: null,
  isConnected: false,
  connectionError: null,
  recentOperations: [],
};

export function useSyncProgress(): UseSyncProgressReturn {
  const [state, setState] = useState<SyncState>(initialState);
  const supabase = getSupabase();
  const eventSourceRef = useRef<SyncEventSource | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Update operation in state based on type
  const updateOperation = useCallback((event: SyncProgressEvent) => {
    setState(prev => {
      const newState = { ...prev };

      // Update the appropriate slot based on operation type
      if (event.type === 'drive_sync' || event.type === 'drive_full_sync') {
        // If completed/failed/cancelled, move to recent and clear active
        if (['completed', 'failed', 'cancelled'].includes(event.status)) {
          newState.driveSync = null;
          newState.recentOperations = [event, ...prev.recentOperations.slice(0, 9)];
        } else {
          newState.driveSync = event;
        }
      } else if (event.type === 'website_scrape') {
        if (['completed', 'failed', 'cancelled'].includes(event.status)) {
          newState.websiteScrape = null;
          newState.recentOperations = [event, ...prev.recentOperations.slice(0, 9)];
        } else {
          newState.websiteScrape = event;
        }
      }

      return newState;
    });
  }, []);

  // Fetch active operations
  const refresh = useCallback(async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const operations = await getActiveOperations(token);

      setState(prev => {
        const newState = { ...prev };

        // Clear old active operations
        newState.driveSync = null;
        newState.websiteScrape = null;

        // Set active operations from API
        for (const op of operations) {
          if (op.type === 'drive_sync' || op.type === 'drive_full_sync') {
            newState.driveSync = op;
          } else if (op.type === 'website_scrape') {
            newState.websiteScrape = op;
          }
        }

        return newState;
      });
    } catch (error) {
      console.error('Failed to refresh operations', error);
    }
  }, [supabase]);

  // Initialize SSE connection
  useEffect(() => {
    let mounted = true;

    const initConnection = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token || !mounted) return;

      tokenRef.current = token;

      // Fetch initial active operations
      await refresh();

      // Create SSE connection
      const eventSource = new SyncEventSource(token, {
        onProgress: (event) => {
          if (mounted) {
            updateOperation(event);
          }
        },
        onConnected: () => {
          if (mounted) {
            setState(prev => ({
              ...prev,
              isConnected: true,
              connectionError: null,
            }));
          }
        },
        onDisconnected: () => {
          if (mounted) {
            setState(prev => ({
              ...prev,
              isConnected: false,
            }));
          }
        },
        onError: (error) => {
          if (mounted) {
            setState(prev => ({
              ...prev,
              connectionError: error.message,
            }));
          }
        },
      });

      eventSourceRef.current = eventSource;
      eventSource.connect();
    };

    initConnection();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session?.access_token && session.access_token !== tokenRef.current) {
          tokenRef.current = session.access_token;
          eventSourceRef.current?.updateToken(session.access_token);
        }
      }
    );

    return () => {
      mounted = false;
      eventSourceRef.current?.close();
      subscription.unsubscribe();
    };
  }, [supabase, updateOperation, refresh]);

  // Helper: check if syncing
  const isSyncing = useCallback((type: SyncOperationType): boolean => {
    if (type === 'drive_sync' || type === 'drive_full_sync') {
      return state.driveSync?.status === 'running';
    }
    if (type === 'website_scrape') {
      return state.websiteScrape?.status === 'running';
    }
    return false;
  }, [state.driveSync, state.websiteScrape]);

  // Helper: get progress
  const getProgress = useCallback((type: SyncOperationType): number => {
    if (type === 'drive_sync' || type === 'drive_full_sync') {
      return state.driveSync?.progress ?? 0;
    }
    if (type === 'website_scrape') {
      return state.websiteScrape?.progress ?? 0;
    }
    return 0;
  }, [state.driveSync, state.websiteScrape]);

  return {
    ...state,
    refresh,
    isSyncing,
    getProgress,
  };
}
