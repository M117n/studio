# Test info

- Name: Home page >> should load successfully and display inventory heading
- Location: /mnt/c/users/martin/desktop/martin/full apps/shawinv/tests/e2e/app.spec.ts:4:7

# Error details

```
Error: browserType.launch: 
╔══════════════════════════════════════════════════════╗
║ Host system is missing dependencies to run browsers. ║
║ Please install them with the following command:      ║
║                                                      ║
║     sudo npx playwright install-deps                 ║
║                                                      ║
║ Alternatively, use apt:                              ║
║     sudo apt-get install libnss3\                    ║
║         libnspr4\                                    ║
║         libasound2t64                                ║
║                                                      ║
║ <3 Playwright Team                                   ║
╚══════════════════════════════════════════════════════╝
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Home page', () => {
>  4 |   test('should load successfully and display inventory heading', async ({ page }) => {
     |       ^ Error: browserType.launch: 
   5 |     await page.goto('/');
   6 |     await expect(page).toHaveURL('/');
   7 |     // Adjust the selector/text to match your Inventory heading or element
   8 |     await expect(page.locator('text=Inventory')).toBeVisible();
   9 |   });
  10 | });
```