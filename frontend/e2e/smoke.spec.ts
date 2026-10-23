import { expect, test } from '@playwright/test';

test('dashboard and customer table are reachable', async ({ page }) => {
  await page.goto('/dashboard/analytics');
  await expect(page.getByText('Welcome to Mantis')).toBeVisible();
  await page.goto('/apps/customer/customer-list');
  await expect(page.getByRole('button', { name: /add customer/i })).toBeVisible();
});
