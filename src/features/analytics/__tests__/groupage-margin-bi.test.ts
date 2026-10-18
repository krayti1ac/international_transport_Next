/**
 * TransSalges TMS — Groupage LTL vs. FTL Margin BI Test Suite
 * Standards: 13.60 LDM standard semi-trailer, CPK (Cost Per Kilometer),
 * Multi-Drop consolidation vs Full Truckload single-shipper economics.
 * Financial Precision: Strictly verified with Decimal.js.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeGroupageMarginBi,
  compareLtlVsFtl,
  convertToMad,
  resolveTripCorridor,
  MAX_TRAILER_LDM,
  DEFAULT_CURRENCY_RATES,
  type RawTripMarginInput,
} from '../services/groupage-margin-calculator.service';
import { getBenchmarkTripsData } from '../services/groupage-margin-bi.actions';

describe('Groupage LTL vs. FTL Margin BI Engine (Strict Decimal.js)', () => {
  describe('1. Currency Conversion & Normalization', () => {
    it('converts foreign currencies to Moroccan Dirham (MAD) with zero floating point drift', () => {
      // 1,000 EUR * 10.85 = 10,850.00 MAD
      const eurInMad = convertToMad(1000, 'EUR', DEFAULT_CURRENCY_RATES);
      expect(eurInMad.toString()).toBe('10850');

      // 40,000 MRU * 0.25 = 10,000.00 MAD
      const mruInMad = convertToMad(40000, 'MRU', DEFAULT_CURRENCY_RATES);
      expect(mruInMad.toString()).toBe('10000');

      // 2,000,000 XOF * 0.0165 = 33,000.00 MAD
      const xofInMad = convertToMad(2000000, 'XOF', DEFAULT_CURRENCY_RATES);
      expect(xofInMad.toString()).toBe('33000');

      // Base MAD returns identical
      const madDirect = convertToMad(45000, 'MAD', DEFAULT_CURRENCY_RATES);
      expect(madDirect.toString()).toBe('45000');
    });
  });

  describe('2. Corridor Classification', () => {
    it('accurately resolves corridors from route keywords and explicit corridor_type', () => {
      expect(
        resolveTripCorridor({
          id: 1,
          route: 'Agadir (MA) -> Guerguerat -> Nouakchott (MR)',
        })
      ).toBe('african_overland');

      expect(
        resolveTripCorridor({
          id: 2,
          route: 'Tanger Med (MA) -> Algeciras -> Perpignan (FR)',
        })
      ).toBe('european_maritime');

      expect(
        resolveTripCorridor({
          id: 3,
          route: 'Casablanca (MA) -> Dakar (SN)',
          corridor_type: 'african_overland',
        })
      ).toBe('african_overland');
    });
  });

  describe('3. Single Trip Metrics & LDM Calculation', () => {
    it('calculates LTL multi-consignment metrics with exact LDM utilization and revenue per LDM', () => {
      const mockLtlTrip: RawTripMarginInput = {
        id: 101,
        cmrNumber: 'CMR-TEST-LTL-101',
        route: 'Tanger Med (MA) -> Perpignan (FR)',
        corridor_type: 'european_maritime',
        road_distance_km: 1850,
        ferry_distance_km: 220,
        price_type: 'groupage',
        consignments: [
          {
            id: 'c1',
            tripId: 101,
            consignmentReference: 'LTL-1',
            clientName: 'Client Alpha',
            loadingCity: 'Tanger',
            loadingCountry: 'MA',
            deliveryCity: 'Perpignan',
            deliveryCountry: 'FR',
            cargoDescription: 'Berries',
            isTemperatureControlled: true,
            palletCount: 10,
            palletType: 'euro',
            isStackable: false,
            ldmMeters: 4.0,
            volumeM3: 24,
            grossWeightKg: 5000,
            chargeableWeightKg: 5000,
            freightPrice: 16000,
            currency: 'MAD',
            status: 'delivered',
            createdAt: '2026-10-12T00:00:00Z',
            updatedAt: '2026-10-14T00:00:00Z',
          },
          {
            id: 'c2',
            tripId: 101,
            consignmentReference: 'LTL-2',
            clientName: 'Client Beta',
            loadingCity: 'Larache',
            loadingCountry: 'MA',
            deliveryCity: 'Montpellier',
            deliveryCountry: 'FR',
            cargoDescription: 'Strawberries',
            isTemperatureControlled: true,
            palletCount: 15,
            palletType: 'euro',
            isStackable: false,
            ldmMeters: 6.0,
            volumeM3: 36,
            grossWeightKg: 7500,
            chargeableWeightKg: 7500,
            freightPrice: 24000,
            currency: 'MAD',
            status: 'delivered',
            createdAt: '2026-10-12T00:00:00Z',
            updatedAt: '2026-10-14T00:00:00Z',
          },
        ],
        allocation: {
          id: 'alloc-101',
          trip_id: 101,
          total_fuel_cost: 9000,
          total_ferry_cost: 6800,
          total_tolls_cost: 2200,
          total_customs_cost: 1500,
          total_driver_cost: 2800,
          total_shared_cost: 22300,
          total_revenue: 40000,
          total_net_profit: 17700,
          overall_profit_margin_pct: 44.25,
          currency: 'MAD',
          consignments_count: 2,
          created_at: '2026-10-12T00:00:00Z',
        },
      };

      const result = computeGroupageMarginBi([mockLtlTrip]);
      expect(result.trips.length).toBe(1);

      const trip = result.trips[0];
      expect(trip.mode).toBe('ltl');
      expect(trip.consignmentsCount).toBe(2);
      expect(trip.totalLdm).toBe(10.0); // 4.0 + 6.0
      expect(trip.trailerUtilizationPct).toBe(73.5); // (10 / 13.6) * 100 = 73.5%
      expect(trip.revenueMad).toBe(40000); // 16000 + 24000
      expect(trip.operatingCostMad).toBe(22300);
      expect(trip.netProfitMad).toBe(17700);
      expect(trip.revenuePerLdmMad).toBe(4000); // 40,000 / 10 LDM
      expect(trip.netMarginPerLdmMad).toBe(1770); // 17,700 / 10 LDM

      // Total distance = 1850 + 220 = 2070 km
      // CPK = 22,300 / 2,070 = 10.77 MAD/km
      expect(trip.cpkMad).toBe(10.77);
    });

    it('calculates FTL single-shipper baseline metrics with 13.60 standard LDM', () => {
      const mockFtlTrip: RawTripMarginInput = {
        id: 102,
        cmrNumber: 'CMR-TEST-FTL-102',
        route: 'Tanger Med (MA) -> Perpignan (FR)',
        corridor_type: 'european_maritime',
        road_distance_km: 1850,
        ferry_distance_km: 220,
        price: 34000,
        price_type: 'full_truckload',
        currency: 'MAD',
      };

      const result = computeGroupageMarginBi([mockFtlTrip]);
      const trip = result.trips[0];

      expect(trip.mode).toBe('ftl');
      expect(trip.totalLdm).toBe(13.6);
      expect(trip.trailerUtilizationPct).toBe(100.0);
      expect(trip.revenueMad).toBe(34000);
      // Revenue per LDM = 34,000 / 13.6 = 2,500.00 MAD/LDM
      expect(trip.revenuePerLdmMad).toBe(2500);
    });
  });

  describe('4. Comparative Metrics & Breakeven LDM', () => {
    it('correctly identifies LTL margin premium over FTL and calculates breakeven LDM', () => {
      const benchmarkData = getBenchmarkTripsData();
      const biResult = computeGroupageMarginBi(benchmarkData);

      // Verify overall comparison
      const overallComp = biResult.overall.comparison;
      expect(overallComp.winnerMode).toBeDefined();
      expect(overallComp.utilizationBreakevenLdm).toBeGreaterThan(0);
      expect(overallComp.utilizationBreakevenLdm).toBeLessThanOrEqual(13.6);
      expect(overallComp.tacticalRecommendationAr).toContain('LDM');
      expect(overallComp.tacticalRecommendationFr).toContain('LDM');
      expect(overallComp.tacticalRecommendationEs).toContain('LDM');

      // Verify European Maritime corridor comparison
      const euro = biResult.europeanMaritime;
      expect(euro.ltl.tripCount).toBeGreaterThan(0);
      expect(euro.ftl.tripCount).toBeGreaterThan(0);
      // Groupage revenue per LDM should be significantly higher than FTL
      expect(euro.ltl.avgRevenuePerLdmMad).toBeGreaterThan(euro.ftl.avgRevenuePerLdmMad);
      expect(euro.comparison.revenuePerLdmPremiumPct).toBeGreaterThan(0);

      // Verify African Overland corridor comparison
      const afr = biResult.africanOverland;
      expect(afr.ltl.tripCount).toBeGreaterThan(0);
      expect(afr.ftl.tripCount).toBeGreaterThan(0);
      expect(afr.ltl.totalConsignments).toBeGreaterThan(0);
    });

    it('accurately groups LTL trips into LDM consolidation efficiency tiers', () => {
      const benchmarkData = getBenchmarkTripsData();
      const biResult = computeGroupageMarginBi(benchmarkData);

      expect(biResult.ldmBuckets.length).toBe(3);
      expect(biResult.ldmBuckets[0].bucketRange).toBe('< 8.0 LDM');
      expect(biResult.ldmBuckets[1].bucketRange).toBe('8.0 - 11.0 LDM');
      expect(biResult.ldmBuckets[2].bucketRange).toBe('11.0 - 13.6 LDM');

      const highTier = biResult.ldmBuckets[2];
      expect(highTier.tripCount).toBeGreaterThan(0);
      expect(highTier.avgUtilizationPct).toBeGreaterThan(80);
    });
  });

  describe('5. Zero-Division & Edge Case Robustness', () => {
    it('gracefully handles empty trip lists without NaN or Infinity', () => {
      const emptyResult = computeGroupageMarginBi([]);
      expect(emptyResult.overall.ltl.tripCount).toBe(0);
      expect(emptyResult.overall.ftl.tripCount).toBe(0);
      expect(emptyResult.overall.ltl.netMarginPct).toBe(0);
      expect(emptyResult.overall.ltl.avgRevenuePerLdmMad).toBe(0);
      expect(emptyResult.overall.ltl.avgCpkMad).toBe(0);
      expect(emptyResult.overall.comparison.utilizationBreakevenLdm).toBe(9.5);
      expect(emptyResult.trips).toEqual([]);
    });

    it('gracefully handles trips with zero distance or zero revenue', () => {
      const zeroTrip: RawTripMarginInput = {
        id: 999,
        route: 'Stationary Trailer',
        price: 0,
        road_distance_km: 0,
        ferry_distance_km: 0,
        consignments: [],
      };

      const result = computeGroupageMarginBi([zeroTrip]);
      const trip = result.trips[0];
      expect(trip.cpkMad).toBe(0);
      expect(trip.rpkMad).toBe(0);
      expect(Number.isNaN(trip.netMarginPct)).toBe(false);
      expect(Number.isNaN(trip.revenuePerLdmMad)).toBe(false);
    });
  });
});

