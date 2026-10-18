import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/admin.json';

setup('تسجيل دخول المشرف وحفظ حالة الجلسة', async ({ page }) => {
  setup.setTimeout(60000);

  // Suppress PWA install popup modal in E2E testing
  await page.addInitScript(() => {
    sessionStorage.setItem('tb_pwa_dismissed_session', 'true');
  });

  await page.goto('/login');
  
  // Wait for React client-side hydration (license number is rendered in useEffect)
  await page.locator('span:has-text("TB-")').waitFor({ state: 'visible', timeout: 25000 });

  // If PWA dialog is visible, dismiss it
  const dismissBtn = page.locator('button:has-text("المتابعة عبر المتصفح"), button:has-text("Continuer"), button[aria-label="إغلاق"], button[aria-label="Fermer"]').first();
  if (await dismissBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dismissBtn.click();
  }

  const emailInput = page.locator('input[type="email"]');
  await emailInput.fill('admin@transbodanon.com');
  await page.fill('input[type="password"]', 'Afra@2023');
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 });
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: authFile });
});
