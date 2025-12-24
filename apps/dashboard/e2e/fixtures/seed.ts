/**
 * E2E Test Seeding
 *
 * Functions to insert predictable test data into the database.
 * Each function is idempotent - safe to call multiple times.
 */

import { getAdminClient } from './db';
import {
  TEST_BOT,
  TEST_BOT_SECONDARY,
  TEST_DOCUMENTS,
  TEST_CHUNKS,
  TEST_LEARNED_FACTS,
  TEST_THREAD_SESSION,
  TEST_THREAD_MESSAGES,
  TEST_ANALYTICS,
  generateMockEmbedding,
} from './test-data';

export interface SeedResult {
  table: string;
  insertedCount: number;
  error?: string;
}

/**
 * Seed a test bot
 * Schema: id, name, slug, description, avatar_url, slack_bot_token, slack_app_token,
 *         slack_signing_secret, slack_bot_user_id, system_instructions, personality,
 *         temperature, max_response_length, include_shared_knowledge, categories,
 *         status, is_default, created_at, updated_at, workspace_id
 */
export async function seedBot(
  workspaceId: string,
  bot: typeof TEST_BOT | typeof TEST_BOT_SECONDARY = TEST_BOT
): Promise<SeedResult> {
  const client = getAdminClient();

  const { data, error } = await client
    .from('bots')
    .upsert({
      id: bot.id,
      workspace_id: workspaceId,
      name: bot.name,
      slug: bot.slug,
      description: bot.description,
      slack_bot_token: bot.slack_bot_token,
      slack_app_token: bot.slack_app_token,
      slack_signing_secret: bot.slack_signing_secret,
      slack_bot_user_id: bot.slack_bot_user_id,
      system_instructions: bot.system_instructions,
      personality: bot.personality,
      temperature: bot.temperature,
      max_response_length: bot.max_response_length,
      include_shared_knowledge: bot.include_shared_knowledge,
      categories: bot.categories,
      status: bot.status,
      is_default: bot.is_default,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select();

  if (error) {
    return { table: 'bots', insertedCount: 0, error: error.message };
  }

  return { table: 'bots', insertedCount: data?.length || 1 };
}

/**
 * Seed all test bots (primary + secondary)
 */
export async function seedBots(workspaceId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  results.push(await seedBot(workspaceId, TEST_BOT));
  results.push(await seedBot(workspaceId, TEST_BOT_SECONDARY));

  return results;
}

/**
 * Seed test documents
 * Schema: id, drive_file_id, title, file_type, source_type, source_url, content_hash,
 *         last_modified, last_synced, is_active, created_at, updated_at, bot_id,
 *         category, priority, workspace_id, tags, drive_folder_id
 */
export async function seedDocuments(workspaceId: string): Promise<SeedResult> {
  const client = getAdminClient();

  const documents = TEST_DOCUMENTS.map((doc) => ({
    id: doc.id,
    drive_file_id: 'drive_file_id' in doc ? doc.drive_file_id : null,
    title: doc.title,
    file_type: doc.file_type,
    source_type: doc.source_type,
    source_url: doc.source_url,
    content_hash: doc.content_hash,
    is_active: doc.is_active,
    category: doc.category,
    priority: doc.priority,
    tags: doc.tags,
    workspace_id: workspaceId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('documents')
    .upsert(documents, { onConflict: 'id' })
    .select();

  if (error) {
    return { table: 'documents', insertedCount: 0, error: error.message };
  }

  return { table: 'documents', insertedCount: data?.length || documents.length };
}

/**
 * Seed test document chunks (with mock embeddings)
 * Schema: id, document_id, chunk_index, content, embedding, fts, metadata, created_at
 */
export async function seedChunks(_workspaceId: string): Promise<SeedResult> {
  const client = getAdminClient();

  const chunks = TEST_CHUNKS.map((chunk) => ({
    id: chunk.id,
    document_id: chunk.document_id,
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: generateMockEmbedding(),
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('document_chunks')
    .upsert(chunks, { onConflict: 'id' })
    .select();

  if (error) {
    return { table: 'document_chunks', insertedCount: 0, error: error.message };
  }

  return { table: 'document_chunks', insertedCount: data?.length || chunks.length };
}

/**
 * Seed test learned facts
 * Schema: id, fact, source, taught_by_user_id, embedding, is_verified, created_at, workspace_id
 */
export async function seedLearnedFacts(workspaceId: string): Promise<SeedResult> {
  const client = getAdminClient();

  const facts = TEST_LEARNED_FACTS.map((fact) => ({
    id: fact.id,
    fact: fact.fact,
    source: fact.source,
    taught_by_user_id: fact.taught_by_user_id,
    is_verified: fact.is_verified,
    workspace_id: workspaceId,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('learned_facts')
    .upsert(facts, { onConflict: 'id' })
    .select();

  if (error) {
    return { table: 'learned_facts', insertedCount: 0, error: error.message };
  }

  return { table: 'learned_facts', insertedCount: data?.length || facts.length };
}

/**
 * Seed a test thread session with messages
 * Schema: id, slack_channel_id, slack_thread_ts, started_by_user_id, is_active,
 *         created_at, last_activity, bot_id, workspace_id
 */
export async function seedThreadSession(
  workspaceId: string,
  botId = TEST_BOT.id
): Promise<SeedResult[]> {
  const client = getAdminClient();
  const results: SeedResult[] = [];

  // Seed session
  const { error: sessionError } = await client
    .from('thread_sessions')
    .upsert({
      id: TEST_THREAD_SESSION.id,
      slack_channel_id: TEST_THREAD_SESSION.slack_channel_id,
      slack_thread_ts: TEST_THREAD_SESSION.slack_thread_ts,
      started_by_user_id: TEST_THREAD_SESSION.started_by_user_id,
      is_active: TEST_THREAD_SESSION.is_active,
      workspace_id: workspaceId,
      bot_id: botId,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (sessionError) {
    results.push({ table: 'thread_sessions', insertedCount: 0, error: sessionError.message });
  } else {
    results.push({ table: 'thread_sessions', insertedCount: 1 });
  }

  // Seed messages
  // Schema: id, session_id, slack_user_id, role, content, sources, confidence_score,
  //         feedback_rating, created_at
  const messages = TEST_THREAD_MESSAGES.map((msg) => ({
    id: msg.id,
    session_id: msg.session_id,
    slack_user_id: msg.slack_user_id,
    role: msg.role,
    content: msg.content,
    sources: 'sources' in msg ? msg.sources : null,
    confidence_score: 'confidence_score' in msg ? msg.confidence_score : null,
    created_at: new Date().toISOString(),
  }));

  const { data: msgData, error: msgError } = await client
    .from('thread_messages')
    .upsert(messages, { onConflict: 'id' })
    .select();

  if (msgError) {
    results.push({ table: 'thread_messages', insertedCount: 0, error: msgError.message });
  } else {
    results.push({ table: 'thread_messages', insertedCount: msgData?.length || messages.length });
  }

  return results;
}

/**
 * Seed test analytics events
 * Schema: id, event_type, event_data, created_at, workspace_id
 */
export async function seedAnalytics(workspaceId: string): Promise<SeedResult> {
  const client = getAdminClient();

  const analytics = TEST_ANALYTICS.map((event) => ({
    id: event.id,
    event_type: event.event_type,
    event_data: event.event_data,
    workspace_id: workspaceId,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await client
    .from('analytics')
    .upsert(analytics, { onConflict: 'id' })
    .select();

  if (error) {
    return { table: 'analytics', insertedCount: 0, error: error.message };
  }

  return { table: 'analytics', insertedCount: data?.length || analytics.length };
}

/**
 * Seed all test data for a workspace
 * Use this for comprehensive test setup
 */
export async function seedAll(workspaceId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  // Seed in dependency order (parents before children)
  results.push(...await seedBots(workspaceId));
  results.push(await seedDocuments(workspaceId));
  results.push(await seedChunks(workspaceId));
  results.push(await seedLearnedFacts(workspaceId));
  results.push(...await seedThreadSession(workspaceId));
  results.push(await seedAnalytics(workspaceId));

  return results;
}

/**
 * Get seed summary as formatted string (for logging)
 */
export function formatSeedResults(results: SeedResult[]): string {
  const lines = results.map((r) => {
    if (r.error) {
      return `  ${r.table}: ERROR - ${r.error}`;
    }
    return `  ${r.table}: ${r.insertedCount} rows inserted`;
  });

  const totalInserted = results.reduce((sum, r) => sum + r.insertedCount, 0);
  const errors = results.filter((r) => r.error).length;

  lines.push(`  ---`);
  lines.push(`  Total: ${totalInserted} rows inserted, ${errors} errors`);

  return lines.join('\n');
}
