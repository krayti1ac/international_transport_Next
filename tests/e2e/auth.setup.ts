import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

setup('تسجيل دخول المشرف وحفظ حالة الجلسة', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', 'hisaltan@gmail.com');
  await page.fill('input[type="password"]', 'Afra@2023');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.waitForLoadState('networkidle');
  await page.context().storageState({ path: authFile });
});
