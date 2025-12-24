/**
 * Dashboard Page E2E Tests
 *
 * Tests the main dashboard overview page with stats and metrics.
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display dashboard header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /dashboard|overview|welcome/i })).toBeVisible();
    });

    test('should display sidebar navigation', async ({ page }) => {
      const sidebar = page.locator('nav, [data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();
    });

    test('should have navigation links', async ({ page }) => {
      // Should have main navigation items
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /documents/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /bots/i })).toBeVisible();
    });
  });

  test.describe('Stats Cards', () => {
    test('should display document stats', async ({ page }) => {
      const hasDocStats = await Promise.race([
        page.getByText(/documents|total docs/i).isVisible(),
        page.locator('[data-testid="doc-stats"]').isVisible(),
      ]).catch(() => false);

      expect(hasDocStats).toBe(true);
    });

    test('should display activity stats', async ({ page }) => {
      const hasActivityStats = await Promise.race([
        page.getByText(/messages|activity|this week/i).isVisible(),
        page.locator('[data-testid="activity-stats"]').isVisible(),
      ]).catch(() => false);

      expect(hasActivityStats).toBe(true);
    });

    test('should display knowledge stats', async ({ page }) => {
      const hasKnowledgeStats = await Promise.race([
        page.getByText(/knowledge|facts|learned/i).isVisible(),
        page.locator('[data-testid="knowledge-stats"]').isVisible(),
      ]).catch(() => false);

      expect(hasKnowledgeStats).toBe(true);
    });
  });

  test.describe('Quick Actions', () => {
    test('should have link to documents', async ({ page }) => {
      const docsLink = page.getByRole('link', { name: /documents|view docs/i });
      await expect(docsLink).toBeVisible();
    });

    test('should have link to bots', async ({ page }) => {
      const botsLink = page.getByRole('link', { name: /bots|manage bots/i });
      await expect(botsLink).toBeVisible();
    });

    test('should have link to knowledge', async ({ page }) => {
      const knowledgeLink = page.getByRole('link', { name: /knowledge|facts/i });
      await expect(knowledgeLink).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to documents page', async ({ page }) => {
      await page.getByRole('link', { name: /documents/i }).click();
      await expect(page).toHaveURL(/\/documents/);
    });

    test('should navigate to bots page', async ({ page }) => {
      await page.getByRole('link', { name: /bots/i }).click();
      await expect(page).toHaveURL(/\/bots/);
    });

    test('should navigate to knowledge page', async ({ page }) => {
      await page.getByRole('link', { name: /knowledge/i }).click();
      await expect(page).toHaveURL(/\/knowledge/);
    });

    test('should navigate to settings page', async ({ page }) => {
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should navigate to billing page', async ({ page }) => {
      const billingLink = page.getByRole('link', { name: /billing/i });
      if (await billingLink.isVisible()) {
        await billingLink.click();
        await expect(page).toHaveURL(/\/billing/);
      }
    });

    test('should navigate to team page', async ({ page }) => {
      const teamLink = page.getByRole('link', { name: /team/i });
      if (await teamLink.isVisible()) {
        await teamLink.click();
        await expect(page).toHaveURL(/\/team/);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Content should still be visible
      await expect(page.getByRole('heading', { name: /dashboard|overview/i })).toBeVisible();

      // May have hamburger menu for navigation
      const hasNavigation = await Promise.race([
        page.locator('nav').isVisible(),
        page.getByRole('button', { name: /menu/i }).isVisible(),
        page.locator('[data-testid="mobile-menu"]').isVisible(),
      ]).catch(() => false);

      expect(hasNavigation).toBe(true);
    });
  });

  test.describe('Loading States', () => {
    test('should show content after loading', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'commit' });

      // Wait for content to load
      await page.waitForLoadState('networkidle');

      // Should show dashboard content
      await expect(page.getByRole('heading', { name: /dashboard|overview/i })).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should have accessible navigation', async ({ page }) => {
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Navigation links should be accessible
      const links = nav.getByRole('link');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have skip link or landmarks', async ({ page }) => {
      // Should have main content area
      const hasLandmarks = await Promise.race([
        page.locator('main, [role="main"]').isVisible(),
        page.locator('[data-testid="main-content"]').isVisible(),
      ]).catch(() => false);

      expect(hasLandmarks).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls and simulate error
      await page.route('**/api/**', (route) => {
        if (route.request().url().includes('/analytics')) {
          route.fulfill({ status: 500, body: 'Server Error' });
        } else {
          route.continue();
        }
      });

      await page.goto('/dashboard');

      // Page should still load without crashing
      await expect(page.locator('body')).toBeVisible();

      // May show error state or fallback content
      const hasErrorOrContent = await Promise.race([
        page.getByText(/error|failed|try again/i).isVisible(),
        page.getByRole('heading').isVisible(),
      ]).catch(() => false);

      expect(hasErrorOrContent).toBe(true);
    });
  });
});
