'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BotsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Bots error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-display font-bold mb-2">Bots Error</h2>
        <p className="text-muted-foreground mb-6">
          {error.message || 'Failed to load bots. Please try again.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="default" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/bots">
              <Home className="h-4 w-4 mr-2" />
              Refresh
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
