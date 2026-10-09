'use server';

import { createClient } from '@/lib/supabase/server';
import { ClearanceCryptoService } from './clearance-crypto.service';
import { DriverClearancePdfService } from './driver-clearance-pdf.service';
import { FiscalPnlExcelService } from './fiscal-pnl-excel.service';
import { getFiscalPeriodSummaryAction } from './fiscal-settlements.actions';
import { FiscalSettlementsService } from './fiscal-settlements.service';
import type {
  ClearanceSheetExportContext,
  CompanyHeaderLegalInfo,
  DetailedTripExportItem,
  ExportFileResult,
} from '../types/financial-export.types';
import type { DriverSettlementStatement } from '../types/fiscal-settlements.types';
import type { Driver, TripOrder } from '@/types/database';

const DEFAULT_COMPANY: CompanyHeaderLegalInfo = {
  name: 'Trans Bodanon Transport & Logistique S.A.R.L.',
  ice: '002938475000084',
  rc: '104928 Tanger',
  patente: '49201948',
  ifNumber: '39485721',
  address: 'Zone Franche Port Tanger Med, Route Principale, Maroc',
  phone: '+212 539 94 82 10',
  email: 'contact@transbodanon.com',
  currency: 'MAD',
};

/**
 * إنشاء ملف كشف إبراء الذمة الرسمي المتجهي (HTML/PDF) مع رمز QR والختم التشفيري
 */
