import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Routes that don't require authentication
const publicRoutes = [
  '/',  // Landing page
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/callback',
  '/auth/reset-password',
  '/setup',
  '/pricing',
  '/features',
];

// Routes that bypass all checks
const skipRoutes = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/static',
];

/**
 * Check if Supabase is configured
 */
function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Middleware to handle authentication and setup status
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for these paths
  if (skipRoutes.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if this is a public route (auth pages, setup)
  const isPublicRoute = publicRoutes.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // If Supabase is not configured, skip auth checks and just check setup
  if (!isSupabaseConfigured()) {
    // Only check setup status for non-public routes
    if (!isPublicRoute) {
      return await checkSetupStatus(request);
    }
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  // Handle auth-required routes
  if (!isPublicRoute && !session) {
    // Redirect to signin with return URL
    const signinUrl = new URL('/auth/signin', request.url);
    signinUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Handle authenticated users on public pages (redirect to dashboard)
  if (isPublicRoute && session && !pathname.startsWith('/setup')) {
    // Redirect auth'd users from landing/auth pages to dashboard
    // Unless they have a specific returnTo destination
    const returnTo = request.nextUrl.searchParams.get('returnTo');
    const dashboardUrl = new URL(returnTo || '/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // For non-public routes, also check setup status
  if (!isPublicRoute && !pathname.startsWith('/setup')) {
    return await checkSetupStatus(request);
  }

  return NextResponse.next();
}

/**
 * Check if initial setup is complete
 */
async function checkSetupStatus(request: NextRequest) {
  try {
    const response = await fetch(`${API_BASE}/api/setup/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const status = await response.json();

      if (!status.completed) {
        const setupUrl = new URL('/setup', request.url);
        return NextResponse.redirect(setupUrl);
      }
    }
  } catch (error) {
    // If API is unavailable, allow through
    console.warn('Setup status check failed:', error);
  }

  return NextResponse.next();
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
