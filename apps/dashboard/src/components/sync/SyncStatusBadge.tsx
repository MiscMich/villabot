'use client';

/**
 * SyncStatusBadge Component
 * Visual indicator showing sync operation status
 * States: idle, syncing, success, error
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2, Check, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyncOperationStatus } from '@/lib/sync-events';

const syncBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200',
  {
    variants: {
      status: {
        idle: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-xs px-2.5 py-1',
        lg: 'text-sm px-3 py-1.5',
      },
    },
    defaultVariants: {
      status: 'idle',
      size: 'md',
    },
  }
);

const statusIcons: Record<SyncOperationStatus | 'idle', React.ReactNode> = {
  idle: <Clock className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  running: <Loader2 className="h-3 w-3 animate-spin" />,
  completed: <Check className="h-3 w-3" />,
  failed: <AlertCircle className="h-3 w-3" />,
  cancelled: <RefreshCw className="h-3 w-3" />,
};

const statusLabels: Record<SyncOperationStatus | 'idle', string> = {
  idle: 'Idle',
  pending: 'Pending',
  running: 'Syncing',
  completed: 'Synced',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export interface SyncStatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof syncBadgeVariants> {
  status: SyncOperationStatus | 'idle';
  progress?: number;
  showLabel?: boolean;
  lastSynced?: string | null;
}

export function SyncStatusBadge({
  status,
  progress,
  showLabel = true,
  lastSynced,
  size,
  className,
  ...props
}: SyncStatusBadgeProps) {
  const displayLabel = status === 'running' && typeof progress === 'number'
    ? `${progress}%`
    : statusLabels[status];

  const timeAgo = lastSynced ? formatTimeAgo(lastSynced) : null;

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <div className={cn(syncBadgeVariants({ status, size }))}>
        {statusIcons[status]}
        {showLabel && <span>{displayLabel}</span>}
      </div>
      {status === 'idle' && timeAgo && (
        <span className="text-xs text-muted-foreground">
          {timeAgo}
        </span>
      )}
    </div>
  );
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export { syncBadgeVariants };
