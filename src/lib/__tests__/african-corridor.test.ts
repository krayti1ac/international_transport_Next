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

describe('African Overland Trade Corridor & Multi-Currency Engine', () => {
  describe('1. Multi-Currency Conversions (MRU & XOF) with Decimal.js', () => {
    it('converts MAD to MRU accurately with strict Decimal precision', () => {
      // STANDARD_FOREX_RATES.MRU = 0.2512 MAD (~3.98 MRU per MAD)
      const madAmount = 1000;
      const mruAmount = convertCurrency(madAmount, 'MAD', 'MRU');
      expect(mruAmount).toBe(3980);
      expect(typeof mruAmount).toBe('number');
    });

    it('converts MAD to XOF accurately', () => {
      // STANDARD_FOREX_RATES.XOF = 0.01533 MAD (~65.20 XOF per MAD)
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
      // Nouakchott: 18.0735, -15.9582
      expect(isWestAfricaLocation(18.0735, -15.9582)).toBe(true);
      // Dakar: 14.7167, -17.4677
      expect(isWestAfricaLocation(14.7167, -17.4677)).toBe(true);
      // Casablanca: 33.5731, -7.5898 (Not West Africa)
      expect(isWestAfricaLocation(33.5731, -7.5898)).toBe(false);
    });

    it('accurately classifies Moroccan locations', () => {
      // Agadir: 30.4278, -9.5981
      expect(isMoroccoLocation(30.4278, -9.5981)).toBe(true);
      // Dakhla: 23.7185, -15.9385
      expect(isMoroccoLocation(23.7185, -15.9385)).toBe(true);
      // Madrid (Spain): 40.4168, -3.7038
      expect(isMoroccoLocation(40.4168, -3.7038)).toBe(false);
    });

    it('accurately classifies European locations', () => {
      // Madrid: 40.4168, -3.7038
      expect(isEuropeLocation(40.4168, -3.7038)).toBe(true);
      // Paris: 48.8566, 2.3522
      expect(isEuropeLocation(48.8566, 2.3522)).toBe(true);
      // Nouakchott: 18.0735, -15.9582
      expect(isEuropeLocation(18.0735, -15.9582)).toBe(false);
    });
  });

  describe('3. Route Cost Calculation (African Overland vs European Maritime)', () => {
    it('calculates African Overland route without ferry costs and with border transit fees', () => {
      // Agadir (30.4278, -9.5981) to Nouakchott (18.0735, -15.9582)
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

      // Verify diesel is calculated continuously for full distance
      expect(breakdown.roadDistanceKm).toBeGreaterThan(1500);
      expect(breakdown.fuelCost).toBeGreaterThan(5000);
      expect(breakdown.totalFreightCost).toBeGreaterThan(breakdown.fuelCost);
    });

    it('calculates European Maritime route with ferry and port charges', () => {
      // Tangier (35.7595, -5.8340) to Madrid (40.4168, -3.7038)
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
});

