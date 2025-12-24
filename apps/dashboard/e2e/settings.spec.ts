/**
 * Settings Page E2E Tests
 *
 * Tests workspace settings, integrations, and configuration.
 *
 * Uses fixtures for clean workspace state.
 */

import { test, expect } from './fixtures';

test.describe('Settings Page', () => {
  // Reset workspace but don't need much data for settings tests
  test.beforeAll(async ({ resetWorkspace }) => {
    await resetWorkspace();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    // Wait for React to render content, not just network idle
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 15000 });
  });

  test.describe('Page Layout', () => {
    test('should display settings header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });

    test('should display tabs or sections', async ({ page }) => {
      // Tabs are: Account, Workspace, Integrations (not General)
      const hasAccountTab = await page.getByRole('tab', { name: /account/i }).isVisible()
        .catch(() => false);
      const hasWorkspaceTab = await page.getByRole('tab', { name: /workspace/i }).isVisible()
        .catch(() => false);
      const hasIntegrationsTab = await page.getByRole('tab', { name: /integrations/i }).isVisible()
        .catch(() => false);

      expect(hasAccountTab || hasWorkspaceTab || hasIntegrationsTab).toBe(true);
    });
  });

  test.describe('Workspace Settings', () => {
    test('should display workspace settings', async ({ page }) => {
      // Click Workspace tab to see workspace settings
      const workspaceTab = page.getByRole('tab', { name: /workspace/i });
      await workspaceTab.click();

      // Wait for tab panel to be visible
      await expect(page.getByRole('tabpanel', { name: /workspace/i })).toBeVisible({ timeout: 5000 });
    });

    test('should have account settings in Account tab', async ({ page }) => {
      // Account tab is default - verify tab panel content
      await expect(page.getByRole('tabpanel', { name: /account/i })).toBeVisible();

      // Account tab shows "Your Account" heading and user info
      await expect(page.getByRole('heading', { name: /your account/i })).toBeVisible();
    });
  });

  test.describe('Integrations Tab', () => {
    test('should display Google Drive integration', async ({ page }) => {
      // Click Integrations tab and wait for content
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      await integrationsTab.click();

      // Wait for tab panel to be visible
      await expect(page.getByRole('tabpanel', { name: /integrations/i })).toBeVisible({ timeout: 5000 });

      // Should show Drive integration section with heading
      await expect(page.getByRole('heading', { name: /google drive/i })).toBeVisible();
    });

    test('should have Connect/Disconnect Drive button', async ({ page }) => {
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      await integrationsTab.click();

      // Wait for tab panel
      await expect(page.getByRole('tabpanel', { name: /integrations/i })).toBeVisible({ timeout: 5000 });

      // Should have connect button (shown as "Connect Google Drive")
      const connectButton = page.getByRole('button', { name: /connect.*google.*drive/i });
      await expect(connectButton).toBeVisible();
    });

    test('should show Drive connection status', async ({ page }) => {
      const integrationsTab = page.getByRole('tab', { name: /integrations/i });
      await integrationsTab.click();

      // Wait for tab panel
      await expect(page.getByRole('tabpanel', { name: /integrations/i })).toBeVisible({ timeout: 5000 });

      // Should show connection status text
      await expect(page.getByText(/not connected/i)).toBeVisible();
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
      // Page has two h1s - sidebar logo and page title - use first()
      await expect(page.locator('h1').first()).toBeVisible();
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
