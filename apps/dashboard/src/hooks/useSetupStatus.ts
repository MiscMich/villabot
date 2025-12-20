'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SetupStatus {
  completed: boolean;
  completedAt: string | null;
  steps: {
    database: boolean;
    ai: boolean;
    slack: boolean;
    googleDrive: boolean;
    bot: boolean;
  };
}

/**
 * Hook to check if initial setup is complete
 * Used for client-side setup status checking
 */
export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: api.getSetupStatus,
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
