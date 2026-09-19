import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildCMRQrSummaryText,
  buildCMRVerificationUrl,
  generateCMRQrCodeBase64,
} from '@/lib/cmr-qr';
import {
  generateDeliverySignatureHash,
  verifyDeliverySignatureIntegrity,
  type SignatureIntegrityPayload,
} from '@/lib/signature-crypto';
import {
  calculateTripFinancials,
  type TripFinancialSummary,
} from '@/lib/profitability';
import { buildTripDossierHtml, type TripDossierData } from '@/lib/trip-dossier-pdf';
import type {
  TripOrder,
  Client,
  Driver,
  Truck,
  Trailer,
  Advance,
  TruckMaintenance,
  FinePenalty,
  Company,
} from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('Phase 6: International Trip Orders, Smart e-CMR & Consolidated Dossier (المرحلة 6 - دورة الرحلات الدولية)', () => {
  // Mock Base Data
  const mockTripOrder: TripOrder = {
    id: 105,
    route: 'Tanger Med -> Madrid',
    route_export: 'Tanger Med -> Algeciras -> Madrid',
    route_import: 'Valencia -> Tanger Med',
    price: 32000,
    price_export: 20000,
    price_import: 12000,
    departure_date: '2026-09-20',
    status: 'in_transit',
    created_at: '2026-09-18T10:00:00Z',
    cmr_number: 'CMR-EXP-00105',
    cmr_export_number: 'CMR-EXP-00105',
    cmr_import_number: 'CMR-IMP-00105',
    truck_id: 12,
    trailer_id: 8,
    driver_id: 4,
    client_id: 7,
    client_import_id: 9,
    weight_export: 22500,
    weight_import: 19800,
    goods_description_export: 'خضار وفواكه طازجة (Fruits & Légumes)',
    goods_description_import: 'قطع غيار سيارات ومعدات صناعية',
    ferry_company: 'FRS Iberia',
    ferry_localizador: 'FRS-889921',
  };

  const mockClientExport: Client = {
    id: 7,
    name: 'Agri Souss Export S.A.',
    phone: '+212661001122',
    address: 'Zone Industrielle Ait Melloul',
    city: 'Agadir',
    ice: '001928374000045',
    email: 'contact@agrisouss.ma',
    currency: 'MAD',
    is_active: true,
    invoice_with_tva: false,
    shipping_address_line1: 'Zone Franche',
    shipping_address_line2: '',
    shipping_address_line3: '',
    shipping_address_line4: '',
    shipping_city: 'Agadir',
    shipping_postal_code: '80000',
    shipping_country: 'Morocco',
    billing_address_line1: 'Zone Franche',
    billing_address_line2: '',
    billing_address_line3: '',
    billing_address_line4: '',
    billing_city: 'Agadir',
    billing_postal_code: '80000',
    billing_country: 'Morocco',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockDriver: Driver = {
    id: 4,
    name: 'رشيد البوداني (Rachid El Boudani)',
    phone: '+212661882233',
    license: 'MA-EC-994821',
    status: 'active',
    base_salary: 8000,
    bonus_percentage: 10,
    has_valid_visa: true,
    visa_number: 'VISA-ESP-2026-99',
    visa_expiry_date: '2027-05-30',
  };

  const mockTruck: Truck = {
    id: 12,
    plate_number: '48921-A-40',
    model: 'Volvo FH 500 Globetrotter',
    status: 'on_trip',
    created_at: '2025-01-10T00:00:00Z',
  };

  const mockTrailer: Trailer = {
    id: 8,
    plate_number: '12884-B-40',
    model: 'Schmitz Cargobull SKO 24 Frigo',
    status: 'on_trip',
    created_at: '2025-01-10T00:00:00Z',
  };

  describe('1. Smart e-CMR Payload & QR Code Generation (محرك وثيقة النقل الدولية الذكية)', () => {
    it('builds canonical e-CMR verification URL with baseUrl and handles trailing slashes', () => {
      const url1 = buildCMRVerificationUrl(105, 'https://app.transbodanon.ma');
      expect(url1).toBe('https://app.transbodanon.ma/track/105');

      const url2 = buildCMRVerificationUrl(105, 'https://app.transbodanon.ma/');
      expect(url2).toBe('https://app.transbodanon.ma/track/105');
    });

    it('generates a unified, structured e-CMR payload containing export/import CMR, IDs, crew, and verify URL', () => {
      const payload = buildCMRQrSummaryText({
        trip: mockTripOrder,
        client: mockClientExport,
        driver: mockDriver,
        truck: mockTruck,
        trailer: mockTrailer,
        baseUrl: 'https://app.transbodanon.ma',
      });

      // Verify standardized prefix
      expect(payload.startsWith('e-CMR|')).toBe(true);

      // Verify all required data elements
      expect(payload).toContain('ID:105');
      expect(payload).toContain('CMR_EXP:CMR-EXP-00105');
      expect(payload).toContain('CMR_IMP:CMR-IMP-00105');
      expect(payload).toContain('TRUCK:48921-A-40');
      expect(payload).toContain('TRAILER:12884-B-40');
      expect(payload).toContain('DRIVER:رشيد البوداني (Rachid El Boudani)');
      expect(payload).toContain('LICENSE:MA-EC-994821');
      expect(payload).toContain('CLIENT:Agri Souss Export S.A.');
      expect(payload).toContain('DEST:Tanger Med -> Algeciras -> Madrid');
      expect(payload).toContain('DATE:2026-09-20');
      expect(payload).toContain('VERIFY:https://app.transbodanon.ma/track/105');
    });

    it('handles missing optional entities gracefully without throwing errors', () => {
      const bareTrip: TripOrder = {
        id: 99,
        route: 'Casablanca -> Valencia',
        price: 15000,
        departure_date: '2026-10-01',
        status: 'pending',
        created_at: '2026-09-18T00:00:00Z',
      };

      const payload = buildCMRQrSummaryText({
        trip: bareTrip,
      });

      expect(payload).toContain('ID:99');
      expect(payload).toContain('CMR_EXP:CMR-EXP-99');
      expect(payload).toContain('CMR_IMP:N/A');
      expect(payload).toContain('TRUCK:N/A');
      expect(payload).toContain('TRAILER:N/A');
      expect(payload).toContain('DRIVER:N/A');
      expect(payload).toContain('LICENSE:N/A');
      expect(payload).toContain('CLIENT:N/A');
      expect(payload).toContain('VERIFY:/track/99');
    });

    it('generates high-resolution base64 QR code with error correction level M', async () => {
      const summary = buildCMRQrSummaryText({
        trip: mockTripOrder,
        client: mockClientExport,
        driver: mockDriver,
        truck: mockTruck,
        trailer: mockTrailer,
      });

      const qrBase64 = await generateCMRQrCodeBase64(summary);
      expect(qrBase64).toMatch(/^data:image\/png;base64,/);
      expect(qrBase64.length).toBeGreaterThan(500);
    });
  });

  describe('2. Operational Profitability P&L & Strict Decimal.js Precision (كشف الأرباح والخسائر)', () => {
    it('prevents JavaScript floating-point arithmetic errors in multi-currency and expense math', () => {
      // Native JS floating point error: 0.1 + 0.2 === 0.30000000000000004
      const nativeMath = 0.1 + 0.2;
      expect(nativeMath).not.toBe(0.3);

      const decimalMath = new Decimal(0.1).plus(new Decimal(0.2));
      expect(decimalMath.toNumber()).toBe(0.3);
      expect(decimalMath.toFixed(2)).toBe('0.30');
    });

    it('calculates round-trip revenue (Export + Import) accurately with Decimal.js', () => {
      const summary = calculateTripFinancials({
        trip: mockTripOrder,
        advances: [],
        fuelRecords: [],
        fines: [],
        ferries: [],
      });

      // Export (20,000) + Import (12,000) = 32,000 MAD
      expect(summary.priceExport).toBe(20000);
      expect(summary.priceImport).toBe(12000);
      expect(summary.revenue).toBe(32000);
    });

    it('falls back to trip.price when price_export and price_import are not defined', () => {
      const singlePriceTrip: TripOrder = {
        ...mockTripOrder,
        price: 25000,
        price_export: undefined,
        price_import: undefined,
      };

      const summary = calculateTripFinancials({
        trip: singlePriceTrip,
      });

      expect(summary.revenue).toBe(25000);
    });

    it('calculates the 4 standard port & maritime transit fees: 4,500 + 500 + 1,200 + 800 = 7,000 MAD', () => {
      const summary = calculateTripFinancials({
        trip: mockTripOrder,
      });

      expect(summary.portFeesBreakdown).toBeDefined();
      expect(summary.portFeesBreakdown.ferry).toBe(4500); // تذكرة الباخرة
      expect(summary.portFeesBreakdown.triptik).toBe(500); // تريبتيك جمركي
      expect(summary.portFeesBreakdown.transitAlmeria).toBe(1200); // ترانزيت ألميريا
      expect(summary.portFeesBreakdown.marsaMaroc).toBe(800); // رسوم ميناء مرسى المغرب
      expect(summary.portFeesBreakdown.total).toBe(7000);
      expect(summary.ferryCost).toBe(7000);
    });

    it('overrides port fees when custom values or specific ferry expenses are provided', () => {
      const customPortTrip: TripOrder = {
        ...mockTripOrder,
        ferry_cost: 4800,
        triptik_cost: 600,
        transit_almeria_cost: 1500,
        marsa_maroc_cost: 900,
      };

      const summary = calculateTripFinancials({
        trip: customPortTrip,
      });

      // 4800 + 600 + 1500 + 900 = 7,800
      expect(summary.portFeesBreakdown.ferry).toBe(4800);
      expect(summary.portFeesBreakdown.triptik).toBe(600);
      expect(summary.portFeesBreakdown.transitAlmeria).toBe(1500);
      expect(summary.portFeesBreakdown.marsaMaroc).toBe(900);
      expect(summary.portFeesBreakdown.total).toBe(7800);
      expect(summary.ferryCost).toBe(7800);
    });

    it('computes complete P&L with revenue, fuel, driver advances, standard port fees, fines, and profit margin', () => {
      const mockAdvances: Advance[] = [
        {
          id: 1,
          driver_id: 4,
          amount: 2500,
          currency: 'MAD',
          reason: 'سلفة مصروفات الطريق الدولية',
          status: 'paid',
          date: '2026-09-19',
          created_at: '2026-09-19T00:00:00Z',
          is_deleted: false,
          extra_advances: 0,
          driver_allowance: 0,
          receipt_expenses: 0,
          cmr_number: 'CMR-EXP-00105',
        },
      ];

      const mockFuel: TruckMaintenance[] = [
        {
          id: 10,
          truck_id: 12,
          date: '2026-09-20',
          type: 'fuel',
          amount: 6200.5,
          notes: 'تزويد وقود طنجة المتوسط',
          created_at: '2026-09-20T00:00:00Z',
        },
      ];

      const mockFines: FinePenalty[] = [
        {
          id: 3,
          trip_order_id: 105,
          driver_id: 4,
          driver_name: 'Rachid El Boudani',
          amount: 300,
          currency: 'MAD',
          fine_type: 'speeding',
          status: 'pending',
          deducted_from_settlement: false,
          created_at: '2026-09-21T00:00:00Z',
        },
      ];

      const summary: TripFinancialSummary = calculateTripFinancials({
        trip: mockTripOrder,
        advances: mockAdvances,
        fuelRecords: mockFuel,
        fines: mockFines,
        distanceKm: 2400,
        fuelLiters: 768, // 768 / 2400 * 100 = 32 L/100km (normal)
      });

      // Revenue: 32,000 MAD
      expect(summary.revenue).toBe(32000);

      // Expenses:
      // Advances: 2,500
      // Fuel: 6,200.5
      // Port Fees: 7,000 (standard 4,500 + 500 + 1,200 + 800)
      // Fines: 300
      // Total Expenses: 2,500 + 6,200.5 + 7,000 + 300 = 16,000.5
      expect(summary.advancesCost).toBe(2500);
      expect(summary.fuelCost).toBe(6200.5);
      expect(summary.ferryCost).toBe(7000);
      expect(summary.finesCost).toBe(300);
      expect(summary.totalExpenses).toBe(16000.5);

      // Net Profit: 32,000 - 16,000.5 = 15,999.5
      expect(summary.netProfit).toBe(15999.5);

      // Margin: (15,999.5 / 32,000) * 100 = 49.9984... -> 50.0%
      expect(summary.profitMarginPercentage).toBe(50.0);

      // Fuel consumption efficiency:
      expect(summary.litersPer100Km).toBe(32);
      expect(summary.fuelStatus).toBe('normal');
    });

    it('handles negative net profit (loss) correctly without breaking percentages', () => {
      const expensiveTrip: TripOrder = {
        ...mockTripOrder,
        price_export: 5000,
        price_import: 0,
      };

      const mockFuel: TruckMaintenance[] = [
        {
          id: 11,
          truck_id: 12,
          date: '2026-09-20',
          type: 'fuel',
          amount: 8000,
          created_at: '2026-09-20T00:00:00Z',
        },
      ];

      const summary = calculateTripFinancials({
        trip: expensiveTrip,
        fuelRecords: mockFuel,
      });

      // Revenue = 5,000. Fuel = 8,000. Ports = 7,000. Total = 15,000. Net = -10,000.
      expect(summary.revenue).toBe(5000);
      expect(summary.totalExpenses).toBe(15000);
      expect(summary.netProfit).toBe(-10000);
      expect(summary.profitMarginPercentage).toBe(-200);
    });
  });

  describe('3. Cryptographic e-POD HMAC Signature & Anti-Tampering (البصمة المشفرة لإثبات التسليم)', () => {
    const validPayload: SignatureIntegrityPayload = {
      tripOrderId: 105,
      recipientName: 'Carlos Hernandez',
      signedAt: '2026-09-22T16:30:00Z',
      latitude: 40.416775,
      longitude: -3.70379,
      signatureUrl: 'https://storage.transbodanon.ma/signatures/pod-105-sig.png',
    };

    it('generates consistent SHA-256 HMAC hash for identical delivery proof payload', () => {
      const hash1 = generateDeliverySignatureHash(validPayload, 'secret-key-test');
      const hash2 = generateDeliverySignatureHash(validPayload, 'secret-key-test');

      expect(hash1).toBeDefined();
      expect(hash1.length).toBe(64); // 64 hex chars = 256 bits
      expect(hash1).toBe(hash2);
    });

    it('successfully validates untampered delivery signature proof', () => {
      const hash = generateDeliverySignatureHash(validPayload, 'secret-key-test');
      const isValid = verifyDeliverySignatureIntegrity(validPayload, hash, 'secret-key-test');

      expect(isValid).toBe(true);
    });

    it('fails validation when recipient name is tampered with', () => {
      const hash = generateDeliverySignatureHash(validPayload, 'secret-key-test');
      const tamperedPayload: SignatureIntegrityPayload = {
        ...validPayload,
        recipientName: 'Alberto Fernandez',
      };

      const isValid = verifyDeliverySignatureIntegrity(tamperedPayload, hash, 'secret-key-test');
      expect(isValid).toBe(false);
    });

    it('fails validation when GPS coordinates are modified', () => {
      const hash = generateDeliverySignatureHash(validPayload, 'secret-key-test');
      const tamperedPayload: SignatureIntegrityPayload = {
        ...validPayload,
        latitude: 40.417999, // Altered latitude
      };

      const isValid = verifyDeliverySignatureIntegrity(tamperedPayload, hash, 'secret-key-test');
      expect(isValid).toBe(false);
    });

    it('fails validation when signature image URL is altered', () => {
      const hash = generateDeliverySignatureHash(validPayload, 'secret-key-test');
      const tamperedPayload: SignatureIntegrityPayload = {
        ...validPayload,
        signatureUrl: 'https://fake-storage.net/signatures/hacked-sig.png',
      };

      const isValid = verifyDeliverySignatureIntegrity(tamperedPayload, hash, 'secret-key-test');
      expect(isValid).toBe(false);
    });

    it('fails validation when checked with a mismatched signing key', () => {
      const hash = generateDeliverySignatureHash(validPayload, 'original-secret-key');
      const isValid = verifyDeliverySignatureIntegrity(validPayload, hash, 'wrong-secret-key');

      expect(isValid).toBe(false);
    });

    it('handles null and undefined GPS coordinates gracefully without throwing', () => {
      const noGpsPayload: SignatureIntegrityPayload = {
        tripOrderId: 105,
        recipientName: 'Maria Garcia',
        signedAt: '2026-09-22T17:00:00Z',
        latitude: null,
        longitude: undefined,
        signatureUrl: 'https://storage.transbodanon.ma/signatures/pod-105-no-gps.png',
      };

      const hash = generateDeliverySignatureHash(noGpsPayload, 'secret-key-test');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);

      const isValid = verifyDeliverySignatureIntegrity(noGpsPayload, hash, 'secret-key-test');
      expect(isValid).toBe(true);
    });

    it('handles corrupted, malformed, or empty hash strings safely without crashing', () => {
      expect(verifyDeliverySignatureIntegrity(validPayload, '', 'secret-key-test')).toBe(false);
      expect(verifyDeliverySignatureIntegrity(validPayload, 'short-hash', 'secret-key-test')).toBe(false);
      expect(verifyDeliverySignatureIntegrity(validPayload, null as unknown as string, 'secret-key-test')).toBe(false);
      expect(verifyDeliverySignatureIntegrity(validPayload, undefined as unknown as string, 'secret-key-test')).toBe(false);
    });
  });

  describe('4. Consolidated Mission Dossier Template & Trilingual HTML Output (توليد الأرشيف الموحد بثلاث لغات)', () => {
    const mockFinancialSummary = calculateTripFinancials({
      trip: mockTripOrder,
      advances: [],
      fuelRecords: [],
      fines: [],
      ferries: [],
    });

    const baseDossierData: TripDossierData = {
      trip: mockTripOrder,
      company: {
        id: 1,
        name: 'Trans Bodanon International',
        ice: '001234567000089',
        currency: 'MAD',
      } as unknown as Company,
      clientExport: mockClientExport,
      clientImport: null,
      driver: mockDriver,
      truck: mockTruck,
      trailer: mockTrailer,
      deliveryProof: null,
      qrCodeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      integrityHash: '8f434352de9632eb1e944b5efad784534f404e76c117830db99a0956976f9219',
      financialSummary: mockFinancialSummary,
      generatedAt: '2026-09-20T12:00:00.000Z',
    };

    it('renders valid Arabic HTML with dir="rtl" and lang="ar" by default', () => {
      const html = buildTripDossierHtml({
        ...baseDossierData,
        locale: 'ar',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="ar" dir="rtl"');
      expect(html).toContain('الملف اللوجستي والمالي الموحد');
      expect(html).toContain('TIR CORRIDOR');
      expect(html).toContain('Trans Bodanon International');
      expect(html).toContain('MAD');
      expect(html).toContain('8f434352de9632eb1e944b5efad78453');
    });

    it('renders valid French HTML with dir="ltr" and lang="fr" when requested', () => {
      const html = buildTripDossierHtml({
        ...baseDossierData,
        locale: 'fr',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="fr" dir="ltr"');
      expect(html).toContain('Dossier de Mission TIR &amp; Financier');
      expect(html).toContain('Trajet Aller &amp; Exportation');
      expect(html).toContain('Chiffre d&#x27;Affaires Fret Total');
      expect(html).toContain('MAD');
    });

    it('renders valid Spanish HTML with dir="ltr" and lang="es" when requested', () => {
      const html = buildTripDossierHtml({
        ...baseDossierData,
        locale: 'es',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="es" dir="ltr"');
      expect(html).toContain('Dossier de Misión TIR y Financiero');
      expect(html).toContain('Trayecto de Ida y Exportación');
      expect(html).toContain('Ingresos Totales por Flete');
      expect(html).toContain('MAD');
    });
  });
});
