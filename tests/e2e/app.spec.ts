import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should load successfully and display inventory heading', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    // Adjust the selector/text to match your Inventory heading or element
    await expect(page.locator('text=Inventory')).toBeVisible();
  });
});