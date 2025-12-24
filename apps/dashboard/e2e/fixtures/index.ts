/**
 * E2E Test Fixtures - Extended Playwright Test
 *
 * This module extends Playwright's test object with custom fixtures
 * for database cleanup and seeding. Import { test, expect } from here
 * instead of @playwright/test in your spec files.
 *
 * @example
 * ```typescript
 * import { test, expect } from './fixtures';
 *
 * test.describe('Bots', () => {
 *   test.beforeAll(async ({ resetWorkspace, seedBots }) => {
 *     await resetWorkspace();
 *     await seedBots();
 *   });
 *
 *   test('displays seeded bot', async ({ page }) => {
 *     await page.goto('/bots');
 *     await expect(page.getByText('E2E Test Bot')).toBeVisible();
 *   });
 * });
 * ```
 */

import { test as base, expect } from '@playwright/test';
import { cleanupWorkspace, formatCleanupResults } from './cleanup';
import {
  seedBots,
  seedDocuments,
  seedChunks,
  seedLearnedFacts,
  seedThreadSession,
  seedAnalytics,
  seedAll,
  formatSeedResults,
  SeedResult,
} from './seed';
import { CleanupResult } from './cleanup';

/**
 * Fixture types for TypeScript intellisense
 */
export interface WorkspaceFixtures {
  /** The E2E test workspace ID (from global setup) */
  workspaceId: string;

  /** Clean all test data from the workspace */
  resetWorkspace: () => Promise<CleanupResult[]>;

  /** Seed bots into the workspace */
  seedBots: () => Promise<SeedResult[]>;

  /** Seed documents into the workspace */
  seedDocuments: () => Promise<SeedResult>;

  /** Seed document chunks into the workspace */
  seedChunks: () => Promise<SeedResult>;

  /** Seed learned facts into the workspace */
  seedLearnedFacts: () => Promise<SeedResult>;

  /** Seed a thread session with messages */
  seedThreadSession: () => Promise<SeedResult[]>;

  /** Seed analytics events */
  seedAnalytics: () => Promise<SeedResult>;

  /** Seed all test data (bots, documents, chunks, facts, sessions, analytics) */
  seedAll: () => Promise<SeedResult[]>;
}

/**
 * Extended test object with workspace fixtures
 */
export const test = base.extend<WorkspaceFixtures>({
  /**
   * Workspace ID fixture - reads from environment variable
   * Set by global.setup.ts
   */
  workspaceId: async ({}, use) => {
    const workspaceId = process.env.E2E_WORKSPACE_ID;

    if (!workspaceId) {
      throw new Error(
        'E2E_WORKSPACE_ID is not set. Ensure global.setup.ts ran successfully.\n' +
        'Check that your .env.test has valid credentials and the E2E user exists.'
      );
    }

    await use(workspaceId);
  },

  /**
   * Reset workspace fixture - cleans all test data
   */
  resetWorkspace: async ({ workspaceId }, use) => {
    const reset = async (): Promise<CleanupResult[]> => {
      console.log(`[Fixtures] Resetting workspace: ${workspaceId}`);
      const results = await cleanupWorkspace(workspaceId);
      console.log(`[Fixtures] Cleanup results:\n${formatCleanupResults(results)}`);
      return results;
    };

    await use(reset);
  },

  /**
   * Seed bots fixture
   */
  seedBots: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult[]> => {
      console.log(`[Fixtures] Seeding bots for workspace: ${workspaceId}`);
      const results = await seedBots(workspaceId);
      console.log(`[Fixtures] Seed results:\n${formatSeedResults(results)}`);
      return results;
    };

    await use(seed);
  },

  /**
   * Seed documents fixture
   */
  seedDocuments: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult> => {
      console.log(`[Fixtures] Seeding documents for workspace: ${workspaceId}`);
      const result = await seedDocuments(workspaceId);
      console.log(`[Fixtures] Seed result: ${result.insertedCount} documents`);
      return result;
    };

    await use(seed);
  },

  /**
   * Seed chunks fixture
   */
  seedChunks: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult> => {
      console.log(`[Fixtures] Seeding chunks for workspace: ${workspaceId}`);
      const result = await seedChunks(workspaceId);
      console.log(`[Fixtures] Seed result: ${result.insertedCount} chunks`);
      return result;
    };

    await use(seed);
  },

  /**
   * Seed learned facts fixture
   */
  seedLearnedFacts: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult> => {
      console.log(`[Fixtures] Seeding learned facts for workspace: ${workspaceId}`);
      const result = await seedLearnedFacts(workspaceId);
      console.log(`[Fixtures] Seed result: ${result.insertedCount} facts`);
      return result;
    };

    await use(seed);
  },

  /**
   * Seed thread session fixture
   */
  seedThreadSession: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult[]> => {
      console.log(`[Fixtures] Seeding thread session for workspace: ${workspaceId}`);
      const results = await seedThreadSession(workspaceId);
      console.log(`[Fixtures] Seed results:\n${formatSeedResults(results)}`);
      return results;
    };

    await use(seed);
  },

  /**
   * Seed analytics fixture
   */
  seedAnalytics: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult> => {
      console.log(`[Fixtures] Seeding analytics for workspace: ${workspaceId}`);
      const result = await seedAnalytics(workspaceId);
      console.log(`[Fixtures] Seed result: ${result.insertedCount} events`);
      return result;
    };

    await use(seed);
  },

  /**
   * Seed all test data fixture
   */
  seedAll: async ({ workspaceId }, use) => {
    const seed = async (): Promise<SeedResult[]> => {
      console.log(`[Fixtures] Seeding ALL test data for workspace: ${workspaceId}`);
      const results = await seedAll(workspaceId);
      console.log(`[Fixtures] Seed results:\n${formatSeedResults(results)}`);
      return results;
    };

    await use(seed);
  },
});

// Re-export expect from Playwright
export { expect };

// Re-export test data for assertions
export * from './test-data';

// Re-export types for advanced usage
export type { CleanupResult } from './cleanup';
export type { SeedResult } from './seed';
