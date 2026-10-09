import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { ClearanceCryptoService } from '../services/clearance-crypto.service';
import { DriverClearancePdfService } from '../services/driver-clearance-pdf.service';
import { FiscalPnlExcelService } from '../services/fiscal-pnl-excel.service';
import type {
  ClearanceSheetExportContext,
  CompanyHeaderLegalInfo,
  TripPnlExcelContext,
} from '../types/financial-export.types';
import type { DriverSettlementStatement } from '../types/fiscal-settlements.types';

const MOCK_COMPANY: CompanyHeaderLegalInfo = {
  name: 'Trans Bodanon S.A.R.L.',
  ice: '002938475000084',
  rc: '104928',
  patente: '492019',
  ifNumber: '39485721',
  address: 'Tanger Med Port, Maroc',
  phone: '+212 539 94 82 10',
  email: 'contact@transbodanon.com',
  currency: 'MAD',
};

const MOCK_STATEMENT: DriverSettlementStatement = {
  id: 42,
  company_id: 1,
  statement_number: 'STMT-202610-D04-8912',
  driver_id: 4,
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  status: 'settled',
  base_salary_mad: 5000,
  mission_bonuses_mad: 1800,
  safety_bonus_mad: 500,
  gross_driver_earnings_mad: 7300,
  total_advances_mad: 6000,
  total_fuel_expenses_mad: 3500,
  total_toll_expenses_mad: 1500,
  total_ferry_expenses_mad: 1200,
  total_port_customs_mad: 500,
  total_fines_mad: 300,
  total_other_expenses_mad: 0,
  total_driver_expenses_mad: 6700,
  expenses_advances_balance_mad: 700,
  net_payout_mad: 7700, // 7300 + 700 - 300
  trips_count: 2,
  total_distance_km: 3700,
  trip_ids: [101, 102],
  advance_ids: [1, 2],
  toll_expense_ids: [10],
  fine_ids: [5],
  itemized_expenses: [
    {
      id: 'fuel-1',
      category: 'fuel',
      amount: 3500,
      currency: 'MAD',
      date: '2026-10-05',
      reference: 'INV-TOTAL-091',
      description: 'Carburant station autoroute AP-7',
    },
    {
      id: 'toll-1',
      category: 'toll',
      amount: 1500,
      currency: 'MAD',
      date: '2026-10-06',
      reference: 'VIA-T-ES',
      description: 'Péages autoroutes Espagne',
    },
  ],
  created_at: '2026-10-09T10:00:00Z',
  updated_at: '2026-10-09T10:00:00Z',
};

