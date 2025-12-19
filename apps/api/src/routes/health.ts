import { Router, Request, Response } from 'express';
import { testSupabaseConnection } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    supabase: 'connected' | 'disconnected';
    slack: 'connected' | 'disconnected';
    gemini: 'connected' | 'disconnected';
    googleDrive: 'connected' | 'disconnected';
  };
  version: string;
}

// Track service status
let serviceStatus = {
  supabase: false,
  slack: false,
  gemini: false,
  googleDrive: false,
};

export function updateServiceStatus(service: keyof typeof serviceStatus, status: boolean): void {
  serviceStatus[service] = status;
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  const supabaseOk = await testSupabaseConnection();
  updateServiceStatus('supabase', supabaseOk);

  const allHealthy = Object.values(serviceStatus).every(Boolean);
  const anyHealthy = Object.values(serviceStatus).some(Boolean);

  const health: HealthStatus = {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      supabase: serviceStatus.supabase ? 'connected' : 'disconnected',
      slack: serviceStatus.slack ? 'connected' : 'disconnected',
      gemini: serviceStatus.gemini ? 'connected' : 'disconnected',
      googleDrive: serviceStatus.googleDrive ? 'connected' : 'disconnected',
    },
    version: process.env.npm_package_version ?? '0.1.0',
  };

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const supabaseOk = await testSupabaseConnection();

  if (supabaseOk) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not available' });
  }
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});
