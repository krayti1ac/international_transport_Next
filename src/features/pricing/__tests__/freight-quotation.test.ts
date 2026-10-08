import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateQuotationCostBreakdown,
  buildQuotationTiers,
  buildFreightQuotation,
  resolveQuotationCorridor,
  BASE_CPK_EUROPE_MAD,
  BASE_CPK_AFRICA_MAD,
  CARGO_CPK_SURCHARGE_MAD,
  FERRY_CROSSING_FEES_MAD,
} from '../services/dynamic-quotation-builder.service';
import {
  convertQuotationToTripOrder,
  storeQuotationInMemory,
  getQuotationFromMemory,
} from '../services/quotation-to-trip-converter.service';
import type { CreateQuotationInput } from '../types/freight-quotation.types';

describe('Dynamic Freight Pricing & Instant Quotation Engine', () => {
  // 1. CPK & Cost Breakdown Calculations with Decimal.js
  describe('1. Cost Breakdown & CPK Calculations (Decimal.js)', () => {
    it('applies baseline CPK rates and cargo surcharges without floating point errors', () => {
      // European corridor, 2,000 km, Reefer cargo
      const breakdown = calculateQuotationCostBreakdown({
        distanceKm: 2000,
        corridorType: 'european_maritime',
        cargoType: 'reefer_temperature_controlled',
        currency: 'MAD',
        targetMarginPercent: 22,
      });

      // Base Europe CPK (9.40) + Reefer Surcharge (1.60) = 11.00 MAD/km
      expect(breakdown.baseCpkRateMad).toBe('11.00');
      // CPK distance cost: 2000 * 11.00 = 22,000.00 MAD
      expect(breakdown.cpkDistanceCostMad).toBe('22000.00');
      // Ferry: 4,600.00 MAD
      expect(breakdown.ferryAndTransitCostMad).toBe('4600.00');
      // Tolls: 2000 * 0.85 = 1,700.00 MAD
      expect(breakdown.tollsCostMad).toBe('1700.00');
      // Driver allowances: 2000 * 0.75 = 1,500.00 MAD
      expect(breakdown.driverAllowancesCostMad).toBe('1500.00');
      // Reefer unit: 2000 * 1.25 = 2,500.00 MAD
      expect(breakdown.reeferCostMad).toBe('2500.00');
    });

    it('uses higher African overland base CPK (10.85 MAD/km) for overland transit', () => {
      const breakdown = calculateQuotationCostBreakdown({
        distanceKm: 3000,
        corridorType: 'african_overland',
        cargoType: 'dry_box',
        currency: 'MAD',
        targetMarginPercent: 20,
      });

      expect(breakdown.baseCpkRateMad).toBe('10.85');
      // CPK distance cost: 3000 * 10.85 = 32,550.00 MAD
      expect(breakdown.cpkDistanceCostMad).toBe('32550.00');
      // African transit fee: 5,800.00 MAD
      expect(breakdown.ferryAndTransitCostMad).toBe('5800.00');
      // Tolls in Africa = 0.00 MAD
      expect(breakdown.tollsCostMad).toBe('0.00');
    });
  });

  // 2. Commercial Pricing Tiers
  describe('2. Strategic Commercial Tiers Generation', () => {
    it('generates Floor (12%), Spot (22%), and Express (32%) tiers with exact margin math', () => {
      const totalDirectCostMad = new Decimal('20000.00');
      const tiers = buildQuotationTiers(totalDirectCostMad, 'MAD', 22);

      // Floor: 20000 * 1.12 = 22,400.00 MAD
      expect(tiers.floor.marginPercent).toBe(12);
      expect(tiers.floor.netPrice).toBe('22400.00');
      expect(tiers.floor.isRecommended).toBe(false);

      // Spot: 20000 * 1.22 = 24,400.00 MAD
      expect(tiers.spot.marginPercent).toBe(22);
      expect(tiers.spot.netPrice).toBe('24400.00');
      expect(tiers.spot.isRecommended).toBe(true);

      // Express Premium: 20000 * 1.32 = 26,400.00 MAD
      expect(tiers.expressPremium.marginPercent).toBe(32);
      expect(tiers.expressPremium.netPrice).toBe('26400.00');
      expect(tiers.expressPremium.isRecommended).toBe(false);
    });
  });

  // 3. Multi-Currency Support (MAD, EUR, MRU, XOF)
  describe('3. Multi-Currency Conversion & Formatting', () => {
    it('converts prices accurately to EUR with 2 decimal places', () => {
      const quotation = buildFreightQuotation({
        clientName: 'Exportateur Frais SARL',
        originCity: 'Agadir',
        destinationCity: 'Perpignan',
        cargoType: 'reefer_temperature_controlled',
        roadDistanceKm: 2450,
        currency: 'EUR',
        targetMarginPercent: 22,
      });

      expect(quotation.currency).toBe('EUR');
      expect(Number(quotation.finalPrice)).toBeGreaterThan(0);
      expect(quotation.finalPrice).toMatch(/^\d+\.\d{2}$/);
    });

    it('formats West African Franc (XOF) without decimals as per regional financial standard', () => {
      const quotation = buildFreightQuotation({
        clientName: 'Dakar Transit SA',
        originCity: 'Casablanca',
        destinationCity: 'Dakar',
        cargoType: 'dry_box',
        roadDistanceKm: 3150,
        currency: 'XOF',
      });

      expect(quotation.currency).toBe('XOF');
      expect(Number(quotation.finalPrice)).toBeGreaterThan(0);
      expect(quotation.finalPrice).not.toContain('.');
    });
  });

  // 4. Legal Tax Exemption Compliance (Article 92-I-10° du CGI)
  describe('4. Moroccan DGI Article 92-I-10° VAT Exemption', () => {
    it('strictly applies 0% VAT rate with legal notice across Arabic, French, and Spanish', () => {
      const quotation = buildFreightQuotation({
        clientName: 'Maroc Export SARL',
        originCity: 'Tanger',
        destinationCity: 'Madrid',
        cargoType: 'dry_box',
        currency: 'MAD',
      });

      expect(quotation.vatRatePercent).toBe(0);
      expect(quotation.vatAmount).toBe('0.00');
      expect(quotation.totalPriceWithVat).toBe(quotation.finalPrice);
      expect(quotation.vatExemptionLegalNoticeAr).toContain('92-I-10°');
      expect(quotation.vatExemptionLegalNoticeFr).toContain('92-I-10°');
      expect(quotation.vatExemptionLegalNoticeEs).toContain('92-I-10°');
    });
  });

  // 5. Quotation to Trip Order Conversion with Idempotency Guard
  describe('5. Quotation to Trip Order Conversion & Idempotency Guard', () => {
    it('converts an accepted quotation to trip order and generates CMR export number', async () => {
      const quotation = buildFreightQuotation({
        clientName: 'Société Maraîchère du Souss',
        originCity: 'Agadir',
        destinationCity: 'Perpignan',
        cargoType: 'reefer_temperature_controlled',
        currency: 'EUR',
      });
      storeQuotationInMemory(quotation);

      // First Conversion: should succeed and create a trip
      const result1 = await convertQuotationToTripOrder(quotation);

      expect(result1.success).toBe(true);
      expect(result1.alreadyConverted).toBe(false);
      expect(result1.tripId).toBeGreaterThan(0);
      expect(result1.cmrNumber).toMatch(/^CMR-/);
      expect(quotation.status).toBe('ACCEPTED');
      expect(quotation.convertedToTripId).toBe(result1.tripId);

      // Second Conversion attempt: must be intercepted by Idempotency Guard
      const result2 = await convertQuotationToTripOrder(quotation);

      expect(result2.success).toBe(true);
      expect(result2.alreadyConverted).toBe(true);
      expect(result2.tripId).toBe(result1.tripId);
      expect(result2.cmrNumber).toBe(result1.cmrNumber);
      expect(result2.message).toContain('تم تحويل هذا العرض مسبقاً');
    });
  });

  // 6. Corridor Resolution
  describe('6. Automatic Corridor Type Resolution', () => {
    it('automatically resolves African Overland corridor for destinations south of Guerguerat', () => {
      expect(resolveQuotationCorridor('Casablanca', 'Nouakchott')).toBe('african_overland');
      expect(resolveQuotationCorridor('Agadir', 'Dakar')).toBe('african_overland');
      expect(resolveQuotationCorridor('Dakhla', 'Nouadhibou')).toBe('african_overland');
    });

    it('automatically resolves European Maritime corridor for European destinations', () => {
      expect(resolveQuotationCorridor('Agadir', 'Perpignan')).toBe('european_maritime');
      expect(resolveQuotationCorridor('Casablanca', 'Paris')).toBe('european_maritime');
      expect(resolveQuotationCorridor('Tanger', 'Madrid')).toBe('european_maritime');
    });
  });
});

