'use client';

/**
 * SyncStatusPanel Component
 * Combined panel showing sync status, progress, and controls
 */

import { cn } from '@/lib/utils';
import { SyncStatusBadge } from './SyncStatusBadge';
import { SyncProgressBar, SyncProgressIndeterminate } from './SyncProgressBar';
import { RefreshCw, XCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SyncProgressEvent, SyncOperationType } from '@/lib/sync-events';

export interface SyncStatusPanelProps {
  /** Title for the panel (e.g., "Google Drive", "Website") */
  title: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Current sync operation (null if idle) */
  operation: SyncProgressEvent | null;
  /** Last successful sync timestamp */
  lastSynced?: string | null;
  /** Whether sync is currently loading (for manual triggers) */
  isLoading?: boolean;
  /** Callback when sync button is clicked */
  onSync?: () => void;
  /** Callback when cancel button is clicked */
  onCancel?: () => void;
  /** Whether to show the sync/cancel buttons */
  showControls?: boolean;
  /** Sync button label */
  syncLabel?: string;
  /** Additional class names */
  className?: string;
  /** Variant style */
  variant?: 'default' | 'compact' | 'card';
}

export function SyncStatusPanel({
  title,
  icon,
  operation,
  lastSynced,
  isLoading = false,
  onSync,
  onCancel,
  showControls = true,
  syncLabel = 'Sync Now',
  className,
  variant = 'default',
}: SyncStatusPanelProps) {
  const isActive = operation?.status === 'running' || operation?.status === 'pending';
  const isSyncing = isActive || isLoading;

  // Determine effective status
  const effectiveStatus = operation?.status || 'idle';

  // Wrapper styles based on variant
  const variantStyles = {
    default: '',
    compact: '',
    card: 'p-4 rounded-lg border bg-card',
  };

  return (
    <div className={cn('space-y-3', variantStyles[variant], className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h4 className="font-medium text-sm">{title}</h4>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge
            status={effectiveStatus}
            progress={operation?.progress}
            lastSynced={!isActive ? lastSynced : undefined}
            size={variant === 'compact' ? 'sm' : 'md'}
          />

          {showControls && (
            <>
              {isSyncing && onCancel ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="h-7 px-2 text-muted-foreground hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              ) : (
                onSync && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSync}
                    disabled={isSyncing}
                    className="h-7 px-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
                    <span className="sr-only">{syncLabel}</span>
                  </Button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress section - only show when active */}
      {isActive && operation && (
        <SyncProgressBar
          progress={operation.progress}
          totalItems={operation.totalItems}
          processedItems={operation.processedItems}
          currentItem={operation.currentItem}
          showDetails={variant !== 'compact'}
          variant={variant === 'compact' ? 'compact' : 'default'}
        />
      )}

      {/* Loading state with indeterminate progress */}
      {isLoading && !isActive && (
        <SyncProgressIndeterminate label="Starting sync..." />
      )}

      {/* Last sync details (when idle and not compact) */}
      {!isActive && !isLoading && variant !== 'compact' && lastSynced && (
        <SyncStatusDetails lastSynced={lastSynced} />
      )}
    </div>
  );
}

/**
 * Additional details about last sync
 */
function SyncStatusDetails({ lastSynced }: { lastSynced: string }) {
  const date = new Date(lastSynced);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>
        Last synced: {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

/**
 * Compact inline sync status indicator
 */
export function SyncStatusInline({
  operation,
  lastSynced,
  isLoading,
  onSync,
  className,
}: {
  operation: SyncProgressEvent | null;
  lastSynced?: string | null;
  isLoading?: boolean;
  onSync?: () => void;
  className?: string;
}) {
  const isActive = operation?.status === 'running' || operation?.status === 'pending';
  const isSyncing = isActive || isLoading;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <SyncStatusBadge
        status={operation?.status || 'idle'}
        progress={operation?.progress}
        lastSynced={!isActive ? lastSynced : undefined}
        size="sm"
      />

      {onSync && !isSyncing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSync}
          className="h-6 px-1.5"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * Recent sync operations list
 */
export function RecentSyncOperations({
  operations,
  className,
}: {
  operations: SyncProgressEvent[];
  className?: string;
}) {
  if (operations.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground py-4 text-center', className)}>
        No recent sync operations
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {operations.map((op) => (
        <RecentOperationItem key={op.operationId} operation={op} />
      ))}
    </div>
  );
}

function RecentOperationItem({ operation }: { operation: SyncProgressEvent }) {
  const typeLabels: Record<SyncOperationType, string> = {
    drive_sync: 'Drive Sync',
    drive_full_sync: 'Full Drive Sync',
    website_scrape: 'Website Scrape',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <AlertCircle className="h-4 w-4 text-red-500" />,
    cancelled: <XCircle className="h-4 w-4 text-slate-400" />,
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        {statusIcons[operation.status] || <Clock className="h-4 w-4 text-slate-400" />}
        <span className="text-sm font-medium">{typeLabels[operation.type]}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {operation.result && (
          <span>
            {operation.result.added > 0 && `+${operation.result.added}`}
            {operation.result.updated > 0 && ` ~${operation.result.updated}`}
            {operation.result.removed > 0 && ` -${operation.result.removed}`}
          </span>
        )}
        <span>{formatTimeAgo(operation.timestamp)}</span>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}
