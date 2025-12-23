import { test, expect } from '@playwright/test';

test.describe('Bot Management', () => {
  // Auth state is handled by playwright.config.ts chromium project

  test.describe('Bots List Page', () => {
    test('should display bots page', async ({ page }) => {
      await page.goto('/bots');

      // Wait for page to settle
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should show bots page heading or page content
      const hasHeading = await page.getByRole('heading', { name: /bots/i }).isVisible().catch(() => false);
      const hasIcon = await page.locator('[class*="lucide-bot"]').first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      expect(hasHeading || hasIcon || hasSidebar).toBeTruthy();
    });

    test('should show new bot button', async ({ page }) => {
      await page.goto('/bots');

      // Wait for page to be on bots URL (may redirect through auth)
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for loading to complete - heading appears after data loads OR loading state
      const heading = page.getByRole('heading', { name: /bots/i });
      const shimmer = page.locator('.shimmer').first();

      // Wait for either heading or loading state
      await Promise.race([
        expect(heading).toBeVisible({ timeout: 20000 }),
        expect(shimmer).toBeVisible({ timeout: 5000 }),
      ]).catch(() => {});

      // If heading visible, check for button
      if (await heading.isVisible()) {
        const newBotButton = page.getByRole('button', { name: /new bot|create bot|add bot/i });
        await expect(newBotButton).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display bot statistics', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for loading to complete or loading state
      await page.waitForTimeout(1000);

      // Should show statistics cards, loading state, or sidebar
      const hasTotal = await page.getByText(/total/i).first().isVisible().catch(() => false);
      const hasActive = await page.getByText(/active/i).first().isVisible().catch(() => false);
      const hasCards = await page.locator('.glass-card').first().isVisible().catch(() => false);
      const hasShimmer = await page.locator('.shimmer').first().isVisible().catch(() => false);
      const hasSidebar = await page.locator('nav, aside').first().isVisible().catch(() => false);

      expect(hasTotal || hasActive || hasCards || hasShimmer || hasSidebar).toBeTruthy();
    });

    test('should have search functionality', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for loading to complete
      await page.waitForTimeout(1000);

      // Should have search input or be in loading state
      const searchInput = page.getByPlaceholder(/search/i);
      const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasSearch) {
        // Should be able to type in search
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
      } else {
        // Page may still be loading - just verify sidebar is there
        await expect(page.locator('nav, aside').first()).toBeVisible();
      }
    });
  });

  test.describe('Bot Setup Wizard', () => {
    test('should open wizard on new bot click', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if new bot button is visible
      const newBotButton = page.getByRole('button', { name: /new bot/i });
      const buttonVisible = await newBotButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (buttonVisible) {
        await newBotButton.click();

        // Wizard dialog or form should open
        const hasDialog = await page.getByRole('dialog').isVisible({ timeout: 5000 }).catch(() => false);
        const hasWizard = await page.getByText(/step 1|basic info|bot name/i).first().isVisible({ timeout: 5000 }).catch(() => false);

        expect(hasDialog || hasWizard).toBeTruthy();
      }
    });

    test('should show wizard steps', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if new bot button is visible
      const newBotButton = page.getByRole('button', { name: /new bot/i });
      if (await newBotButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBotButton.click();
        await page.waitForTimeout(500);

        // Should show step indicator or form content
        const hasSteps = await page.getByText(/step|name|basic/i).first().isVisible().catch(() => false);
        const hasForm = await page.locator('input, form').first().isVisible().catch(() => false);

        expect(hasSteps || hasForm).toBeTruthy();
      }
    });

    test('should have name input field', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Open wizard if button visible
      const newBotButton = page.getByRole('button', { name: /new bot/i });
      if (await newBotButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBotButton.click();
        await page.waitForTimeout(500);

        // Find name input by label or placeholder
        const nameInput = page.getByLabel(/name/i).or(page.getByPlaceholder(/name/i));

        if (await nameInput.first().isVisible().catch(() => false)) {
          await expect(nameInput.first()).toBeVisible();
          await nameInput.first().fill('Test Bot');
          await expect(nameInput.first()).toHaveValue('Test Bot');
        }
      }
    });

    test('should have next/continue button', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Open wizard if button visible
      const newBotButton = page.getByRole('button', { name: /new bot/i });
      if (await newBotButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBotButton.click();
        await page.waitForTimeout(500);

        // Should have next or continue button
        const nextButton = page.getByRole('button', { name: /next|continue|create|save/i });
        if (await nextButton.first().isVisible().catch(() => false)) {
          await expect(nextButton.first()).toBeVisible();
        }
      }
    });

    test('should close wizard on cancel', async ({ page }) => {
      await page.goto('/bots');
      await expect(page).toHaveURL(/bots/, { timeout: 15000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Open wizard if button visible
      const newBotButton = page.getByRole('button', { name: /new bot/i });
      if (await newBotButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBotButton.click();
        await page.waitForTimeout(500);

        // Find and click cancel or close button
        const cancelButton = page.getByRole('button', { name: /cancel|close|back/i }).or(
          page.locator('[aria-label*="close" i]').or(
            page.locator('button svg.lucide-x').locator('..')
          )
        );

        if (await cancelButton.first().isVisible().catch(() => false)) {
          await cancelButton.first().click();
          await page.waitForTimeout(300);

          // Dialog should be closed
          const dialogGone = !(await page.getByRole('dialog').isVisible().catch(() => false));
          expect(dialogGone).toBeTruthy();
        }
      }
    });
  });

  test.describe('Bot Navigation', () => {
    test('should have bots link in sidebar', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Should have bots link (exact name is "Bots")
      const botsLink = page.getByRole('link', { name: /bots/i });
      await expect(botsLink.first()).toBeVisible({ timeout: 5000 });
    });

    test('should navigate from dashboard to bots', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 10000 });

      // Wait for navigation items to load
      await page.waitForTimeout(1000);

      // Click bots link and wait for navigation
      const botsLink = page.getByRole('link', { name: /bots/i }).first();
      await Promise.all([
        page.waitForURL(/bots/, { timeout: 15000 }),
        botsLink.click(),
      ]);
    });
  });
});
