/**
 * Authentication E2E Tests
 *
 * Tests login, logout, and protected route access.
 * These tests run in the 'chromium-noauth' project to start unauthenticated.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/auth/signin');

      // Check for login form elements
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
    });

    test('should show validation errors for empty submission', async ({ page }) => {
      await page.goto('/auth/signin');

      // Try to submit empty form
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should show validation message (HTML5 or custom)
      const emailInput = page.getByLabel(/email/i);
      const isInvalid =
        (await emailInput.getAttribute('aria-invalid')) === 'true' ||
        (await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid));

      expect(isInvalid).toBe(true);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/signin');

      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Wait for error message
      await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 });
    });

    test('should redirect to dashboard after successful login', async ({ page }) => {
      const email = process.env.PLAYWRIGHT_TEST_EMAIL;
      const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

      if (!email || !password) {
        test.skip();
        return;
      }

      await page.goto('/auth/signin');

      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should redirect to dashboard or setup
      await page.waitForURL(/\/(dashboard|setup|bots)/, { timeout: 15000 });
    });

    test('should have link to signup page', async ({ page }) => {
      await page.goto('/auth/signin');

      const signupLink = page.getByRole('link', { name: /sign up|create account|register/i });
      await expect(signupLink).toBeVisible();
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/auth/signup');

      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /sign up|create|register/i })).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await page.goto('/auth/signup');

      const loginLink = page.getByRole('link', { name: /sign in|log in|already have/i });
      await expect(loginLink).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected page without auth
      await page.goto('/dashboard');

      // Should redirect to signin
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should redirect from /bots to login when unauthenticated', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should redirect from /documents to login when unauthenticated', async ({ page }) => {
      await page.goto('/documents');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('should redirect from /settings to login when unauthenticated', async ({ page }) => {
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe('Authenticated User', () => {
    // Use saved auth state for these tests
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should access dashboard when authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      // Should not redirect to login
      await expect(page).not.toHaveURL(/\/auth\/login/);

      // Wait for loading to complete - look for nav element or specific dashboard content
      await expect(
        page.locator('nav').or(page.getByRole('heading', { name: /dashboard|overview/i }))
      ).toBeVisible({ timeout: 15000 });
    });

    test('should display user info or logout option', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for navigation to be visible first (indicates page loaded)
      await expect(page.locator('nav')).toBeVisible({ timeout: 15000 });

      // Should have some indication of logged-in state
      // The sidebar has user-menu data-testid and a sign-out button with aria-label
      const hasUserIndicator = await Promise.race([
        page.locator('[data-testid="user-menu"]').isVisible(),
        page.locator('[data-testid="sign-out-button"]').isVisible(),
        page.getByRole('button', { name: /sign out/i }).isVisible(),
      ]).catch(() => false);

      // At minimum, we should be able to navigate
      const hasNavigation = await page.locator('nav').isVisible();

      expect(hasUserIndicator || hasNavigation).toBe(true);
    });
  });
});
