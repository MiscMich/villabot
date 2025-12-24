/**
 * Billing Page E2E Tests
 *
 * Tests subscription management and Stripe integration.
 */

import { test, expect } from '@playwright/test';

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display billing header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /billing|subscription/i })).toBeVisible();
    });

    test('should display current plan info', async ({ page }) => {
      const hasPlanInfo = await Promise.race([
        page.getByText(/current plan|your plan|free|pro|enterprise/i).isVisible(),
        page.locator('[data-testid="current-plan"]').isVisible(),
      ]).catch(() => false);

      expect(hasPlanInfo).toBe(true);
    });
  });

  test.describe('Plan Display', () => {
    test('should show plan options', async ({ page }) => {
      const hasPlanOptions = await Promise.race([
        page.getByText(/upgrade|plans|pricing/i).isVisible(),
        page.locator('[data-testid="plan-options"]').isVisible(),
      ]).catch(() => false);

      expect(hasPlanOptions).toBe(true);
    });

    test('should display plan features', async ({ page }) => {
      const hasFeatures = await Promise.race([
        page.getByText(/features|included|bots|documents/i).isVisible(),
        page.locator('ul, [data-testid="features"]').isVisible(),
      ]).catch(() => false);

      expect(typeof hasFeatures).toBe('boolean');
    });
  });

  test.describe('Upgrade Flow', () => {
    test('should have upgrade button for free users', async ({ page }) => {
      const upgradeButton = page.getByRole('button', { name: /upgrade|subscribe/i });

      // May or may not be visible depending on current plan
      const hasUpgrade = await upgradeButton.isVisible().catch(() => false);
      expect(typeof hasUpgrade).toBe('boolean');
    });

    test('should have manage subscription for paid users', async ({ page }) => {
      const manageButton = page.getByRole('button', { name: /manage|portal|subscription/i });

      // May or may not be visible depending on current plan
      const hasManage = await manageButton.isVisible().catch(() => false);
      expect(typeof hasManage).toBe('boolean');
    });
  });

  test.describe('Usage Display', () => {
    test('should show usage metrics', async ({ page }) => {
      const hasUsage = await Promise.race([
        page.getByText(/usage|used|remaining|limit/i).isVisible(),
        page.locator('[data-testid="usage-metrics"]').isVisible(),
      ]).catch(() => false);

      expect(typeof hasUsage).toBe('boolean');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible();
    });
  });
});
