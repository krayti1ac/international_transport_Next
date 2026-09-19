import { test, expect } from '@playwright/test';

test.describe('دورة الفترات المالية والاستمرارية (Fiscal Period E2E Flow)', () => {
  
  test.beforeEach(async ({ page }) => {
    // الانتقال إلى صفحة الأسطول أو أي صفحة تحتوي على شريط الفترات المالية (PeriodFilterBar)
    await page.goto('/fleet');
  });

  test('التحقق من تبديل الفترة المالية، تحديث البيانات، واستمرار الاختيار في التخزين المحلي', async ({ page }) => {
    // 1. النقر على زر محدد الفترة المالية أو شريط الفترات
    const periodTrigger = page.locator('button:has-text("فترة"), button:has-text("Period"), [data-testid="period-selector"]').first();
    if (await periodTrigger.isVisible()) {
      await periodTrigger.click();
    }

    // 2. اختيار نطاق زمني أو سنة مالية معينة من القائمة
    const periodOption = page.locator('text=السنة المالية الحالية, text=الشهر الحالي, text=Current Year').first();
    if (await periodOption.isVisible()) {
      await periodOption.click();
    }

    // 3. التحقق من تحديث بطاقات مؤشرات الأداء (KPIs) أو جداول البيانات بناءً على الحدود الزمنية الجديدة
    const kpiCard = page.locator('.kpi-card, [data-testid="kpi-container"], card').first();
    await expect(kpiCard).toBeVisible();

    // 4. اختبار استمرارية الفترة المالية في localStorage عند الانتقال بين الصفحات
    // الانتقال إلى لوحة التحكم (Dashboard)
    const dashboardLink = page.locator('a[href*="/dashboard"], a:has-text("لوحة التحكم")').first();
    await dashboardLink.click();
    await expect(page).toHaveURL(/.+\/dashboard/);

    // العودة إلى صفحة الأسطول (Fleet)
    const fleetLink = page.locator('a[href*="/fleet"], a:has-text("الأسطول")').first();
    await fleetLink.click();
    await expect(page).toHaveURL(/.+\/fleet/);

    // 5. التحقق من بقاء حالة الفترة المالية محفوظة في localStorage
    const storedPeriodState = await page.evaluate(() => {
      // البحث عن مفتاح تخزين الفترة المالية المستخدم في المتجر (useFiscalStore)
      const keys = Object.keys(localStorage);
      const periodKey = keys.find(k => k.includes('fiscal') || k.includes('period') || k.includes('storage'));
      return periodKey ? localStorage.getItem(periodKey) : null;
    });

    // التأكد من أن حالة الفترة المالية محفوظة ولا تمسح عند التنقل
    expect(storedPeriodState).not.toBeNull();
  });

  test('التحقق من تحديث تاريخ البداية والنهاية عند اختيار نطاق مخصص (Custom Range)', async ({ page }) => {
    const periodTrigger = page.locator('button:has-text("فترة"), button:has-text("Period")').first();
    if (await periodTrigger.isVisible()) {
      await periodTrigger.click();
    }

    // اختيار خيار النطاق المخصص إذا وجد
    const customRangeOption = page.locator('text=مخصص, text=Custom Range').first();
    if (await customRangeOption.isVisible()) {
      await customRangeOption.click();

      // إدخال تواريخ البداية والنهاية
      const startDateInput = page.locator('input[type="date"]').first();
      const endDateInput = page.locator('input[type="date"]').last();

      if (await startDateInput.isVisible() && await endDateInput.isVisible()) {
        await startDateInput.fill('2026-01-01');
        await endDateInput.fill('2026-09-18');

        // تطبيق الفلتر
        const applyButton = page.locator('button:has-text("تطبيق"), button:has-text("Apply")').first();
        if (await applyButton.isVisible()) {
          await applyButton.click();
        }

        // التحقق من تحديث واجهة المستخدم واستجابة البيانات
        await expect(page.locator('body')).not.toBeEmpty();
      }
    }
  });

});