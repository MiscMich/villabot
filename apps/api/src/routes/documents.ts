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
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  checkUsageLimit,
} from '../middleware/index.js';

export const documentsRouter = Router();

// Apply authentication and workspace resolution to all routes
documentsRouter.use(authenticate, resolveWorkspace);

/**
 * List all documents for the workspace
 */
documentsRouter.get('/', async (req, res) => {
  try {
    const { source_type: sourceType, is_active: isActive, bot_id: botId } = req.query;

    let query = supabase
      .from('documents')
      .select('id, title, file_type, source_type, source_url, last_modified, last_synced, is_active, created_at, tags, bot_id, drive_folder_id')
      .eq('workspace_id', req.workspace!.id)
      .order('last_modified', { ascending: false });

    if (sourceType) {
      query = query.eq('source_type', sourceType as string);
    }

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (botId) {
      query = query.eq('bot_id', botId as string);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      documents: data ?? [],
      total: count ?? data?.length ?? 0,
    });
  } catch (error) {
    logger.error('Failed to list documents', { error, workspaceId: req.workspace!.id });
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
      .eq('workspace_id', req.workspace!.id)
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
    logger.error('Failed to get document', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * Toggle document active status
 */
documentsRouter.patch('/:id/status', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({ is_active })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select('id, title, is_active')
      .single();

    if (error) throw error;

    logger.info('Document status updated', { id: req.params.id, is_active, workspaceId: req.workspace!.id });
    res.json(data);
  } catch (error) {
    logger.error('Failed to update document status', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update document status' });
  }
});

/**
 * Delete a document
 */
documentsRouter.delete('/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id);

    if (error) throw error;

    logger.info('Document deleted', { id: req.params.id, workspaceId: req.workspace!.id });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete document', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * Get sync status for the workspace
 */
documentsRouter.get('/sync/status', async (req, res) => {
  try {
    const status = await getSyncStatus(req.workspace!.id);
    const driveConnected = isDriveClientInitialized();

    // Get workspace-specific document counts
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', req.workspace!.id)
      .eq('source_type', 'google_drive');

    res.json({
      ...status,
      driveConnected,
      workspaceDocuments: docCount ?? 0,
    });
  } catch (error) {
    logger.error('Failed to get sync status', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * Trigger immediate sync for the workspace
 */
documentsRouter.post('/sync', requireWorkspaceAdmin, checkUsageLimit('documents'), async (req, res) => {
  try {
    if (!isDriveClientInitialized()) {
      return res.status(400).json({ error: 'Google Drive not connected' });
    }

    const result = await triggerImmediateSync(req.workspace!.id);

    logger.info('Manual sync triggered', { ...result, workspaceId: req.workspace!.id });
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger sync', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * Trigger full resync for the workspace
 */
documentsRouter.post('/sync/full', requireWorkspaceAdmin, checkUsageLimit('documents'), async (req, res) => {
  try {
    if (!isDriveClientInitialized()) {
      return res.status(400).json({ error: 'Google Drive not connected' });
    }

    const result = await fullSync({ workspaceId: req.workspace!.id });

    logger.info('Full sync triggered', { ...result, workspaceId: req.workspace!.id });
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger full sync', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to trigger full sync' });
  }
});

/**
 * Trigger website scrape for the workspace
 */
documentsRouter.post('/scrape/website', requireWorkspaceAdmin, checkUsageLimit('documents'), async (req, res) => {
  try {
    if (!env.COMPANY_WEBSITE_URL) {
      return res.status(400).json({ error: 'Website URL not configured' });
    }

    const result = await triggerWebsiteScrape(req.workspace!.id);

    logger.info('Website scrape triggered', { ...result, workspaceId: req.workspace!.id });
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to trigger website scrape', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to trigger website scrape' });
  }
});

/**
 * Get website scrape status for the workspace
 */
documentsRouter.get('/scrape/status', async (req, res) => {
  try {
    const websiteConfigured = !!env.COMPANY_WEBSITE_URL;

    // Get latest website scrape event for this workspace
    const { data: lastScrape } = await supabase
      .from('analytics')
      .select('created_at, event_data')
      .eq('workspace_id', req.workspace!.id)
      .in('event_type', ['website_scrape', 'website_scrape_scheduled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Count website documents for this workspace
    const { count: websiteDocCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', req.workspace!.id)
      .eq('source_type', 'website');

    res.json({
      websiteConfigured,
      websiteUrl: env.COMPANY_WEBSITE_URL ?? null,
      lastScrape: lastScrape?.created_at ?? null,
      lastScrapeResult: lastScrape?.event_data ?? null,
      documentCount: websiteDocCount ?? 0,
    });
  } catch (error) {
    logger.error('Failed to get scrape status', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get scrape status' });
  }
});

// ============================================
// DOCUMENT TAGS
// ============================================

/**
 * Get all unique tags in workspace (for autocomplete)
 */
documentsRouter.get('/tags', async (req, res) => {
  try {
    // Get all documents with tags for this workspace
    const { data, error } = await supabase
      .from('documents')
      .select('tags')
      .eq('workspace_id', req.workspace!.id)
      .not('tags', 'is', null);

    if (error) throw error;

    // Extract unique tags
    const allTags = new Set<string>();
    for (const doc of data ?? []) {
      if (Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          allTags.add(tag);
        }
      }
    }

    res.json({
      tags: Array.from(allTags).sort(),
    });
  } catch (error) {
    logger.error('Failed to get tags', { error, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to get tags' });
  }
});

/**
 * Update document tags
 */
documentsRouter.patch('/:id/tags', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { tags } = req.body;

    // Validate tags array
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags must be an array of strings' });
    }

    // Validate all tags are strings and sanitize
    const sanitizedTags = tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 50);

    // Remove duplicates
    const uniqueTags = [...new Set(sanitizedTags)];

    const { data, error } = await supabase
      .from('documents')
      .update({ tags: uniqueTags })
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select('id, title, tags')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw error;
    }

    logger.info('Document tags updated', {
      id: req.params.id,
      tags: uniqueTags,
      workspaceId: req.workspace!.id
    });

    res.json(data);
  } catch (error) {
    logger.error('Failed to update document tags', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update document tags' });
  }
});
