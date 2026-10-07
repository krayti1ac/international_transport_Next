import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateTripInvoiceBreakdown,
  isInternationalTransport,
  formatAutoInvoiceNumber,
  formatBankCoordinates,
  buildClientPaymentPortalLink,
  autoGenerateInvoiceForTrip,
  INTERNATIONAL_VAT_EXEMPTION_CLAUSE,
} from '../services/auto-invoicing.service';
import type { TripOrder, Client, Invoice } from '@/types/database';

// Mock External Modules
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-123' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Automated Invoicing & Settlement Engine (Epic 6 / Phase 1)', () => {
  const mockInternationalTrip: TripOrder = {
    id: 901,
    route: 'Tanger Med -> Algeciras',
    corridor_type: 'european_maritime',
    price: 32000,
    price_export: 32000,
    price_type: 'MAD',
    departure_date: '2026-10-25',
    status: 'in_transit',
    created_at: '2026-10-20',
    client_id: 42,
    cmr_export_number: 'CMR-2026-901',
    ferry_localizador: 'BALEARIA-LOC-8877',
    ferry_cost: 6500,
    transit_almeria_cost: 800,
    marsa_maroc_cost: 1200,
    triptik_cost: 500,
  };

  const mockDomesticTrip: TripOrder = {
    id: 902,
    route: 'Casablanca -> Agadir',
    corridor_type: undefined,
    price: 12000,
    price_export: 12000,
    price_type: 'MAD',
    departure_date: '2026-10-26',
    status: 'in_transit',
    created_at: '2026-10-20',
    client_id: 43,
  };

  const mockClientExport: Client = {
    id: 42,
    name: 'Atlas Fruits Export SARL',
    phone: '0661234567',
    email: 'contact@atlasfruits.ma',
    ice: '001523456789012',
    address: 'Zone Industrielle, Agadir',
    city: 'Agadir',
    currency: 'MAD',
    invoice_with_tva: false,
    created_at: '2026-01-01',
    is_active: true,
    shipping_address_line1: 'Agadir',
    shipping_address_line2: '',
    shipping_address_line3: '',
    shipping_address_line4: '',
    shipping_city: 'Agadir',
    shipping_postal_code: '80000',
    shipping_country: 'MA',
    billing_address_line1: 'Agadir',
    billing_address_line2: '',
    billing_address_line3: '',
    billing_address_line4: '',
    billing_city: 'Agadir',
    billing_postal_code: '80000',
    billing_country: 'MA',
  };

  const mockClientDomestic: Client = {
    id: 43,
    name: 'Maroc Distribution SA',
    phone: '0669887766',
    email: 'contact@marocdist.ma',
    ice: '002987654321098',
    address: 'Boulevard Mohammed V, Casablanca',
    city: 'Casablanca',
    currency: 'MAD',
    invoice_with_tva: true,
    tva_rate: '20',
    created_at: '2026-01-01',
    is_active: true,
    shipping_address_line1: 'Casablanca',
    shipping_address_line2: '',
    shipping_address_line3: '',
    shipping_address_line4: '',
    shipping_city: 'Casablanca',
    shipping_postal_code: '20000',
    shipping_country: 'MA',
    billing_address_line1: 'Casablanca',
    billing_address_line2: '',
    billing_address_line3: '',
    billing_address_line4: '',
    billing_city: 'Casablanca',
    billing_postal_code: '20000',
    billing_country: 'MA',
  };

  const mockCustomsSubmission = {
    mrn: '26MA003100DUM778899',
    seal_numbers: ['MA-DOUANE-881122', 'MA-DOUANE-881123'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. International Transport Classification & Detection', () => {
    it('identifies european_maritime as international', () => {
      expect(isInternationalTransport(mockInternationalTrip)).toBe(true);
    });

    it('identifies african_overland as international', () => {
      const trip = { corridor_type: 'african_overland', route: 'Agadir -> Dakar' };
      expect(isInternationalTransport(trip as any)).toBe(true);
    });

    it('identifies international routes even if corridor_type is unset', () => {
      const trip = { route: 'Tanger Med -> Algeciras' };
      expect(isInternationalTransport(trip as any)).toBe(true);
    });

    it('correctly classifies domestic routes as non-international', () => {
      expect(isInternationalTransport(mockDomesticTrip)).toBe(false);
    });
  });

  describe('2. Strict Financial Breakdown & Tax Exemption (Article 92 CGI)', () => {
    it('exempts international freight from VAT (0% TVA, Art. 92 CGI) using Decimal.js', () => {
      const breakdown = calculateTripInvoiceBreakdown(
        mockInternationalTrip,
        mockClientExport,
        mockCustomsSubmission
      );

      expect(breakdown.isTaxExempt).toBe(true);
      expect(breakdown.tvaRate).toBe('0');
      expect(breakdown.tvaAmount).toBe('0.00');
      expect(breakdown.totalHt).toBe('32000.00');
      expect(breakdown.totalTtc).toBe('32000.00');
      expect(breakdown.taxExemptionClause).toBe(INTERNATIONAL_VAT_EXEMPTION_CLAUSE);
      expect(breakdown.mrn).toBe('26MA003100DUM778899');
      expect(breakdown.scelleNumbers).toEqual(['MA-DOUANE-881122', 'MA-DOUANE-881123']);
      expect(breakdown.ferryBooking).toBe('BALEARIA-LOC-8877');
      expect(breakdown.cmrNumber).toBe('CMR-2026-901');
      expect(breakdown.clientIce).toBe('001523456789012');
    });

    it('applies standard 20% TVA for domestic transport using Decimal.js', () => {
      const breakdown = calculateTripInvoiceBreakdown(
        mockDomesticTrip,
        mockClientDomestic,
        null
      );

      // 12,000 * 20% = 2,400.00 TVA -> 14,400.00 TTC
      expect(breakdown.isTaxExempt).toBe(false);
      expect(breakdown.tvaRate).toBe('20');
      expect(breakdown.tvaAmount).toBe('2400.00');
      expect(breakdown.totalHt).toBe('12000.00');
      expect(breakdown.totalTtc).toBe('14400.00');
      expect(breakdown.taxExemptionClause).toBeUndefined();
    });

    it('handles decimal amounts without precision loss using Decimal.js', () => {
      const tripWithDecimals: TripOrder = {
        ...mockDomesticTrip,
        price: 12345.67,
        price_export: 12345.67,
      };

      const breakdown = calculateTripInvoiceBreakdown(
        tripWithDecimals,
        mockClientDomestic,
        null
      );

      // 12345.67 * 0.20 = 2469.134 -> ROUND_HALF_UP = 2469.13
      // 12345.67 + 2469.13 = 14814.80
      expect(breakdown.totalHt).toBe('12345.67');
      expect(breakdown.tvaAmount).toBe('2469.13');
      expect(breakdown.totalTtc).toBe('14814.80');
    });
  });

  describe('3. Invoice Number & Payment Links Formatting', () => {
    it('formats sequential auto-invoice numbers with current year and padded trip ID', () => {
      const invNumber = formatAutoInvoiceNumber(901);
      const currentYear = new Date().getFullYear();
      expect(invNumber).toBe(`INV-${currentYear}-0901`);
    });

    it('includes company ID prefix when companyId is provided', () => {
      const invNumber = formatAutoInvoiceNumber(901, 7);
      const currentYear = new Date().getFullYear();
      expect(invNumber).toBe(`INV-C7-${currentYear}-0901`);
    });

    it('builds secure client portal query link with ICE, CMR, and trip ID', () => {
      const link = buildClientPaymentPortalLink(
        901,
        42,
        '001523456789012',
        'CMR-2026-901'
      );

      expect(link).toContain('/portal/invoices?');
      expect(link).toContain('client_id=42');
      expect(link).toContain('ice=001523456789012');
      expect(link).toContain('cmr=CMR-2026-901');
      expect(link).toContain('trip_id=901');
    });

    it('formats bank coordinates properly', () => {
      const bank = formatBankCoordinates(mockClientExport);
      expect(bank).toContain('ATTIJARIWAFA BANK');
      expect(bank).toContain('RIB:');
    });
  });

  describe('4. Idempotent Auto-Invoicing Workflow (autoGenerateInvoiceForTrip)', () => {
    it('returns existing invoice immediately without re-inserting when invoice already exists (Idempotency Guard)', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      const existingInvoiceRecord = {
        id: 777,
        trip_order_id: 901,
        client_id: '42',
        invoice_number: 'INV-2026-0901',
        total_amount: '32000.00',
        status: 'unpaid',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'invoices') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [existingInvoiceRecord],
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const result = await autoGenerateInvoiceForTrip(901);

      expect(result.success).toBe(true);
      expect(result.alreadyExisted).toBe(true);
      expect(result.invoice?.id).toBe(777);
      expect(result.invoice?.invoice_number).toBe('INV-2026-0901');
      expect(result.paymentLink).toContain('trip_id=901');
    });

    it('generates, inserts, links, and dispatches invoice when none exists', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const { sendWhatsAppCloudMessage } = await import('@/lib/whatsapp');
      const { recordAuditLog } = await import('@/lib/audit.server');

      const createdInvoice = {
        id: 888,
        trip_order_id: 901,
        client_id: '42',
        invoice_number: 'INV-2026-0901',
        total_amount: '32000.00',
        ht_amount: '32000.00',
        tva_rate: '0',
        tva_amount: '0.00',
        ttc_amount: '32000.00',
        currency: 'MAD',
        status: 'unpaid',
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'invoices') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string, val: any) => {
                // If checking trip_order_id in idempotency step, return empty array
                return Promise.resolve({ data: [], error: null });
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: createdInvoice, error: null }),
                }),
              }),
            };
          }
          if (table === 'trip_orders') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockInternationalTrip, error: null }),
              update: vi.fn().mockReturnThis(),
            };
          }
          if (table === 'clients') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockClientExport, error: null }),
            };
          }
          if (table === 'customs_submissions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomsSubmission, error: null }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const result = await autoGenerateInvoiceForTrip(901, {
        triggerEvent: 'customs_cleared',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyExisted).toBe(false);
      expect(result.invoice?.id).toBe(888);
      expect(result.details?.isTaxExempt).toBe(true);
      expect(result.details?.totalTtc).toBe('32000.00');

      // WhatsApp notification was dispatched
      expect(sendWhatsAppCloudMessage).toHaveBeenCalledTimes(1);
      const waCallArgs = vi.mocked(sendWhatsAppCloudMessage).mock.calls[0][0];
      expect(waCallArgs.to).toBe('0661234567');
      expect(waCallArgs.message).toContain('INV-2026-0901');
      expect(waCallArgs.message).toContain('32000.00 MAD');
      expect(waCallArgs.message).toContain('MRN 26MA003100DUM778899');

      // Audit log was recorded
      expect(recordAuditLog).toHaveBeenCalledTimes(1);
      const auditArgs = vi.mocked(recordAuditLog).mock.calls[0][0];
      expect(auditArgs.entityType).toBe('invoices');
      expect(auditArgs.entityId).toBe('888');
    });

    it('returns error if trip order has no associated client', async () => {
      const { createClient } = await import('@/lib/supabase/server');

      const tripWithoutClient: TripOrder = {
        ...mockInternationalTrip,
        client_id: undefined,
        client_import_id: undefined,
      };

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'invoices') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'trip_orders') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: tripWithoutClient, error: null }),
            };
          }
          return {};
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const result = await autoGenerateInvoiceForTrip(901);
      expect(result.success).toBe(false);
      expect(result.error).toContain('العميل المصدر غير محدد');
    });
  });
});
