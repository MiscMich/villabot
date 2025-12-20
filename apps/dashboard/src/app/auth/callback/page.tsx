'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();

        // Get the code from URL if present (for email confirmation)
        const code = searchParams.get('code');
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
          // Redirect to dashboard after a brief success message
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        } else {
          setError('No session found. Please try signing in again.');
          setStatus('error');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred. Please try again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            {status === 'loading' && (
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-slate-100">
            {status === 'loading' && 'Signing you in...'}
            {status === 'success' && 'Welcome back!'}
            {status === 'error' && 'Authentication failed'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {status === 'loading' && 'Please wait while we verify your account.'}
            {status === 'success' && 'Redirecting you to the dashboard...'}
            {status === 'error' && (error || 'Something went wrong. Please try again.')}
          </CardDescription>
        </CardHeader>

        {status === 'error' && (
          <CardContent className="flex flex-col gap-3">
            <Link href="/auth/signin">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium">
                Try signing in again
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              >
                Create a new account
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
