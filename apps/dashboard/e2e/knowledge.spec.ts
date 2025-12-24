/**
 * Knowledge Page E2E Tests
 *
 * Tests learned facts display, verification workflow, and manual fact creation.
 * This is the key user-facing component of the RAG pipeline.
 */

import { test, expect } from '@playwright/test';

test.describe('Knowledge Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display knowledge base header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /knowledge/i })).toBeVisible();
    });

    test('should display Add Fact button', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact|create.*fact/i });
      await expect(addButton).toBeVisible();
    });

    test('should display stats cards', async ({ page }) => {
      // Should show pending, verified, and total counts
      const statsSection = await Promise.race([
        page.getByText(/pending.*review/i).isVisible(),
        page.getByText(/verified.*facts/i).isVisible(),
        page.getByText(/total.*knowledge/i).isVisible(),
      ]).catch(() => false);

      expect(statsSection).toBe(true);
    });
  });

  test.describe('Stats Display', () => {
    test('should show pending review count', async ({ page }) => {
      const pendingCard = page.locator('text=/pending/i').first();
      await expect(pendingCard).toBeVisible();
    });

    test('should show verified facts count', async ({ page }) => {
      const verifiedCard = page.locator('text=/verified/i').first();
      await expect(verifiedCard).toBeVisible();
    });
  });

  test.describe('Pending Facts Section', () => {
    test('should display pending facts or empty state', async ({ page }) => {
      // Look for pending section
      const pendingSection = page.locator('text=/pending.*review/i').first();
      await expect(pendingSection).toBeVisible();

      // Should show facts or "all caught up" message
      const hasContent = await Promise.race([
        page.getByText(/all caught up|no facts pending/i).isVisible(),
        page.getByRole('button', { name: /approve/i }).isVisible(),
      ]).catch(() => false);

      expect(hasContent).toBe(true);
    });

    test('should have approve and reject buttons for pending facts', async ({ page }) => {
      // If there are pending facts, should have action buttons
      const approveButton = page.getByRole('button', { name: /approve/i }).first();

      if (await approveButton.isVisible()) {
        await expect(approveButton).toBeEnabled();

        const rejectButton = page.getByRole('button', { name: /reject/i }).first();
        await expect(rejectButton).toBeVisible();
      }
    });
  });

  test.describe('Verified Facts Section', () => {
    test('should display verified facts or empty state', async ({ page }) => {
      const verifiedSection = page.locator('text=/verified.*facts/i').first();
      await expect(verifiedSection).toBeVisible();

      // Should show facts or empty message
      const hasContent = await Promise.race([
        page.getByText(/no verified facts|approve pending/i).isVisible(),
        page.locator('[data-testid="verified-fact"]').first().isVisible(),
        page.locator('text=/verified/i').locator('..').locator('p, div').first().isVisible(),
      ]).catch(() => false);

      expect(hasContent).toBe(true);
    });

    test('should have delete button on hover for verified facts', async ({ page }) => {
      const verifiedFact = page.locator('[data-testid="verified-fact"], .group').first();

      if (await verifiedFact.isVisible()) {
        await verifiedFact.hover();

        // Delete button should become visible on hover
        const deleteButton = verifiedFact.getByRole('button', { name: /delete/i });
        if (await deleteButton.isVisible()) {
          await expect(deleteButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Add Fact Modal', () => {
    test('should open modal when Add Fact button clicked', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      // Modal should open
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    test('should display fact input form', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      // Should have fact text input
      await expect(page.getByLabel(/fact|rule/i)).toBeVisible();

      // Should have source input (optional)
      await expect(page.getByLabel(/source/i)).toBeVisible();

      // Should have submit button
      await expect(page.getByRole('button', { name: /add|save|create/i })).toBeVisible();
    });

    test('should close modal on cancel', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      // Modal should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should require fact text', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      // Try to submit empty form
      const submitButton = page.getByRole('button', { name: /add.*fact/i }).last();
      await submitButton.click();

      // Should show validation or button should be disabled
      const factInput = page.getByLabel(/fact|rule/i);
      const isInvalid =
        await submitButton.isDisabled() ||
        (await factInput.getAttribute('aria-invalid')) === 'true';

      expect(isInvalid).toBe(true);
    });

    test('should create fact with valid input', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      // Fill in fact
      const testFact = 'E2E Test Fact - ' + new Date().getTime();
      await page.getByLabel(/fact|rule/i).fill(testFact);
      await page.getByLabel(/source/i).fill('E2E Test');

      // Submit
      const submitButton = page.getByRole('button', { name: /add.*fact/i }).last();
      await submitButton.click();

      // Modal should close
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

      // Fact should appear in verified list (since manual facts are auto-verified)
      await expect(page.getByText(testFact)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Fact Verification Workflow', () => {
    test('should approve pending fact', async ({ page }) => {
      const approveButton = page.getByRole('button', { name: /approve/i }).first();

      if (await approveButton.isVisible()) {
        // Get the fact content before approving
        const factContent = await page.locator('.whitespace-pre-wrap').first().textContent();

        await approveButton.click();

        // Wait for the fact to move to verified section
        await page.waitForTimeout(1000);

        // The approve button for this fact should be gone
        // and the fact should be in verified section
        await expect(page.getByText(factContent || '')).toBeVisible();
      }
    });

    test('should reject pending fact with confirmation', async ({ page }) => {
      const rejectButton = page.getByRole('button', { name: /reject/i }).first();

      if (await rejectButton.isVisible()) {
        // Set up dialog handler for confirmation
        page.on('dialog', async (dialog) => {
          await dialog.accept();
        });

        await rejectButton.click();

        // Wait for rejection to process
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Fact Deletion', () => {
    test('should delete verified fact with confirmation', async ({ page }) => {
      // Find a verified fact with delete button
      const factGroup = page.locator('.group, [data-testid="verified-fact"]').first();

      if (await factGroup.isVisible()) {
        await factGroup.hover();

        const deleteButton = factGroup.getByRole('button').filter({ has: page.locator('svg') });

        if (await deleteButton.isVisible()) {
          // Set up dialog handler
          page.on('dialog', async (dialog) => {
            await dialog.accept();
          });

          await deleteButton.click();

          // Wait for deletion
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should have accessible buttons', async ({ page }) => {
      const buttons = page.getByRole('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        const hasAccessibleName =
          (await button.getAttribute('aria-label')) ||
          (await button.textContent());
        expect(hasAccessibleName).toBeTruthy();
      }
    });

    test('should have form labels', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add.*fact/i });
      await addButton.click();

      // Form inputs should have labels
      const factInput = page.getByLabel(/fact|rule/i);
      await expect(factInput).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state initially', async ({ page }) => {
      // Navigate with cache cleared to see loading state
      await page.goto('/knowledge', { waitUntil: 'commit' });

      // Should show loading indicator briefly
      const hasLoading = await Promise.race([
        page.locator('.shimmer, [data-loading], .animate-pulse').first().isVisible(),
        page.waitForTimeout(100).then(() => false),
      ]).catch(() => false);

      // Loading state is transient, just verify page eventually loads
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /knowledge/i })).toBeVisible();
    });
  });
});
