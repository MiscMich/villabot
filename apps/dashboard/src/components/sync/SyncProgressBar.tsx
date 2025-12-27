'use client';

/**
 * SyncProgressBar Component
 * Animated progress bar with current item display
 */

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface SyncProgressBarProps {
  progress: number;
  totalItems?: number;
  processedItems?: number;
  currentItem?: string;
  className?: string;
  showDetails?: boolean;
  variant?: 'default' | 'compact';
}

export function SyncProgressBar({
  progress,
  totalItems,
  processedItems,
  currentItem,
  className,
  showDetails = true,
  variant = 'default',
}: SyncProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const isCompact = variant === 'compact';

  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar container */}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800',
          isCompact ? 'h-1.5' : 'h-2'
        )}
      >
        <motion.div
          className={cn(
            'h-full rounded-full',
            'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{
            duration: 0.5,
            ease: 'easeOut',
          }}
        />
      </div>

      {/* Details section */}
      {showDetails && !isCompact && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {currentItem && (
              <span className="truncate">
                Processing: {truncateFileName(currentItem)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {typeof processedItems === 'number' && typeof totalItems === 'number' && (
              <span>
                {processedItems} of {totalItems} items
              </span>
            )}
            <span className="font-medium tabular-nums">{clampedProgress}%</span>
          </div>
        </div>
      )}

      {/* Compact variant details */}
      {showDetails && isCompact && (
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate max-w-[180px]">
            {currentItem ? truncateFileName(currentItem) : 'Syncing...'}
          </span>
          <span className="font-medium tabular-nums">{clampedProgress}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Truncate filename for display
 */
function truncateFileName(filename: string, maxLength = 30): string {
  if (filename.length <= maxLength) return filename;

  const extension = filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.'))
    : '';
  const name = filename.slice(0, filename.length - extension.length);

  const truncatedName = name.slice(0, maxLength - extension.length - 3);
  return `${truncatedName}...${extension}`;
}

/**
 * Indeterminate progress bar for unknown duration operations
 */
export function SyncProgressIndeterminate({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <div className="w-full h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          animate={{
            x: ['-100%', '400%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
      {label && (
        <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      )}
    </div>
  );
}
