'use client';

/**
 * Workspace Context for TeamBrain AI Dashboard
 * Manages current workspace, usage tracking, and workspace operations
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type {
  Workspace,
  WorkspaceMember,
  UsageSummary,
  WorkspaceWithRole,
  SubscriptionTier,
} from '@villa-paraiso/shared';
import { TIER_CONFIGS } from '@villa-paraiso/shared';

// Workspace state
interface WorkspaceState {
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
  usage: UsageSummary | null;
  isLoading: boolean;
  error: Error | null;
}

// Workspace actions
interface WorkspaceActions {
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

// Computed values
interface WorkspaceComputed {
  tier: SubscriptionTier;
  tierConfig: typeof TIER_CONFIGS.starter;
  isOwner: boolean;
  isAdmin: boolean;
  canManageTeam: boolean;
  canManageBilling: boolean;
  isTrialing: boolean;
  trialDaysRemaining: number | null;
  isApproachingLimit: (resource: 'queries' | 'documents' | 'bots') => boolean;
  isAtLimit: (resource: 'queries' | 'documents' | 'bots') => boolean;
}

// Combined context
type WorkspaceContextType = WorkspaceState & WorkspaceActions & WorkspaceComputed;

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_STORAGE_KEY = 'teambrain_current_workspace';

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { session, workspaces, isAuthenticated, profile } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    membership: null,
    usage: null,
    isLoading: true,
    error: null,
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Get access token for API calls
  const getAccessToken = useCallback(() => {
    return session?.access_token;
  }, [session]);

  // Fetch workspace details and usage
  const fetchWorkspaceData = useCallback(async (workspaceId: string) => {
    const accessToken = getAccessToken();
    if (!accessToken) return null;

    try {
      const [workspaceRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/api/workspaces/${workspaceId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${API_BASE}/api/workspaces/${workspaceId}/usage`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!workspaceRes.ok) {
        throw new Error('Failed to fetch workspace');
      }

      const workspaceData = await workspaceRes.json();
      const usageData = usageRes.ok ? await usageRes.json() : null;

      return {
        workspace: workspaceData.workspace as Workspace,
        membership: workspaceData.membership as WorkspaceMember,
        usage: usageData?.usage as UsageSummary | null,
      };
    } catch (error) {
      console.error('Failed to fetch workspace data:', error);
      return null;
    }
  }, [API_BASE, getAccessToken]);

  // Initialize workspace on auth change
  useEffect(() => {
    if (!isAuthenticated || workspaces.length === 0) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const initializeWorkspace = async () => {
      // Try to restore saved workspace
      const savedWorkspaceId = typeof window !== 'undefined'
        ? localStorage.getItem(WORKSPACE_STORAGE_KEY)
        : null;

      // Find workspace to use: saved > default > first
      let targetWorkspace: WorkspaceWithRole | undefined;

      if (savedWorkspaceId) {
        targetWorkspace = workspaces.find(w => w.workspace.id === savedWorkspaceId);
      }

      if (!targetWorkspace && profile?.default_workspace_id) {
        targetWorkspace = workspaces.find(w => w.workspace.id === profile.default_workspace_id);
      }

      if (!targetWorkspace) {
        targetWorkspace = workspaces[0];
      }

      if (!targetWorkspace) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const data = await fetchWorkspaceData(targetWorkspace.workspace.id);

      if (data) {
        setState({
          workspace: data.workspace,
          membership: data.membership,
          usage: data.usage,
          isLoading: false,
          error: null,
        });

        // Save selection
        if (typeof window !== 'undefined') {
          localStorage.setItem(WORKSPACE_STORAGE_KEY, data.workspace.id);
        }
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: new Error('Failed to load workspace'),
        }));
      }
    };

    initializeWorkspace();
  }, [isAuthenticated, workspaces, profile, fetchWorkspaceData]);

  // Switch to a different workspace
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const data = await fetchWorkspaceData(workspaceId);

    if (data) {
      setState({
        workspace: data.workspace,
        membership: data.membership,
        usage: data.usage,
        isLoading: false,
        error: null,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      }
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error('Failed to switch workspace'),
      }));
    }
  }, [fetchWorkspaceData]);

  // Refresh usage data
  const refreshUsage = useCallback(async () => {
    if (!state.workspace) return;

    const accessToken = getAccessToken();
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_BASE}/api/workspaces/${state.workspace.id}/usage`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          usage: data.usage,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh usage:', error);
    }
  }, [state.workspace, API_BASE, getAccessToken]);

  // Refresh workspace data
  const refreshWorkspace = useCallback(async () => {
    if (!state.workspace) return;

    const data = await fetchWorkspaceData(state.workspace.id);
    if (data) {
      setState(prev => ({
        ...prev,
        workspace: data.workspace,
        membership: data.membership,
        usage: data.usage,
      }));
    }
  }, [state.workspace, fetchWorkspaceData]);

  // Computed values
  const tier = state.workspace?.tier ?? 'starter';
  const tierConfig = TIER_CONFIGS[tier];

  const isOwner = state.membership?.role === 'owner';
  const isAdmin = state.membership?.role === 'owner' || state.membership?.role === 'admin';
  const canManageTeam = isAdmin;
  const canManageBilling = isOwner;

  const isTrialing = state.workspace?.status === 'trialing';
  const trialDaysRemaining = (() => {
    if (!isTrialing || !state.workspace?.trial_ends_at) return null;
    const trialEnd = new Date(state.workspace.trial_ends_at);
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  })();

  const isApproachingLimit = useCallback((resource: 'queries' | 'documents' | 'bots') => {
    if (!state.usage) return false;

    switch (resource) {
      case 'queries':
        return state.usage.queries_percent >= 80;
      case 'documents':
        return state.usage.documents_percent >= 80;
      case 'bots':
        return (state.usage.bots_used / state.usage.bots_limit) >= 0.8;
      default:
        return false;
    }
  }, [state.usage]);

  const isAtLimit = useCallback((resource: 'queries' | 'documents' | 'bots') => {
    if (!state.usage) return false;

    switch (resource) {
      case 'queries':
        return state.usage.queries_percent >= 100;
      case 'documents':
        return state.usage.documents_percent >= 100;
      case 'bots':
        return state.usage.bots_used >= state.usage.bots_limit;
      default:
        return false;
    }
  }, [state.usage]);

  const value: WorkspaceContextType = {
    ...state,
    switchWorkspace,
    refreshUsage,
    refreshWorkspace,
    tier,
    tierConfig,
    isOwner,
    isAdmin,
    canManageTeam,
    canManageBilling,
    isTrialing,
    trialDaysRemaining,
    isApproachingLimit,
    isAtLimit,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// Hook to use workspace context
export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }

  return context;
}

// Hook to get current workspace ID (for API calls)
export function useWorkspaceId(): string | null {
  const { workspace } = useWorkspace();
  return workspace?.id ?? null;
}
