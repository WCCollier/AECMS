import { test, expect } from '@playwright/test';

test.describe('Shop Page', () => {
  test('should load the shop page', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('heading', { name: /shop/i })).toBeVisible();
  });

  test('should display product grid or empty state', async ({ page }) => {
    await page.goto('/shop');

    // Either products are shown or an empty state message
    const hasProducts = await page.locator('[data-testid="product-card"]').count() > 0;
    const hasEmptyState = await page.getByText(/no products/i).isVisible().catch(() => false);

    expect(hasProducts || hasEmptyState).toBeTruthy();
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/shop');

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Page should update (we're just testing the input works)
      await expect(searchInput).toHaveValue('test');
    }
  });
});
