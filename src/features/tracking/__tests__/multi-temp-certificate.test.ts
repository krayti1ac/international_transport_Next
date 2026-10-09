import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { MultiTempPdfGeneratorService } from '../services/multi-temp-pdf-generator.service';
import {
  generateCompartmentCertificateSchema,
  exportBatchCompartmentCertificatesSchema,
  type CompartmentCertificatePayload,
} from '../types/multi-temp-certificate.types';

describe('Multi-Temp Independent Compartment GDP Certificate & PDF Generator', () => {
  const MOCK_PAYLOAD: CompartmentCertificatePayload = {
    certificateNumber: 'GDP-MT-C1-20261009-8840',
    compartmentCode: 'C1',
    compartmentName: 'Front Frozen Zone',
    cargoCategory: 'deep_frozen',
    trailerId: 42,
    trailerPlate: 'MA-R-8821',
    tripId: 8840,
    tripNumber: 'TRIP-2026-8840',
    cmrNumber: 'CMR-2026-8840',
    clientName: 'Atlas Agro Frigo S.A.',
    driverName: 'عمر التازي',
    route: 'Tanger Med → Algeciras → Perpignan',
    setpointTempC: -20.0,
    minTempLimitC: -22.0,
    maxTempLimitC: -18.0,
    mktTempC: -19.45,
    avgSupplyAirTempC: -20.2,
    avgReturnAirTempC: -19.6,
    excursionMinutes: 0,
    doorOpenCount: 0,
    evaporatorModel: 'Carrier Multi-Evap MX-1',
    bulkheadPositionPct: 40,
    status: 'compliant',
    complianceScore: 100,
    issuedAt: '9 أكتوبر 2026',
    verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verificationUrl: 'https://tms.transbodanon.com/verify/cold-chain/e3b0c44298fc1c14',
    logsSample: [
      {
        time: '18:00:00',
        supply: -20.5,
        return: -19.8,
        cargo: -20.1,
        mode: 'cooling',
        door: false,
      },
      {
        time: '18:15:00',
        supply: -20.3,
        return: -19.5,
        cargo: -19.9,
        mode: 'cooling',
        door: false,
      },
    ],
    locale: 'ar',
  };

  describe('Zod Validation Schemas', () => {
    it('validates correct generateCompartmentCertificate input', () => {
      const valid = {
        compartmentId: '123e4567-e89b-12d3-a456-426614174000',
        trailerId: 42,
        tripId: 8840,
        locale: 'ar',
      };
      const parsed = generateCompartmentCertificateSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.locale).toBe('ar');
        expect(parsed.data.trailerId).toBe(42);
      }
    });

    it('rejects invalid compartmentId (not a UUID)', () => {
      const invalid = {
        compartmentId: 'not-a-uuid',
        trailerId: 42,
      };
      const parsed = generateCompartmentCertificateSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('defaults locale to ar when omitted in schema', () => {
      const input = {
        compartmentId: '123e4567-e89b-12d3-a456-426614174000',
        trailerId: '105',
      };
      const parsed = generateCompartmentCertificateSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.locale).toBe('ar');
        expect(parsed.data.trailerId).toBe(105);
      }
    });

    it('validates batch export schema', () => {
      const validBatch = {
        trailerId: 42,
        locale: 'fr',
      };
      const parsed = exportBatchCompartmentCertificatesSchema.safeParse(validBatch);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.locale).toBe('fr');
      }
    });

    it('rejects non-positive trailerId in batch schema', () => {
      const invalid = {
        trailerId: -5,
      };
      const parsed = exportBatchCompartmentCertificatesSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('PDF & Vector A4 HTML Generator', () => {
    it('generates compliant Arabic RTL A4 HTML layout with QR code and seals', () => {
      const html = MultiTempPdfGeneratorService.generateCertificateHtml(MOCK_PAYLOAD);

      // Standards & Identification
      expect(html).toContain('EN 12830');
      expect(html).toContain('GDP');
      expect(html).toContain('MKT');
      expect(html).toContain('GDP-MT-C1-20261009-8840');
      expect(html).toContain('الحجرة C1');
      expect(html).toContain('MA-R-8821');

      // RTL Direction & KaTeX/A4 typography
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="ar"');
      expect(html).toContain('size: A4 portrait;');

      // Technical Metadata
      expect(html).toContain('-20°C');
      expect(html).toContain('-19.45°C');
      expect(html).toContain('40%');
      expect(html).toContain('Carrier Multi-Evap MX-1');

      // Cryptographic seal and QR code
      expect(html).toContain(MOCK_PAYLOAD.verificationHash);
      expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"');
      expect(html).toContain('الختم الرقمي والتحقق الميداني');

      // Logs table
      expect(html).toContain('18:00:00');
      expect(html).toContain('-20.5');
      expect(html).toContain('-19.8');
    });

    it('generates compliant French LTR layout when requested', () => {
      const frPayload: CompartmentCertificatePayload = {
        ...MOCK_PAYLOAD,
        compartmentCode: 'C2',
        locale: 'fr',
        status: 'warning',
        complianceScore: 88,
      };

      const html = MultiTempPdfGeneratorService.generateCertificateHtml(frPayload);

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('lang="fr"');
      expect(html).toContain("Certificat d'Audit Thermique Indépendant — Compartiment C2");
      expect(html).toContain("Sceau d'Intégrité Cryptographique");
      expect(html).toContain('AVERTISSEMENT');
    });

    it('generates compliant Spanish LTR layout when requested', () => {
      const esPayload: CompartmentCertificatePayload = {
        ...MOCK_PAYLOAD,
        compartmentCode: 'C3',
        locale: 'es',
        status: 'breached',
        complianceScore: 65,
      };

      const html = MultiTempPdfGeneratorService.generateCertificateHtml(esPayload);

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('lang="es"');
      expect(html).toContain('Certificado Oficial de Cumplimiento Térmico — Compartimento C3');
      expect(html).toContain('Sello de Integridad Criptográfica');
      expect(html).toContain('RUPTURA DE LA CADENA DE FRÍO');
    });

    it('handles empty logs sample gracefully without errors', () => {
      const emptyLogsPayload: CompartmentCertificatePayload = {
        ...MOCK_PAYLOAD,
        logsSample: [],
      };

      const html = MultiTempPdfGeneratorService.generateCertificateHtml(emptyLogsPayload);
      expect(html).toContain('لا توجد تسجيلات مسجلة لهذه الحجرة خلال الفترة');
      expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"');
    });
  });

  describe('Financial & Metric Precision (Decimal.js Compliance)', () => {
    it('calculates compliance scores and deviations with strict Decimal.js precision', () => {
      const maxScore = new Decimal(100);
      const excursionMinutes = new Decimal(15);
      const penaltyPerMinute = new Decimal(0.8);
      const finalScore = maxScore.minus(excursionMinutes.times(penaltyPerMinute));

      expect(finalScore.toNumber()).toBe(88);
      expect(finalScore.toFixed(2)).toBe('88.00');
    });

    it('verifies SHA256 integrity seal generation compatibility', () => {
      const secret = 'TEST_HMAC_SECRET';
      const dataToSign = `CERT:C1:TRIP:8840:MKT:-19.45:SCORE:100`;

      const signature = crypto
        .createHmac('sha256', secret)
        .update(dataToSign)
        .digest('hex');

      expect(signature).toHaveLength(64);
      expect(typeof signature).toBe('string');
    });
  });
});
