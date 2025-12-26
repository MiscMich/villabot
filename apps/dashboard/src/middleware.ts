import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Use internal API URL for server-side calls (runtime), fallback to public URL (build-time)
const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Routes that don't require authentication
const publicRoutes = [
  '/',  // Landing page
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/callback',
  '/auth/reset-password',
  // NOTE: /setup is NOT public - users must be authenticated to complete setup
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
  if (!isPublicRoute && !pathname.startsWith('/setup') && session) {
    // Get user's default workspace ID from their profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('default_workspace_id')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('[Middleware] Failed to get user profile:', profileError.message, 'userId:', session.user.id);
    }

    const workspaceId = profile?.default_workspace_id;
    console.log('[Middleware] Setup check:', { userId: session.user.id, workspaceId, hasProfile: !!profile });
    // Pass access token for API authentication
    return await checkSetupStatus(request, workspaceId, session.access_token);
  }

  return NextResponse.next();
}

/**
 * Check if this is an E2E test (bypass setup checks for testing)
 * SECURITY: Only allow in non-production environments to prevent bypass attacks
 */
function isE2ETestMode(request: NextRequest): boolean {
  // CRITICAL: Never allow E2E bypass in production
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Check for E2E bypass cookie (development/test only)
  const bypassCookie = request.cookies.get('e2e_bypass_setup');
  if (bypassCookie?.value === 'true') {
    return true;
  }

  // Check for URL parameter (development/test only)
  const e2eParam = request.nextUrl.searchParams.get('e2e_test');
  return e2eParam === 'true';
}

/**
 * Check if initial setup is complete
 */
async function checkSetupStatus(request: NextRequest, workspaceId?: string, accessToken?: string) {
  // Bypass setup check in E2E test mode
  if (isE2ETestMode(request)) {
    console.log('E2E test mode - bypassing setup check in middleware');
    return NextResponse.next();
  }

  try {
    // Include workspace ID in the request if available
    const url = workspaceId
      ? `${API_BASE}/api/setup/status?workspaceId=${encodeURIComponent(workspaceId)}`
      : `${API_BASE}/api/setup/status`;

    console.log('[Middleware] Checking setup status:', { url, workspaceId, API_BASE, hasToken: !!accessToken });

    // Build headers with optional auth token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const status = await response.json();
      console.log('[Middleware] Setup status response:', status);

      if (!status.completed) {
        console.log('[Middleware] Setup not complete, redirecting to /setup');
        const setupUrl = new URL('/setup', request.url);
        return NextResponse.redirect(setupUrl);
      }
    } else {
      console.error('[Middleware] Setup status check failed:', response.status, response.statusText);
    }
  } catch (error) {
    // If API is unavailable, allow through
    console.warn('[Middleware] Setup status check error:', error);
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
