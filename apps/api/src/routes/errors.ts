/**
 * Error logs API routes
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase/client.js';
import { errorTracker } from '../utils/error-tracker.js';

const router = Router();

/**
 * GET /api/errors - Get error logs with filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      hours = '24',
      severity,
      service,
      resolved,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Time filter
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);

    // Optional filters
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (service) {
      query = query.eq('service', service);
    }
    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true');
    }

    // Pagination
    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      errors: data,
      total: count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

/**
 * GET /api/errors/stats - Get error statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const stats = await errorTracker.getStats(Number(hours));
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Failed to fetch error stats' });
  }
});

/**
 * PATCH /api/errors/:id/resolve - Mark an error as resolved
 */
router.patch('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Missing error ID' });
      return;
    }
    await errorTracker.resolve(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to resolve error' });
  }
});

/**
 * DELETE /api/errors/resolved - Clear resolved errors older than X days
 */
router.delete('/resolved', async (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query;
    const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
      .from('error_logs')
      .delete()
      .eq('resolved', true)
      .lt('created_at', cutoff);

    if (error) throw error;

    res.json({ deleted: count });
  } catch {
    res.status(500).json({ error: 'Failed to clear resolved errors' });
  }
});

export default router;
