/**
 * Sync Progress Emitter Service
 * Provides real-time progress updates for sync operations via SSE
 */

import { EventEmitter } from 'events';
import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';

export type SyncOperationType = 'drive_sync' | 'website_scrape' | 'drive_full_sync';
export type SyncOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncProgressEvent {
  operationId: string;
  workspaceId: string;
  type: SyncOperationType;
  status: SyncOperationStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  currentItem?: string;
  result?: {
    added: number;
    updated: number;
    removed: number;
    errors: string[];
  };
  error?: string;
  timestamp: string;
}

interface OperationState {
  lastEmitTime: number;
  pendingEvent: SyncProgressEvent | null;
}

// Debounce interval in ms (emit at most every 500ms during progress)
const DEBOUNCE_INTERVAL_MS = 500;

class SyncProgressEmitter extends EventEmitter {
  private operationStates: Map<string, OperationState> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    // Allow many listeners (one per SSE connection)
    this.setMaxListeners(100);
  }

  /**
   * Create a new sync operation in the database
   */
  async createOperation(
    workspaceId: string,
    type: SyncOperationType
  ): Promise<string> {
    const { data, error } = await supabase
      .from('sync_operations')
      .insert({
        workspace_id: workspaceId,
        operation_type: type,
        status: 'pending',
        progress: 0,
        total_items: 0,
        processed_items: 0,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create sync operation', { error, workspaceId, type });
      throw error;
    }

    logger.info('Created sync operation', { operationId: data.id, workspaceId, type });
    return data.id;
  }

  /**
   * Emit a progress event (debounced for 'running' status)
   */
  emitProgress(event: Omit<SyncProgressEvent, 'timestamp'>): void {
    const fullEvent: SyncProgressEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // For start/complete/failed events, emit immediately
    if (event.status !== 'running') {
      this.emitImmediate(fullEvent);
      this.updateDatabase(fullEvent);
      return;
    }

    // For running status, debounce to avoid flooding
    const state = this.operationStates.get(event.operationId) || {
      lastEmitTime: 0,
      pendingEvent: null,
    };

    const now = Date.now();
    const timeSinceLastEmit = now - state.lastEmitTime;

    if (timeSinceLastEmit >= DEBOUNCE_INTERVAL_MS) {
      // Enough time has passed, emit immediately
      this.emitImmediate(fullEvent);
      state.lastEmitTime = now;
      state.pendingEvent = null;
    } else {
      // Store for debounced emission
      state.pendingEvent = fullEvent;

      // Set up debounce timer if not already set
      if (!this.debounceTimers.has(event.operationId)) {
        const timer = setTimeout(() => {
          const currentState = this.operationStates.get(event.operationId);
          if (currentState?.pendingEvent) {
            this.emitImmediate(currentState.pendingEvent);
            currentState.lastEmitTime = Date.now();
            currentState.pendingEvent = null;
          }
          this.debounceTimers.delete(event.operationId);
        }, DEBOUNCE_INTERVAL_MS - timeSinceLastEmit);

        this.debounceTimers.set(event.operationId, timer);
      }
    }

    this.operationStates.set(event.operationId, state);
  }

  /**
   * Emit event immediately to all listeners
   */
  private emitImmediate(event: SyncProgressEvent): void {
    this.emit('progress', event);
    logger.debug('Emitted sync progress', {
      operationId: event.operationId,
      status: event.status,
      progress: event.progress,
    });
  }

  /**
   * Update operation in database
   */
  private async updateDatabase(event: SyncProgressEvent): Promise<void> {
    try {
      const update: Record<string, unknown> = {
        status: event.status,
        progress: event.progress,
        total_items: event.totalItems,
        processed_items: event.processedItems,
        current_item: event.currentItem || null,
      };

      if (event.status === 'completed' || event.status === 'failed') {
        update.completed_at = new Date().toISOString();
        if (event.result) {
          update.result = event.result;
        }
        if (event.error) {
          update.error_message = event.error;
        }

        // Cleanup state
        this.operationStates.delete(event.operationId);
        const timer = this.debounceTimers.get(event.operationId);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(event.operationId);
        }
      }

      await supabase
        .from('sync_operations')
        .update(update)
        .eq('id', event.operationId);
    } catch (error) {
      logger.error('Failed to update sync operation', { error, operationId: event.operationId });
    }
  }

  /**
   * Get active operations for a workspace
   */
  async getActiveOperations(workspaceId: string): Promise<SyncProgressEvent[]> {
    const { data, error } = await supabase
      .from('sync_operations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get active operations', { error, workspaceId });
      return [];
    }

    return (data || []).map((op) => ({
      operationId: op.id,
      workspaceId: op.workspace_id,
      type: op.operation_type as SyncOperationType,
      status: op.status as SyncOperationStatus,
      progress: op.progress,
      totalItems: op.total_items,
      processedItems: op.processed_items,
      currentItem: op.current_item,
      result: op.result,
      error: op.error_message,
      timestamp: op.created_at,
    }));
  }

  /**
   * Get recent operations for a workspace
   */
  async getRecentOperations(workspaceId: string, limit = 10): Promise<SyncProgressEvent[]> {
    const { data, error } = await supabase
      .from('sync_operations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get recent operations', { error, workspaceId });
      return [];
    }

    return (data || []).map((op) => ({
      operationId: op.id,
      workspaceId: op.workspace_id,
      type: op.operation_type as SyncOperationType,
      status: op.status as SyncOperationStatus,
      progress: op.progress,
      totalItems: op.total_items,
      processedItems: op.processed_items,
      currentItem: op.current_item,
      result: op.result,
      error: op.error_message,
      timestamp: op.created_at,
    }));
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId: string): Promise<void> {
    await supabase
      .from('sync_operations')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', operationId);

    // Cleanup state
    this.operationStates.delete(operationId);
    const timer = this.debounceTimers.get(operationId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(operationId);
    }
  }
}

// Export singleton instance
export const syncProgressEmitter = new SyncProgressEmitter();
