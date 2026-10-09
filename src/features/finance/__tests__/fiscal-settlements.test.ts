import { describe, it, expect } from 'vitest';
import { FiscalSettlementsService } from '../services/fiscal-settlements.service';
import type {
  CalculateDriverSettlementInput,
  CalculateTripPnlInput,
} from '../types/fiscal-settlements.types';

describe('FiscalSettlementsService — Strict Decimal.js Precision & Closed-Loop Audits', () => {
  describe('calculateDriverSettlement', () => {
    it('accurately reconciles advances with exact zero floating-point error', () => {
      // 0.1 + 0.2 floating point check
      const input: CalculateDriverSettlementInput = {
        driverId: 1,
        baseSalary: 4500.1,
        bonusPercentage: 5,
        safetyScore: 92,
        trips: [
          { id: 101, price: 20000.2, distance_km: 1850 },
        ],
        advances: [
          { id: 1, amount: 5000.3, date: '2026-10-01' },
        ],
        fuelExpenses: [
          { id: 1, amount: 2500.2, date: '2026-10-02' },
        ],
        tollExpenses: [
          { id: 1, amount_mad: 1200.1, exit_time: '2026-10-03T12:00:00Z', toll_system: 'via_t' },
        ],
        ferryExpenses: [
          { id: 1, amount: 1500.0, date: '2026-10-04' },
        ],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);

      // Total driver expenses: 2500.2 + 1200.1 + 1500.0 = 5200.30 MAD
      expect(result.totalDriverExpenses).toBe(5200.3);
      // Advances: 5000.30 MAD
      expect(result.totalAdvances).toBe(5000.3);
      // Expenses vs Advances balance: 5200.3 - 5000.3 = +200.00 MAD (driver is owed reimbursement)
      expect(result.expensesVsAdvancesBalance).toBe(200);

      // Base: 4500.10
      // Trip revenue: 20000.20 * 5% = 1000.01
      // Safety bonus (score 92 >= 90): 500.00
      // Gross earnings: 4500.10 + 1000.01 + 500.00 = 6000.11
      expect(result.safetyBonus).toBe(500);
      expect(result.missionBonuses).toBe(1000.01);
      expect(result.grossEarnings).toBe(6000.11);

      // Net payout: 6000.11 + 200.00 = 6200.11
      expect(result.netPayout).toBe(6200.11);
    });

    it('correctly handles driver advance deficit (unspent advances deducted from salary)', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 2,
        baseSalary: 5000,
        bonusPercentage: 0,
        safetyScore: 85, // < 90 so no safety bonus
        trips: [],
        advances: [
          { id: 1, amount: 10000, date: '2026-10-01' },
        ],
        fuelExpenses: [
          { id: 1, amount: 4000, date: '2026-10-02' },
        ],
        tollExpenses: [
          { id: 1, amount_mad: 2000, exit_time: '2026-10-03T12:00:00Z', toll_system: 'telepeage' },
        ],
        ferryExpenses: [],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);

      // Documented expenses: 4000 + 2000 = 6000 MAD
      expect(result.totalDriverExpenses).toBe(6000);
      // Advances: 10000 MAD
      expect(result.totalAdvances).toBe(10000);
      // Balance: 6000 - 10000 = -4000 MAD (driver returned or owes unspent cash)
      expect(result.expensesVsAdvancesBalance).toBe(-4000);

      // Gross earnings: 5000 + 0 + 0 = 5000 MAD
      expect(result.grossEarnings).toBe(5000);
      // Net payout: 5000 - 4000 = 1000 MAD
      expect(result.netPayout).toBe(1000);
    });

    it('deducts pending operational fines from net payout', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 3,
        baseSalary: 6000,
        bonusPercentage: 0,
        safetyScore: 70,
        trips: [],
        advances: [{ id: 1, amount: 3000, date: '2026-10-01' }],
        fuelExpenses: [{ id: 1, amount: 3000, date: '2026-10-02' }], // zero net expense balance
        tollExpenses: [],
        ferryExpenses: [],
        fines: [
          { id: 10, amount: 750, fine_type: 'speeding', deducted_from_settlement: false },
          { id: 11, amount: 500, fine_type: 'tachograph', deducted_from_settlement: true }, // already deducted, should be ignored
        ],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);

      expect(result.totalFinesToDeduct).toBe(750);
      expect(result.expensesVsAdvancesBalance).toBe(0);
      // Net payout: 6000 - 750 = 5250 MAD
      expect(result.netPayout).toBe(5250);
    });

    it('converts EUR toll amounts to MAD when MAD amount is not specified', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 4,
        baseSalary: 5000,
        safetyScore: 80,
        trips: [],
        advances: [],
        fuelExpenses: [],
        tollExpenses: [
          // 100 EUR * 10.85 = 1085 MAD
          { id: 50, amount_eur: 100, exit_time: '2026-10-05T10:00:00Z', toll_system: 'lkw_maut' },
        ],
        ferryExpenses: [],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);
      expect(result.totalTolls).toBe(1085);
      expect(result.totalDriverExpenses).toBe(1085);
      expect(result.netPayout).toBe(6085); // 5000 + 1085 (reimbursement)
    });

    it('populates itemized expenses with correct categories for clearance sheet', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 5,
        baseSalary: 5000,
        trips: [{ id: 1, price: 15000 }],
        advances: [{ id: 1, amount: 2000, date: '2026-10-01' }],
        fuelExpenses: [{ id: 1, amount: 1500, date: '2026-10-02' }],
        tollExpenses: [{ id: 1, amount_mad: 500, exit_time: '2026-10-03', toll_system: 'via_t' }],
        ferryExpenses: [{ id: 1, amount: 800, date: '2026-10-04' }],
        fines: [{ id: 1, amount: 300, fine_type: 'overload', deducted_from_settlement: false }],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);

      expect(result.itemizedExpenses).toHaveLength(5);
      const categories = result.itemizedExpenses.map((e) => e.category);
      expect(categories).toContain('advance');
      expect(categories).toContain('fuel');
      expect(categories).toContain('toll');
      expect(categories).toContain('ferry');
      expect(categories).toContain('fine');
    });
  });

  describe('calculateTripPnl', () => {
    it('calculates gross profit and profit margin percentage accurately', () => {
      const input: CalculateTripPnlInput = {
        tripId: 500,
        revenue: 35000,
        fuelCost: 9500,
        tollsCost: 2800,
        ferryCost: 4500,
        customsPortsCost: 2200,
        driverCost: 3500,
        otherCosts: 500,
      };

      const pnl = FiscalSettlementsService.calculateTripPnl(input);

      // Total costs: 9500 + 2800 + 4500 + 2200 + 3500 + 500 = 23000 MAD
      expect(pnl.totalCosts).toBe(23000);
      // Gross profit: 35000 - 23000 = 12000 MAD
      expect(pnl.grossProfit).toBe(12000);
      // Margin: (12000 / 35000) * 100 = 34.2857... -> 34.29%
      expect(pnl.profitMarginPct).toBe(34.29);
      expect(pnl.profitabilityTier).toBe('exceptional');
    });

    it('classifies profitability tiers correctly (healthy, tight, loss)', () => {
      // Healthy (15% to 25%)
      const healthy = FiscalSettlementsService.calculateTripPnl({
        tripId: 501,
        revenue: 20000,
        fuelCost: 10000,
        tollsCost: 2000,
        ferryCost: 2000,
        customsPortsCost: 1000,
        driverCost: 1400,
      });
      // Costs: 16400, Profit: 3600 (18%)
      expect(healthy.profitabilityTier).toBe('healthy');
      expect(healthy.profitMarginPct).toBe(18);

      // Tight (0% to 15%)
      const tight = FiscalSettlementsService.calculateTripPnl({
        tripId: 502,
        revenue: 20000,
        fuelCost: 12000,
        tollsCost: 3000,
        ferryCost: 2000,
        customsPortsCost: 1000,
        driverCost: 1000,
      });
      // Costs: 19000, Profit: 1000 (5%)
      expect(tight.profitabilityTier).toBe('tight');
      expect(tight.profitMarginPct).toBe(5);

      // Loss (< 0%)
      const loss = FiscalSettlementsService.calculateTripPnl({
        tripId: 503,
        revenue: 20000,
        fuelCost: 14000,
        tollsCost: 3500,
        ferryCost: 2500,
        customsPortsCost: 1000,
        driverCost: 1000,
      });
      // Costs: 22000, Profit: -2000 (-10%)
      expect(loss.profitabilityTier).toBe('loss');
      expect(loss.profitMarginPct).toBe(-10);
    });

    it('handles zero revenue safely without division by zero errors', () => {
      const pnl = FiscalSettlementsService.calculateTripPnl({
        tripId: 504,
        revenue: 0,
        fuelCost: 1500,
        tollsCost: 0,
        ferryCost: 0,
        customsPortsCost: 0,
        driverCost: 0,
      });

      expect(pnl.grossProfit).toBe(-1500);
      expect(pnl.profitMarginPct).toBe(0);
      expect(pnl.profitabilityTier).toBe('loss');
    });

    it('sums export and import prices accurately for round trips', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 6,
        baseSalary: 4000,
        bonusPercentage: 10,
        safetyScore: 80,
        trips: [
          { id: 1, price_export: 18000, price_import: 14000, distance_km: 2100 },
          { id: 2, price: 15000, distance_km: 900 },
        ],
        advances: [],
        fuelExpenses: [],
        tollExpenses: [],
        ferryExpenses: [],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);

      // Trip 1 revenue: 18000 + 14000 = 32000
      // Trip 2 revenue: 15000
      // Total revenue: 47000. 10% bonus = 4700.
      expect(result.missionBonuses).toBe(4700);
      expect(result.totalDistanceKm).toBe(3000);
      expect(result.grossEarnings).toBe(8700); // 4000 + 4700
      expect(result.netPayout).toBe(8700);
    });

    it('handles fractional percentage bonuses accurately with ROUND_HALF_UP', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 7,
        baseSalary: 3000,
        bonusPercentage: 7.25, // 7.25%
        safetyScore: 80,
        trips: [{ id: 10, price: 15555.55 }],
        advances: [],
        fuelExpenses: [],
        tollExpenses: [],
        ferryExpenses: [],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);
      // 15555.55 * 0.0725 = 1127.777375 -> rounded to 1127.78
      expect(result.missionBonuses).toBe(1127.78);
    });

    it('correctly handles compound deductions: advance deficit AND fines', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 8,
        baseSalary: 6000,
        safetyScore: 75,
        trips: [],
        advances: [{ id: 1, amount: 8000, date: '2026-10-01' }],
        fuelExpenses: [{ id: 1, amount: 5000, date: '2026-10-02' }], // 3000 unspent advances
        tollExpenses: [],
        ferryExpenses: [],
        fines: [{ id: 1, amount: 1500, fine_type: 'speeding', deducted_from_settlement: false }],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);
      // Expenses - Advances = 5000 - 8000 = -3000
      // Fines = 1500
      // Gross = 6000
      // Net payout = 6000 - 3000 - 1500 = 1500 MAD
      expect(result.expensesVsAdvancesBalance).toBe(-3000);
      expect(result.totalFinesToDeduct).toBe(1500);
      expect(result.netPayout).toBe(1500);
    });

    it('attributable flag is true for advances and fines, false for operational receipts', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 9,
        baseSalary: 4000,
        trips: [],
        advances: [{ id: 1, amount: 1000, date: '2026-10-01' }],
        fuelExpenses: [{ id: 2, amount: 500, date: '2026-10-02' }],
        tollExpenses: [],
        ferryExpenses: [],
        fines: [{ id: 3, amount: 200, fine_type: 'customs', deducted_from_settlement: false }],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);
      const advItem = result.itemizedExpenses.find((e) => e.category === 'advance');
      const fuelItem = result.itemizedExpenses.find((e) => e.category === 'fuel');
      const fineItem = result.itemizedExpenses.find((e) => e.category === 'fine');

      expect(advItem?.isAttributableToDriver).toBe(true);
      expect(fuelItem?.isAttributableToDriver).toBe(false);
      expect(fineItem?.isAttributableToDriver).toBe(true);
    });

    it('evaluates port and customs incidentals properly into total legitimate expenses', () => {
      const input: CalculateDriverSettlementInput = {
        driverId: 10,
        baseSalary: 5000,
        safetyScore: 80,
        trips: [],
        advances: [{ id: 1, amount: 5000, date: '2026-10-01' }],
        fuelExpenses: [],
        tollExpenses: [],
        ferryExpenses: [],
        portCustomsExpenses: [
          { id: 'pc-1', amount: 800, description: 'Marsa Maroc Terminal fee' },
          { id: 'pc-2', amount: 500, description: 'Triptik Carnet fee' },
        ],
        otherExpenses: [
          { id: 'oe-1', amount: 250, description: 'Truck sanitization phytosanitary certificate' },
        ],
        fines: [],
      };

      const result = FiscalSettlementsService.calculateDriverSettlement(input);
      // Total expenses: 800 + 500 + 250 = 1550
      expect(result.totalPortCustoms).toBe(1300);
      expect(result.totalOtherExpenses).toBe(250);
      expect(result.totalDriverExpenses).toBe(1550);
      // Balance: 1550 - 5000 = -3450
      expect(result.expensesVsAdvancesBalance).toBe(-3450);
      // Net payout: 5000 - 3450 = 1550
      expect(result.netPayout).toBe(1550);
    });
  });

  describe('generateStatementNumber', () => {
    it('generates consistent statement number with expected format', () => {
      const num = FiscalSettlementsService.generateStatementNumber(7, '2026-10-01');
      expect(num).toMatch(/^STMT-202610-D07-\d{4}$/);
    });

    it('generates unique references for different driver IDs and dates', () => {
      const num1 = FiscalSettlementsService.generateStatementNumber(12, '2026-11-15');
      const num2 = FiscalSettlementsService.generateStatementNumber(3, '2026-11-15');
      expect(num1).toMatch(/^STMT-202611-D12-\d{4}$/);
      expect(num2).toMatch(/^STMT-202611-D03-\d{4}$/);
      expect(num1).not.toBe(num2);
    });
  });
});
