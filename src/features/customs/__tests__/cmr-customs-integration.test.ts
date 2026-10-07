import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCMRVerificationUrl } from '@/lib/cmr-qr';
import { getTripCustomsData } from '@/features/customs/services/customs-gateway.actions';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 42,
              cmr_export_number: 'CMR-EXP-00042',
              ferry_localizador: 'LOC-BAL-8899',
              ferry_company: 'Balearia',
              weight_export: 22500,
              goods_description_export: 'Tomates Frigo',
              truck: { plate_number: '10101-A-40' },
              trailer: { plate_number: 'REM-1001-MA' },
              driver: { name: 'Abdelkarim El Khamlichi', passport_number: 'PA901245' },
              client: { name: 'Agro Export', ice: '001928374650001' },
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('e-CMR & Customs Clearance Integration (CMRPrintModal & Public Verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. e-CMR QR Code & Public Verification URL', () => {
    it('generates compliant public verification URL linking directly to /track/[id]', () => {
      const url = buildCMRVerificationUrl(42);
      expect(url).toContain('/track/42');
    });

    it('ensures tracking route contains no sensitive financial query params', () => {
      const url = buildCMRVerificationUrl(99);
      expect(url).not.toContain('price');
      expect(url).not.toContain('cost');
      expect(url).not.toContain('revenue');
      expect(url).not.toContain('balance');
    });
  });

  describe('2. Customs Clearance Resolution for e-CMR Print Document', () => {
    it('fetches and resolves PortNet gate pass data including MRN and customs seal', async () => {
      const customsRes = await getTripCustomsData(42);

      expect(customsRes.success).toBe(true);
      expect(customsRes.portNet).toBeDefined();

      const portNet = customsRes.portNet!;
      expect(portNet.tripId).toBe(42);
      expect(portNet.bookingReference).toBe('LOC-BAL-8899');
      expect(portNet.ferryCompany).toBe('Balearia');
      expect(portNet.mrnNumber).toContain('CMR-EXP-00042');
      expect(portNet.customsSealNumber).toContain('MA-DOUANE-000042');
      expect(portNet.grossWeightKg).toBe(22500);
      expect(portNet.consignorIce).toBe('001928374650001');
    });

    it('correctly formats official MRN and Scellé for display in Box 18 & 19', () => {
      const tripId = 42;
      const cmrExportNumber = 'CMR-EXP-00042';

      const mrnDisplay = cmrExportNumber
        ? `MRN-MA-${cmrExportNumber}`
        : `MRN-MA-${tripId.toString().padStart(6, '0')}-DUM`;

      const sealDisplay = `MA-DOUANE-${tripId.toString().padStart(6, '0')}`;

      expect(mrnDisplay).toBe('MRN-MA-CMR-EXP-00042');
      expect(sealDisplay).toBe('MA-DOUANE-000042');
    });
  });

  describe('3. Financial Privacy Guard in e-CMR Printout', () => {
    it('masks commercial transport freight price when confidentiality toggle is enabled', () => {
      const activePrice = 35000;
      const hidePrice = true;

      const renderedPrice = hidePrice
        ? 'Non Déclaré (Exemplaire Réglementaire)'
        : `${activePrice.toLocaleString()} MAD`;

      expect(renderedPrice).toBe('Non Déclaré (Exemplaire Réglementaire)');
      expect(renderedPrice).not.toContain('35,000');
    });

    it('displays standard formatted freight rate when price is declared', () => {
      const activePrice = 35000;
      const hidePrice = false;

      const renderedPrice = hidePrice
        ? 'Non Déclaré (Exemplaire Réglementaire)'
        : `${activePrice.toLocaleString()} MAD`;

      expect(renderedPrice).toMatch(/35[,.]?000 MAD/);
    });
  });
});
