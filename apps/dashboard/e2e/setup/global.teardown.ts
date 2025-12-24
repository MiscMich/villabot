/**
 * E2E Global Teardown
 *
 * Runs once after all tests complete. Responsibilities:
 * 1. Optional cleanup of test data
 * 2. Report summary statistics
 *
 * Note: Per-suite cleanup is preferred over global cleanup
 * to ensure test isolation. This is mainly for logging.
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n[Global Teardown] E2E tests completed.');

  const workspaceId = process.env.E2E_WORKSPACE_ID;

  if (workspaceId) {
    console.log(`[Global Teardown] Workspace ID was: ${workspaceId}`);

    // Optional: Clean up all test data after test run
    // Uncomment if you want to leave the database clean after tests
    //
    // const { cleanupWorkspace, formatCleanupResults } = await import('../fixtures/cleanup');
    // console.log('[Global Teardown] Cleaning up test data...');
    // const results = await cleanupWorkspace(workspaceId);
    // console.log(`[Global Teardown] Cleanup results:\n${formatCleanupResults(results)}`);
  }

  console.log('[Global Teardown] Complete.\n');
}

export default globalTeardown;
