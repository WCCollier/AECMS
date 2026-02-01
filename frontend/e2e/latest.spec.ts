import { test, expect } from '@playwright/test';

test.describe('Latest (Articles) Page', () => {
  test('should load the latest page', async ({ page }) => {
    await page.goto('/latest');
    await expect(page.getByRole('heading', { name: /latest/i })).toBeVisible();
  });

  test('should display articles or empty state', async ({ page }) => {
    await page.goto('/latest');

    // Either articles are shown or an empty state
    const hasArticles = await page.locator('article, [data-testid="article-card"]').count() > 0;
    const hasEmptyState = await page.getByText(/no articles|no posts/i).isVisible().catch(() => false);

    expect(hasArticles || hasEmptyState).toBeTruthy();
  });
});
