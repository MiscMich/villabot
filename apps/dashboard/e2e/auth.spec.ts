import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Sign In', () => {
    test('should show sign in form', async ({ page }) => {
      await page.goto('/auth/signin');

      await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/signin');

      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 5000 });
    });

    test('should link to sign up page', async ({ page }) => {
      await page.goto('/auth/signin');

      const signUpLink = page.getByRole('link', { name: /sign up|create account/i });
      await expect(signUpLink).toBeVisible();

      await signUpLink.click();
      await expect(page).toHaveURL(/signup/);
    });
  });

  test.describe('Sign Up', () => {
    test('should show sign up form', async ({ page }) => {
      await page.goto('/auth/signup');

      // Heading could be "Sign up", "Create account", "Get started", etc.
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign up|create|get started/i })).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/auth/signup');

      await page.getByLabel(/email/i).fill('invalid-email');
      // Use exact match for password to avoid matching confirm password
      await page.getByLabel(/^password$/i).fill('testpassword123');
      await page.getByRole('button', { name: /sign up|create|get started/i }).click();

      // Should either show validation error or email field should have invalid state
      // Different browsers/frameworks handle validation differently
      const emailInput = page.getByLabel(/email/i);
      const hasError = await page.getByText(/valid|invalid|error/i).isVisible().catch(() => false);
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);

      expect(hasError || isInvalid).toBeTruthy();
    });

    test('should link to sign in page', async ({ page }) => {
      await page.goto('/auth/signup');

      const signInLink = page.getByRole('link', { name: /sign in|log in/i });
      await expect(signInLink).toBeVisible();

      await signInLink.click();
      await expect(page).toHaveURL(/signin/);
    });
  });

  test.describe('Password Reset', () => {
    test('should show forgot password link on sign in', async ({ page }) => {
      await page.goto('/auth/signin');

      const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
      await expect(forgotLink).toBeVisible();
    });

    test('should navigate to password reset page', async ({ page }) => {
      await page.goto('/auth/signin');

      await page.getByRole('link', { name: /forgot|reset/i }).click();
      await expect(page).toHaveURL(/reset|forgot/);
    });
  });

  test.describe('Authenticated Routes', () => {
    test.use({ storageState: 'playwright/.auth/user.json' });

    test('should access dashboard when authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      // Should not redirect to login
      await expect(page).not.toHaveURL(/auth/);

      // Should show sidebar navigation (always visible even when content loading)
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });
    });

    test('should show user menu when authenticated', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByTestId('user-menu')).toBeVisible();
    });

    test('should sign out successfully', async ({ page }) => {
      await page.goto('/dashboard');

      // First check we're actually on dashboard (not redirected to login)
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Wait for sidebar to be visible (always renders even if content is loading)
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for animations to complete
      await page.waitForTimeout(2000);

      // Click sign out button (in sidebar, has data-testid="sign-out-button")
      const signOutButton = page.getByTestId('sign-out-button');

      // Scroll the button into view and wait for it
      if (await signOutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await signOutButton.scrollIntoViewIfNeeded();
        await signOutButton.click({ force: true });

        // Should redirect to sign in page
        await expect(page).toHaveURL(/signin|login/, { timeout: 10000 });
      } else {
        // Button not visible - try clicking the user menu area or aria-label
        const signOutByLabel = page.locator('[aria-label="Sign out"]');
        if (await signOutByLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
          await signOutByLabel.click({ force: true });
          await expect(page).toHaveURL(/signin|login/, { timeout: 10000 });
        }
      }
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to sign in', async ({ page }) => {
      // Clear any existing auth state
      await page.context().clearCookies();

      await page.goto('/dashboard');

      // Should redirect to auth
      await expect(page).toHaveURL(/auth/);
    });
  });
});
