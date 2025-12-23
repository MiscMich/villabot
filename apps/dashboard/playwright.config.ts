import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Cluebase AI E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Setup project - handles authentication state */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    /* Authenticated tests - bots, billing, documents, settings, dashboard */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      /* Only run authenticated test files */
      testMatch: [
        '**/bots.spec.ts',
        '**/billing.spec.ts',
        '**/documents.spec.ts',
        '**/settings.spec.ts',
        '**/dashboard.spec.ts',
      ],
    },

    /* Public page tests that don't require authentication */
    {
      name: 'chromium-noauth',
      use: {
        ...devices['Desktop Chrome'],
        /* No storageState - tests start unauthenticated */
      },
      /* Depend on setup so auth file exists for tests that use test.use({ storageState }) */
      dependencies: ['setup'],
      /* Only run auth spec which tests both authenticated and unauthenticated flows */
      testMatch: ['**/auth.spec.ts'],
    },
  ],

  /* Run your local dev server before starting the tests */
  /* Skip webServer when using external URL or in CI, or when server already running */
  webServer: (process.env.CI || process.env.PLAYWRIGHT_BASE_URL || process.env.REUSE_SERVER) ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 180 * 1000, // 3 minutes for first compile
  },
});
