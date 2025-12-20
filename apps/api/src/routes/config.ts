/**
 * Configuration API routes
 * Dashboard settings management
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';

export const configRouter = Router();

/**
 * Get all configuration
 */
configRouter.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('bot_config')
      .select('key, value, updated_at');

    if (error) throw error;

    // Convert to object format
    const config = (data ?? []).reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, unknown>);

    res.json({ config });
  } catch (error) {
    logger.error('Failed to get config', { error });
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * Get specific configuration section
 */
configRouter.get('/:key', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bot_config')
      .select('value, updated_at')
      .eq('key', req.params.key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      throw error;
    }

    res.json({ key: req.params.key, ...data });
  } catch (error) {
    logger.error('Failed to get config', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

/**
 * Update configuration section
 */
configRouter.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const { data, error } = await supabase
      .from('bot_config')
      .upsert(
        {
          key: req.params.key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )
      .select('key, value, updated_at')
      .single();

    if (error) throw error;

    logger.info('Config updated', { key: req.params.key });
    res.json(data);
  } catch (error) {
    logger.error('Failed to update config', { error, key: req.params.key });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * Update multiple configuration sections
 */
configRouter.patch('/', async (req, res) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const upsertData = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('bot_config')
      .upsert(upsertData, { onConflict: 'key' });

    if (error) throw error;

    logger.info('Multiple configs updated', { keys: Object.keys(updates) });
    res.json({ success: true, updated: Object.keys(updates) });
  } catch (error) {
    logger.error('Failed to update configs', { error });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});
