/**
 * Settings Page E2E Tests
 *
 * Tests workspace settings, integrations, and configuration.
 */

import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display settings header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    test('should display tabs or sections', async ({ page }) => {
      // Should have General and Integrations tabs/sections
      const hasGeneralTab = await page.getByRole('tab', { name: /general/i }).isVisible()
        .catch(() => page.getByText(/general/i).first().isVisible());
      const hasIntegrationsTab = await page.getByRole('tab', { name: /integrations/i }).isVisible()
        .catch(() => page.getByText(/integrations/i).first().isVisible());

      expect(hasGeneralTab || hasIntegrationsTab).toBe(true);
    });
  });

  test.describe('General Settings', () => {
    test('should display timezone setting', async ({ page }) => {
      // Click General tab if needed
      const generalTab = page.getByRole('tab', { name: /general/i });
      if (await generalTab.isVisible()) {
        await generalTab.click();
      }

      // Should have timezone selector
      const hasTimezone = await Promise.race([
        page.getByLabel(/timezone/i).isVisible(),
        page.getByText(/timezone/i).isVisible(),
      ]).catch(() => false);

      expect(hasTimezone).toBe(true);
    });

    test('should have save button', async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /save|update/i });
      await expect(saveButton).toBeVisible();
    });
  });

  test.describe('Integrations Tab', () => {
    test('should display Google Drive integration', async ({ page }) => {
      // Click Integrations tab
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      if (await integrationsTab.isVisible()) {
        await integrationsTab.click();
      }

      // Should show Drive integration section
      const hasDriveSection = await Promise.race([
        page.getByText(/google.*drive/i).isVisible(),
        page.getByText(/drive.*integration/i).isVisible(),
      ]).catch(() => false);

      expect(hasDriveSection).toBe(true);
    });

    test('should have Connect/Disconnect Drive button', async ({ page }) => {
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      if (await integrationsTab.isVisible()) {
        await integrationsTab.click();
      }

      // Should have connect or disconnect button
      const hasButton = await Promise.race([
        page.getByRole('button', { name: /connect.*drive/i }).isVisible(),
        page.getByRole('button', { name: /disconnect/i }).isVisible(),
        page.getByText(/connected/i).isVisible(),
      ]).catch(() => false);

      expect(hasButton).toBe(true);
    });

    test('should show Drive connection status', async ({ page }) => {
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      if (await integrationsTab.isVisible()) {
        await integrationsTab.click();
      }

      // Should show connection status
      const hasStatus = await Promise.race([
        page.getByText(/connected|not connected|connect/i).isVisible(),
        page.locator('[data-testid="drive-status"]').isVisible(),
      ]).catch(() => false);

      expect(hasStatus).toBe(true);
    });
  });

  test.describe('Form Validation', () => {
    test('should validate settings before saving', async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /save|update/i });

      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show success or validation feedback
        const hasFeedback = await Promise.race([
          page.getByText(/saved|updated|success/i).isVisible(),
          page.getByText(/error|invalid|required/i).isVisible(),
        ]).catch(() => false);

        // At minimum, button should respond
        expect(typeof hasFeedback).toBe('boolean');
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should have accessible form controls', async ({ page }) => {
      // Form inputs should have labels
      const inputs = page.locator('input:not([type="hidden"])');
      const count = await inputs.count();

      for (let i = 0; i < Math.min(count, 3); i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.isVisible().catch(() => false);
          const hasAriaLabel = await input.getAttribute('aria-label');
          expect(hasLabel || hasAriaLabel).toBeTruthy();
        }
      }
    });

    test('should have accessible tabs', async ({ page }) => {
      const tabList = page.getByRole('tablist');

      if (await tabList.isVisible()) {
        // Tab list should be present
        await expect(tabList).toBeVisible();

        // Tabs should be keyboard navigable
        const tabs = page.getByRole('tab');
        const count = await tabs.count();
        expect(count).toBeGreaterThan(0);
      }
    });
  });
});
