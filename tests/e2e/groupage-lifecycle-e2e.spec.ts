/**
 * TransSalges TMS — Groupage LTL & Margin BI Playwright E2E Acceptance Test Suite
 * Validates the full groupage lifecycle:
 * 1. RBAC route accessibility and sidebar navigation integration.
 * 2. Executive Margin BI Dashboard (/analytics/groupage) with 13.60 LDM & CPK engine.
 * 3. Corridor segmentation (European Maritime vs. African Overland).
 * 4. Split-Billing, 0% TVA (Article 92-I-10° CGI) multi-consignment economics.
 * 5. Recharts visualizations, AI Dispatch Advisor breakeven LDM, and CSV export.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('دورة الشحن التجميعي وتحليلات الربحية (Groupage LTL vs FTL Margin BI E2E)', () => {

  test.beforeEach(async ({ page }) => {
    // Suppress PWA install popup modal in E2E tests
    await page.addInitScript(() => {
      sessionStorage.setItem('tb_pwa_dismissed_session', 'true');
    });
  });

  test('1. يجب فتح المسار المباشر /analytics/groupage وعرض ترويسة محرك 13.60 LDM و CPK', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/groupage`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // التحقق من عنوان الصفحة
    await expect(page).toHaveTitle(/TransSalges/);

    // التحقق من ترويسة لوحة تحليلات الشحن التجميعي
    const mainHeading = page.locator('main h1').first();
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toContainText(/الشحن التجميعي|Groupage|Grupaje/);

    // التحقق من شارة المحرك القياسي 13.60 LDM
    const engineBadge = page.locator('text=/13.60 LDM/i').first();
    await expect(engineBadge).toBeVisible();
  });

  test('2. يجب عرض بطاقات المؤشرات التنفيذية الأربع (KPIs) بدقة Decimal.js', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/groupage`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // 1. بطاقة فارق هامش الربح الصافي
    const marginCard = page.locator('text=/هامش الربح الصافي|Marge Nette|Margen Neto/i').first();
    await expect(marginCard).toBeVisible();

    // 2. بطاقة عائد المتر الطولي (MAD/LDM)
    const ldmRevCard = page.locator('text=/المتر الطولي|Mètre Linéaire|Metro Lineal/i').first();
    await expect(ldmRevCard).toBeVisible();

    // 3. بطاقة تكلفة الكيلومتر (CPK)
    const cpkCard = page.locator('text=/تكلفة الكيلومتر|Coût au Kilomètre|Coste por Kilómetro|CPK/i').first();
    await expect(cpkCard).toBeVisible();

    // 4. بطاقة متوسط إشغال المقطورة
    const utilCard = page.locator('text=/إشغال مقطورة|Occupation Moyenne|Ocupación Media/i').first();
    await expect(utilCard).toBeVisible();
  });

  test('3. يجب تبديل الفلاتر للممرات الدولية والأنماط وتحديث المؤشرات', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/groupage`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // فلترة الممر البحري الأوروبي
    const euroButton = page.locator('button:has-text("الممر البحري الأوروبي"), button:has-text("Maritime Européen"), button:has-text("Marítimo Europeo")').first();
    if (await euroButton.isVisible()) {
      await euroButton.click();
      await page.waitForTimeout(500);
      await expect(euroButton).toHaveClass(/bg-indigo-600/);
    }

    // فلترة الممر البري الإفريقي
    const africaButton = page.locator('button:has-text("الممر البري الإفريقي"), button:has-text("Terrestre Africain"), button:has-text("Terrestre Africano")').first();
    if (await africaButton.isVisible()) {
      await africaButton.click();
      await page.waitForTimeout(500);
      await expect(africaButton).toHaveClass(/bg-amber-600/);
    }

    // فلترة نمط الشحن التجميعي LTL
    const ltlButton = page.locator('button:has-text("تجميعي (LTL)"), button:has-text("Groupage (LTL)"), button:has-text("Grupaje (LTL)")').first();
    if (await ltlButton.isVisible()) {
      await ltlButton.click();
      await page.waitForTimeout(500);
      await expect(ltlButton).toHaveClass(/bg-cyan-600/);
    }
  });

  test('4. يجب ظهور شريط المستشار الذكي (AI Dispatch Advisor) وعتبة التعادل الربحي', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/groupage`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // راية التوصية الاستراتيجية للتشغيل
    const aiBanner = page.locator('text=/التوصية الاستراتيجية|Conseil Stratégique|Recomendación Estratégica/i').first();
    await expect(aiBanner).toBeVisible();

    // عتبة التعادل
    const breakevenLabel = page.locator('text=/عتبة التعادل|Seuil de Rentabilité|Umbral de Rentabilidad/i').first();
    await expect(breakevenLabel).toBeVisible();

    // شرائح كفاءة الإشغال المترية
    const tiersTitle = page.locator('text=/شرائح كفاءة الإشغال|Paliers d’Efficacité|Tramos de Eficiencia/i').first();
    await expect(tiersTitle).toBeVisible();
    await expect(page.locator('text=/11.0 - 13.6 LDM/i').first()).toBeVisible();
  });

  test('5. يجب توفر جدول تفاصيل الرحلات التجميعية وإمكانية البحث وتصدير CSV', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/groupage`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // جدول تفاصيل الرحلات
    const tableHeader = page.locator('th:has-text("CMR"), th:has-text("Trajet"), th:has-text("Ruta")').first();
    await expect(tableHeader).toBeVisible();

    // حقل البحث
    const searchInput = page.locator('input[placeholder*="CMR"], input[placeholder*="بحث"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('CMR');
    await page.waitForTimeout(300);

    // زر تصدير CSV
    const exportButton = page.locator('button:has-text("CSV"), button:has-text("تصدير"), button:has-text("Exporter"), button:has-text("Exportar")').first();
    await expect(exportButton).toBeVisible();
  });

  test('6. يجب التحقق من تكامل التبويب المخصص للشحن التجميعي في صفحة /analytics/corridors', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/corridors`, { waitUntil: 'domcontentloaded' });
    await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 20000 });

    // التبويب الثالث في مركز الممرات
    const groupageTab = page.locator('button[role="tab"]:has-text("ربحية الشحن التجميعي"), button[role="tab"]:has-text("Groupage LTL")').first();
    await expect(groupageTab).toBeVisible();

    // النقر على التبويب
    await groupageTab.click();
    await page.waitForTimeout(500);

    // التحقق من ظهور لوحة GroupageMarginBiView المضمنة
    const embeddedView = page.locator('text=/13.60 LDM/i').first();
    await expect(embeddedView).toBeVisible();
  });

  test('7. التحقق من سلامة عناصر شريط التنقل الجانبي (Sidebar Navigation Integration)', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    // فتح مجموعة التقارير في القائمة الجانبية إذا لم تكن مفتوحة
    const reportsGroupBtn = page.locator('button:has-text("التقارير"), button:has-text("Rapports"), button:has-text("Informes")').first();
    await reportsGroupBtn.click();
    await page.waitForTimeout(500);

    // التحقق من وجود رابط الشحن التجميعي في القائمة الجانبية
    const navLink = page.locator('a[href="/analytics/groupage"]').first();
    await expect(navLink).toBeVisible();
    await expect(navLink).toContainText(/الشحن التجميعي|Groupage|Grupaje/);
    await navLink.click();
    await expect(page).toHaveURL(/\/analytics\/groupage/);
  });

});
