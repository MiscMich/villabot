/**
 * E2E Test Data Constants
 *
 * Predictable test data for E2E tests. All IDs are deterministic UUIDs
 * so tests can reference them without querying the database.
 */

// Deterministic UUIDs for test data
export const TEST_IDS = {
  BOT_1: '00000000-0000-0000-0000-000000000001',
  BOT_2: '00000000-0000-0000-0000-000000000002',
  DOC_1: '00000000-0000-0000-0000-000000000011',
  DOC_2: '00000000-0000-0000-0000-000000000012',
  DOC_3: '00000000-0000-0000-0000-000000000013',
  CHUNK_1: '00000000-0000-0000-0000-000000000021',
  CHUNK_2: '00000000-0000-0000-0000-000000000022',
  CHUNK_3: '00000000-0000-0000-0000-000000000023',
  FACT_1: '00000000-0000-0000-0000-000000000031',
  FACT_2: '00000000-0000-0000-0000-000000000032',
  SESSION_1: '00000000-0000-0000-0000-000000000041',
  MSG_1: '00000000-0000-0000-0000-000000000051',
  MSG_2: '00000000-0000-0000-0000-000000000052',
  ANALYTICS_1: '00000000-0000-0000-0000-000000000061',
  ANALYTICS_2: '00000000-0000-0000-0000-000000000062',
} as const;

/**
 * Test Bot - simulates a configured Slack bot
 * Schema: id, name, slug, description, avatar_url, slack_bot_token, slack_app_token,
 *         slack_signing_secret, slack_bot_user_id, system_instructions, personality,
 *         temperature, max_response_length, include_shared_knowledge, categories,
 *         status, is_default, created_at, updated_at, workspace_id
 */
export const TEST_BOT = {
  id: TEST_IDS.BOT_1,
  name: 'E2E Test Bot',
  slug: 'e2e-test-bot',
  description: 'Test bot for E2E automation',
  slack_bot_token: 'xoxb-test-token-e2e',
  slack_app_token: 'xapp-test-token-e2e',
  slack_signing_secret: 'test-signing-secret-e2e',
  slack_bot_user_id: 'U0000E2E',
  system_instructions: 'You are a helpful assistant for E2E testing.',
  personality: 'professional',
  temperature: 0.7,
  max_response_length: 2000,
  include_shared_knowledge: true,
  categories: ['shared', 'operations'],
  status: 'active' as const,
  is_default: true,
} as const;

/**
 * Secondary test bot for multi-bot scenarios
 */
export const TEST_BOT_SECONDARY = {
  id: TEST_IDS.BOT_2,
  name: 'E2E Secondary Bot',
  slug: 'e2e-secondary-bot',
  description: 'Secondary test bot for multi-bot tests',
  slack_bot_token: 'xoxb-test-token-e2e-2',
  slack_app_token: 'xapp-test-token-e2e-2',
  slack_signing_secret: 'test-signing-secret-e2e-2',
  slack_bot_user_id: 'U0000E2E2',
  system_instructions: 'You are a secondary assistant for E2E testing.',
  personality: 'casual',
  temperature: 0.5,
  max_response_length: 1000,
  include_shared_knowledge: false,
  categories: ['marketing', 'sales'],
  status: 'inactive' as const,
  is_default: false,
} as const;

/**
 * Test Documents - simulates synced Drive/website content
 * Schema: id, drive_file_id, title, file_type, source_type, source_url, content_hash,
 *         last_modified, last_synced, is_active, created_at, updated_at, bot_id,
 *         category, priority, workspace_id, tags, drive_folder_id
 */
export const TEST_DOCUMENTS = [
  {
    id: TEST_IDS.DOC_1,
    drive_file_id: 'gdrive-test-001',
    title: 'E2E Company Policies',
    file_type: 'document',
    source_type: 'google_drive' as const,
    source_url: 'https://docs.google.com/document/d/test-001',
    content_hash: 'hash-001',
    is_active: true,
    category: 'operations' as const,
    priority: 1,
    tags: ['policies', 'hr'],
  },
  {
    id: TEST_IDS.DOC_2,
    drive_file_id: 'gdrive-test-002',
    title: 'E2E Product FAQ',
    file_type: 'document',
    source_type: 'google_drive' as const,
    source_url: 'https://docs.google.com/document/d/test-002',
    content_hash: 'hash-002',
    is_active: true,
    category: 'shared' as const,
    priority: 2,
    tags: ['faq', 'product'],
  },
  {
    id: TEST_IDS.DOC_3,
    title: 'E2E Website Homepage',
    file_type: 'webpage',
    source_type: 'website' as const,
    source_url: 'https://e2e-test.example.com/',
    content_hash: 'hash-003',
    is_active: true,
    category: 'marketing' as const,
    priority: 3,
    tags: ['website', 'homepage'],
  },
] as const;

