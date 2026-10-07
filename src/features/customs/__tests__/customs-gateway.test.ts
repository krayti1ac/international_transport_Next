import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSubmissionsStore: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => ({
          eq: (col2: string, val2: any) => ({
            eq: (col3: string, val3: any) => ({
              maybeSingle: async () => {
                const found = mockSubmissionsStore.find(
                  (s) => s.trip_id === val && s.gateway === val2 && s.idempotency_key === val3
                );
                return { data: found || null, error: null };
              },
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async (record: any) => {
        const existingIdx = mockSubmissionsStore.findIndex(
          (s) => s.idempotency_key === record.idempotency_key
        );
        if (existingIdx >= 0) {
          mockSubmissionsStore[existingIdx] = { ...mockSubmissionsStore[existingIdx], ...record };
        } else {
          mockSubmissionsStore.push(record);
        }
        return { data: record, error: null };
      },
    }),
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  escapeXml,
  validateMoroccanIce,
  buildPortNetXML,
  buildTirEpdXML,
  buildPortNetPayloadFromTripOrder,
  buildTirEpdPayloadFromTripOrder,
} from '../services/customs-payload-builder.service';
import {
  generateCustomsIdempotencyKey,
  verifyCustomsReadiness,
  submitCustomsDeclaration,
} from '../services/customs-submission.service';
import { STANDARD_CUSTOMS_OFFICES } from '../services/customs-api-adapter.service';
import type { PortNetPayloadData, TirEpdPayloadData } from '../types/customs.types';

describe('Epic 5: International Customs & Port Gateways (PortNet & IRU TIR-EPD)', () => {
  beforeEach(() => {
    mockSubmissionsStore.length = 0;
    vi.clearAllMocks();
  });

  describe('5.1 XML Escaping & Moroccan ICE Sanitization', () => {
    it('correctly escapes special characters for XML security', () => {
      const unsafe = '<Fruits & Légumes "Bio" d\'Agadir>';
      const safe = escapeXml(unsafe);
      expect(safe).toBe('&lt;Fruits &amp; Légumes &quot;Bio&quot; d&apos;Agadir&gt;');
    });

    it('handles null, undefined, and numbers safely in escapeXml', () => {
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
      expect(escapeXml(24500)).toBe('24500');
    });

    it('validates 15-digit Moroccan ICE correctly', () => {
      expect(validateMoroccanIce('001928374650001')).toEqual({
        isValid: true,
        cleanedIce: '001928374650001',
      });

      // Strips non-digits
      expect(validateMoroccanIce('001-928-374-650001')).toEqual({
        isValid: true,
        cleanedIce: '001928374650001',
      });

      // Invalid lengths
      expect(validateMoroccanIce('12345')).toEqual({
        isValid: false,
        cleanedIce: '12345',
      });
      expect(validateMoroccanIce('')).toEqual({
        isValid: false,
        cleanedIce: '',
      });
      expect(validateMoroccanIce(undefined)).toEqual({
        isValid: false,
        cleanedIce: '',
      });
    });
  });

  describe('5.2 PortNet XML Payload Generation', () => {
    const validPortNetData: PortNetPayloadData = {
      declarationType: 'PRE_GATE_PASS',
      version: '2.0',
      referenceNumber: 'PN-2026-0042',
      timestamp: '2026-10-15T08:00:00Z',
      booking: {
        localizador: 'LOC-BAL-8899',
        shippingLine: 'Balearia',
        portOfLoading: 'MA-TNG (Tanger Med)',
        portOfDischarge: 'ES-ALG (Algeciras)',
      },
      transport: {
        carrierName: 'TRANS BODANON & CIE',
        carrierTirHolder: 'MA/042/2026',
        carrierIce: '001928374650001',
        truckPlate: '10101-A-40',
        trailerPlate: 'REM-1001-MA',
        driverName: 'Abdelkarim El Khamlichi',
        driverPassport: 'PA901245',
        driverCin: 'K123456',
        driverPhone: '+212661000000',
      },
      consignment: {
        cmrNumber: 'CMR-MA-2026-0042',
        mrnNumber: '26MA00310012345678',
        grossWeightKg: 22500,
        sealNumber: 'SEAL-MA-000042',
        goodsDescription: 'Tomates & Primeurs Frigo',
        clientIce: '003194827000091',
        shipperName: 'Frigo Souss Export',
        consigneeName: 'Mercamadrid Imports SL',
        consigneeAddress: 'Mercamadrid Nave 14, Madrid',
        consigneeVat: 'ESB99887766',
      },
    };

    it('generates fully compliant PortNet XML with escaped fields and GrossWeight unit', () => {
      const xml = buildPortNetXML(validPortNetData);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<PortNetDeclaration version="2.0" type="PRE_GATE_PASS">');
      expect(xml).toContain('<ReferenceNumber>PN-2026-0042</ReferenceNumber>');
      expect(xml).toContain('<Corridor>TangerMed-Algeciras</Corridor>');
      expect(xml).toContain('<Localizador>LOC-BAL-8899</Localizador>');
      expect(xml).toContain('<CarrierName>TRANS BODANON &amp; CIE</CarrierName>');
      expect(xml).toContain('<CarrierICE>001928374650001</CarrierICE>');
      expect(xml).toContain('<GrossWeight unit="KG">22500</GrossWeight>');
      expect(xml).toContain('<GoodsDescription>Tomates &amp; Primeurs Frigo</GoodsDescription>');
      expect(xml).toContain('<ICE>003194827000091</ICE>');
      expect(xml).toContain('<VatNumber>ESB99887766</VatNumber>');
    });
  });

  describe('5.3 IRU TIR-EPD XML Payload Generation', () => {
    const validTirEpdData: TirEpdPayloadData = {
      carnetTirNumber: 'XF-2026-778899',
      voucherNumber: 'VC-42-01',
      tirHolderCode: 'MA/042/2026',
      operationType: 'EXIT',
      departureOffice: STANDARD_CUSTOMS_OFFICES.tanger_med,
      destinationOffice: STANDARD_CUSTOMS_OFFICES.algeciras,
      carrier: {
        name: 'TRANS BODANON SARL',
        ice: '001928374650001',
        address: 'Zone Franche Tanger Med, Maroc',
      },
      transportMeans: {
        truckPlate: '10101-A-40',
        truckNationality: 'MA',
        trailerPlate: 'REM-1001-MA',
        trailerNationality: 'MA',
        driverName: 'Abdelkarim El Khamlichi',
        driverPassport: 'PA901245',
        driverNationality: 'MA',
      },
      cargo: {
        description: 'Poissons Frais & Congelés',
        grossWeightKg: 24000,
        sealNumber: 'SEAL-MA-000042',
        packagesCount: 1100,
        hsCode: '030310',
        containerNumber: 'REM-1001-MA',
      },
      metadata: {
        tripId: 42,
        referenceNumber: 'TIR-EPD-42-998877',
        createdAt: '2026-10-15T08:30:00Z',
      },
    };

    it('generates standard IRU TIR-EPD XML with official border offices', () => {
      const xml = buildTirEpdXML(validTirEpdData);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<TirEpdDeclaration xmlns="http://www.iru.org/tirepd/v4" version="4.1">');
      expect(xml).toContain('<MessageReference>TIR-EPD-42-998877</MessageReference>');
      expect(xml).toContain('<CarrierHolderCode>MA/042/2026</CarrierHolderCode>');
      expect(xml).toContain('<CustomsOfficeDeparture code="MA003100">Tanger Med Port</CustomsOfficeDeparture>');
      expect(xml).toContain('<CustomsOfficeDestination code="ES001100">Algeciras Puerto</CustomsOfficeDestination>');
      expect(xml).toContain('<HsCommodityCode>030310</HsCommodityCode>');
      expect(xml).toContain('<GrossMassKg>24000</GrossMassKg>');
      expect(xml).toContain('<SealNumber>SEAL-MA-000042</SealNumber>');
    });
  });

  describe('5.4 Trip Order Assembly & Corridor-Aware Customs Routing', () => {
    it('correctly maps European corridor to Tanger Med -> Algeciras', () => {
      const tripEuropean = {
        id: 101,
        corridor_type: 'european_maritime',
        truck: { plate_number: '12345-A-1' },
        trailer: { plate_number: 'REM-9988' },
        driver: { name: 'Omar Bennani', passport_number: 'PB112233' },
        weight_export: 21500,
      };

      const result = buildTirEpdPayloadFromTripOrder(tripEuropean);
      expect(result.isValid).toBe(true);
      expect(result.payload.departureOffice.code).toBe('MA003100'); // Tanger Med
      expect(result.payload.destinationOffice.code).toBe('ES001100'); // Algeciras
      expect(result.payload.cargo.grossWeightKg).toBe(21500);
    });

    it('correctly maps African corridor to Guerguerat -> Dakar', () => {
      const tripAfrican = {
        id: 102,
        corridor_type: 'african_overland',
        truck: { plate_number: '20202-B-40' },
        trailer: { plate_number: 'REM-3344' },
        driver: { name: 'Driss Tazi', passport_number: 'PC445566' },
        weight_export: 23800,
      };

      const result = buildTirEpdPayloadFromTripOrder(tripAfrican);
      expect(result.isValid).toBe(true);
      expect(result.payload.departureOffice.code).toBe('MA004900'); // Guerguerat
      expect(result.payload.destinationOffice.code).toBe('SN001000'); // Dakar
      expect(result.payload.cargo.grossWeightKg).toBe(23800);
    });

    it('flags missing equipment or driver documents as invalid with descriptive errors', () => {
      const incompleteTrip = {
        id: 103,
        truck: null, // Missing truck plate
        trailer: { plate_number: 'REM-1122' },
        driver: { name: 'Ahmed', passport_number: '' }, // Missing passport
        ferry_localizador: '', // Missing ferry booking
        weight_export: 0,
      };

      const portNetCheck = buildPortNetPayloadFromTripOrder(incompleteTrip);
      expect(portNetCheck.isValid).toBe(false);
      expect(portNetCheck.missingFields).toContain('رقم لوحة الشاحنة (Tracteur)');
      expect(portNetCheck.missingFields).toContain('جواز سفر / بطاقة تعريف السائق');
      expect(portNetCheck.missingFields).toContain('رقم حجز العبّارة (Booking Localizador)');
      expect(portNetCheck.missingFields).toContain('الوزن الإجمالي للبضاعة');

      const tirCheck = buildTirEpdPayloadFromTripOrder(incompleteTrip);
      expect(tirCheck.isValid).toBe(false);
      expect(tirCheck.missingFields).toContain('رقم لوحة رأس الشاحنة');
      expect(tirCheck.missingFields).toContain('رقم جواز السفر الدولي للسائق');
      expect(tirCheck.missingFields).toContain('الوزن الإجمالي للبضاعة');
    });

    it('verifies customs readiness via verifyCustomsReadiness', () => {
      const validTrip = {
        id: 104,
        ferry_localizador: 'LOC-BAL-100',
        truck: { plate_number: '10101-A-40' },
        trailer: { plate_number: 'REM-1001-MA' },
        driver: { name: 'Khamlichi', passport_number: 'PA901245' },
        client: { ice: '001928374650001' },
        weight_export: 22000,
      };

      const readyPortNet = verifyCustomsReadiness(validTrip, 'portnet');
      expect(readyPortNet.isReady).toBe(true);
      expect(readyPortNet.missingFields).toHaveLength(0);

      const readyTir = verifyCustomsReadiness(validTrip, 'tir_epd');
      expect(readyTir.isReady).toBe(true);
      expect(readyTir.missingFields).toHaveLength(0);
    });
  });

  describe('5.5 Deterministic Idempotency Key Engine', () => {
    it('generates consistent, deterministic idempotency keys for the same day and trip', () => {
      const key1 = generateCustomsIdempotencyKey(42, 'portnet', '2026-10-15');
      const key2 = generateCustomsIdempotencyKey(42, 'portnet', '2026-10-15');
      expect(key1).toBe('customs_42_portnet_2026-10-15');
      expect(key1).toBe(key2);
    });

    it('generates distinct keys for different gateways or different trips', () => {
      const keyPortNet = generateCustomsIdempotencyKey(42, 'portnet', '2026-10-15');
      const keyTir = generateCustomsIdempotencyKey(42, 'tir_epd', '2026-10-15');
      const keyOtherTrip = generateCustomsIdempotencyKey(99, 'portnet', '2026-10-15');

      expect(keyPortNet).not.toBe(keyTir);
      expect(keyPortNet).not.toBe(keyOtherTrip);
    });
  });

  describe('5.6 Idempotent Customs Submission Workflow', () => {
    it('executes successful sandbox submission for PortNet and returns MRN and barcode', async () => {
      const result = await submitCustomsDeclaration(42, 'portnet', { mode: 'sandbox' });

      expect(result.success).toBe(true);
      expect(result.gateway).toBe('portnet');
      expect(result.mode).toBe('sandbox');
      expect(result.status).toBe('accepted');
      expect(result.mrnNumber).toMatch(/^26MA/);
      expect(result.barcodeUrl).toContain('portnet.ma/barcode');
      expect(result.idempotencyKey).toBeDefined();
      expect(result.idempotentReplay).toBe(false);
      expect(result.xmlPayload).toContain('PortNetDeclaration');
    });

    it('executes successful sandbox submission for TIR-EPD and returns international EPD ID', async () => {
      const result = await submitCustomsDeclaration(42, 'tir_epd', { mode: 'sandbox' });

      expect(result.success).toBe(true);
      expect(result.gateway).toBe('tir_epd');
      expect(result.mode).toBe('sandbox');
      expect(result.status).toBe('accepted');
      expect(result.mrnNumber).toContain('EPD-MA-2026-');
      expect(result.barcodeUrl).toContain('tirepd.iru.org/qr');
      expect(result.xmlPayload).toContain('TirEpdDeclaration');
    });

    it('replays previously accepted declaration when submitted with same idempotency key (Protection d’idempotence)', async () => {
      // First submission
      const first = await submitCustomsDeclaration(55, 'portnet', { mode: 'sandbox' });
      expect(first.success).toBe(true);
      expect(first.idempotentReplay).toBe(false);

      // Re-submit same trip and gateway without force
      const replay = await submitCustomsDeclaration(55, 'portnet', { mode: 'sandbox' });
      expect(replay.success).toBe(true);
      expect(replay.idempotentReplay).toBe(true);
      expect(replay.mrnNumber).toBe(first.mrnNumber);
      expect(replay.messageAr).toContain('حماية منع التكرار');
    });

    it('returns structured rejection when required equipment data is missing', async () => {
      const invalidTrip = {
        id: 77,
        truck: null,
        trailer: null,
        driver: null,
      };

      const result = await submitCustomsDeclaration(77, 'portnet', {
        mode: 'sandbox',
        tripData: invalidTrip,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.error).toContain('Missing required fields');
      expect(result.messageAr).toContain('بيانات غير مكتملة');
    });
  });
});

