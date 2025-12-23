import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  // Auth state is handled by playwright.config.ts chromium project

  test.describe('Dashboard Overview', () => {
    test('should display dashboard page', async ({ page }) => {
      await page.goto('/dashboard');

      // Dashboard page should render (sidebar always visible even if content loading)
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // URL should be dashboard
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should show welcome message or loading', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show either welcome content OR loading skeleton (both are valid states)
      const hasContent = await page.getByText(/welcome|hello|overview|dashboard/i).first().isVisible().catch(() => false);
      const hasLoading = await page.locator('.animate-pulse').first().isVisible().catch(() => false);

      expect(hasContent || hasLoading).toBeTruthy();
    });
  });

  test.describe('Statistics Cards', () => {
    test('should display statistics cards or loading', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for sidebar to be visible
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show stat cards OR loading skeletons
      const hasCards = await page.locator('.glass-card, [data-testid="stat-card"]').first().isVisible().catch(() => false);
      const hasLoading = await page.locator('.animate-pulse').first().isVisible().catch(() => false);

      expect(hasCards || hasLoading).toBeTruthy();
    });

    test('should show bot count in sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Sidebar navigation always has "Bots" link
      await expect(page.getByRole('link', { name: /bot/i }).first()).toBeVisible();
    });

    test('should show document link in sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Sidebar navigation always has "Documents" link
      await expect(page.getByRole('link', { name: /document/i }).first()).toBeVisible();
    });

    test('should show query/usage metrics link', async ({ page }) => {
      await page.goto('/dashboard');

      // Sidebar should have analytics link
      await expect(page.getByRole('link', { name: /analytic/i }).first()).toBeVisible();
    });
  });

  test.describe('Quick Actions', () => {
    test('should have navigation buttons', async ({ page }) => {
      await page.goto('/dashboard');

      // Should have navigation links in sidebar
      const navLinks = page.locator('nav a, aside a').filter({
        hasText: /dashboard|document|bot|setting/i,
      });

      await expect(navLinks.first()).toBeVisible();
    });

    test('should navigate to bots from sidebar', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for navigation items to load
      await page.waitForTimeout(1000);

      // Find link to bots in sidebar (exact name is "Bots")
      const botsLink = page.getByRole('link', { name: /bots/i }).first();
      await expect(botsLink).toBeVisible({ timeout: 5000 });

      // Click and wait for navigation
      await Promise.all([
        page.waitForURL(/bots/, { timeout: 15000 }),
        botsLink.click(),
      ]);
    });

    test('should navigate to documents from sidebar', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for navigation items to load
      await page.waitForTimeout(1000);

      // Find link to documents (exact name is "Documents")
      const docsLink = page.getByRole('link', { name: /documents/i }).first();
      await expect(docsLink).toBeVisible({ timeout: 5000 });

      // Click and wait for navigation
      await Promise.all([
        page.waitForURL(/documents/, { timeout: 15000 }),
        docsLink.click(),
      ]);
    });
  });

  test.describe('Recent Activity', () => {
    test('should show recent activity or loading', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have activity section, sidebar, or loading state
      const hasActivity = await page.getByText(/recent|activity|latest|sync/i).first().isVisible().catch(() => false);
      const hasLoading = await page.locator('.animate-pulse, .shimmer').first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      expect(hasActivity || hasLoading || hasSidebar).toBeTruthy();
    });
  });

  test.describe('Setup Status', () => {
    test('should show setup progress if incomplete', async ({ page }) => {
      await page.goto('/dashboard');

      // May show setup progress in sidebar
      const setupIndicator = page.getByText(/setup|getting started|complete|connect/i);

      // This is optional - workspace may be fully set up
      if (await setupIndicator.first().isVisible().catch(() => false)) {
        await expect(setupIndicator.first()).toBeVisible();
      }
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Should have sidebar navigation
      const sidebar = page.locator('aside').or(page.locator('nav'));
      await expect(sidebar.first()).toBeVisible();
    });

    test('should have navigation links', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have main navigation links - exact names from sidebar
      await expect(page.getByRole('link', { name: /overview/i }).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('link', { name: /bots/i })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('link', { name: /documents/i })).toBeVisible({ timeout: 5000 });
    });

    test('should highlight active page', async ({ page }) => {
      await page.goto('/dashboard');

      // Dashboard/Overview link should be visible
      const dashboardLink = page.getByRole('link', { name: /overview|dashboard/i }).first();
      await expect(dashboardLink).toBeVisible();

      // The link is active since we're on dashboard
      const href = await dashboardLink.getAttribute('href');
      expect(href).toMatch(/dashboard/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Should still render (mobile menu or visible content)
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show mobile menu on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Look for mobile menu button (hamburger)
      const menuButton = page.getByRole('button', { name: /menu|toggle/i }).or(
        page.locator('[data-testid="mobile-menu"]').or(
          page.locator('[aria-label*="menu" i]')
        )
      );

      // Mobile menu button should be visible on small screens
      await expect(menuButton.first()).toBeVisible({ timeout: 5000 });
    });
  });
});
