import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Authentication setup - creates authenticated state for tests
 * This runs before all tests to establish a logged-in session
 * Uses E2E bypass cookie to skip setup wizard
 */
setup('authenticate', async ({ page, context }) => {
  // Increase timeout for first compile
  setup.setTimeout(180000);

  // Use test credentials from environment
  const email = process.env.PLAYWRIGHT_TEST_EMAIL || 'e2e@cluebase.ai';
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD || 'E2EPassword123';

  // Get the base URL for the domain
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
  const domain = new URL(baseURL).hostname;

  // Set E2E bypass cookie BEFORE navigating - this must be set before login
  // so the SetupGuard doesn't redirect to /setup after authentication
  await context.addCookies([
    {
      name: 'e2e_bypass_setup',
      value: 'true',
      domain: domain,
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
  ]);
  console.log('E2E bypass cookie set for domain:', domain);

  // Navigate to sign in page - use 'load' instead of 'networkidle' to avoid timeout issues
  await page.goto('/auth/signin', { waitUntil: 'load', timeout: 60000 });

  // Wait for the sign in form to be visible
  await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible({ timeout: 30000 });

  // Wait for inputs to be in DOM
  await page.waitForSelector('#email', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#password', { state: 'visible', timeout: 10000 });

  // Wait longer for React hydration
  await page.waitForTimeout(2000);

  // Use React-compatible input value setting
  await page.evaluate((emailValue) => {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    if (emailInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(emailInput, emailValue);
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }, email);

  await page.evaluate((passwordValue) => {
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    if (passwordInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(passwordInput, passwordValue);
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }, password);

  // Verify the values were filled
  await expect(page.locator('#email')).toHaveValue(email, { timeout: 5000 });
  await expect(page.locator('#password')).toHaveValue(password, { timeout: 5000 });

  // Submit the form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect - with bypass cookie, should go to dashboard
  // But allow /setup as fallback for production before middleware deploy
  await page.waitForURL(/\/(dashboard|setup)/, { timeout: 60000 });
  const currentUrl = page.url();
  console.log('Navigated to:', currentUrl);

  // If we landed on /setup despite the cookie, navigate to dashboard manually
  if (currentUrl.includes('/setup')) {
    console.log('Landed on setup - navigating to dashboard with e2e_test param');
    await page.goto('/dashboard?e2e_test=true');
    await page.waitForLoadState('domcontentloaded');
  }

  // Wait for page to settle
  await page.waitForTimeout(2000);

  // Auth succeeded! Save the storage state (includes cookies).
  await page.context().storageState({ path: authFile });
  console.log('Authentication state saved successfully');
});
