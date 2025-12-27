'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mb-6 text-center text-gray-600">
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p className="mb-4 text-center text-xs text-gray-400">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="w-full rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90"
              >
                Try again
              </button>
              <a
                href="/"
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-50"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
