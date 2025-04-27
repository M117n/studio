# Test info

- Name: Home page >> should load successfully and display inventory heading
- Location: /mnt/c/users/martin/desktop/martin/full apps/smartstock/tests/e2e/app.spec.ts:4:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at /home/martin/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Home page', () => {
>  4 |   test('should load successfully and display inventory heading', async ({ page }) => {
     |       ^ Error: browserType.launch: Executable doesn't exist at /home/martin/.cache/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell
   5 |     await page.goto('/');
   6 |     await expect(page).toHaveURL('/');
   7 |     // Adjust the selector/text to match your Inventory heading or element
   8 |     await expect(page.locator('text=Inventory')).toBeVisible();
   9 |   });
  10 | });
```