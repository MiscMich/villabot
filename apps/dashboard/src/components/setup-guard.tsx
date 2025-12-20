'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { Bot, Loader2 } from 'lucide-react';

interface SetupGuardProps {
  children: React.ReactNode;
}

// Public routes that should skip setup guard
const PUBLIC_ROUTES = [
  '/',           // Landing page
  '/auth',       // All auth pages
  '/pricing',    // Pricing page
  '/features',   // Features page
];

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

  useEffect(() => {
    // Don't redirect if we're already on setup page
    if (pathname?.startsWith('/setup')) {
      return;
    }

    // Don't redirect if this is a public route (landing page, auth pages, etc.)
    if (isPublicRoute(pathname)) {
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
  // But show loading while client-side redirect happens
  if (status && !status.completed && !pathname?.startsWith('/setup')) {
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
