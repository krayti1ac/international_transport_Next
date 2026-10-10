import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportMonthlyDockArrivalsExcelAction,
  exportMonthlyDockArrivalsPdfAction,
} from '../services/dock-export.actions';
import { DockArrivalsExcelService } from '../services/dock-arrivals-excel.service';
import { DockArrivalsPdfService } from '../services/dock-arrivals-pdf.service';
import * as AuditActions from '../services/dock-dispatch-audit.actions';

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

describe('Monthly Dock Arrivals & Compliance Export Engine (Excel & PDF)', () => {
  const MOCK_ITEMS = [
    {
      id: 'item-1',
      tripId: 8840,
      tripNumber: 'TRIP-2026-8840',
      cmrNumber: 'CMR-2026-8840',
      truckPlate: '67890-A-40',
      zoneName: 'Mercamadrid - Muelle 14 Frutas',
      zoneType: 'customer_warehouse',
      arrivedAt: '2026-10-09T18:30:00Z',
      receiverName: 'Carlos Rodriguez',
      receiverPhone: '+34612345678',
      compartmentCode: 'C1',
      compartmentName: 'Front Frozen Zone',
      cargoCategory: 'deep_frozen',
      status: 'compliant' as const,
      mktTempC: -19.45,
      complianceScore: 100,
      dispatchStatus: 'delivered' as const,
      messageId: 'wamid.123',
      isCooldownActive: true,
      cooldownRemainingMinutes: 42,
    },
    {
      id: 'item-2',
      tripId: 8840,
      tripNumber: 'TRIP-2026-8840',
      cmrNumber: 'CMR-2026-8840',
      truckPlate: '67890-A-40',
      zoneName: 'Mercamadrid - Muelle 14 Frutas',
      zoneType: 'customer_warehouse',
      arrivedAt: '2026-10-09T18:30:00Z',
      receiverName: 'Carlos Rodriguez',
      receiverPhone: '+34612345678',
      compartmentCode: 'C2',
      compartmentName: 'Chilled Produce Zone',
      cargoCategory: 'fresh_produce',
      status: 'compliant' as const,
      mktTempC: 4.15,
      complianceScore: 98,
      dispatchStatus: 'delivered' as const,
      messageId: 'wamid.124',
      isCooldownActive: true,
      cooldownRemainingMinutes: 42,
    },
    {
      id: 'item-3',
      tripId: 8835,
      tripNumber: 'TRIP-2026-8835',
      cmrNumber: 'CMR-2026-8835',
      truckPlate: '12345-B-10',
      zoneName: 'Marché Saint-Charles Perpignan',
      zoneType: 'unloading_zone',
      arrivedAt: '2026-10-08T12:00:00Z',
      receiverName: 'Jean-Luc Dubois',
      receiverPhone: '+33612987654',
      compartmentCode: 'C1',
      compartmentName: 'Zone Tempérée Frais',
      cargoCategory: 'fresh_produce',
      status: 'warning' as const,
      mktTempC: 3.8,
      complianceScore: 92,
      dispatchStatus: 'sent' as const,
      messageId: 'wamid.125',
      isCooldownActive: false,
      cooldownRemainingMinutes: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AuditActions, 'fetchDockArrivalsAuditAction').mockImplementation(
      async () => ({
        success: true,
        items: MOCK_ITEMS,
        stats: {
          totalArrivals: 3,
          totalDispatches: 3,
          successfulDispatches: 3,
          cooldownProtected: 2,
          successRatePct: 100,
          topDocks: [
            { zoneName: 'Mercamadrid - Muelle 14 Frutas', count: 2 },
            { zoneName: 'Marché Saint-Charles Perpignan', count: 1 },
          ],
          activeCompartmentsCount: { C1: 2, C2: 1, C3: 0 },
        },
      })
    );
  });

  describe('1. Monthly Excel Workbook Exporter Action', () => {
    it('successfully generates multi-sheet Excel XML workbook with required worksheets', async () => {
      const result = await exportMonthlyDockArrivalsExcelAction({
        month: '2026-10',
        locale: 'ar',
        format: 'excel',
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('excel');
      expect(result.filename).toBe('dock_arrivals_2026-10.xls');
      expect(result.mimeType).toBe('application/vnd.ms-excel');
      expect(result.verificationHash).toBeDefined();
      expect(result.verificationHash.length).toBe(64); // SHA-256 hex string
      expect(result.verificationUrl).toContain('https://tms.transbodanon.com/verify/cold-chain/');

      // Verify Worksheet names
      expect(result.content).toContain('ss:Name="Synthèse_Mensuelle"');
      expect(result.content).toContain('ss:Name="Détail_Arrivages_Docks"');
      expect(result.content).toContain('ss:Name="Audit_Chaine_Froid"');

      // Verify content data
      expect(result.content).toContain('Mercamadrid');
      expect(result.content).toContain('TRIP-2026-8840');
      expect(result.content).toContain('Carlos Rodriguez');
      expect(result.content).toContain('Perpignan');
    });

    it('generates French and Spanish localized workbooks correctly', async () => {
      const resFr = await exportMonthlyDockArrivalsExcelAction({
        month: '2026-10',
        locale: 'fr',
        format: 'excel',
      });

      expect(resFr.success).toBe(true);
      expect(resFr.content).toContain('Rapport Mensuel des Arrivages aux Quais');
      expect(resFr.content).toContain('Identifiant Commun');

      const resEs = await exportMonthlyDockArrivalsExcelAction({
        month: '2026-10',
        locale: 'es',
        format: 'excel',
      });

      expect(resEs.success).toBe(true);
      expect(resEs.content).toContain('Informe Mensual de Llegadas a Muelles');
    });
  });

  describe('2. Monthly Official Printable PDF / HTML Exporter Action', () => {
    it('successfully generates vector printable HTML report with QR code and cryptographic seal', async () => {
      const result = await exportMonthlyDockArrivalsPdfAction({
        month: '2026-10',
        locale: 'ar',
        format: 'pdf',
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');
      expect(result.filename).toBe('dock_arrivals_compliance_2026-10.html');
      expect(result.mimeType).toBe('text/html');
      expect(result.verificationHash).toBeDefined();
      expect(result.verificationHash.length).toBe(64);

      // Verify HTML content structure
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('dir="rtl"');
      expect(result.content).toContain('Trans Bodanon Transport');
      expect(result.content).toContain('data:image/png;base64,'); // QR code data URL
      expect(result.content).toContain('SHA256: ' + result.verificationHash);
      expect(result.content).toContain('تأشيرة مدير الجودة وسلاسل التبريد (GDP)');
    });

    it('supports French LTR format with proper direction and labels', async () => {
      const result = await exportMonthlyDockArrivalsPdfAction({
        month: '2026-10',
        locale: 'fr',
        format: 'pdf',
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('dir="ltr"');
      expect(result.content).toContain('Responsable Qualité & GDP Chaîne du Froid');
      expect(result.content).toContain('Directeur des Opérations & Flotte');
    });
  });

  describe('3. Validation & Edge Cases', () => {
    it('rejects invalid month format using Zod validation', async () => {
      const result = await exportMonthlyDockArrivalsExcelAction({
        month: 'invalid-month',
        format: 'excel',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('صيغة الشهر يجب أن تكون YYYY-MM');
    });
  });
});

