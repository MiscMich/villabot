/**
 * E2E Test Cleanup
 *
 * Cleans up test data from the database in foreign key order.
 * Preserves: workspaces, workspace_members, user_profiles, billing tables
 */

import { getAdminClient } from './db';

export interface CleanupResult {
  table: string;
  deletedCount: number;
  error?: string;
}

/**
 * Clean all test data for a specific workspace
 * Deletes data in FK order to avoid constraint violations
 *
 * Note: Some tables (document_chunks, thread_messages, bot_channels, bot_drive_folders)
 * don't have workspace_id - they're linked via parent tables.
 */
export async function cleanupWorkspace(workspaceId: string): Promise<CleanupResult[]> {
  const client = getAdminClient();
  const results: CleanupResult[] = [];

  // Helper to delete and track results
  const deleteFromTable = async (
    table: string,
    filter: { column: string; value: string }
  ): Promise<CleanupResult> => {
    try {
      const { data, error } = await client
        .from(table)
        .delete()
        .eq(filter.column, filter.value)
        .select('id');

      if (error) {
        if (error.code === '42P01' || error.code === '42703') {
          return { table, deletedCount: 0, error: 'Table/column not found' };
        }
        return { table, deletedCount: 0, error: error.message };
      }
      return { table, deletedCount: data?.length || 0 };
    } catch (err) {
      return {
        table,
        deletedCount: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  // 1. Delete thread_messages via sessions (no workspace_id on thread_messages)
  // First get session IDs for this workspace
  const { data: sessions } = await client
    .from('thread_sessions')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    try {
      const { data, error } = await client
        .from('thread_messages')
        .delete()
        .in('session_id', sessionIds)
        .select('id');

      if (error) {
        results.push({ table: 'thread_messages', deletedCount: 0, error: error.message });
      } else {
        results.push({ table: 'thread_messages', deletedCount: data?.length || 0 });
      }
    } catch (err) {
      results.push({ table: 'thread_messages', deletedCount: 0, error: 'Failed to delete' });
    }
  } else {
    results.push({ table: 'thread_messages', deletedCount: 0 });
  }

  // 2. Delete document_chunks via documents (no workspace_id on document_chunks)
  const { data: docs } = await client
    .from('documents')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (docs && docs.length > 0) {
    const docIds = docs.map(d => d.id);
    try {
      const { data, error } = await client
        .from('document_chunks')
        .delete()
        .in('document_id', docIds)
        .select('id');

      if (error) {
        results.push({ table: 'document_chunks', deletedCount: 0, error: error.message });
      } else {
        results.push({ table: 'document_chunks', deletedCount: data?.length || 0 });
      }
    } catch (err) {
      results.push({ table: 'document_chunks', deletedCount: 0, error: 'Failed to delete' });
    }
  } else {
    results.push({ table: 'document_chunks', deletedCount: 0 });
  }

  // 3. Delete thread_sessions (has workspace_id)
  results.push(await deleteFromTable('thread_sessions', { column: 'workspace_id', value: workspaceId }));

  // 4. Delete documents (has workspace_id)
  results.push(await deleteFromTable('documents', { column: 'workspace_id', value: workspaceId }));

  // 5. Delete bot sub-tables via bots (no workspace_id on these)
  const { data: bots } = await client
    .from('bots')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (bots && bots.length > 0) {
    const botIds = bots.map(b => b.id);

    // bot_channels
    try {
      const { data, error } = await client
        .from('bot_channels')
        .delete()
        .in('bot_id', botIds)
        .select('id');
      results.push({
        table: 'bot_channels',
        deletedCount: error ? 0 : (data?.length || 0),
        error: error?.message
      });
    } catch {
      results.push({ table: 'bot_channels', deletedCount: 0, error: 'Failed to delete' });
    }

    // bot_drive_folders
    try {
      const { data, error } = await client
        .from('bot_drive_folders')
        .delete()
        .in('bot_id', botIds)
        .select('id');
      results.push({
        table: 'bot_drive_folders',
        deletedCount: error ? 0 : (data?.length || 0),
        error: error?.message
      });
    } catch {
      results.push({ table: 'bot_drive_folders', deletedCount: 0, error: 'Failed to delete' });
    }

    // bot_health
    try {
      const { data, error } = await client
        .from('bot_health')
        .delete()
        .in('bot_id', botIds)
        .select('bot_id');
      results.push({
        table: 'bot_health',
        deletedCount: error ? 0 : (data?.length || 0),
        error: error?.message
      });
    } catch {
      results.push({ table: 'bot_health', deletedCount: 0, error: 'Failed to delete' });
    }
  }

  // 6. Delete response_feedback (has workspace_id)
  results.push(await deleteFromTable('response_feedback', { column: 'workspace_id', value: workspaceId }));

  // 7. Delete bots (has workspace_id)
  results.push(await deleteFromTable('bots', { column: 'workspace_id', value: workspaceId }));

  // 8. Delete learned_facts (has workspace_id)
  results.push(await deleteFromTable('learned_facts', { column: 'workspace_id', value: workspaceId }));

  // 9. Delete analytics (has workspace_id)
  results.push(await deleteFromTable('analytics', { column: 'workspace_id', value: workspaceId }));

  // 10. Delete error_logs (has workspace_id)
  results.push(await deleteFromTable('error_logs', { column: 'workspace_id', value: workspaceId }));

  return results;
}

/**
 * Verify cleanup was successful (no remaining data for workspace)
 */
export async function verifyCleanup(workspaceId: string): Promise<boolean> {
  const client = getAdminClient();
  const tablesToCheck = [
    'bots',
    'documents',
    'learned_facts',
    'thread_sessions',
    'analytics',
    'response_feedback',
  ];

  for (const table of tablesToCheck) {
    try {
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      if (!error && count && count > 0) {
        console.warn(`Cleanup verification failed: ${table} has ${count} rows`);
        return false;
      }
    } catch {
      // Table might not exist - that's ok
    }
  }

  return true;
}

/**
 * Get cleanup summary as formatted string (for logging)
 */
export function formatCleanupResults(results: CleanupResult[]): string {
  const lines = results.map((r) => {
    if (r.error) {
      return `  ${r.table}: ERROR - ${r.error}`;
    }
    return `  ${r.table}: ${r.deletedCount} rows deleted`;
  });

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const errors = results.filter((r) => r.error).length;

  lines.push(`  ---`);
  lines.push(`  Total: ${totalDeleted} rows deleted, ${errors} errors`);

  return lines.join('\n');
}
