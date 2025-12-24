/**
 * E2E Global Setup
 *
 * Runs once before all tests. Responsibilities:
 * 1. Verify database connection
 * 2. Get E2E user's workspace ID
 * 3. Store workspace ID in environment for fixtures
 */

import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
const envPath = path.resolve(__dirname, '../../.env.test');
console.log('[Global Setup] Loading env from:', envPath);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('[Global Setup] Error loading .env.test:', envResult.error);
}

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n[Global Setup] Starting E2E test setup...');
  console.log('[Global Setup] Service key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 50) + '...');

  // Verify required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = process.env.PLAYWRIGHT_TEST_EMAIL || 'e2e@cluebase.ai';

  if (!supabaseUrl) {
    throw new Error(
      '[Global Setup] NEXT_PUBLIC_SUPABASE_URL is not set.\n' +
      'Check your apps/dashboard/.env.test file.'
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      '[Global Setup] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
      'Fixture operations (reset, seed) will fail.\n' +
      'Get it from: Supabase Dashboard > Settings > API > service_role key\n' +
      'Add it to: apps/dashboard/.env.test'
    );
    console.log('[Global Setup] Continuing without fixtures support...');
    return;
  }

  // Create admin client inline to avoid ESM import issues
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify connection
  console.log('[Global Setup] Verifying Supabase connection...');
  const { error: connError } = await adminClient.from('workspaces').select('id').limit(1);

  if (connError) {
    throw new Error(
      `[Global Setup] Could not connect to Supabase: ${connError.message}\n` +
      'Check your NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  console.log('[Global Setup] Supabase connection verified.');

  // Get workspace ID for E2E user
  console.log(`[Global Setup] Looking up workspace for: ${testEmail}`);

  // Query auth.users directly (service role bypasses RLS)
  const { data: authUsers, error: authError } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', testEmail)
    .limit(1);

  // If auth.users query fails (different schema), try via listUsers
  let userId: string | null = null;

  if (authUsers && authUsers.length > 0) {
    userId = authUsers[0].id;
  } else {
    // Fallback: use admin API listUsers
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      throw new Error(
        `[Global Setup] Failed to list users: ${listError.message}`
      );
    }
    const foundUser = listData.users.find(u => u.email === testEmail);
    if (foundUser) {
      userId = foundUser.id;
    }
  }

  if (!userId) {
    throw new Error(
      `[Global Setup] E2E test user not found: ${testEmail}\n` +
      `Ensure the user exists in Supabase Auth.`
    );
  }

  const userProfile = { id: userId };
  console.log(`[Global Setup] Found user: ${userId}`);

  // Get workspace membership
  const { data: membership, error: memberError } = await adminClient
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userProfile.id)
    .eq('is_active', true)
    .single();

  if (memberError || !membership) {
    throw new Error(
      `[Global Setup] E2E test user has no active workspace.\n` +
      `User ID: ${userProfile.id}\n` +
      `Error: ${memberError?.message || 'No workspace membership found'}`
    );
  }

  const workspaceId = membership.workspace_id;
  console.log(`[Global Setup] E2E Workspace ID: ${workspaceId}`);

  // Store in environment for fixtures
  process.env.E2E_WORKSPACE_ID = workspaceId;

  console.log('[Global Setup] Complete.\n');
}

export default globalSetup;
