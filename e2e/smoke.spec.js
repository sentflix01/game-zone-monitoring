import { test, expect } from '@playwright/test';

test.describe('production smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    // Email sign-in button (inside the form)
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('unauthenticated root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });
});
