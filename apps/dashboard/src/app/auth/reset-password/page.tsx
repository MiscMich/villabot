'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

function SuccessMessage() {
  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 shadow-lg">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Password updated!
        </h1>
        <p className="text-white/60">
          Your password has been successfully reset. You can now sign in with your new password.
        </p>
      </div>

      <Link href="/auth/signin" className="block">
        <Button
          className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
        >
          Sign in
        </Button>
      </Link>
    </div>
  );
}

function InvalidLinkMessage() {
  return (
    <div className="w-full max-w-md glass-card p-8">
      <div className="space-y-1 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 shadow-lg">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Invalid or expired link
        </h1>
        <p className="text-white/60">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
      </div>

      <Link href="/auth/forgot-password" className="block">
        <Button
          className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
        >
          Request new link
        </Button>
      </Link>

      <Link href="/auth/signin" className="block mt-3">
        <Button
          variant="outline"
          className="w-full border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign in
        </Button>
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);

  const { updatePassword } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check if we have the recovery tokens in the URL hash
    // Supabase includes: #access_token=xxx&refresh_token=xxx&type=recovery
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsValidLink(true);
    } else if (hash && hash.includes('error')) {
      setIsValidLink(false);
    } else {
      // If no hash, check if user is in a recovery session
      // The Supabase client will handle the session automatically
      setIsValidLink(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);

      if (error) {
        // Handle specific error cases
        if (error.message.includes('session') || error.message.includes('expired')) {
          setIsValidLink(false);
          return;
        }
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking link validity
  if (isValidLink === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div className="mesh-gradient" />
        <div className="grid-pattern fixed inset-0" />
        <div className="glass-card p-8">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto" />
          <p className="text-white/60 mt-4">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="grid-pattern fixed inset-0" />

      {!isValidLink ? (
        <InvalidLinkMessage />
      ) : success ? (
        <SuccessMessage />
      ) : (
        <div className="w-full max-w-md glass-card p-8">
          <div className="space-y-1 text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
                <Brain className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Set new password
            </h1>
            <p className="text-white/60">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-violet-500 focus:ring-violet-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-white/40">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/80">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-violet-500 focus:ring-violet-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                'Update password'
              )}
            </Button>

            <Link href="/auth/signin" className="block">
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/10 text-white/80 hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign in
              </Button>
            </Link>
          </form>
        </div>
      )}
    </div>
  );
}
