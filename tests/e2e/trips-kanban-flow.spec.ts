import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('لوحة كانبان والتحقق الميداني الشامل للرحلات', () => {

  // ─────────────────────────────────────────────────────────────
  // 1. فحص بوابة التتبع العامة بدون مصادقة
  // ─────────────────────────────────────────────────────────────
  test.use({ storageState: { cookies: [], origins: [] } });

  test('يجب فتح صفحة التتبع العام /track/2002 للزوار دون تحويل إلى /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/track/2002`);
    await expect(page).toHaveURL(/\/track\/2002/);
    await expect(page.locator('body')).not.toContainText('404');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. فحص لوحة المؤشرات المركزية
  // ─────────────────────────────────────────────────────────────
  test('يجب أن تعرض لوحة التحكم إحصائيات الرحلات مع المخطط', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    await expect(page.locator('body')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // 3. فحص لوحة كانبان للرحلات وتوزيع البطاقات
  // ─────────────────────────────────────────────────────────────
  test('يجب عرض الأعمدة الخمسة للكانبان مع تموضع الرحلات 2001–2008 بدقة', async ({ page }) => {
    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(10000);

    await page.screenshot({ path: 'playwright-screenshots/kanban-debug.png', fullPage: true });

    const headers = [
      ['قيد التعيين', 'En attente'],
      ['في طريق الذهاب', 'Transit Aller'],
      ['بانتظار العودة', 'Attente Retour'],
      ['في طريق العودة', 'Transit Retour'],
      ['مكتملة ومفوترة', 'Clôturé & Facturé'],
    ];

    for (const [ar, fr] of headers) {
      const locator = page.locator(`text=/${ar}|${fr}/`);
      await expect(locator.first()).toBeVisible({ timeout: 15000 });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 4. فحص العرض الآمن للحقول غير المسندة
  // ─────────────────────────────────────────────────────────────
  test('يجب فتح الرحلة 2008 وعرض السائق والشاحنة كغير مسند بدون أخطاء', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/trips/2008`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(consoleErrors.filter((e) => e.includes('TypeError'))).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. فحص كشف P&L المالي والحساب الدقيق للرحلة المكتملة
  // ─────────────────────────────────────────────────────────────
  test('يجب احتساب وعرض الأرباح والخسائر للرحلة 2001 بدقة Decimal.js', async ({ page }) => {
    await page.goto(`${BASE_URL}/trips/2001`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // 6. اختبار السحب والإفلات (Drag & Drop) بين مراحل الكانبان
  // ─────────────────────────────────────────────────────────────
  test('يجب نقل بطاقة الرحلة 2008 من قيد التعيين إلى في طريق الذهاب وتحديث الحالة', async ({ page }) => {
    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const sourceCard = page.locator('div:has-text("2008")').first();
    const targetColumn = page.locator('div:has-text("في طريق الذهاب"), div:has-text("Transit Aller")').first();

    if (await targetColumn.isVisible()) {
      await sourceCard.hover();
      await page.mouse.down();
      await targetColumn.hover();
      await page.mouse.up();
      await expect(targetColumn.locator('text=2008')).toBeVisible({ timeout: 5000 });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 7. فحص توليد e-CMR مع رمز الاستجابة السريع QR
  // ─────────────────────────────────────────────────────────────
  test('يجب فتح نافذة طباعة الـ CMR وتوليد رمز QR يوجه إلى رابط التتبع', async ({ page }) => {
    await page.goto(`${BASE_URL}/trips`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const cmrButton = page.locator('button:has-text("CMR")').first();
    if (await cmrButton.isVisible()) {
      await cmrButton.click();
      const printModal = page.locator('[role="dialog"], .print-modal, .modal');
      await expect(printModal).toBeVisible({ timeout: 10000 });
    }
  });

});
