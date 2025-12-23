'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { Bot, Loader2 } from 'lucide-react';

interface SetupGuardProps {
  children: React.ReactNode;
}

// Public routes that should skip setup guard
// NOTE: /setup is NOT here because authenticated users who haven't completed
// setup should be redirected TO /setup, not away from it
const PUBLIC_ROUTES = [
  '/',           // Landing page
  '/auth',       // All auth pages
  '/pricing',    // Pricing page
  '/features',   // Features page
];

// Check if running in E2E test mode (bypass setup for testing)
function isE2ETestMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for E2E test cookie
  const hasTestCookie = document.cookie.includes('e2e_bypass_setup=true');

  // Check for URL parameter (for initial setup)
  const urlParams = new URLSearchParams(window.location.search);
  const hasTestParam = urlParams.get('e2e_test') === 'true';

  // Set cookie if URL param is present (persists across navigation)
  if (hasTestParam && !hasTestCookie) {
    document.cookie = 'e2e_bypass_setup=true; path=/; max-age=3600'; // 1 hour
  }

  return hasTestCookie || hasTestParam;
}

// Maximum time to wait for setup status before showing children anyway
// Keep short for better UX - 3 seconds for E2E testing
const MAX_LOADING_TIME_MS = 3000; // 3 seconds

/**
 * Check if a pathname is a public route that should skip setup guard
 */
function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Client-side guard that redirects to setup wizard if setup is not complete
 * Acts as a fallback for middleware (e.g., when API was unavailable during SSR)
 */
export function SetupGuard({ children }: SetupGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: status, isLoading, error } = useSetupStatus();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  // Timeout for loading state - show children if loading takes too long
  // Start timeout immediately on mount, not dependent on isLoading changes
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn('Setup status check timed out, showing dashboard anyway');
      setLoadingTimedOut(true);
    }, MAX_LOADING_TIME_MS);

    return () => clearTimeout(timer);
  }, []); // Empty deps - only run on mount

  useEffect(() => {
    // Don't redirect if we're already on setup page
    if (pathname?.startsWith('/setup')) {
      return;
    }

    // Don't redirect if this is a public route (landing page, auth pages, etc.)
    if (isPublicRoute(pathname)) {
      return;
    }

    // Don't redirect in E2E test mode (bypass setup for testing)
    if (isE2ETestMode()) {
      console.log('E2E test mode detected - bypassing setup guard');
      return;
    }

    // If setup is not complete, redirect to setup wizard
    if (status && !status.completed) {
      router.push('/setup');
    }
  }, [status, pathname, router]);

  // For public routes, skip loading state and show children immediately
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // If timeout fired, show children immediately (API might be unavailable)
  if (loadingTimedOut) {
    // Log to help debug E2E tests
    if (typeof window !== 'undefined') {
      console.warn('SetupGuard timeout - showing children without API check');
    }
    return <>{children}</>;
  }

  // Show loading state while checking setup status
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If there's an error checking status, show the children anyway
  // (better UX than blocking, and API might just be slow)
  if (error) {
    console.warn('Setup status check failed:', error);
  }

  // If setup not complete and not on setup page, middleware should have redirected
  // But show loading while client-side redirect happens (skip in E2E test mode)
  if (status && !status.completed && !pathname?.startsWith('/setup') && !isE2ETestMode()) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
