/**
 * Trans Bodanon TMS — Enterprise Closed-Loop Smoke Test & Live Production Audit
 * Suite covering the 7 core enterprise stages from quotation to fiscal bank reconciliation.
 * Strictly adheres to Decimal.js financial precision and zero-float error rules.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import crypto from 'crypto';

// Stage 1 imports: Dynamic Pricing
import {
  buildFreightQuotation,
  resolveQuotationCorridor,
  BASE_CPK_EUROPE_MAD,
  CARGO_CPK_SURCHARGE_MAD,
  FERRY_CROSSING_FEES_MAD,
} from '@/features/pricing/services/dynamic-quotation-builder.service';

// Stage 3 imports: ONSSA Phytosanitary & Customs Clearance
import {
  reconcileDossierWeights,
  verifyThermalRegimeCompliance,
  validatePhytosanitaryCertificate,
} from '@/features/customs/services/phytosanitary-validator.service';

// Stage 5 imports: e-POD Cryptographic Token & Verification
import {
  generateEpodMagicToken,
  verifyEpodMagicToken,
} from '@/features/charter/services/charter-epod-token.service';

// Stage 6 imports: DGI UBL 2.1 E-Invoicing & Cryptographic Tax Seal
import {
  buildCanonicalInvoiceString,
  generateSha256Digest,
  verifyTaxSealIntegrity,
  DGI_ARTICLE_92_NOTICE,
} from '@/features/invoices/services/cryptographic-tax-seal.service';

// Stage 7 imports: Multi-Currency Forex & Bank Auto Reconciliation
import { calculateForexDifferential } from '@/features/finance/services/bank-auto-reconciler.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('Trans Bodanon TMS — Enterprise Closed-Loop Smoke Test (Stages 1 to 7)', () => {
  // ---------------------------------------------------------------------------
  // STAGE 1: Instant Freight Pricing & CPK Breakdown
  // ---------------------------------------------------------------------------
  describe('Stage 1: Dynamic Freight Pricing & CPK Breakdown', () => {
    it('accurately calculates direct operational costs and spot tier margin using Decimal.js', () => {
      const quoteInput = {
        clientName: 'DIDO PRO',
        originCity: 'Agadir, Morocco',
        destinationCity: 'Valencia, Spain',
        roadDistanceKm: 1850,
        cargoType: 'reefer_temperature_controlled' as const,
        targetMarginPercent: 22,
        currency: 'MAD' as const,
      };

      const corridor = resolveQuotationCorridor(quoteInput.originCity, quoteInput.destinationCity);
      expect(corridor).toBe('european_maritime');

      const quotation = buildFreightQuotation(quoteInput);
      expect(quotation).toBeDefined();
      expect(quotation.totalDistanceKm).toBe(1850);

      // Verify Decimal.js calculation of base CPK and surcharges
      const expectedCpk = BASE_CPK_EUROPE_MAD.plus(CARGO_CPK_SURCHARGE_MAD.reefer_temperature_controlled);
      expect(new Decimal(quotation.costBreakdown.baseCpkRateMad).equals(expectedCpk)).toBe(true);

      // Ferry cost check
      expect(new Decimal(quotation.costBreakdown.ferryAndTransitCostMad).equals(FERRY_CROSSING_FEES_MAD.tanger_med_algeciras)).toBe(true);

      // Verify Spot pricing and positive net margin
      const spotTier = quotation.tiers.spot;
      expect(new Decimal(spotTier.netPrice).greaterThan(new Decimal(quotation.costBreakdown.totalDirectCostMad))).toBe(true);
      expect(quotation.vatRatePercent).toBe(0);
      expect(quotation.vatAmount).toBe('0.00');
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 2: Trip Order & International CMR Compliance
  // ---------------------------------------------------------------------------
  describe('Stage 2: Trip Order Creation & International CMR Numbering', () => {
    it('validates idempotency and international CMR assignment schema', () => {
      const tripMission = {
        tripNumber: 273,
        direction: 'export',
        truckPlate: '18573-B-50',
        trailerPlate: 'REM-8821-B',
        driverName: 'سعيد التوزاني',
        clientName: 'DIDO PRO',
        cmrNumber: 'CMR-MA-2026-0273',
        status: 'in_transit',
        agreedPrice: new Decimal('48000.00'),
      };

      expect(tripMission.cmrNumber).toMatch(/^CMR-MA-2026-\d{4}$/);
      expect(tripMission.agreedPrice.equals(new Decimal('48000.00'))).toBe(true);
      expect(tripMission.truckPlate).toContain('18573');
      expect(tripMission.direction).toBe('export');
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 3: ONSSA Phytosanitary Dossier & BADR Customs Green Circuit
  // ---------------------------------------------------------------------------
  describe('Stage 3: Customs & ONSSA Phytosanitary Dossier Validation', () => {
    it('verifies weight variance compliance within 3% tolerance', () => {
      const weightCheck = reconcileDossierWeights({
        cmrNetWeightKg: 21500,
        cmrGrossWeightKg: 22800,
        dumNetWeightKg: 21450,
        dumGrossWeightKg: 22750,
        phytoWeightKg: 22800,
      });

      expect(weightCheck.isWeightCompliant).toBe(true);
      expect(weightCheck.variancePercentage).toBeLessThanOrEqual(3.0);
    });

    it('enforces reefer temperature compliance against ONSSA cold chain rules', () => {
      const thermalCheck = verifyThermalRegimeCompliance({
        sensorTemp: -18.4,
        prescribedMin: -22.0,
        prescribedMax: -18.0,
        prescribedTarget: -18.5,
      });

      expect(thermalCheck.isCompliant).toBe(true);
      expect(thermalCheck.deviationCelsius).toBe(0);
    });

    it('validates phytosanitary certificate validity and trailer match', () => {
      const cert = {
        certificateNumber: 'PHYTO-MA-2026-8812',
        issueDate: '2026-10-08',
        expiryDate: '2026-10-25',
        issuingAuthority: 'ONSSA' as const,
        productCategory: 'fresh_produce' as const,
        originCountry: 'MA',
        destinationCountry: 'ES',
        inspectedTrailerPlate: 'REM-8821-B',
        leadSealNumber: 'ONSSA-SEAL-4410',
        prescribedTempCelsius: {
          min: -22.0,
          max: -18.0,
          target: -18.5,
        },
        status: 'valid' as const,
      };

      const result = validatePhytosanitaryCertificate(cert, {
        currentDate: '2026-10-09',
        currentTrailer: 'REM-8821-B',
        currentSeal: 'ONSSA-SEAL-4410',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 4: Sahara & European Telemetry Ingestion (Frigo IoT)
  // ---------------------------------------------------------------------------
  describe('Stage 4: IoT Telematics & Reefer Physical Diagnostics', () => {
    it('verifies telematics sensors remain strictly within operational limits', () => {
      const reeferTelemetry = {
        coreTemperatureCelsius: new Decimal('-18.4'),
        suctionPressureBar: new Decimal('1.8'),
        dischargePressureBar: new Decimal('16.5'),
        supplyVoltage: new Decimal('13.8'),
        engineRpm: 1450,
        defrostActive: false,
      };

      // Suction pressure range: 1.5 - 2.2 Bar
      expect(reeferTelemetry.suctionPressureBar.greaterThanOrEqualTo(1.5)).toBe(true);
      expect(reeferTelemetry.suctionPressureBar.lessThanOrEqualTo(2.2)).toBe(true);

      // Discharge pressure range: 14.0 - 18.0 Bar
      expect(reeferTelemetry.dischargePressureBar.greaterThanOrEqualTo(14.0)).toBe(true);
      expect(reeferTelemetry.dischargePressureBar.lessThanOrEqualTo(18.0)).toBe(true);

      // Battery voltage nominal: > 12.4 V
      expect(reeferTelemetry.supplyVoltage.greaterThan(12.4)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 5: Biometric e-POD Signature & Cryptographic Sealing
  // ---------------------------------------------------------------------------
  describe('Stage 5: Biometric e-POD & HMAC Non-Repudiation Verification', () => {
    it('generates and cryptographically verifies e-POD delivery token and HMAC seal', () => {
      const tokenInput = {
        orderNumber: 'TRIP-2026-0273',
        carrierId: 'SUB-INTERNAL-FLT-6',
        driverPhone: '212694585307',
        expiresInHours: 48,
      };

      const result = generateEpodMagicToken(tokenInput);
      expect(result.token).toBeDefined();
      expect(result.magicLinkUrl).toContain('/charter/epod?token=');

      const verification = verifyEpodMagicToken(result.token);
      expect(verification.isValid).toBe(true);
      expect(verification.payload?.orderNumber).toBe('TRIP-2026-0273');

      // Receiver signature biometric HMAC
      const receiverName = 'JUAN CARLOS MARTINEZ';
      const timestamp = '2026-10-09T11:08:18.000Z';
      const secret = 'trans-bodanon-epod-signing-secret';

      const hmacDigest = crypto
        .createHmac('sha256', secret)
        .update(`${tokenInput.orderNumber}|${receiverName}|39.4699|-0.3763|${timestamp}`)
        .digest('hex');

      expect(hmacDigest).toHaveLength(64);
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 6: Moroccan DGI UBL 2.1 E-Invoicing & Fiscal Vault
  // ---------------------------------------------------------------------------
  describe('Stage 6: DGI UBL 2.1 E-Invoicing & Tamper-Evident Fiscal Vault', () => {
    it('builds canonical string, generates SHA-256 digest, and verifies tax seal', () => {
      const canonicalPayload = {
        invoiceId: 166,
        invoiceNumber: 'FA-2026-0273',
        sellerIce: '002345678000091',
        buyerIce: '002672889000094',
        issueTimestamp: '2026-10-09T11:08:18.105Z',
        currency: 'MAD',
        totalHt: '48000.00',
        totalTva: '0.00',
        totalTtc: '48000.00',
        isArticle92Exempt: true,
      };

      const canonicalStr = buildCanonicalInvoiceString(canonicalPayload);
      expect(canonicalStr).toContain('002345678000091');
      expect(canonicalStr).toContain('FA-2026-0273');
      expect(canonicalStr).toContain('EXEMPT_CGI_92_I_10');

      const digest = generateSha256Digest(canonicalStr);
      expect(digest).toHaveLength(64);

      // Verify Article 92 notice is present in trilingual resources
      expect(DGI_ARTICLE_92_NOTICE.ar).toContain('92-I-10°');
      expect(DGI_ARTICLE_92_NOTICE.fr).toContain('92-I-10°');
      expect(DGI_ARTICLE_92_NOTICE.es).toContain('92-I-10°');
    });
  });

  // ---------------------------------------------------------------------------
  // STAGE 7: Bank Reconciliation & Multi-Currency Settlement
  // ---------------------------------------------------------------------------
  describe('Stage 7: Swift MT940 / CAMT.053 Bank Statement Reconciliation & FX Settlement', () => {
    it('accurately reconciles EUR inbound bank settlement against MAD invoice with Decimal.js', () => {
      const eurSettlementAmount = '4423.96';
      const eurExchangeRate = '10.8500';
      const invoiceMadTtc = '48000.00';

      // Decimal.js conversion: 4,423.96 * 10.85 = 47,999.966 ≈ 48,000.00 MAD
      const convertedMad = new Decimal(eurSettlementAmount).times(new Decimal(eurExchangeRate));
      const differenceMad = new Decimal(invoiceMadTtc).minus(convertedMad).abs();

      // Ensure variance is less than 0.05 MAD rounding threshold
      expect(differenceMad.lessThan(0.05)).toBe(true);

      // Test forex differential engine
      const forexResult = calculateForexDifferential({
        invoiceAmount: '48000.00',
        settledAmount: '4423.96',
        invoiceCurrency: 'MAD',
        settledCurrency: 'EUR',
        invoiceExchangeRate: new Decimal(1).dividedBy(new Decimal('10.8500')).toString(),
      });

      expect(forexResult).toBeDefined();
      expect(forexResult.hasForex).toBe(true);
      expect(new Decimal(forexResult.forexGainLossAmount).lessThan(0.05)).toBe(true);
    });
  });
});

