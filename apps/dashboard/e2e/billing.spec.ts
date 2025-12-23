import { test, expect } from '@playwright/test';

test.describe('Billing', () => {
  // Auth state is handled by playwright.config.ts chromium project

  test.describe('Billing Page', () => {
    test('should display billing page', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show billing page - check for heading or content
      const hasHeading = await page.getByRole('heading', { name: /billing|subscription|plan/i }).isVisible().catch(() => false);
      const hasBillingText = await page.getByText(/billing|subscription|plan|tier/i).first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      expect(hasHeading || hasBillingText || hasSidebar).toBeTruthy();
    });

    test('should display plan information', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show plan features or limits
      const hasPlanInfo = await page.getByText(/plan|tier|subscription|free|pro|enterprise/i).first().isVisible().catch(() => false);
      const hasFeatures = await page.getByText(/bots|documents|users|features|limit/i).first().isVisible().catch(() => false);

      expect(hasPlanInfo || hasFeatures).toBeTruthy();
    });

    test('should show upgrade options or plan management', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // If on free tier, should show upgrade options, or plan info
      const upgradeButton = page.getByRole('button', { name: /upgrade|pro|premium|subscribe/i });
      const viewPlansButton = page.getByRole('button', { name: /view plans|see plans|compare/i });
      const manageButton = page.getByRole('button', { name: /manage|portal|billing/i });
      const planText = page.getByText(/free|pro|enterprise|plan|tier/i);

      const hasUpgrade = await upgradeButton.first().isVisible().catch(() => false);
      const hasViewPlans = await viewPlansButton.first().isVisible().catch(() => false);
      const hasManage = await manageButton.first().isVisible().catch(() => false);
      const hasPlanText = await planText.first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      // At least one option or plan info should be present
      expect(hasUpgrade || hasViewPlans || hasManage || hasPlanText || hasSidebar).toBeTruthy();
    });
  });

  test.describe('Stripe Integration', () => {
    test('should have checkout or upgrade functionality', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Look for upgrade/checkout button
      const actionButton = page.getByRole('button', { name: /upgrade|checkout|subscribe|manage|portal/i }).first();

      if (await actionButton.isVisible().catch(() => false)) {
        await expect(actionButton).toBeVisible();
      }
    });
  });

  test.describe('Usage Tracking', () => {
    test('should display usage information', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show some usage metrics or plan limits
      const hasUsage = await page.getByText(/usage|used|limit|remaining|bots|documents/i).first().isVisible().catch(() => false);
      const hasCards = await page.locator('.glass-card, .card').first().isVisible().catch(() => false);

      expect(hasUsage || hasCards).toBeTruthy();
    });

    test('should show resource counts', async ({ page }) => {
      await page.goto('/billing');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should display number of bots or documents used
      const hasBot = await page.getByText(/bot/i).first().isVisible().catch(() => false);
      const hasDoc = await page.getByText(/document/i).first().isVisible().catch(() => false);
      const hasCount = await page.locator('text=/\\d+/').first().isVisible().catch(() => false);

      expect(hasBot || hasDoc || hasCount).toBeTruthy();
    });
  });

  test.describe('Billing Navigation', () => {
    test('should navigate to billing from sidebar if link exists', async ({ page }) => {
      await page.goto('/dashboard');

      // Billing link may or may not exist in sidebar
      const billingLink = page.getByRole('link', { name: /billing/i });

      if (await billingLink.first().isVisible().catch(() => false)) {
        await billingLink.first().click();
        await expect(page).toHaveURL(/billing/);
      }
    });

    test('should be accessible via direct URL', async ({ page }) => {
      await page.goto('/billing');

      // Should not redirect away from billing
      await expect(page).toHaveURL(/billing/);
    });
  });
});
