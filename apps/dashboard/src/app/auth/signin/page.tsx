'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Loader2, AlertCircle, Mail, Lock, CheckCircle2 } from 'lucide-react';

type SignInMode = 'password' | 'magiclink';

function MagicLinkSent({ email }: { email: string }) {
  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 shadow-lg">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Check your email
        </h1>
        <p className="text-white/60">
          We sent a sign-in link to <strong className="text-white">{email}</strong>.
          Click the link to sign in.
        </p>
      </div>

      <p className="text-sm text-white/40 text-center">
        Didn&apos;t receive the email? Check your spam folder or try again.
      </p>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<SignInMode>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const { signIn, signInWithMagicLink } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setError(error.message);
        return;
      }

      router.push(returnTo);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await signInWithMagicLink(email);

      if (error) {
        setError(error.message);
        return;
      }

      setMagicLinkSent(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return <MagicLinkSent email={email} />;
  }

  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
            <Brain className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back
        </h1>
        <p className="text-white/60">
          Sign in to your workspace
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg mb-6">
        <button
          type="button"
          onClick={() => { setMode('password'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'password'
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white/80'
            }`}
        >
          <Lock className="h-4 w-4" />
          Password
        </button>
        <button
          type="button"
          onClick={() => { setMode('magiclink'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${mode === 'magiclink'
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white/80'
            }`}
        >
          <Mail className="h-4 w-4" />
          Magic Link
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-violet-500 focus:ring-violet-500/20"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-violet-500 focus:ring-violet-500/20"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>

          <p className="text-sm text-white/60 text-center">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="magic-email" className="text-white/80">
              Email
            </Label>
            <Input
              id="magic-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-violet-500 focus:ring-violet-500/20"
            />
            <p className="text-xs text-white/40">
              We&apos;ll send you a sign-in link. No password needed.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send magic link
              </>
            )}
          </Button>

          <p className="text-sm text-white/60 text-center">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

function SignInLoading() {
  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Loading...
        </h1>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="grid-pattern fixed inset-0" />

      <Suspense fallback={<SignInLoading />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