export async function getDriverClearanceExportAction(
  statementId: number,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): Promise<ExportFileResult & { verificationUrl?: string }> {
  try {
    const supabase = await createClient();

    // 1. استعلام كشف التصفية
    const { data: stmt, error: stmtErr } = await supabase
      .from('driver_settlement_statements')
      .select('*')
      .eq('id', statementId)
      .single<DriverSettlementStatement>();

    if (stmtErr || !stmt) {
      return { success: false, error: 'تعذر العثور على كشف التصفية المطلوب' };
    }

    // 2. استعلام بيانات السائق
    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', stmt.driver_id)
      .single<Driver>();

    // 3. استعلام بيانات الشركة
    let companyInfo = DEFAULT_COMPANY;
    if (stmt.company_id) {
      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .eq('id', stmt.company_id)
        .maybeSingle();

      if (comp) {
        companyInfo = {
          ...DEFAULT_COMPANY,
          name: comp.name || DEFAULT_COMPANY.name,
          ice: comp.ice || DEFAULT_COMPANY.ice,
        };
      }
    }

    // 4. توليد الختم الرقمي HMAC-SHA256
    const verificationHash = ClearanceCryptoService.generateSecurityHash({
      statementId: stmt.id,
      driverId: stmt.driver_id,
      statementNumber: stmt.statement_number,
      netPayoutMad: stmt.net_payout_mad,
      periodStart: stmt.period_start,
      periodEnd: stmt.period_end,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.com';
    const verificationUrl = `${appUrl}/verify/clearance/${verificationHash}`;

    // 5. توليد رمز الاستجابة السريعة QR Code
    const qrCodeDataUri = await ClearanceCryptoService.generateQrCodeDataUri(
      verificationUrl
    );

    const nowFormatted = new Date().toLocaleDateString(
      locale === 'ar' ? 'ar-MA' : 'fr-FR',
      { year: 'numeric', month: 'long', day: 'numeric' }
    );

    const exportContext: ClearanceSheetExportContext = {
      company: companyInfo,
      driver: {
        driverId: stmt.driver_id,
        name: driver?.name || `Chauffeur #${stmt.driver_id}`,
        cin: (driver as any)?.cin || (driver as any)?.national_id || '',
        passportNumber: (driver as any)?.passport_number || '',
        driverLicenseNumber: (driver as any)?.license_number || '',
        matricule: (driver as any)?.matricule || '',
        phone: driver?.phone || '',
      },
      statement: stmt,
      locale,
      verificationUrl,
      verificationHash,
      issuedAt: nowFormatted,
      qrCodeDataUri,
    };

    // 6. توليد قالب المستند
    const htmlContent = DriverClearancePdfService.generateClearanceHtml(exportContext);

    return {
      success: true,
      htmlContent,
      verificationHash,
      verificationUrl,
      fileName: `Decompte_${stmt.statement_number}.html`,
      mimeType: 'text/html; charset=utf-8',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تصدير كشف إبراء الذمة';
    return { success: false, error: message };
  }
}

/**
 * تصدير مصنف الأرباح والخسائر للرحلات بصيغة Excel المحاسبية الرسمية (.xlsx)
 */
export async function exportFiscalPnlExcelAction(
  fiscalPeriod: string,
  locale: 'ar' | 'fr' | 'es' = 'fr'
): Promise<ExportFileResult> {
  try {
    const supabase = await createClient();

    const periodStart = `${fiscalPeriod}-01`;
    const parts = fiscalPeriod.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${fiscalPeriod}-${String(lastDay).padStart(2, '0')}`;

    // 1. جلب ملخص الفترة
    const summaryRes = await getFiscalPeriodSummaryAction(fiscalPeriod);
    const summary = summaryRes.data || {
      period: fiscalPeriod,
      totalRevenueMad: 0,
      totalOperatingCostsMad: 0,
      grossOperatingProfitMad: 0,
      averageMarginPct: 0,
      totalDriverPayoutsMad: 0,
      totalReconciledTollsMad: 0,
      totalReconciledFuelMad: 0,
      unsettledAdvancesMad: 0,
      settledStatementsCount: 0,
      pendingStatementsCount: 0,
      closedTripsCount: 0,
    };

    // 2. جلب الرحلات
    const { data: tripsData } = await supabase
      .from('trip_orders')
      .select('*, driver:drivers(name), truck:trucks(plate_number)')
      .gte('departure_date', periodStart)
      .lte('departure_date', periodEnd)
      .order('departure_date', { ascending: false });

    const trips = (tripsData || []) as any[];

    // 3. بناء قائمة الرحلات التفصيلية
    const detailedTrips: DetailedTripExportItem[] = trips.map((t) => {
      const exportP = Number(t.price_export || 0);
      const importP = Number(t.price_import || 0);
      const revenue = exportP + importP > 0 ? exportP + importP : Number(t.price || 0);

      const fuel = Number(t.fuel_cost || 6500);
      const tolls = 2200;
      const ferry = Number(t.ferry_cost || 4500) + Number(t.triptik_cost || 500);
      const customs = 800;
      const driverCost = Math.round(revenue * 0.05);
      const other = 0;

      const pnl = FiscalSettlementsService.calculateTripPnl({
        tripId: t.id,
        revenue,
        fuelCost: fuel,
        tollsCost: tolls,
        ferryCost: ferry,
        customsPortsCost: customs,
        driverCost,
        otherCosts: other,
      });

      return {
        id: t.id,
        cmrNumber: t.cmr_export_number || t.cmr_number || `CMR-#${t.id}`,
        route: t.route_export || t.route || 'MA ➔ EU',
        departureDate: t.departure_date || periodStart,
        driverName: t.driver?.name || `Chauffeur #${t.driver_id}`,
        truckPlate: t.truck?.plate_number || 'TRUCK-INTL',
        revenue: pnl.revenue,
        fuelCost: pnl.fuelCost,
        tollsCost: pnl.tollsCost,
        ferryCost: pnl.ferryCost,
        customsCost: pnl.customsPortsCost,
        driverCost: pnl.driverCost,
        otherCost: pnl.otherCosts,
        totalCosts: pnl.totalCosts,
        grossProfit: pnl.grossProfit,
        profitMarginPct: pnl.profitMarginPct,
        tier: pnl.profitabilityTier,
        isClosed: true,
      };
    });

    // 4. توليد مصنف Excel
    const base64Data = FiscalPnlExcelService.generatePnlWorkbookBase64({
      fiscalPeriod,
      company: DEFAULT_COMPANY,
      trips: detailedTrips,
      summary,
      locale,
      generatedAt: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      base64Data,
      fileName: `TransBodanon_PnL_${fiscalPeriod}.xlsx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تصدير ملف Excel للربحية';
    return { success: false, error: message };
  }
}

/**
 * التحقق من صحة كشف إبراء الذمة عبر الختم الرقمي (لصفحة التحقق العامة)
 */
export async function verifyClearanceByHashAction(
  candidateHash: string
): Promise<{
  isValid: boolean;
  statement?: DriverSettlementStatement;
  driverName?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // جلب آخر 100 كشف تصفية للتحقق من تطابق الختم
    const { data: stmts } = await supabase
      .from('driver_settlement_statements')
      .select('*, driver:drivers(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!stmts) return { isValid: false, error: 'لا توجد كشوفات مسجلة' };

    for (const stmt of stmts as any[]) {
      const match = ClearanceCryptoService.verifySecurityHash(
        {
          statementId: stmt.id,
          driverId: stmt.driver_id,
          statementNumber: stmt.statement_number,
          netPayoutMad: stmt.net_payout_mad,
          periodStart: stmt.period_start,
          periodEnd: stmt.period_end,
        },
        candidateHash
      );

      if (match) {
        return {
          isValid: true,
          statement: stmt,
          driverName: stmt.driver?.name,
        };
      }
    }

    return { isValid: false, error: 'رمز الختم الرقمي غير مطابق لأي وثيقة رسمية معتمدة' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل التحقق من صحة الوثيقة';
    return { isValid: false, error: message };
  }
}
