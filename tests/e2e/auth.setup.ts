import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

setup('تسجيل دخول المشرف وحفظ حالة الجلسة', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', 'admin@transbodanon.com');
  await page.fill('input[type="password"]', 'Afra@2023');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  await page.goto('/trips');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').textContent();
  if (bodyText?.includes('تسجيل الدخول') || bodyText?.includes('/login')) {
    throw new Error('Failed to load /trips - redirected to login despite having session');
  }

  await page.context().storageState({ path: authFile });
});
