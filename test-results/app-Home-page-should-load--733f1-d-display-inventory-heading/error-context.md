# Test info

- Name: Home page >> should load successfully and display inventory heading
- Location: /mnt/c/users/martin/desktop/martin/full apps/shawinv/tests/e2e/app.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:9002/
Call log:
  - navigating to "http://localhost:9002/", waiting until "load"

    at /mnt/c/users/martin/desktop/martin/full apps/shawinv/tests/e2e/app.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Home page', () => {
   4 |   test('should load successfully and display inventory heading', async ({ page }) => {
>  5 |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:9002/
   6 |     await expect(page).toHaveURL('/');
   7 |     // Adjust the selector/text to match your Inventory heading or element
   8 |     await expect(page.locator('text=Inventory')).toBeVisible();
   9 |   });
  10 | });
```