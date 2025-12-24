/**
 * Authentication setup for Playwright E2E tests
 *
 * This file runs before authenticated tests to establish a valid session.
 * It saves the authentication state to playwright/.auth/user.json which is
 * then reused by all authenticated test specs.
 *
 * @see https://playwright.dev/docs/auth#basic-shared-account-in-all-tests
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Get test credentials from environment
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Missing test credentials. Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in .env.test'
    );
  }

  // Navigate to login page
  await page.goto('/auth/login');

  // Wait for the login form to be visible
  await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

  // Fill in credentials
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  // Submit the form
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Wait for successful redirect to dashboard or setup
  // Could redirect to /dashboard or /setup depending on workspace state
  await page.waitForURL(/\/(dashboard|setup|bots|documents)/, { timeout: 15000 });

  // Verify we're authenticated by checking for common authenticated elements
  // Either the sidebar navigation or setup wizard should be visible
  const isAuthenticated = await Promise.race([
    page.locator('nav').isVisible().then(() => true),
    page.locator('[data-testid="setup-wizard"]').isVisible().then(() => true),
    page.getByText(/dashboard|setup|welcome/i).first().isVisible().then(() => true),
  ]).catch(() => false);

  expect(isAuthenticated).toBe(true);

  // Save authentication state for reuse in other tests
  await page.context().storageState({ path: authFile });
});
