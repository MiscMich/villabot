/**
 * Sync API routes
 * Real-time progress tracking for sync operations via SSE
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import {
  authenticate,
  resolveWorkspace,
  generalApiRateLimiter,
} from '../middleware/index.js';
import {
  syncProgressEmitter,
  type SyncProgressEvent,
} from '../services/sync/index.js';
import { supabase } from '../services/supabase/client.js';

export const syncRouter = Router();

/**
 * SSE-compatible authentication middleware
 * Supports both Authorization header and query parameter token
 * (EventSource API doesn't support custom headers)
 */
async function authenticateSSE(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try header first, then query param
    let token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;

    if (!token) {
      token = req.query.token as string | undefined ?? null;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Get user's workspace membership
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      res.status(403).json({ error: 'No workspace access' });
      return;
    }

    // Attach workspace info to request
    req.workspace = { id: membership.workspace_id } as typeof req.workspace;
    req.user = { id: user.id, email: user.email } as typeof req.user;

    next();
  } catch (error) {
    logger.error('SSE auth error', { error });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * SSE endpoint for real-time sync progress updates
 * Clients connect and receive progress events for their workspace
 * Uses custom auth to support query param token for EventSource compatibility
 */
syncRouter.get('/events', authenticateSSE, (req: Request, res: Response) => {
  const workspaceId = req.workspace!.id;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ workspaceId, timestamp: new Date().toISOString() })}\n\n`);

  logger.info('SSE client connected', { workspaceId });

  // Listen for progress events
  const onProgress = (event: SyncProgressEvent) => {
    if (event.workspaceId === workspaceId) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  };

  syncProgressEmitter.on('progress', onProgress);

  // Heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    logger.info('SSE client disconnected', { workspaceId });
    syncProgressEmitter.off('progress', onProgress);
    clearInterval(heartbeat);
  });
});

// Apply standard authentication to non-SSE routes
syncRouter.use('/operations', authenticate, resolveWorkspace);

/**
 * Get active sync operations for the workspace
 */
syncRouter.get('/operations', generalApiRateLimiter, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const operations = await syncProgressEmitter.getActiveOperations(workspaceId);

    res.json({ operations });
  } catch (error) {
    logger.error('Failed to get active operations', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get active operations' });
  }
});

/**
 * Get recent sync operations for the workspace
 */
syncRouter.get('/operations/recent', generalApiRateLimiter, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const operations = await syncProgressEmitter.getRecentOperations(workspaceId, limit);

    res.json({ operations });
  } catch (error) {
    logger.error('Failed to get recent operations', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get recent operations' });
  }
});

/**
 * Get a specific sync operation
 */
syncRouter.get('/operations/:operationId', generalApiRateLimiter, async (req: Request, res: Response) => {
  try {
    const { operationId } = req.params;
    const workspaceId = req.workspace!.id;

    // Get from recent operations and filter by ID
    const operations = await syncProgressEmitter.getRecentOperations(workspaceId, 100);
    const operation = operations.find(op => op.operationId === operationId);

    if (!operation) {
      return res.status(404).json({ error: 'Operation not found' });
    }

    res.json(operation);
  } catch (error) {
    logger.error('Failed to get operation', { error, operationId: req.params.operationId });
    res.status(500).json({ error: 'Failed to get operation' });
  }
});

/**
 * Cancel a sync operation
 */
syncRouter.post('/operations/:operationId/cancel', generalApiRateLimiter, async (req: Request, res: Response) => {
  try {
    const operationId = req.params.operationId as string;
    const workspaceId = req.workspace!.id;

    // Verify operation belongs to workspace
    const operations = await syncProgressEmitter.getActiveOperations(workspaceId);
    const operation = operations.find(op => op.operationId === operationId);

    if (!operation) {
      return res.status(404).json({ error: 'Operation not found or already completed' });
    }

    await syncProgressEmitter.cancelOperation(operation.operationId);

    // Emit cancellation event
    syncProgressEmitter.emitProgress({
      operationId: operation.operationId,
      workspaceId,
      type: operation.type,
      status: 'cancelled',
      progress: operation.progress,
      totalItems: operation.totalItems,
      processedItems: operation.processedItems,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to cancel operation', { error, operationId: req.params.operationId });
    res.status(500).json({ error: 'Failed to cancel operation' });
  }
});
