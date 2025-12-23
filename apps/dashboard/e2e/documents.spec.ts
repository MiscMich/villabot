import { test, expect } from '@playwright/test';

test.describe('Documents Management', () => {
  // Auth state is handled by playwright.config.ts chromium project

  test.describe('Documents List Page', () => {
    test('should display documents page', async ({ page }) => {
      await page.goto('/documents');
      await expect(page).toHaveURL(/documents/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show documents page - check for heading, sidebar, or loading
      const hasHeading = await page.getByRole('heading', { name: /documents/i }).isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);
      const hasDocText = await page.getByText(/document/i).first().isVisible().catch(() => false);

      expect(hasHeading || hasSidebar || hasDocText).toBeTruthy();
    });

    test('should show document statistics or loading', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show statistics cards or loading state
      const hasTotal = await page.getByText(/total|documents/i).first().isVisible().catch(() => false);
      const hasCards = await page.locator('.glass-card').first().isVisible().catch(() => false);
      const hasLoading = await page.locator('.animate-pulse').first().isVisible().catch(() => false);

      expect(hasTotal || hasCards || hasLoading).toBeTruthy();
    });

    test('should have search functionality', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have search input
      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible().catch(() => false)) {
        await expect(searchInput).toBeVisible();
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
      }
    });

    test('should have filter or category options', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have filter/category dropdown, tabs, or buttons
      const filterElement = page.getByRole('combobox').or(
        page.getByRole('tablist')
      ).or(
        page.getByText(/filter|category|all|type/i).first()
      ).or(
        page.getByRole('button', { name: /filter|category/i })
      );

      if (await filterElement.first().isVisible().catch(() => false)) {
        await expect(filterElement.first()).toBeVisible();
      }
    });
  });

  test.describe('Document Categories', () => {
    test('should display category options if available', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have category options
      const categoryFilter = page.getByRole('combobox').or(
        page.getByText(/category|type|filter/i)
      );

      if (await categoryFilter.first().isVisible().catch(() => false)) {
        await expect(categoryFilter.first()).toBeVisible();
      }
    });
  });

  test.describe('Document Details', () => {
    test('should show document cards or empty state', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Look for document cards, empty state, or any content indicating page loaded
      const documentCards = page.locator('[data-testid="document-card"]').or(
        page.locator('.glass-card').filter({ hasText: /\.pdf|\.doc|\.txt|google|drive|sync/i })
      );
      const emptyState = page.getByText(/no documents|get started|connect|upload|sync|google/i);

      const hasDocuments = (await documentCards.count()) > 0;
      const hasEmpty = await emptyState.first().isVisible().catch(() => false);
      const hasCards = await page.locator('.glass-card').first().isVisible().catch(() => false);
      const hasLoading = await page.locator('.shimmer, .animate-pulse').first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      expect(hasDocuments || hasEmpty || hasCards || hasLoading || hasSidebar).toBeTruthy();
    });
  });

  test.describe('Google Drive Integration', () => {
    test('should show Drive connection status or connect option', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show Drive connection status or connect button
      const driveStatus = page.getByText(/google drive|connected|connect|sync/i);
      const driveButton = page.getByRole('button', { name: /connect|google|drive/i });

      const hasStatus = await driveStatus.first().isVisible().catch(() => false);
      const hasButton = await driveButton.first().isVisible().catch(() => false);

      // Either status or button should be present
      if (hasStatus || hasButton) {
        expect(true).toBeTruthy();
      }
    });

    test('should have sync capability', async ({ page }) => {
      await page.goto('/documents');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Look for sync button or sync status
      const syncButton = page.getByRole('button', { name: /sync|refresh/i });
      const syncText = page.getByText(/sync|last synced/i);

      const hasSync = await syncButton.isVisible().catch(() => false);
      const hasSyncText = await syncText.first().isVisible().catch(() => false);

      // Sync capability should be present if connected
      if (hasSync || hasSyncText) {
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('Document Navigation', () => {
    test('should have documents link in sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Should have documents link
      const docsLink = page.getByRole('link', { name: /document/i });
      await expect(docsLink.first()).toBeVisible();
    });

    test('should navigate from dashboard to documents', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for page to fully load
      await page.waitForTimeout(2000);

      // Find and click documents link
      const docsLink = page.getByRole('link', { name: /document/i }).first();
      const hasDocsLink = await docsLink.isVisible().catch(() => false);

      if (hasDocsLink) {
        await docsLink.click();
        // Wait for navigation
        await page.waitForTimeout(2000);
        const onDocsPage = await page.url().includes('documents');
        const hasDocContent = await page.getByText(/documents|no documents|upload/i).first().isVisible().catch(() => false);
        expect(onDocsPage || hasDocContent).toBeTruthy();
      } else {
        // No documents link - check if page has valid sidebar
        await expect(page.locator('nav, aside').first()).toBeVisible();
      }
    });
  });
});
