/**
 * E2E Test Database Client
 *
 * Provides direct Supabase access using service role key to bypass RLS.
 * Used for test data seeding and cleanup operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton admin client
let adminClient: SupabaseClient | null = null;

/**
 * Get the Supabase admin client (service role - bypasses RLS)
 * This client should ONLY be used for test setup/teardown operations
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Check your .env.test file.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Check your .env.test file.\n' +
      'Get it from: Supabase Dashboard > Settings > API > service_role key'
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Get workspace ID for the E2E test user
 * Looks up the workspace membership for the test email
 */
export async function getE2EWorkspaceId(): Promise<string> {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL || 'e2e@cluebase.ai';
  const client = getAdminClient();

  // First get the user ID from auth.users
  const { data: authUser, error: authError } = await client
    .from('user_profiles')
    .select('id, workspace_id')
    .eq('email', email)
    .single();

  if (authError || !authUser) {
    throw new Error(
      `E2E test user not found: ${email}. ` +
      `Ensure this user exists in Supabase and has a workspace.`
    );
  }

  // Get workspace from membership
  const { data: membership, error: memberError } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', authUser.id)
    .eq('is_active', true)
    .single();

  if (memberError || !membership) {
    throw new Error(
      `E2E test user has no active workspace membership. ` +
      `User ID: ${authUser.id}`
    );
  }

  return membership.workspace_id;
}

/**
 * Verify admin client can connect to Supabase
 */
export async function verifyConnection(): Promise<boolean> {
  try {
    const client = getAdminClient();
    const { error } = await client.from('workspaces').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
