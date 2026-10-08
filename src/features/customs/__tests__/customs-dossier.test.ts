import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  reconcileDossierWeights,
  verifyThermalRegimeCompliance,
  validatePhytosanitaryCertificate,
  calculateCustomsSanitaryFees,
  MAX_WEIGHT_VARIANCE_PERCENTAGE,
  BASE_SANITARY_INSPECTION_MAD,
  SANITARY_RATE_PER_TON_MAD,
  PHYTO_STAMP_FIXED_MAD,
} from '../services/phytosanitary-validator.service';
import {
  buildConsolidatedCustomsDossier,
  resolveInspectionChannel,
  generateCustomsQrVerificationHash,
} from '../services/customs-dossier-builder.service';
import type { PhytosanitaryCertificate } from '../types/customs-dossier.types';

describe('Smart Transit Customs & Phytosanitary Dossier Engine', () => {
  const mockPhytoValid: PhytosanitaryCertificate = {
    certificateNumber: 'ONSSA-PHYTO-2026-MA-88412',
    issueDate: '2026-10-01T08:00:00Z',
    expiryDate: '2026-11-01T23:59:59Z',
    issuingAuthority: 'ONSSA',
    productCategory: 'fresh_produce',
    botanicalName: 'Solanum lycopersicum',
    originCountry: 'MA',
    destinationCountry: 'ES',
    inspectedTrailerPlate: 'REM-1001-MA',
    leadSealNumber: 'SEAL-MA-99441',
    prescribedTempCelsius: { min: 4.0, max: 8.0, target: 6.0 },
    status: 'valid',
  };

  // 1. Weight Reconciliation with Decimal.js
  describe('1. Weight Reconciliation Engine', () => {
    it('approves weight matching when CMR and DUM gross variance is <= 3.0%', () => {
      // 22,000 kg vs 21,700 kg -> 300 kg diff -> (300 / 22000) * 100 = 1.36%
      const res = reconcileDossierWeights({
        cmrNetWeightKg: 20240,
        cmrGrossWeightKg: 22000,
        dumNetWeightKg: 19964,
        dumGrossWeightKg: 21700,
      });

      expect(res.varianceGrossKg).toBe(300);
      expect(res.variancePercentage).toBeCloseTo(1.36, 2);
      expect(res.isWeightCompliant).toBe(true);
    });

    it('rejects weight matching when variance exceeds 3.0% threshold', () => {
      // 22,000 kg vs 20,500 kg -> 1500 kg diff -> (1500 / 22000) * 100 = 6.82%
      const res = reconcileDossierWeights({
        cmrNetWeightKg: 20240,
        cmrGrossWeightKg: 22000,
        dumNetWeightKg: 18860,
        dumGrossWeightKg: 20500,
      });

      expect(res.varianceGrossKg).toBe(1500);
      expect(res.variancePercentage).toBeCloseTo(6.82, 2);
      expect(res.isWeightCompliant).toBe(false);
    });

    it('handles zero weight edge case safely without division by zero', () => {
      const res = reconcileDossierWeights({
        cmrNetWeightKg: 0,
        cmrGrossWeightKg: 0,
        dumNetWeightKg: 0,
        dumGrossWeightKg: 0,
      });

      expect(res.variancePercentage).toBe(0);
      expect(res.isWeightCompliant).toBe(true);
    });
  });

  // 2. Frigo Thermal Regime Verification
  describe('2. Frigo Thermal Regime Compliance', () => {
    it('marks thermal compliance as true when sensor is within [min, max] range', () => {
      const res = verifyThermalRegimeCompliance({
        sensorTemp: 6.2,
        prescribedMin: 4.0,
        prescribedMax: 8.0,
      });

      expect(res.isCompliant).toBe(true);
      expect(res.deviationCelsius).toBe(0);
      expect(res.prescribedRange).toBe('4.0°C ➔ 8.0°C');
    });

    it('detects negative cold chain excursion below prescribed minimum', () => {
      const res = verifyThermalRegimeCompliance({
        sensorTemp: 2.1,
        prescribedMin: 4.0,
        prescribedMax: 8.0,
      });

      expect(res.isCompliant).toBe(false);
      expect(res.deviationCelsius).toBe(1.9); // 4.0 - 2.1 = 1.9
    });

    it('detects overheating excursion above prescribed maximum', () => {
      const res = verifyThermalRegimeCompliance({
        sensorTemp: 11.4,
        prescribedMin: 4.0,
        prescribedMax: 8.0,
      });

      expect(res.isCompliant).toBe(false);
      expect(res.deviationCelsius).toBe(3.4); // 11.4 - 8.0 = 3.4
    });
  });

  // 3. Phytosanitary Certificate Validation
  describe('3. Phytosanitary Certificate Validator', () => {
    it('validates a matching and active ONSSA certificate', () => {
      const res = validatePhytosanitaryCertificate(mockPhytoValid, {
        currentDate: '2026-10-15T10:00:00Z',
        currentTrailer: 'REM-1001-MA',
        currentSeal: 'SEAL-MA-99441',
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('flags expired ONSSA certificate', () => {
      const res = validatePhytosanitaryCertificate(mockPhytoValid, {
        currentDate: '2026-11-20T10:00:00Z', // After Nov 1 expiry
        currentTrailer: 'REM-1001-MA',
        currentSeal: 'SEAL-MA-99441',
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('منتهية الصلاحية'))).toBe(true);
    });

    it('detects trailer plate mismatch', () => {
      const res = validatePhytosanitaryCertificate(mockPhytoValid, {
        currentDate: '2026-10-15T10:00:00Z',
        currentTrailer: 'REM-9999-XYZ', // Different trailer
        currentSeal: 'SEAL-MA-99441',
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('عدم تطابق مقطورة الشحن'))).toBe(true);
    });

    it('detects lead seal number discrepancy', () => {
      const res = validatePhytosanitaryCertificate(mockPhytoValid, {
        currentDate: '2026-10-15T10:00:00Z',
        currentTrailer: 'REM-1001-MA',
        currentSeal: 'BROKEN-SEAL-000',
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('عدم تطابق شمع الرصاص'))).toBe(true);
    });
  });

  // 4. Customs Duties & Sanitary Inspection Fees (Decimal.js)
  describe('4. Customs Duties & Sanitary Fees (Decimal.js)', () => {
    it('calculates sanitary fees and statistical taxes with 100% precision without float errors', () => {
      // 24,000 kg gross (24 tons), goods value 120,000 MAD
      // Inspection: 350.00 + (24 * 15.00 = 360.00) = 710.00 MAD
      // Phyto Stamp: 100.00 MAD
      // Port Sanitary Tax: max(150, 120,000 * 0.0025 = 300) = 300.00 MAD
      // Customs Statistical Tax: 120,000 * 0.0025 = 300.00 MAD
      // Total: 710 + 100 + 300 + 300 = 1410.00 MAD
      const fees = calculateCustomsSanitaryFees({
        grossWeightKg: 24000,
        goodsValueMad: 120000,
      });

      expect(fees.sanitaryInspectionFeeMad).toBe('710.00');
      expect(fees.phytosanitaryStampMad).toBe('100.00');
      expect(fees.portSanitaryTaxMad).toBe('300.00');
      expect(fees.customsStatisticalTaxMad).toBe('300.00');
      expect(fees.totalDutiesAndFeesMad).toBe('1410.00');
    });

    it('enforces minimum port sanitary tax of 150.00 MAD for lower value goods', () => {
      // 10,000 kg gross, value 20,000 MAD -> 20,000 * 0.0025 = 50 MAD (< 150 min)
      const fees = calculateCustomsSanitaryFees({
        grossWeightKg: 10000,
        goodsValueMad: 20000,
      });

      expect(fees.portSanitaryTaxMad).toBe('150.00');
    });
  });

  // 5. Inspection Channel Routing & QR Hash
  describe('5. Inspection Channel Routing & Cryptographic Verification', () => {
    it('routes compliant dossiers to GREEN channel (Circuit Vert) with cleared BAE', () => {
      const channelRes = resolveInspectionChannel({
        isWeightCompliant: true,
        isPhytoValid: true,
        isThermalCompliant: true,
        allDocsVerified: true,
      });

      expect(channelRes.channel).toBe('GREEN');
      expect(channelRes.status).toBe('cleared_bae');
    });

    it('routes dossiers with thermal excursions or pending docs to ORANGE channel', () => {
      const channelRes = resolveInspectionChannel({
        isWeightCompliant: true,
        isPhytoValid: true,
        isThermalCompliant: false, // Drift
        allDocsVerified: true,
      });

      expect(channelRes.channel).toBe('ORANGE');
      expect(channelRes.status).toBe('inspection_pending');
    });

    it('routes dossiers with weight discrepancies or invalid certificates to RED channel (Scanner)', () => {
      const channelRes = resolveInspectionChannel({
        isWeightCompliant: false, // Weight mismatch > 3%
        isPhytoValid: true,
        isThermalCompliant: true,
        allDocsVerified: true,
      });

      expect(channelRes.channel).toBe('RED');
      expect(channelRes.status).toBe('inspection_pending');
    });

    it('generates deterministic SHA-256 QR verification hash', () => {
      const hash1 = generateCustomsQrVerificationHash({
        dossierReference: 'DOS-2026-TNG-00901',
        tripId: 901,
        trailerPlate: 'REM-1001-MA',
        sealNumber: 'SEAL-MA-99441',
        phytoCertNumber: 'ONSSA-PHYTO-2026-MA-88412',
        grossWeightKg: 22000,
        timestamp: '2026-10-08T12:00:00Z',
      });

      const hash2 = generateCustomsQrVerificationHash({
        dossierReference: 'DOS-2026-TNG-00901',
        tripId: 901,
        trailerPlate: 'REM-1001-MA',
        sealNumber: 'SEAL-MA-99441',
        phytoCertNumber: 'ONSSA-PHYTO-2026-MA-88412',
        grossWeightKg: 22000,
        timestamp: '2026-10-08T12:00:00Z',
      });

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);

      // Tampering seal number produces completely different hash
      const tamperedHash = generateCustomsQrVerificationHash({
        dossierReference: 'DOS-2026-TNG-00901',
        tripId: 901,
        trailerPlate: 'REM-1001-MA',
        sealNumber: 'TAMPERED-SEAL',
        phytoCertNumber: 'ONSSA-PHYTO-2026-MA-88412',
        grossWeightKg: 22000,
        timestamp: '2026-10-08T12:00:00Z',
      });

      expect(hash1).not.toBe(tamperedHash);
    });
  });

  // 6. Consolidated Dossier Builder Full Pipeline
  describe('6. Consolidated Dossier Assembly', () => {
    it('assembles a full consolidated clearance dossier with all modules integrated', () => {
      const dossier = buildConsolidatedCustomsDossier({
        tripId: 905,
        corridorType: 'european_maritime',
        truckPlate: '12345-A-26',
        trailerPlate: 'REM-1001-MA',
        sealNumber: 'SEAL-MA-99441',
        goodsValueMad: 110000,
        cmrNetWeightKg: 20240,
        cmrGrossWeightKg: 22000,
        dumNetWeightKg: 20100,
        dumGrossWeightKg: 21850,
        currentSensorTemp: 6.5,
        phytosanitary: mockPhytoValid,
      });

      expect(dossier.dossierReference).toBe('DOS-2026-TNG-00905');
      expect(dossier.channel).toBe('GREEN');
      expect(dossier.status).toBe('cleared_bae');
      expect(dossier.weightReconciliation.isWeightCompliant).toBe(true);
      expect(dossier.thermalCompliance.isCompliant).toBe(true);
      expect(dossier.qrVerificationHash).toHaveLength(64);
      expect(dossier.documents.length).toBeGreaterThanOrEqual(4);
      expect(dossier.fees.totalDutiesAndFeesMad).toBeDefined();
    });
  });
});