/**
 * Test Document Chunks - vectorized content for RAG
 * Schema: id, document_id, chunk_index, content, embedding, fts, metadata, created_at
 */
export const TEST_CHUNKS = [
  {
    id: TEST_IDS.CHUNK_1,
    document_id: TEST_IDS.DOC_1,
    content: 'Our company vacation policy allows employees to take up to 20 days of paid time off per year.',
    chunk_index: 0,
    metadata: { tokens: 25 },
  },
  {
    id: TEST_IDS.CHUNK_2,
    document_id: TEST_IDS.DOC_1,
    content: 'Remote work is permitted with manager approval. Employees must be available during core hours.',
    chunk_index: 1,
    metadata: { tokens: 20 },
  },
  {
    id: TEST_IDS.CHUNK_3,
    document_id: TEST_IDS.DOC_2,
    content: 'Our product integrates with Slack to provide instant answers from your knowledge base.',
    chunk_index: 0,
    metadata: { tokens: 18 },
  },
] as const;

/**
 * Test Learned Facts - user corrections
 * Schema: id, fact, source, taught_by_user_id, embedding, is_verified, created_at, workspace_id
 */
export const TEST_LEARNED_FACTS = [
  {
    id: TEST_IDS.FACT_1,
    fact: 'We observe all federal holidays plus the week between Christmas and New Year.',
    source: 'User correction in Slack',
    taught_by_user_id: 'U0000E2E',
    is_verified: true,
  },
  {
    id: TEST_IDS.FACT_2,
    fact: 'Jane Smith is the CEO as of 2024.',
    source: 'Admin knowledge entry',
    taught_by_user_id: 'U0000E2E',
    is_verified: true,
  },
] as const;

/**
 * Test Thread Sessions - Slack conversations
 * Schema: id, slack_channel_id, slack_thread_ts, started_by_user_id, is_active,
 *         created_at, last_activity, bot_id, workspace_id
 */
export const TEST_THREAD_SESSION = {
  id: TEST_IDS.SESSION_1,
  slack_channel_id: 'C0000E2E',
  slack_thread_ts: '1700000000.000001',
  started_by_user_id: 'U0000E2E',
  is_active: true,
} as const;

/**
 * Test Thread Messages
 * Schema: id, session_id, slack_user_id, role, content, sources, confidence_score,
 *         feedback_rating, created_at
 */
export const TEST_THREAD_MESSAGES = [
  {
    id: TEST_IDS.MSG_1,
    session_id: TEST_IDS.SESSION_1,
    slack_user_id: 'U0000E2E',
    role: 'user' as const,
    content: 'What is our vacation policy?',
  },
  {
    id: TEST_IDS.MSG_2,
    session_id: TEST_IDS.SESSION_1,
    slack_user_id: 'U0000E2E', // Bot user ID (slack_user_id is NOT NULL)
    role: 'assistant' as const,
    content: 'Our company vacation policy allows employees to take up to 20 days of paid time off per year.',
    sources: [{ document_id: TEST_IDS.DOC_1, chunk_id: TEST_IDS.CHUNK_1 }],
    confidence_score: 0.92,
  },
] as const;

/**
 * Test Analytics Events
 * Schema: id, event_type, event_data, created_at, workspace_id
 */
export const TEST_ANALYTICS = [
  {
    id: TEST_IDS.ANALYTICS_1,
    event_type: 'question_asked' as const,
    event_data: { channel: 'C0000E2E', hasAnswer: true },
  },
  {
    id: TEST_IDS.ANALYTICS_2,
    event_type: 'document_synced' as const,
    event_data: { source: 'google_drive', count: 2 },
  },
] as const;

/**
 * Generate a 768-dimensional zero vector (OpenAI text-embedding-3-small size)
 * Used as placeholder for test chunks
 */
export function generateMockEmbedding(): number[] {
  return new Array(768).fill(0);
}

/**
 * All test data for quick reference
 */
export const ALL_TEST_DATA = {
  bot: TEST_BOT,
  botSecondary: TEST_BOT_SECONDARY,
  documents: TEST_DOCUMENTS,
  chunks: TEST_CHUNKS,
  learnedFacts: TEST_LEARNED_FACTS,
  threadSession: TEST_THREAD_SESSION,
  threadMessages: TEST_THREAD_MESSAGES,
  analytics: TEST_ANALYTICS,
} as const;
