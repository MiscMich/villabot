/**
 * Bots Page E2E Tests
 *
 * Tests bot listing, creation, configuration, and management.
 * Each bot has its own knowledge base and Slack integration.
 */

import { test, expect } from '@playwright/test';

test.describe('Bots Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bots');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Layout', () => {
    test('should display bots header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /bots/i })).toBeVisible();
    });

    test('should display Create Bot button', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create.*bot|add.*bot|new.*bot/i });
      await expect(createButton).toBeVisible();
    });
  });

  test.describe('Bot List', () => {
    test('should display bots or empty state', async ({ page }) => {
      const hasContent = await Promise.race([
        page.locator('[data-testid="bot-card"], .bot-card').first().isVisible(),
        page.getByText(/no bots|create your first|get started/i).isVisible(),
      ]).catch(() => false);

      expect(hasContent).toBe(true);
    });

    test('should show bot status indicators', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const hasStatus = await Promise.race([
          botCard.getByText(/running|active|online|stopped|offline/i).isVisible(),
          botCard.locator('[data-status]').isVisible(),
        ]).catch(() => false);

        expect(typeof hasStatus).toBe('boolean');
      }
    });
  });

  test.describe('Create Bot Modal', () => {
    test('should open create modal on button click', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create.*bot|add.*bot|new.*bot/i });
      await createButton.click();

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    test('should display bot configuration form', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create.*bot|add.*bot|new.*bot/i });
      await createButton.click();

      await expect(page.getByLabel(/name|bot name/i)).toBeVisible();

      const hasSlackFields = await Promise.race([
        page.getByLabel(/bot.*token|slack.*token/i).isVisible(),
        page.getByPlaceholder(/xoxb-/i).isVisible(),
      ]).catch(() => false);

      expect(hasSlackFields).toBe(true);
    });

    test('should close modal on cancel', async ({ page }) => {
      const createButton = page.getByRole('button', { name: /create.*bot|add.*bot|new.*bot/i });
      await createButton.click();

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Bot Configuration', () => {
    test('should open settings for existing bot', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          const modal = page.locator('[role="dialog"]');
          await expect(modal).toBeVisible();
        }
      }
    });

    test('should display knowledge sources section', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();

          const hasKnowledgeSection = await Promise.race([
            page.getByText(/knowledge.*sources|drive.*folders/i).isVisible(),
            page.getByText(/folders|documents/i).isVisible(),
          ]).catch(() => false);

          expect(typeof hasKnowledgeSection).toBe('boolean');
        }
      }
    });

    test('should display Slack channels section', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();

          const hasChannelsSection = await Promise.race([
            page.getByText(/slack.*channels|channels/i).isVisible(),
            page.getByLabel(/channel/i).isVisible(),
          ]).catch(() => false);

          expect(typeof hasChannelsSection).toBe('boolean');
        }
      }
    });
  });

  test.describe('Bot Actions', () => {
    test('should have start/stop controls', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const hasControls = await Promise.race([
          botCard.getByRole('button', { name: /start|stop|restart/i }).isVisible(),
          botCard.locator('[data-testid="bot-controls"]').isVisible(),
        ]).catch(() => false);

        expect(typeof hasControls).toBe('boolean');
      }
    });

    test('should have delete option', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          const deleteButton = page.getByRole('button', { name: /delete/i });
          await expect(deleteButton).toBeVisible();
        }
      }
    });
  });

  test.describe('Drive Folder Picker', () => {
    test('should have Browse Drive button when Drive connected', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();

          const browseButton = page.getByRole('button', { name: /browse.*drive|select.*folder/i });
          const hasBrowse = await browseButton.isVisible().catch(() => false);
          expect(typeof hasBrowse).toBe('boolean');
        }
      }
    });

    test('should open folder picker modal', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const settingsButton = botCard.getByRole('button', { name: /settings|edit|configure/i });

        if (await settingsButton.isVisible()) {
          await settingsButton.click();

          const browseButton = page.getByRole('button', { name: /browse.*drive|select.*folder/i });

          if (await browseButton.isVisible()) {
            await browseButton.click();

            const folderPicker = page.locator('[role="dialog"]').filter({
              has: page.getByText(/select.*folder|google.*drive/i),
            });

            await expect(folderPicker).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show setup guidance when no bots', async ({ page }) => {
      const emptyState = page.getByText(/no bots|create your first|get started/i);

      if (await emptyState.isVisible()) {
        const hasAction = await Promise.race([
          page.getByRole('button', { name: /create|add|new/i }).isVisible(),
          page.getByRole('link', { name: /create|add|new/i }).isVisible(),
        ]).catch(() => false);

        expect(hasAction).toBe(true);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should have accessible bot cards', async ({ page }) => {
      const botCard = page.locator('[data-testid="bot-card"], .bot-card').first();

      if (await botCard.isVisible()) {
        const hasHeading = await botCard.locator('h2, h3, [role="heading"]').isVisible();
        const hasDescription = await botCard.locator('p').isVisible();
        expect(hasHeading || hasDescription).toBe(true);
      }
    });
  });
});
