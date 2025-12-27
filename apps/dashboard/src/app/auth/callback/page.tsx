'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function AuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();

        // Get the code from URL if present (for email confirmation)
        const code = searchParams.get('code');
        const type = searchParams.get('type');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle error from OAuth provider
        if (errorParam) {
          setError(errorDescription || errorParam);
          setStatus('error');
          return;
        }

        // Exchange code for session
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            setError(error.message);
            setStatus('error');
            return;
          }
        }

        // Check if we have a session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setStatus('success');

          // Handle password recovery flow - redirect to reset password page
          if (type === 'recovery') {
            setIsRecovery(true);
            setTimeout(() => {
              router.push('/auth/reset-password');
            }, 1000);
            return;
          }

          // Redirect to dashboard after a brief success message
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        } else {
          setError('No session found. Please try signing in again.');
          setStatus('error');
        }
      } catch {
        setError('An unexpected error occurred. Please try again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          {status === 'loading' && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 shadow-lg">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 shadow-lg">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {status === 'loading' && 'Signing you in...'}
          {status === 'success' && (isRecovery ? 'Link verified!' : 'Welcome back!')}
          {status === 'error' && 'Authentication failed'}
        </h1>
        <p className="text-white/60">
          {status === 'loading' && 'Please wait while we verify your account.'}
          {status === 'success' && (isRecovery ? 'Redirecting to reset your password...' : 'Redirecting you to the dashboard...')}
          {status === 'error' && (error || 'Something went wrong. Please try again.')}
        </p>
      </div>

      {status === 'error' && (
        <div className="flex flex-col gap-3">
          <Link href="/auth/signin">
            <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple">
              Try signing in again
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button
              variant="outline"
              className="w-full border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
            >
              Create a new account
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function AuthCallbackLoading() {
  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Signing you in...
        </h1>
        <p className="text-white/60">
          Please wait while we verify your account.
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="grid-pattern fixed inset-0" />

      <Suspense fallback={<AuthCallbackLoading />}>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}
