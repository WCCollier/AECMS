import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AECMS/);
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for main navigation elements
    await expect(page.getByRole('link', { name: /shop/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /latest/i })).toBeVisible();
  });

  test('should navigate to shop page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /shop/i }).click();
    await expect(page).toHaveURL('/shop');
  });

  test('should navigate to latest page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /latest/i }).click();
    await expect(page).toHaveURL('/latest');
  });
});
