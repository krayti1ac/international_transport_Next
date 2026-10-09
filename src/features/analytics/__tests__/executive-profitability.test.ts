import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateActualCpk,
  calculateRevenuePerKm,
  calculateNetMarginPercent,
  calculateCpkVariancePercent,
  evaluateCostAnomaly,
  convertCurrency,
  buildCorridorProfitabilitySummary,
  buildExecutiveBiReport,
  DEFAULT_EUR_TO_MAD_RATE,
} from '../services/executive-profitability.service';

describe('Executive BI & Fleet Profitability Analytics Engine', () => {
  describe('1. Decimal.js Financial Precision & Zero Floating Point Errors', () => {
    it('calculates Actual CPK without floating point drift', () => {
      // 148,600.50 MAD over 34,200 km
      const cpk = calculateActualCpk('148600.50', '34200');
      expect(cpk.toFixed(4)).toBe('4.3450');
      expect(cpk.toFixed(2)).toBe('4.35');
    });

    it('returns zero CPK safely when distance is zero or negative', () => {
      expect(calculateActualCpk('5000', 0).toFixed(2)).toBe('0.00');
      expect(calculateActualCpk('5000', -100).toFixed(2)).toBe('0.00');
    });

    it('calculates Revenue Per Km (RPK) accurately', () => {
      // 425,000.00 MAD over 34,200 km
      const rpk = calculateRevenuePerKm('425000.00', '34200');
      expect(rpk.toFixed(4)).toBe('12.4269');
      expect(rpk.toFixed(2)).toBe('12.43');
    });

    it('calculates Net Operating Margin % accurately', () => {
      // Revenue 500,000, Costs 320,000 => Profit 180,000 => 36.00%
      const margin = calculateNetMarginPercent('500000.00', '320000.00');
      expect(margin.toFixed(2)).toBe('36.00');
    });

    it('handles zero revenue safely without division by zero in margin', () => {
      const margin = calculateNetMarginPercent(0, '10000');
      expect(margin.toFixed(2)).toBe('0.00');
    });
  });

  describe('2. Cost Variance & Anomaly Alert Engine', () => {
    it('calculates CPK variance percent accurately', () => {
      // Actual 3.80 vs Target 3.20 => +18.75%
      const variance = calculateCpkVariancePercent('3.80', '3.20');
      expect(variance.toFixed(2)).toBe('18.75');
    });

    it('flags cost anomaly when variance exceeds threshold (+15%)', () => {
      const anomaly = evaluateCostAnomaly('3.95', '3.30', 15.0);
      expect(anomaly.isAnomaly).toBe(true);
      expect(parseFloat(anomaly.variancePercent)).toBeGreaterThanOrEqual(15.0);
      expect(anomaly.reason).toContain('تجاوز تكلفة الكيلومتر الميدانية');
    });

    it('does not flag anomaly when variance is within acceptable tolerance (+5%)', () => {
      const anomaly = evaluateCostAnomaly('3.40', '3.30', 15.0);
      expect(anomaly.isAnomaly).toBe(false);
      expect(parseFloat(anomaly.variancePercent)).toBeLessThan(15.0);
    });
  });

  describe('3. Multi-Currency Normalization (MAD, EUR, MRU, XOF)', () => {
    it('converts EUR to MAD at default forex rate 10.85', () => {
      const inMad = convertCurrency('1000.00', 'EUR', 'MAD', DEFAULT_EUR_TO_MAD_RATE);
      expect(inMad.toFixed(2)).toBe('10850.00');
    });

    it('converts MAD to EUR accurately', () => {
      const inEur = convertCurrency('10850.00', 'MAD', 'EUR', DEFAULT_EUR_TO_MAD_RATE);
      expect(inEur.toFixed(2)).toBe('1000.00');
    });

    it('returns exact amount when from and to currencies match', () => {
      const same = convertCurrency('4500.50', 'MAD', 'MAD');
      expect(same.toFixed(2)).toBe('4500.50');
    });
  });

  describe('4. Single Corridor Summary Builder', () => {
    it('builds Agadir ➔ Dakar corridor summary with full cost breakdown', () => {
      const summary = buildCorridorProfitabilitySummary({
        corridorCode: 'agadir_dakar',
        corridorTitleAr: 'أكادير ➔ دكار',
        corridorTitleFr: 'Agadir ➔ Dakar',
        corridorTitleEs: 'Agadir ➔ Dakar',
        origin: 'Agadir',
        destination: 'Dakar',
        totalTripsCount: 12,
        totalDistanceKm: 34200,
        revenue: '425000.00',
        costs: {
          fuelCost: '148600.00',
          ferryPortFees: '18500.00',
          driverAllowancesAdvances: '38200.00',
          maintenanceDepreciation: '22400.00',
          customsTransitFees: '16800.00',
          otherOperatingExpenses: '6500.00',
        },
        targetCpk: '3.10',
        currency: 'MAD',
      });

      // Total Cost: 148600 + 18500 + 38200 + 22400 + 16800 + 6500 = 251,000.00
      expect(summary.costs.totalCost).toBe('251000.00');
      // Net Profit: 425000 - 251000 = 174,000.00
      expect(summary.netOperatingProfit).toBe('174000.00');
      // Net Margin %: (174000 / 425000) * 100 = 40.941... => 40.94%
      expect(summary.netMarginPercent).toBe('40.94');
      // Actual CPK: 251000 / 34200 = 7.339... => 7.34
      expect(summary.actualCpk).toBe('7.34');
      expect(summary.currency).toBe('MAD');
    });
  });

  describe('5. Consolidated Executive BI Report Aggregator', () => {
    it('aggregates multiple corridors into company executive summary and cost distribution', () => {
      const c1 = buildCorridorProfitabilitySummary({
        corridorCode: 'agadir_dakar',
        corridorTitleAr: 'أكادير ➔ دكار',
        corridorTitleFr: 'Agadir ➔ Dakar',
        corridorTitleEs: 'Agadir ➔ Dakar',
        origin: 'Agadir',
        destination: 'Dakar',
        totalTripsCount: 10,
        totalDistanceKm: 25000,
        revenue: '300000.00',
        costs: {
          fuelCost: '100000.00',
          ferryPortFees: '15000.00',
          driverAllowancesAdvances: '25000.00',
          maintenanceDepreciation: '15000.00',
          customsTransitFees: '10000.00',
          otherOperatingExpenses: '5000.00',
        },
        targetCpk: '3.20',
      });

      const c2 = buildCorridorProfitabilitySummary({
        corridorCode: 'tanger_valencia_perpignan',
        corridorTitleAr: 'طنجة ➔ فالنسيا',
        corridorTitleFr: 'Tanger ➔ Valence',
        corridorTitleEs: 'Tánger ➔ Valencia',
        origin: 'Tanger',
        destination: 'Valencia',
        totalTripsCount: 15,
        totalDistanceKm: 30000,
        revenue: '450000.00',
        costs: {
          fuelCost: '120000.00',
          ferryPortFees: '40000.00',
          driverAllowancesAdvances: '30000.00',
          maintenanceDepreciation: '20000.00',
          customsTransitFees: '15000.00',
          otherOperatingExpenses: '5000.00',
        },
        targetCpk: '3.40',
      });

      const report = buildExecutiveBiReport([c1, c2], [], 'MAD', DEFAULT_EUR_TO_MAD_RATE);

      // Total Revenue: 300000 + 450000 = 750000.00
      expect(report.kpis.totalRevenue).toBe('750000.00');
      // Total Distance: 25000 + 30000 = 55000
      expect(report.kpis.totalDistanceKm).toBe(55000);
      expect(report.kpis.totalTripsCompleted).toBe(25);
      expect(report.costDistribution).toHaveLength(6);
      expect(report.costDistribution[0].category).toBe('fuelCost');
      expect(report.costDistribution[0].amount).toBe(220000); // 100000 + 120000
    });
  });
});

