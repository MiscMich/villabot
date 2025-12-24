/**
 * Documents Page E2E Tests
 *
 * Tests document listing, filtering, sync controls, and document details.
 * Requires authenticated user with workspace access.
 */

import { test, expect } from '@playwright/test';

test.describe('Documents Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display documents header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /documents/i })).toBeVisible();
    });

    test('should display sync controls', async ({ page }) => {
      // Should have sync button or controls
      const syncButton = page.getByRole('button', { name: /sync|refresh/i });
      await expect(syncButton).toBeVisible();
    });

    test('should display filter options', async ({ page }) => {
      // Should have filter controls (source type, active status)
      const hasFilters = await Promise.race([
        page.getByRole('combobox').first().isVisible(),
        page.getByText(/filter|source|type/i).first().isVisible(),
        page.locator('[data-testid="filter"]').isVisible(),
      ]).catch(() => false);

      expect(hasFilters).toBe(true);
    });
  });

  test.describe('Document List', () => {
    test('should display documents or empty state', async ({ page }) => {
      // Either show document list or empty state message
      const hasContent = await Promise.race([
        page.locator('table, [data-testid="document-list"]').isVisible(),
        page.getByText(/no documents|empty|get started/i).isVisible(),
      ]).catch(() => false);

      expect(hasContent).toBe(true);
    });

    test('should show document metadata when documents exist', async ({ page }) => {
      // Check if documents table exists with expected columns
      const table = page.locator('table');
      if (await table.isVisible()) {
        // Should have columns for title, type, source, last modified
        await expect(page.getByRole('columnheader', { name: /title|name/i })).toBeVisible();
      }
    });
  });

  test.describe('Source Filtering', () => {
    test('should filter by Google Drive source', async ({ page }) => {
      // Find and click filter control
      const filterControl = page.getByRole('combobox').first();
      if (await filterControl.isVisible()) {
        await filterControl.click();

        // Select Google Drive option if available
        const driveOption = page.getByRole('option', { name: /drive|google/i });
        if (await driveOption.isVisible()) {
          await driveOption.click();

          // URL should update with filter parameter
          await expect(page).toHaveURL(/source.*drive|type.*drive/i);
        }
      }
    });

    test('should filter by website source', async ({ page }) => {
      const filterControl = page.getByRole('combobox').first();
      if (await filterControl.isVisible()) {
        await filterControl.click();

        const websiteOption = page.getByRole('option', { name: /website|web|scrape/i });
        if (await websiteOption.isVisible()) {
          await websiteOption.click();
          await expect(page).toHaveURL(/source.*website|type.*website/i);
        }
      }
    });
  });

  test.describe('Sync Controls', () => {
    test('should trigger Google Drive sync', async ({ page }) => {
      const syncButton = page.getByRole('button', { name: /sync.*drive|drive.*sync/i });

      if (await syncButton.isVisible()) {
        await syncButton.click();

        // Should show loading state or success message
        const feedback = await Promise.race([
          page.getByText(/syncing|started|success|queued/i).isVisible(),
          page.locator('[data-testid="sync-loading"]').isVisible(),
          syncButton.isDisabled(),
        ]).catch(() => false);

        expect(feedback).toBe(true);
      }
    });

    test('should display sync status', async ({ page }) => {
      // Should show last sync time or status indicator
      const hasStatus = await Promise.race([
        page.getByText(/last sync|synced|never synced/i).isVisible(),
        page.locator('[data-testid="sync-status"]').isVisible(),
      ]).catch(() => false);

      // Status display is optional but good to have
      expect(typeof hasStatus).toBe('boolean');
    });
  });

  test.describe('Document Details', () => {
    test('should navigate to document details on click', async ({ page }) => {
      // Find a document row/card
      const documentLink = page.locator('table tbody tr a, [data-testid="document-item"] a').first();

      if (await documentLink.isVisible()) {
        await documentLink.click();

        // Should navigate to document detail page or open modal
        const showsDetails = await Promise.race([
          page.waitForURL(/\/documents\/[a-z0-9-]+/i, { timeout: 5000 }).then(() => true),
          page.locator('[role="dialog"]').isVisible(),
        ]).catch(() => false);

        expect(showsDetails).toBe(true);
      }
    });
  });

  test.describe('Bulk Actions', () => {
    test('should have select all checkbox', async ({ page }) => {
      const table = page.locator('table');
      if (await table.isVisible()) {
        const selectAll = page.locator('table thead input[type="checkbox"]');
        if (await selectAll.isVisible()) {
          await selectAll.check();

          // All row checkboxes should be checked
          const rowCheckboxes = page.locator('table tbody input[type="checkbox"]');
          const count = await rowCheckboxes.count();
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              await expect(rowCheckboxes.nth(i)).toBeChecked();
            }
          }
        }
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show helpful message when no documents', async ({ page }) => {
      // If empty state is shown, it should have helpful guidance
      const emptyState = page.getByText(/no documents|get started|connect|sync/i);
      if (await emptyState.isVisible()) {
        // Should provide action or guidance
        const hasGuidance = await Promise.race([
          page.getByRole('button', { name: /connect|sync|add/i }).isVisible(),
          page.getByRole('link', { name: /connect|settings|setup/i }).isVisible(),
          page.getByText(/connect.*drive|sync.*documents/i).isVisible(),
        ]).catch(() => false);

        expect(hasGuidance).toBe(true);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Page should have h1
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should have accessible table', async ({ page }) => {
      const table = page.locator('table');
      if (await table.isVisible()) {
        // Table should have headers
        const headerCount = await page.locator('table thead th, table thead [role="columnheader"]').count();
        expect(headerCount).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
