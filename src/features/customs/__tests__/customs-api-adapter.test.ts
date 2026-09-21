import { describe, it, expect } from 'vitest';
import {
  STANDARD_CUSTOMS_OFFICES,
  buildTirEpdPayloadFromTrip,
  submitToPortNetApi,
  submitToTirEpdApi,
} from '../services/customs-api-adapter.service';
import type { PortNetPayloadData } from '../services/portnet-xml';

describe('Customs API Adapter — PortNet & IRU TIR-EPD Integration', () => {
  const mockTripMaritime = {
    id: 42,
    corridor_type: 'european_maritime',
    cmr_number: 'CMR-BK-2026-0042',
    weight_export: 22500,
    goods_description_export: 'Tomates & Fruits Frais Frigo',
    truck: { plate_number: '10101-A-40' },
    trailer: { plate_number: 'REM-1001-MA' },
    driver: { name: 'Abdelkarim El Khamlichi', passport_number: 'PA901245' },
  };

  const mockTripAfrican = {
    id: 43,
    corridor_type: 'african_overland',
    cmr_number: 'CMR-BK-2026-0043',
    weight_export: 24000,
    goods_description_export: 'Poissons Congelés Frigo -19C',
    truck: { plate_number: '20202-B-40' },
    trailer: { plate_number: 'REM-2002-MA' },
    driver: { name: 'Hassan Amrani', passport_number: 'PB887711' },
  };

  describe('1. Customs Offices Registry', () => {
    it('contains valid official codes for Tanger Med, Guerguerat, and Algeciras', () => {
      expect(STANDARD_CUSTOMS_OFFICES.tanger_med.code).toBe('MA003100');
      expect(STANDARD_CUSTOMS_OFFICES.guerguerat.code).toBe('MA004900');
      expect(STANDARD_CUSTOMS_OFFICES.algeciras.code).toBe('ES001100');
      expect(STANDARD_CUSTOMS_OFFICES.rosso.code).toBe('MR002100');
    });
  });

  describe('2. TIR-EPD Payload Builder (buildTirEpdPayloadFromTrip)', () => {
    it('selects Tanger Med -> Algeciras for European Maritime corridor', () => {
      const payload = buildTirEpdPayloadFromTrip(mockTripMaritime);

      expect(payload.operationType).toBe('EXIT');
      expect(payload.departureOffice.code).toBe('MA003100'); // Tanger Med
      expect(payload.destinationOffice.code).toBe('ES001100'); // Algeciras
      expect(payload.cargo.grossWeightKg).toBe(22500);
      expect(payload.transportMeans.truckPlate).toBe('10101-A-40');
      expect(payload.transportMeans.driverPassport).toBe('PA901245');
      expect(payload.cargo.sealNumber).toContain('SEAL-MA-000042');
    });

    it('selects Guerguerat -> Dakar for African Overland corridor', () => {
      const payload = buildTirEpdPayloadFromTrip(mockTripAfrican);

      expect(payload.departureOffice.code).toBe('MA004900'); // Guerguerat
      expect(payload.destinationOffice.code).toBe('SN001000'); // Dakar
      expect(payload.cargo.grossWeightKg).toBe(24000);
      expect(payload.transportMeans.truckPlate).toBe('20202-B-40');
    });
  });

  describe('3. PortNet API Sandbox Submission (submitToPortNetApi)', () => {
    it('successfully processes pre-gate pass in sandbox mode and generates MRN & barcode', async () => {
      const portNetPayload: PortNetPayloadData = {
        declarationType: 'PRE_GATE_PASS',
        version: '2.0',
        referenceNumber: 'PN-DEC-42-998877',
        timestamp: new Date().toISOString(),
        booking: {
          localizador: 'LOC-42-TM',
          shippingLine: 'Balearia',
          portOfLoading: 'MA-TNG (Tanger Med)',
          portOfDischarge: 'ES-ALG (Algeciras)',
        },
        transport: {
          carrierName: 'TRANS BODANON SARL',
          carrierTirHolder: 'MA/042/2026',
          carrierIce: '001928374650001',
          truckPlate: '10101-A-40',
          trailerPlate: 'REM-1001-MA',
          driverName: 'Abdelkarim El Khamlichi',
          driverPassport: 'PA901245',
          driverCin: 'K123456',
        },
        consignment: {
          cmrNumber: 'CMR-BK-2026-0042',
          mrnNumber: 'MRN-MA-42-2026',
          grossWeightKg: 22500,
          sealNumber: 'SEAL-MA-000042',
          goodsDescription: 'Primeurs Frigo',
          clientIce: '003194827000091',
          shipperName: 'FRIGO ATLANTIC AGADIR',
          consigneeName: 'IBERIA LOGISTICA',
        },
      };

      const response = await submitToPortNetApi(portNetPayload, { mode: 'sandbox' });

      expect(response.success).toBe(true);
      expect(response.status).toBe('accepted');
      expect(response.gateway).toBe('portnet');
      expect(response.mode).toBe('sandbox');
      expect(response.customsRegistrationNumber).toMatch(/^26MA/);
      expect(response.barcode).toContain('portnet.ma/barcode');
      expect(response.messageAr).toContain('تم قبول الإشعار المسبق بنجاح');
    });
  });

  describe('4. IRU TIR-EPD Sandbox Submission (submitToTirEpdApi)', () => {
    it('successfully processes electronic pre-declaration in sandbox mode and returns international EPD ID', async () => {
      const tirPayload = buildTirEpdPayloadFromTrip(mockTripMaritime);
      const response = await submitToTirEpdApi(tirPayload, { mode: 'sandbox' });

      expect(response.success).toBe(true);
      expect(response.status).toBe('accepted');
      expect(response.gateway).toBe('tir_epd');
      expect(response.mode).toBe('sandbox');
      expect(response.customsRegistrationNumber).toContain('EPD-MA-2026-000042');
      expect(response.barcode).toContain('tirepd.iru.org/qr');
      expect(response.messageAr).toContain('تم إرسال التصريح الإلكتروني المسبق بنجاح');
    });
  });

  describe('5. Error Handling in Production Mode without Credentials', () => {
    it('returns structured rejection when production endpoint is unreachable', async () => {
      const tirPayload = buildTirEpdPayloadFromTrip(mockTripMaritime);
      const response = await submitToTirEpdApi(tirPayload, {
        mode: 'production',
        apiUrl: 'https://invalid-non-existent-customs-endpoint.test/api',
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe('rejected');
      expect(response.error).toBeDefined();
    });
  });
});
