/**
 * Documents API routes
 * Document management and sync controls
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
import { triggerImmediateSync, triggerWebsiteScrape } from '../services/scheduler/index.js';
import { fullSync, getSyncStatus } from '../services/google-drive/sync.js';
import { isDriveClientInitialized } from '../services/google-drive/client.js';
import { env } from '../config/env.js';

export const documentsRouter = Router();

/**
 * List all documents
 */
documentsRouter.get('/', async (req, res) => {
  try {
    const { source_type, is_active } = req.query;

    let query = supabase
      .from('documents')
      .select('id, title, file_type, source_type, source_url, last_modified, last_synced, is_active, created_at')
      .order('last_modified', { ascending: false });

    if (source_type) {
      query = query.eq('source_type', source_type as string);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      documents: data ?? [],
      total: count ?? data?.length ?? 0,
    });
  } catch (error) {
    logger.error('Failed to list documents', { error });
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * Get document details with chunks
 */
documentsRouter.get('/:id', async (req, res) => {
  try {
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (docError) {
      if (docError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw docError;
    }

    const { data: chunks, error: chunkError } = await supabase
      .from('document_chunks')
      .select('id, chunk_index, content, metadata')
      .eq('document_id', req.params.id)
      .order('chunk_index', { ascending: true });

    if (chunkError) throw chunkError;

    res.json({
      ...document,
      chunks: chunks ?? [],
      chunk_count: chunks?.length ?? 0,
    });
  } catch (error) {
    logger.error('Failed to get document', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * Toggle document active status
 */
documentsRouter.patch('/:id/status', async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({ is_active })
      .eq('id', req.params.id)
      .select('id, title, is_active')
      .single();

    if (error) throw error;

    logger.info('Document status updated', { id: req.params.id, is_active });
    res.json(data);
  } catch (error) {
    logger.error('Failed to update document status', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to update document status' });
  }
});

/**
 * Delete a document
 */
documentsRouter.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    logger.info('Document deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete document', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * Get sync status
 */
documentsRouter.get('/sync/status', async (_req, res) => {
  try {
    const status = await getSyncStatus();
    const driveConnected = isDriveClientInitialized();

    res.json({
      ...status,
      driveConnected,
    });
  } catch (error) {
    logger.error('Failed to get sync status', { error });
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * Trigger immediate sync
 */
documentsRouter.post('/sync', async (_req, res) => {
  try {
    if (!isDriveClientInitialized()) {
      return res.status(400).json({ error: 'Google Drive not connected' });
    }

    const result = await triggerImmediateSync();

    logger.info('Manual sync triggered', result);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger sync', { error });
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * Trigger full resync
 */
documentsRouter.post('/sync/full', async (_req, res) => {
  try {
    if (!isDriveClientInitialized()) {
      return res.status(400).json({ error: 'Google Drive not connected' });
    }

    const result = await fullSync();

    logger.info('Full sync triggered', result);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger full sync', { error });
    res.status(500).json({ error: 'Failed to trigger full sync' });
  }
});

/**
 * Trigger website scrape
 */
documentsRouter.post('/scrape/website', async (_req, res) => {
  try {
    if (!env.COMPANY_WEBSITE_URL) {
      return res.status(400).json({ error: 'Website URL not configured' });
    }

    const result = await triggerWebsiteScrape();

    logger.info('Website scrape triggered', result);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger website scrape', { error });
    res.status(500).json({ error: 'Failed to trigger website scrape' });
  }
});

/**
 * Get website scrape status
 */
documentsRouter.get('/scrape/status', async (_req, res) => {
  try {
    const websiteConfigured = !!env.COMPANY_WEBSITE_URL;

    // Get latest website scrape event
    const { data: lastScrape } = await supabase
      .from('analytics')
      .select('created_at, event_data')
      .in('event_type', ['website_scrape', 'website_scrape_scheduled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Count website documents
    const { count: websiteDocCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('source_type', 'website');

    res.json({
      websiteConfigured,
      websiteUrl: env.COMPANY_WEBSITE_URL ?? null,
      lastScrape: lastScrape?.created_at ?? null,
      lastScrapeResult: lastScrape?.event_data ?? null,
      documentCount: websiteDocCount ?? 0,
    });
  } catch (error) {
    logger.error('Failed to get scrape status', { error });
    res.status(500).json({ error: 'Failed to get scrape status' });
  }
});