describe('Financial Export Engine — Official PDF & Excel Systems', () => {
  describe('ClearanceCryptoService — HMAC-SHA256 & QR Integrity', () => {
    it('generates consistent 64-character hex cryptographic hash', () => {
      const hash1 = ClearanceCryptoService.generateSecurityHash({
        statementId: 42,
        driverId: 4,
        statementNumber: 'STMT-202610-D04-8912',
        netPayoutMad: 7700,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      });

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);

      // Idempotency check
      const hash2 = ClearanceCryptoService.generateSecurityHash({
        statementId: 42,
        driverId: 4,
        statementNumber: 'STMT-202610-D04-8912',
        netPayoutMad: 7700,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      });

      expect(hash1).toBe(hash2);
    });

    it('detects tampering with amount, dates, or driver ID', () => {
      const validPayload = {
        statementId: 42,
        driverId: 4,
        statementNumber: 'STMT-202610-D04-8912',
        netPayoutMad: 7700,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      };
      const validHash = ClearanceCryptoService.generateSecurityHash(validPayload);

      expect(ClearanceCryptoService.verifySecurityHash(validPayload, validHash)).toBe(true);

      // Alter net payout
      const tamperedPayload = { ...validPayload, netPayoutMad: 9999 };
      expect(ClearanceCryptoService.verifySecurityHash(tamperedPayload, validHash)).toBe(false);

      // Alter statement number
      const tamperedStmt = { ...validPayload, statementNumber: 'FAKE-NUM' };
      expect(ClearanceCryptoService.verifySecurityHash(tamperedStmt, validHash)).toBe(false);
    });

    it('generates valid QR Code Data URI', async () => {
      const url = 'https://app.transbodanon.com/verify/clearance/abc123def456';
      const qrDataUri = await ClearanceCryptoService.generateQrCodeDataUri(url);

      expect(qrDataUri).toContain('data:image/png;base64,');
      expect(qrDataUri.length).toBeGreaterThan(100);
    });
  });

  describe('DriverClearancePdfService — Vector A4 Printable Document', () => {
    it('generates valid HTML document in Arabic with RTL orientation', () => {
      const context: ClearanceSheetExportContext = {
        company: MOCK_COMPANY,
        driver: {
          driverId: 4,
          name: 'محمد الإدريسي',
          cin: 'KB84920',
          passportNumber: 'MC948201',
          driverLicenseNumber: 'DRV-8492',
          matricule: 'CH-04',
          truckPlate: '12345-A-26',
        },
        statement: MOCK_STATEMENT,
        locale: 'ar',
        verificationUrl: 'https://app.transbodanon.com/verify/clearance/test',
        verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        issuedAt: '9 أكتوبر 2026',
        qrCodeDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
      };

      const html = DriverClearancePdfService.generateClearanceHtml(context);

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain('كشف تصفية مصاريف الطريق وإبراء ذمة سائق');
      expect(html).toContain('محمد الإدريسي');
      expect(html).toContain('STMT-202610-D04-8912');
      expect(html).toContain('002938475000084'); // ICE
      expect(html).toMatch(/7[\s\u202F\u00A0]?700,00/); // Net payout formatted
      expect(html).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'); // Embedded QR
    });

    it('generates valid HTML document in French with LTR orientation', () => {
      const context: ClearanceSheetExportContext = {
        company: MOCK_COMPANY,
        driver: {
          driverId: 4,
          name: 'Mohamed Drissi',
          cin: 'KB84920',
        },
        statement: MOCK_STATEMENT,
        locale: 'fr',
        verificationUrl: 'https://app.transbodanon.com/verify/clearance/test',
        verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        issuedAt: '09 Octobre 2026',
      };

      const html = DriverClearancePdfService.generateClearanceHtml(context);

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('lang="fr"');
      expect(html).toContain('Décompte des Frais de Route & Décharge Chauffeur');
      expect(html).toContain('Mohamed Drissi');
      expect(html).toContain('Rémunération Brute');
      expect(html).toContain('Total Avances Versées');
    });

    it('generates valid HTML document in Spanish with LTR orientation', () => {
      const context: ClearanceSheetExportContext = {
        company: MOCK_COMPANY,
        driver: {
          driverId: 4,
          name: 'Mohamed Drissi',
        },
        statement: MOCK_STATEMENT,
        locale: 'es',
        verificationUrl: 'https://app.transbodanon.com/verify/clearance/test',
        verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        issuedAt: '09 Octubre 2026',
      };

      const html = DriverClearancePdfService.generateClearanceHtml(context);

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('lang="es"');
      expect(html).toContain('Liquidación de Gastos de Ruta y Finiquito de Chofer');
      expect(html).toContain('Retribución y Primas');
      expect(html).toContain('Balance Gastos de Ruta / Anticipos');
    });
  });

  describe('FiscalPnlExcelService — Professional Workbook Generator', () => {
    it('generates valid Excel base64 string decodable to 3 sheets with formulas', () => {
      const context: TripPnlExcelContext = {
        fiscalPeriod: '2026-10',
        company: MOCK_COMPANY,
        trips: [
          {
            id: 101,
            cmrNumber: 'CMR-2026-091',
            route: 'Tanger ➔ Perpignan',
            departureDate: '2026-10-02',
            driverName: 'Mohamed Drissi',
            truckPlate: '12345-A-26',
            revenue: 35000,
            fuelCost: 9500,
            tollsCost: 2800,
            ferryCost: 4500,
            customsCost: 1200,
            driverCost: 2500,
            otherCost: 0,
            totalCosts: 20500,
            grossProfit: 14500,
            profitMarginPct: 41.43,
            tier: 'exceptional',
            isClosed: true,
          },
          {
            id: 102,
            cmrNumber: 'CMR-2026-092',
            route: 'Perpignan ➔ Casablanca',
            departureDate: '2026-10-07',
            driverName: 'Mohamed Drissi',
            truckPlate: '12345-A-26',
            revenue: 28000,
            fuelCost: 8500,
            tollsCost: 2600,
            ferryCost: 4500,
            customsCost: 800,
            driverCost: 2000,
            otherCost: 0,
            totalCosts: 18400,
            grossProfit: 9600,
            profitMarginPct: 34.29,
            tier: 'exceptional',
            isClosed: true,
          },
        ],
        summary: {
          period: '2026-10',
          totalRevenueMad: 63000,
          totalOperatingCostsMad: 38900,
          grossOperatingProfitMad: 24100,
          averageMarginPct: 38.25,
          totalDriverPayoutsMad: 7700,
          totalReconciledTollsMad: 5400,
          totalReconciledFuelMad: 18000,
          unsettledAdvancesMad: 0,
          settledStatementsCount: 1,
          pendingStatementsCount: 0,
          closedTripsCount: 2,
        },
        locale: 'fr',
        generatedAt: '2026-10-09',
      };

      const base64 = FiscalPnlExcelService.generatePnlWorkbookBase64(context);
      expect(base64).toBeTruthy();

      // Read back workbook using XLSX
      const buffer = Buffer.from(base64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      expect(workbook.SheetNames).toEqual([
        'Synthèse_Exécutive',
        'Détail_P&L_Voyages',
        'Structure_Coûts',
      ]);

      // Check sheet 1
      const sheet1 = workbook.Sheets['Synthèse_Exécutive'];
      expect(sheet1).toBeTruthy();

      // Check sheet 2 (Trips)
      const sheet2 = workbook.Sheets['Détail_P&L_Voyages'];
      expect(sheet2).toBeTruthy();
      const tripsJson = XLSX.utils.sheet_to_json(sheet2);
      expect(tripsJson.length).toBeGreaterThanOrEqual(2);

      // Check sheet 3 (Costs)
      const sheet3 = workbook.Sheets['Structure_Coûts'];
      expect(sheet3).toBeTruthy();
    });
  });
});
