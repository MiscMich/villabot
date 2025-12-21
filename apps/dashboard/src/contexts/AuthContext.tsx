'use client';

/**
 * Authentication Context for TeamBrain AI Dashboard
 * Manages user session, authentication state, and auth operations
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { UserProfile, WorkspaceWithRole } from '@teambrain/shared';

// Auth state
interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  workspaces: WorkspaceWithRole[];
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | Error | null;
}

// Auth actions
interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
}

interface SignUpOptions {
  full_name?: string;
  workspace_name?: string;
  invite_token?: string;
}

// Combined context
type AuthContextType = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  session: null,
  profile: null,
  workspaces: [],
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);
  const router = useRouter();

  // Fetch user profile and workspaces from API
  const fetchUserData = useCallback(async (accessToken: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          profile: data.profile as UserProfile,
          workspaces: data.workspaces as WorkspaceWithRole[],
        };
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    }
    return { profile: null, workspaces: [] };
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const supabase = getSupabase();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          setState(prev => ({ ...prev, isLoading: false, error }));
          return;
        }

        if (session?.user) {
          const { profile, workspaces } = await fetchUserData(session.access_token);
          setState({
            user: session.user,
            session,
            profile,
            workspaces,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error('Failed to initialize auth'),
        }));
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { profile, workspaces } = await fetchUserData(session.access_token);
        setState({
          user: session.user,
          session,
          profile,
          workspaces,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else if (event === 'SIGNED_OUT') {
        setState({
          ...initialState,
          isLoading: false,
        });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setState(prev => ({
          ...prev,
          session,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      return { error };
    }

    return { error: null };
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (
    email: string,
    password: string,
    options?: SignUpOptions
  ) => {
    const supabase = getSupabase();
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: options?.full_name,
          workspace_name: options?.workspace_name,
          invite_token: options?.invite_token,
        },
      },
    });

    if (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      return { error };
    }

    return { error: null };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  }, [router]);

  // Reset password (send reset email)
  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    const redirectTo = `${window.location.origin}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    return { error };
  }, []);

  // Update password (when logged in)
  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    return { error };
  }, []);

  // Refresh session token
  const refreshSession = useCallback(async () => {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      setState(prev => ({ ...prev, error }));
      return;
    }

    if (session) {
      setState(prev => ({ ...prev, session }));
    }
  }, []);

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// Hook to require authentication (redirects if not authenticated)
export function useRequireAuth(redirectTo = '/auth/signin') {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo]);

  return auth;
}
