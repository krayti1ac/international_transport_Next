import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  convertCurrency,
  formatCurrency,
  STANDARD_FOREX_RATES,
} from '@/lib/forex';
import {
  calculateInternationalRoute,
  isWestAfricaLocation,
  isMoroccoLocation,
  isEuropeLocation,
} from '@/lib/route-calculator';
import {
  AFRICAN_CORRIDOR_WAYPOINTS,
  calculateAfricanRoadExpenses,
  evaluateAfricanDriverVisa,
  buildAfricanTransitManifest,
} from '@/lib/african-corridor';
import { checkDocumentExpiry } from '@/lib/utils/document-radar';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('African Overland Trade Corridor & Multi-Currency Engine', () => {
  describe('1. Multi-Currency Conversions (MRU & XOF) with Decimal.js', () => {
    it('converts MAD to MRU accurately with strict Decimal precision', () => {
      const madAmount = 1000;
      const mruAmount = convertCurrency(madAmount, 'MAD', 'MRU');
      expect(mruAmount).toBe(3980);
      expect(typeof mruAmount).toBe('number');
    });

    it('converts MAD to XOF accurately', () => {
      const madAmount = 1000;
      const xofAmount = convertCurrency(madAmount, 'MAD', 'XOF');
      expect(xofAmount).toBe(65200);
      expect(typeof xofAmount).toBe('number');
    });

    it('formats MRU and XOF currencies properly', () => {
      expect(formatCurrency(4500, 'MRU')).toContain('MRU');
      expect(formatCurrency(250000, 'XOF')).toContain('XOF');
    });
  });

  describe('2. Geographic Boundary Detection', () => {
    it('accurately classifies Nouakchott and Dakar as West Africa', () => {
      expect(isWestAfricaLocation(18.0735, -15.9582)).toBe(true);
      expect(isWestAfricaLocation(14.7167, -17.4677)).toBe(true);
      expect(isWestAfricaLocation(33.5731, -7.5898)).toBe(false);
    });

    it('accurately classifies Moroccan locations', () => {
      expect(isMoroccoLocation(30.4278, -9.5981)).toBe(true);
      expect(isMoroccoLocation(23.7185, -15.9385)).toBe(true);
      expect(isMoroccoLocation(40.4168, -3.7038)).toBe(false);
    });

    it('accurately classifies European locations', () => {
      expect(isEuropeLocation(40.4168, -3.7038)).toBe(true);
      expect(isEuropeLocation(48.8566, 2.3522)).toBe(true);
      expect(isEuropeLocation(18.0735, -15.9582)).toBe(false);
    });
  });

  describe('3. Route Cost Calculation (African Overland vs European Maritime)', () => {
    it('calculates African Overland route without ferry costs and with border transit fees', () => {
      const breakdown = calculateInternationalRoute({
        originLat: 30.4278,
        originLng: -9.5981,
        destLat: 18.0735,
        destLng: -15.9582,
        fuelPricePerLiter: 13.0,
        fuelConsumptionRate: 36,
      });

      expect(breakdown.isAfricanOverland).toBe(true);
      expect(breakdown.isCrossStrait).toBe(false);
      expect(breakdown.corridorType).toBe('african_overland');
      expect(breakdown.ferryCost).toBe(0);
      expect(breakdown.ferryDistanceKm).toBe(0);
      expect(breakdown.guergueratBorderCost).toBe(1500);
      expect(breakdown.mauritaniaTransitCost).toBe(2500);
      expect(breakdown.ecowasInsuranceCost).toBe(800);
      expect(breakdown.roadDistanceKm).toBeGreaterThan(1500);
      expect(breakdown.fuelCost).toBeGreaterThan(5000);
      expect(breakdown.totalFreightCost).toBeGreaterThan(breakdown.fuelCost);
    });

    it('calculates European Maritime route with ferry and port charges', () => {
      const breakdown = calculateInternationalRoute({
        originLat: 35.7595,
        originLng: -5.8340,
        destLat: 40.4168,
        destLng: -3.7038,
        fuelPricePerLiter: 13.0,
        fuelConsumptionRate: 36,
      });

      expect(breakdown.isAfricanOverland).toBe(false);
      expect(breakdown.isCrossStrait).toBe(true);
      expect(breakdown.corridorType).toBe('european_maritime');
      expect(breakdown.ferryCost).toBeGreaterThan(0);
      expect(breakdown.ferryDistanceKm).toBeGreaterThan(0);
      expect(breakdown.guergueratBorderCost).toBe(0);
      expect(breakdown.mauritaniaTransitCost).toBe(0);
      expect(breakdown.ecowasInsuranceCost).toBe(0);
    });
  });

  describe('4. African Road Expenses Settlement (MAD, MRU, XOF with Decimal.js)', () => {
    it('calculates exact multi-currency road expenses with Decimal.js precision', () => {
      const expenses = calculateAfricanRoadExpenses({
        guergueratFeeMad: 1500,
        mauritaniaFeeMru: 9950,
        rossoFerryFeeXof: 75000,
        ecowasFeeXof: 52000,
        fuelLiters: 800,
        fuelPricePerLiterMad: 13,
        tripDays: 6,
      });

      expect(expenses.guergueratBorderFeeMad).toBe(1500);
      expect(expenses.mauritaniaTransitFeeMru).toBe(9950);
      expect(expenses.rossoFerryFeeXof).toBe(75000);
      expect(expenses.ecowasInsuranceFeeXof).toBe(52000);
      expect(expenses.fuelCostMad).toBe(10400); // 800 * 13
      expect(expenses.driverRoadAllowanceMad).toBe(2400); // 6 * 400

      // Total in MAD must accurately sum all components converted via Decimal.js
      expect(expenses.totalCostInMad).toBeGreaterThan(16000);
      expect(expenses.totalCostInMru).toBeGreaterThan(60000);
      expect(expenses.totalCostInXof).toBeGreaterThan(1000000);
    });
  });

  describe('5. Strategic Waypoints of the African Trade Corridor', () => {
    it('contains all 5 key waypoints with exact coordinates and metadata', () => {
      const keys = Object.keys(AFRICAN_CORRIDOR_WAYPOINTS);
      expect(keys).toContain('el_guerguerat');
      expect(keys).toContain('nouadhibou_freezone');
      expect(keys).toContain('nouakchott_hub');
      expect(keys).toContain('rosso_border');
      expect(keys).toContain('dakar_port_hub');

      const guerguerat = AFRICAN_CORRIDOR_WAYPOINTS.el_guerguerat;
      expect(guerguerat.country).toBe('MA');
      expect(guerguerat.latitude).toBeCloseTo(21.3656, 3);
      expect(guerguerat.longitude).toBeCloseTo(-16.9583, 3);
      expect(guerguerat.radiusKm).toBe(5);

      const rosso = AFRICAN_CORRIDOR_WAYPOINTS.rosso_border;
      expect(rosso.latitude).toBeCloseTo(16.5133, 3);
      expect(rosso.radiusKm).toBe(3);

      const dakar = AFRICAN_CORRIDOR_WAYPOINTS.dakar_port_hub;
      expect(dakar.country).toBe('SN');
      expect(dakar.latitude).toBeCloseTo(14.7167, 3);
      expect(dakar.radiusKm).toBe(6);
    });
  });

  describe('6. ECOWAS Brown Card (Carte Brune) Legal Expiry Radar', () => {
    it('classifies safe ECOWAS Brown Card with > 30 days', () => {
      const baseDate = new Date('2026-09-20');
      const safeExpiry = '2026-11-20'; // 61 days
      const result = checkDocumentExpiry(safeExpiry, 'truck', baseDate);
      expect(result.status).toBe('safe');
      expect(result.isUrgent).toBe(false);
      expect(result.daysRemaining).toBe(61);
    });

    it('classifies expiring ECOWAS Brown Card with warning <= 30 days and critical <= 15 days', () => {
      const baseDate = new Date('2026-09-20');
      const warningExpiry = '2026-10-10'; // 20 days
      const warnResult = checkDocumentExpiry(warningExpiry, 'truck', baseDate);
      expect(warnResult.status).toBe('warning');
      expect(warnResult.isUrgent).toBe(true);

      const criticalExpiry = '2026-09-25'; // 5 days
      const critResult = checkDocumentExpiry(criticalExpiry, 'truck', baseDate);
      expect(critResult.status).toBe('critical');
      expect(critResult.isUrgent).toBe(true);
    });

    it('classifies expired ECOWAS Brown Card (< 0 days)', () => {
      const baseDate = new Date('2026-09-20');
      const expiredDate = '2026-09-15'; // -5 days
      const result = checkDocumentExpiry(expiredDate, 'truck', baseDate);
      expect(result.status).toBe('expired');
      expect(result.isUrgent).toBe(true);
    });
  });

  describe('7. Driver African Visa Evaluation', () => {
    it('evaluates valid African visa properly', () => {
      const baseDate = new Date('2026-09-20');
      const res = evaluateAfricanDriverVisa('2026-12-31', 'V-MR-2026-99', baseDate);
      expect(res.status).toBe('valid');
      expect(res.isEligibleForAfricanTransit).toBe(true);
      expect(res.color).toBe('green');
    });

    it('evaluates expiring African visa properly within 30 days', () => {
      const baseDate = new Date('2026-09-20');
      const res = evaluateAfricanDriverVisa('2026-10-05', 'V-MR-2026-99', baseDate);
      expect(res.status).toBe('expiring');
      expect(res.isEligibleForAfricanTransit).toBe(true);
      expect(res.color).toBe('amber');
    });

    it('evaluates expired African visa and marks driver ineligible for transit', () => {
      const baseDate = new Date('2026-09-20');
      const res = evaluateAfricanDriverVisa('2026-09-10', 'V-MR-2026-99', baseDate);
      expect(res.status).toBe('expired');
      expect(res.isEligibleForAfricanTransit).toBe(false);
      expect(res.color).toBe('rose');
    });

    it('handles missing visa number or date gracefully', () => {
      const res = evaluateAfricanDriverVisa(null, null);
      expect(res.status).toBe('missing');
      expect(res.isEligibleForAfricanTransit).toBe(false);
    });
  });

  describe('8. African Overland Transit Manifest (TRIE / Carnet de Passage)', () => {
    it('generates complete transit manifest with customs seal and multi-currency values', () => {
      const manifest = buildAfricanTransitManifest({
        tripId: 105,
        orderNumber: 'TRIP-2026-105',
        truckPlate: '12345-A-40',
        trailerPlate: 'REM-8921-MA',
        driverName: 'الحسين التازي',
        driverCin: 'JC123456',
        driverLicense: 'B-998877',
        africanVisaNumber: 'V-MR-2026-0045',
        africanVisaExpiry: '2026-12-31',
        declaredValueMad: 250000,
        loadingPoint: 'أكادير / المغرب',
        destinationPoint: 'دكار / السنغال',
      });

      expect(manifest.manifestNumber).toContain('TRIE-AFR-');
      expect(manifest.manifestNumber).toContain('00105');
      expect(manifest.customsSealNumber).toContain('PLOMB-MA-');
      expect(manifest.carnetDePassageNumber).toContain('CPD-MR-');
      expect(manifest.ecowasCardNumber).toContain('CB-CEDEAO-');
      expect(manifest.declaredValueMad).toBe(250000);
      expect(manifest.declaredValueMru).toBe(995000); // 250000 * 3.98
      expect(manifest.declaredValueXof).toBe(16300000); // 250000 * 65.20
      expect(manifest.transitWaypoints.length).toBe(5);
      expect(manifest.corridorType).toBe('african_overland');
    });
  });
});
