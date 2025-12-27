/**
 * Documents API routes
 * Document management and sync controls
 *
 * Uses shared Zod schemas from @cluebase/shared/api for type-safe validation.
 * This ensures frontend and backend use the same type definitions.
 */

import { Router } from 'express';
import { supabase } from '../services/supabase/client.js';
import { logger } from '../utils/logger.js';
// Import shared schemas for end-to-end type safety
import {
  ToggleDocumentRequestSchema,
  type ToggleDocumentRequest,
} from '@cluebase/shared/api';
import { triggerImmediateSync, triggerWebsiteScrape, getWorkspaceWebsiteUrl } from '../services/scheduler/index.js';
import { fullSync, getSyncStatus, SyncError } from '../services/google-drive/sync.js';
import { isDriveClientInitialized, initializeDriveClient } from '../services/google-drive/client.js';

const TOKENS_KEY = 'google_drive_tokens';

/**
 * Check if Google Drive is connected by verifying tokens exist in database
 * This is more reliable than checking in-memory client state
 */
async function isDriveConnectedInDB(workspaceId: string): Promise<boolean> {
  try {
    // Check for workspace-specific tokens
    const { data } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .eq('workspace_id', workspaceId)
      .single();

    if (data?.value?.access_token) {
      return true;
    }

    // Check for legacy global tokens
    const { data: legacyData } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', TOKENS_KEY)
      .is('workspace_id', null)
      .single();

    return !!legacyData?.value?.access_token;
  } catch {
    return false;
  }
}

/**
 * Ensure Drive client is initialized, loading tokens from DB if needed
 */
async function ensureDriveInitialized(workspaceId: string): Promise<boolean> {
  // If already initialized, we're good
  if (isDriveClientInitialized()) {
    return true;
  }

  // Try to initialize from stored tokens
  const { data } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', TOKENS_KEY)
    .eq('workspace_id', workspaceId)
    .single();

  if (data?.value?.access_token && data?.value?.refresh_token) {
    await initializeDriveClient(data.value);
    return isDriveClientInitialized();
  }

  // Try legacy global tokens
  const { data: legacyData } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', TOKENS_KEY)
    .is('workspace_id', null)
    .single();

  if (legacyData?.value?.access_token && legacyData?.value?.refresh_token) {
    await initializeDriveClient(legacyData.value);
    return isDriveClientInitialized();
  }

  return false;
}
import {
  authenticate,
  resolveWorkspace,
  requireWorkspaceAdmin,
  checkUsageLimit,
  documentSyncRateLimiter,
  validateBody,
} from '../middleware/index.js';

export const documentsRouter = Router();

// Apply authentication, workspace resolution, and rate limiting to all routes
// Order matters: authenticate first, then resolveWorkspace, then rate limiter
documentsRouter.use(authenticate, resolveWorkspace, documentSyncRateLimiter);

/**
 * List all documents for the workspace
 */
documentsRouter.get('/', async (req, res) => {
  try {
    const { source_type: sourceType, is_active: isActive, bot_id: botId, category } = req.query;

    let query = supabase
      .from('documents')
      .select('id, title, file_type, source_type, source_url, last_modified, last_synced, is_active, created_at, tags, bot_id, drive_folder_id, category')
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

    if (category) {
      query = query.eq('category', category as string);
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
 * Uses shared ToggleDocumentRequestSchema for type-safe validation
 */
documentsRouter.patch(
  '/:id/status',
  requireWorkspaceAdmin,
  validateBody(ToggleDocumentRequestSchema),
  async (req, res) => {
    try {
      // Body is validated and typed by Zod middleware
      const { is_active } = req.body as ToggleDocumentRequest;

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

    // Check database for tokens - more reliable than in-memory client state
    const driveConnected = await isDriveConnectedInDB(req.workspace!.id);

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
    // Auto-initialize from database tokens if needed
    const initialized = await ensureDriveInitialized(req.workspace!.id);
    if (!initialized) {
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
    // Auto-initialize from database tokens if needed
    const initialized = await ensureDriveInitialized(req.workspace!.id);
    if (!initialized) {
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

    // Return appropriate error based on SyncError type
    if (error instanceof SyncError) {
      const statusCode = error.code.includes('AUTH') ? 401 : 500;
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    res.status(500).json({ error: 'Failed to trigger full sync' });
  }
});

/**
 * Trigger website scrape for the workspace
 * Reads website URL from workspace's setup config (not env var)
 */
documentsRouter.post('/scrape/website', requireWorkspaceAdmin, checkUsageLimit('documents'), async (req, res) => {
  try {
    // Check if website is configured for this workspace
    const websiteConfig = await getWorkspaceWebsiteUrl(req.workspace!.id);
    if (!websiteConfig) {
      return res.status(400).json({ error: 'Website URL not configured. Add one in Settings.' });
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
 * Reads website URL from workspace's setup config (not env var)
 */
documentsRouter.get('/scrape/status', async (req, res) => {
  try {
    // Get website config from workspace setup
    const websiteConfig = await getWorkspaceWebsiteUrl(req.workspace!.id);
    const websiteConfigured = !!websiteConfig;

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
      websiteUrl: websiteConfig?.url ?? null,
      maxPages: websiteConfig?.maxPages ?? null,
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

/**
 * Update document assignment (bot_id, category)
 * Allows manually assigning documents to bots and categories
 */
documentsRouter.patch('/:id', requireWorkspaceAdmin, async (req, res) => {
  try {
    const { bot_id, category } = req.body;
    const updateData: Record<string, unknown> = {};

    // Validate and set bot_id
    if (bot_id !== undefined) {
      if (bot_id === null) {
        updateData.bot_id = null;
      } else if (typeof bot_id === 'string') {
        // Verify bot exists and belongs to workspace
        const { data: bot, error: botError } = await supabase
          .from('bots')
          .select('id')
          .eq('id', bot_id)
          .eq('workspace_id', req.workspace!.id)
          .single();

        if (botError || !bot) {
          return res.status(400).json({ error: 'Invalid bot_id - bot not found in workspace' });
        }
        updateData.bot_id = bot_id;
      } else {
        return res.status(400).json({ error: 'bot_id must be a string or null' });
      }
    }

    // Validate and set category
    if (category !== undefined) {
      const validCategories = ['shared', 'operations', 'marketing', 'sales', 'hr', 'technical', 'custom'];
      if (category === null || validCategories.includes(category)) {
        updateData.category = category;
      } else {
        return res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update. Provide bot_id and/or category.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('workspace_id', req.workspace!.id)
      .select('id, title, bot_id, category')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw error;
    }

    logger.info('Document assignment updated', {
      id: req.params.id,
      ...updateData,
      workspaceId: req.workspace!.id
    });

    res.json(data);
  } catch (error) {
    logger.error('Failed to update document', { error, id: req.params.id, workspaceId: req.workspace!.id });
    res.status(500).json({ error: 'Failed to update document' });
  }
});
