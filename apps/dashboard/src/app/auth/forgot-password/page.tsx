'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Brain, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

function SuccessMessage({ email }: { email: string }) {
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
          We sent a password reset link to <strong className="text-white">{email}</strong>.
          Click the link to reset your password.
        </p>
      </div>

      <Link href="/auth/signin" className="block">
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="grid-pattern fixed inset-0" />

      {success ? (
        <SuccessMessage email={email} />
      ) : (
        <div className="w-full max-w-md glass-card p-8">
          <div className="space-y-1 text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 shadow-glow-purple">
                <Brain className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Reset your password
            </h1>
            <p className="text-white/60">
              Enter your email and we&apos;ll send you a reset link
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

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-medium shadow-glow-purple"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                'Send reset link'
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
