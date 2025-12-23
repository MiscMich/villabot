'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Workspace storage key (synced with WorkspaceContext and api.ts)
const WORKSPACE_STORAGE_KEY = 'cluebase_current_workspace';

export interface SetupStatus {
  completed: boolean;
  completedAt: string | null;
  steps: {
    workspace: boolean;
    slack: boolean;
    googleDrive: boolean;
    bot: boolean;
  };
}

/**
 * Get current workspace ID from localStorage
 */
function getCurrentWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

/**
 * Hook to check if initial setup is complete
 * Uses current workspace context to check setup status
 */
export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: () => {
      const workspaceId = getCurrentWorkspaceId();
      return api.getSetupStatus(workspaceId ?? undefined);
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Calculate setup progress percentage
 */
export function getSetupProgress(status: SetupStatus | undefined): number {
  if (!status) return 0;
  const steps = status.steps;
  const completedSteps = Object.values(steps).filter(Boolean).length;
  const totalSteps = Object.keys(steps).length;
  return Math.round((completedSteps / totalSteps) * 100);
}
