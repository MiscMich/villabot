'use client';

/**
 * useSyncToast Hook
 * Provides sync-specific toast notifications using the existing toast infrastructure
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { SyncProgressEvent, SyncOperationType } from '@/lib/sync-events';

const operationNames: Record<SyncOperationType, string> = {
  drive_sync: 'Google Drive',
  drive_full_sync: 'Google Drive',
  website_scrape: 'Website',
};

interface UseSyncToastOptions {
  /** Show toast when sync starts */
  showOnStart?: boolean;
  /** Show toast when sync completes */
  showOnComplete?: boolean;
  /** Show toast when sync fails */
  showOnError?: boolean;
  /** Auto-dismiss success toasts after this duration (ms) */
  successDuration?: number;
}

const defaultOptions: UseSyncToastOptions = {
  showOnStart: true,
  showOnComplete: true,
  showOnError: true,
  successDuration: 5000,
};

export function useSyncToast(options: UseSyncToastOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  const activeToasts = useRef<Map<string, { id: string; dismiss: () => void }>>(new Map());

  // Show start toast
  const showStartToast = useCallback((event: SyncProgressEvent) => {
    if (!opts.showOnStart) return;

    const operationName = operationNames[event.type];
    const { id, dismiss } = toast({
      title: `Syncing ${operationName}...`,
      description: event.totalItems
        ? `Processing ${event.totalItems} items`
        : 'Starting sync operation',
    });

    activeToasts.current.set(event.operationId, { id, dismiss });
  }, [opts.showOnStart]);

  // Show completion toast
  const showCompleteToast = useCallback((event: SyncProgressEvent) => {
    if (!opts.showOnComplete) return;

    // Dismiss the progress toast if exists
    const existing = activeToasts.current.get(event.operationId);
    if (existing) {
      existing.dismiss();
      activeToasts.current.delete(event.operationId);
    }

    const operationName = operationNames[event.type];
    const result = event.result;

    let description = 'Sync completed successfully';
    if (result) {
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} added`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.removed > 0) parts.push(`${result.removed} removed`);
      if (parts.length > 0) description = parts.join(', ');
    }

    toast({
      variant: 'success',
      title: `${operationName} synced`,
      description,
      duration: opts.successDuration,
    });
  }, [opts.showOnComplete, opts.successDuration]);

  // Show error toast
  const showErrorToast = useCallback((event: SyncProgressEvent) => {
    if (!opts.showOnError) return;

    // Dismiss the progress toast if exists
    const existing = activeToasts.current.get(event.operationId);
    if (existing) {
      existing.dismiss();
      activeToasts.current.delete(event.operationId);
    }

    const operationName = operationNames[event.type];

    toast({
      variant: 'destructive',
      title: `${operationName} sync failed`,
      description: event.error || 'An error occurred during sync',
    });
  }, [opts.showOnError]);

  // Handle sync event
  const handleSyncEvent = useCallback((event: SyncProgressEvent) => {
    switch (event.status) {
      case 'running':
        // Only show start toast if this is the first event for this operation
        if (!activeToasts.current.has(event.operationId) && event.progress === 0) {
          showStartToast(event);
        }
        break;
      case 'completed':
        showCompleteToast(event);
        break;
      case 'failed':
        showErrorToast(event);
        break;
      case 'cancelled': {
        // Dismiss the progress toast if exists
        const existing = activeToasts.current.get(event.operationId);
        if (existing) {
          existing.dismiss();
          activeToasts.current.delete(event.operationId);
        }
        toast({
          title: `${operationNames[event.type]} sync cancelled`,
          description: 'The operation was cancelled',
        });
        break;
      }
    }
  }, [showStartToast, showCompleteToast, showErrorToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeToasts.current.forEach(({ dismiss }) => dismiss());
      activeToasts.current.clear();
    };
  }, []);

  return {
    handleSyncEvent,
    showStartToast,
    showCompleteToast,
    showErrorToast,
  };
}

/**
 * Standalone toast functions for sync operations
 */
export const syncToast = {
  start: (type: SyncOperationType, totalItems?: number) => {
    const operationName = operationNames[type];
    return toast({
      title: `Syncing ${operationName}...`,
      description: totalItems
        ? `Processing ${totalItems} items`
        : 'Starting sync operation',
    });
  },

  complete: (type: SyncOperationType, result?: SyncProgressEvent['result']) => {
    const operationName = operationNames[type];
    let description = 'Sync completed successfully';

    if (result) {
      const parts: string[] = [];
      if (result.added > 0) parts.push(`${result.added} added`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.removed > 0) parts.push(`${result.removed} removed`);
      if (parts.length > 0) description = parts.join(', ');
    }

    return toast({
      variant: 'success',
      title: `${operationName} synced`,
      description,
    });
  },

  error: (type: SyncOperationType, error?: string) => {
    const operationName = operationNames[type];
    return toast({
      variant: 'destructive',
      title: `${operationName} sync failed`,
      description: error || 'An error occurred during sync',
    });
  },

  cancelled: (type: SyncOperationType) => {
    const operationName = operationNames[type];
    return toast({
      title: `${operationName} sync cancelled`,
      description: 'The operation was cancelled',
    });
  },
};
