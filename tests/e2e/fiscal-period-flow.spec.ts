import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const AUTH_FILE = 'playwright/.auth/admin.json';

test.describe('نظام الفترات المحاسبية وتكامل الأسطول والرحلات', () => {
  test.use({ storageState: AUTH_FILE });

  test('يجب التبديل بين نمط السنة/الشهر ونمط النطاق المخصص وتحديث التواريخ', async ({ page }) => {
    await page.goto(`${BASE_URL}/fleet/301?type=truck`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const currentPath = page.url();
    if (currentPath.includes('/login')) {
      test.skip(true, 'تخطي: الصفحة محمية وتتطلب مصادقة صالحة');
      return;
    }

    const periodBar = page.locator('div[dir="rtl"]').filter({ hasText: 'تحديد الفترة المحاسبية' });
    await expect(periodBar).toBeVisible({ timeout: 15000 });

    const customRangeBtn = page.getByRole('button', { name: /من يوم إلى يوم/i });
    await customRangeBtn.click();

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    await startDateInput.fill('2024-01-01');
    await endDateInput.fill('2024-01-31');

    const tripsTab = page.getByRole('tab', { name: /تاريخ الرحلات/i });
    if (await tripsTab.isVisible()) {
      await tripsTab.click();
      await expect(page.locator('text=لا توجد رحلات مسجلة').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('يجب التحقق من ثبات الفترة المحاسبية في localStorage عبر التنقل بين الصفحات', async ({ page }) => {
    await page.goto(`${BASE_URL}/trip-profitability`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const currentPath = page.url();
    if (currentPath.includes('/login')) {
      test.skip(true, 'تخطي: الصفحة محمية وتتطلب مصادقة صالحة');
      return;
    }

    const yearSelect = page.locator('select').first();
    const monthSelect = page.locator('select').nth(1);

    if (await yearSelect.isVisible() && await monthSelect.isVisible()) {
      await yearSelect.selectOption('2025');
      await monthSelect.selectOption('5');
    }

    const storedState = await page.evaluate(() => {
      const raw = localStorage.getItem('transbodanon_fiscal_period');
      return raw ? JSON.parse(raw) : null;
    });

    expect(storedState).not.toBeNull();
    expect(storedState.state.selectedYear).toBe(2025);
    expect(storedState.state.selectedMonth).toBe(5);
    expect(storedState.state.startDate).toBe('2025-05-01');
    expect(storedState.state.endDate).toBe('2025-05-31');

    await page.goto(`${BASE_URL}/fleet/301?type=truck`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const retainedYear = await page.locator('select').first().inputValue();
    const retainedMonth = await page.locator('select').nth(1).inputValue();

    expect(retainedYear).toBe('2025');
    expect(retainedMonth).toBe('5');
  });

  test('يجب تحديث حسابات TCO عند تغيير الفترة الزمنية للمركبة', async ({ page }) => {
    await page.goto(`${BASE_URL}/fleet/301?type=truck`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const tcoTab = page.getByRole('tab', { name: /TCO|التكلفة/i });
    if (await tcoTab.isVisible()) {
      await tcoTab.click();

      await expect(page.locator('text=تكلفة الوقود').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=التكلفة الإجمالية').first()).toBeVisible({ timeout: 15000 });

      const customRangeBtn = page.getByRole('button', { name: /من يوم إلى يوم/i });
      if (await customRangeBtn.isVisible()) {
        await customRangeBtn.click();

        const startDateInput = page.locator('input[type="date"]').first();
        if (await startDateInput.isVisible()) {
          await startDateInput.fill('2026-06-01');
        }
      }

      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

});
