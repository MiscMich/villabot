'use client';

import { usePathname } from 'next/navigation';
import { Sidebar, MobileSidebarProvider, MobileMenuButton } from '@/components/sidebar';
import { SetupGuard } from '@/components/setup-guard';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

// Public routes that should NOT have the dashboard layout (sidebar, etc.)
const PUBLIC_ROUTES = [
  '/',           // Landing page
  '/auth',       // All auth pages
  '/pricing',    // Pricing page
  '/features',   // Features page
  '/setup',      // Setup wizard (full-page experience)
];

/**
 * Check if a pathname is a public route that should skip dashboard layout
 */
function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Conditional layout that shows dashboard layout (sidebar) for protected routes
 * and just renders children directly for public routes (landing page, auth pages)
 */
export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Public routes: render children directly without sidebar or setup guard
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // Protected routes: wrap with setup guard and dashboard layout
  return (
    <SetupGuard>
      <MobileSidebarProvider>
        <div className="flex h-screen bg-background">
          <MobileMenuButton />
          <Sidebar />
          <main className="flex-1 overflow-y-auto md:ml-0">
            <div className="relative min-h-full">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/20 via-background to-background dark:from-amber-900/10 pointer-events-none" />

              {/* Content */}
              <div className="relative px-4 py-16 md:px-8 md:py-8 max-w-7xl mx-auto">
                {children}
              </div>
            </div>
          </main>
        </div>
      </MobileSidebarProvider>
    </SetupGuard>
  );
}
