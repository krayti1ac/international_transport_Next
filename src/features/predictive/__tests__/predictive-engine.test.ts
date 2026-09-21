import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeTruckTireWear,
  computeReeferHealth,
  computeEngineOilHealth,
  computeFleetPredictiveHealth,
} from '../services/fleet-predictive.service';
import {
  computeClientPaymentVelocities,
  computeCashFlowProjections,
} from '../services/cashflow-predictive.service';
import type { Truck, Trailer, Invoice, Client, TreasuryTransaction } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';

describe('Predictive AI Engine — Fleet Asset Health & Cash Flow Forecasting', () => {
  const mockTruckA: Truck = {
    id: 101,
    plate_number: '10101-A-40',
    model: 'Volvo FH 540',
    status: 'active',
    fuel_consumption_rate: 36.0,
    created_at: '2026-01-01',
  };

  const mockTruckB: Truck = {
    id: 102,
    plate_number: '20202-B-40',
    model: 'Scania R500',
    status: 'active',
    fuel_consumption_rate: 39.6, // High fuel burn (+10%)
    created_at: '2026-01-01',
  };

  const mockTrailerFrigo: Trailer = {
    id: 201,
    plate_number: 'REM-1001-MA',
    model: 'Schmitz Cargobull Frigo (Thermo King)',
    status: 'active',
    created_at: '2026-01-01',
  };

  // 1. Tire Wear Index (TWI) with Corridor Weighting
  describe('1. Tire Wear Index (TWI)', () => {
    it('applies corridor stress multiplier (1.4x for African Overland, 1.0x for European Maritime)', () => {
      const trips: RawTripOrderWithRelations[] = [
        {
          id: 1,
          truck_id: 101,
          route: 'Tanger Med -> Algeciras',
          corridor_type: 'european_maritime',
          road_distance_km: 1850,
          departure_date: '2026-09-01',
          status: 'completed',
          created_at: '2026-09-01',
          price: 25000,
        },
        {
          id: 2,
          truck_id: 101,
          route: 'Agadir -> Dakar',
          corridor_type: 'african_overland',
          road_distance_km: 2800,
          departure_date: '2026-09-10',
          status: 'completed',
          created_at: '2026-09-10',
          price: 45000,
        },
      ];

      const result = computeTruckTireWear(mockTruckA, trips);

      // Accumulated km = 1850 + 2800 = 4650 km
      expect(result.accumulatedKm).toBe(4650);
      // Weighted km = (1850 * 1.0) + (2800 * 1.4) = 1850 + 3920 = 5770 km
      expect(result.weightedKm).toBe(5770);
      // TWI % = (5770 / 120000) * 100 = 4.8%
      expect(result.twiPercentage).toBe(4.8);
      expect(result.status).toBe('normal');
      expect(result.allowedLongHaul).toBe(true);
    });

    it('triggers critical alert and blocks long haul when TWI reaches >= 90%', () => {
      // 28 African trips * 2800 km * 1.4 = 109,760 weighted km (91.5% of 120,000)
      const heavyTrips: RawTripOrderWithRelations[] = Array.from({ length: 28 }, (_, i) => ({
        id: i + 10,
        truck_id: 101,
        route: 'Agadir -> Dakar',
        corridor_type: 'african_overland' as const,
        road_distance_km: 2800,
        departure_date: '2026-08-01',
        status: 'completed',
        created_at: '2026-08-01',
        price: 45000,
      }));

      const result = computeTruckTireWear(mockTruckA, heavyTrips);
      expect(result.twiPercentage).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe('critical');
      expect(result.allowedLongHaul).toBe(false);
      expect(result.recommendedActionAr).toContain('حظر فوري للمسافات الطويلة');
    });
  });

  // 2. Reefer Health Score (Frigo SDI)
  describe('2. Reefer Health Score (Frigo SDI)', () => {
    it('computes cooling degradation and penalties for temperature drift events', () => {
      const trips: RawTripOrderWithRelations[] = [
        {
          id: 301,
          trailer_id: 201,
          route: 'Agadir -> Dakar',
          corridor_type: 'african_overland',
          road_distance_km: 2800,
          departure_date: '2026-09-15',
          status: 'completed',
          created_at: '2026-09-15',
          price: 45000,
        },
      ];

      // Hours: 2800 / 50 + 4 = 60 hours
      // Usage degradation: (60 / 1500) * 40 = 1.6
      // Drift penalty: 2 events * 5 = 10
      // Score: 100 - (1.6 + 10) = 88.4 -> 88
      const result = computeReeferHealth(mockTrailerFrigo, trips, 2);
      expect(result.engineHours).toBe(60);
      expect(result.tempDriftPenalty).toBe(10);
      expect(result.healthScore).toBe(88);
      expect(result.status).toBe('optimal');
    });

    it('classifies reefer as high_risk if health score falls below 50', () => {
      // 40 trips * 60h = 2400 hours -> (2400/1500)*40 = 64% degradation + 6 drifts (30 pts) = 94 pts penalty
      const heavyTrips: RawTripOrderWithRelations[] = Array.from({ length: 40 }, (_, i) => ({
        id: i + 500,
        trailer_id: 201,
        route: 'Agadir -> Dakar',
        corridor_type: 'african_overland' as const,
        road_distance_km: 2800,
        departure_date: '2026-05-01',
        status: 'completed',
        created_at: '2026-05-01',
        price: 45000,
      }));

      const result = computeReeferHealth(mockTrailerFrigo, heavyTrips, 6);
      expect(result.healthScore).toBeLessThan(50);
      expect(result.status).toBe('high_risk');
      expect(result.recommendedActionAr).toContain('خطر تدهور شحنة التبريد');
    });
  });

  // 3. Engine Oil Degradation Adjusted by Fuel Burn
  describe('3. Engine Oil Degradation', () => {
    it('compresses service interval when truck burns fuel above baseline', () => {
      // mockTruckB has fuel_consumption_rate: 39.6 L/100km (factor = 39.6 / 36 = 1.1)
      // Effective interval: 40,000 / 1.1 = 36,364 km
      const trips: RawTripOrderWithRelations[] = [
        {
          id: 401,
          truck_id: 102,
          route: 'Agadir -> Dakar',
          corridor_type: 'african_overland',
          road_distance_km: 28000,
          departure_date: '2026-09-01',
          status: 'completed',
          created_at: '2026-09-01',
          price: 450000,
        },
      ];

      const result = computeEngineOilHealth(mockTruckB, trips);
      expect(result.fuelBurnFactor).toBe(1.1);
      expect(result.effectiveIntervalKm).toBe(36364);
      // Degradation: (28000 / 36363.63) * 100 = 77.0%
      expect(result.degradationPercentage).toBe(77);
      expect(result.status).toBe('due_soon');
    });
  });

  // 4. Payment Velocity Index (PVI) & Client Reliability
  describe('4. Payment Velocity Index (PVI)', () => {
    const clients: Client[] = [
      { id: 1, name: 'FRIGO ATLANTIC AGADIR' } as Client,
      { id: 2, name: 'DAKAR LOGISTICS HUB SN' } as Client,
    ];

    const invoices: Invoice[] = [
      // Client 1 paid on time (PVI <= 0)
      {
        id: 10,
        client_id: '1',
        invoice_number: 'INV-10',
        total_amount: '45000.00',
        paid_amount: '45000.00',
        status: 'paid',
        due_date: '2026-09-15',
        created_at: '2026-09-14',
        currency: 'MAD',
        input_mode: 'manual',
      },
      // Client 2 paid with 20 days delay (PVI > 15)
      {
        id: 20,
        client_id: '2',
        invoice_number: 'INV-20',
        total_amount: '35000.00',
        paid_amount: '35000.00',
        status: 'paid',
        due_date: '2026-08-10',
        created_at: '2026-08-30', // 20 days late
        currency: 'MAD',
        input_mode: 'manual',
      },
    ];

    it('assigns Grade A to punctual payers and Grade C to delayed payers', () => {
      const velocities = computeClientPaymentVelocities(clients, invoices);
      const c1 = velocities.find((v) => String(v.clientId) === '1');
      const c2 = velocities.find((v) => String(v.clientId) === '2');

      expect(c1).toBeDefined();
      expect(c1?.averageDelayDays).toBeLessThanOrEqual(0);
      expect(c1?.reliabilityRating).toBe('A');

      expect(c2).toBeDefined();
      expect(c2?.averageDelayDays).toBe(20);
      expect(c2?.reliabilityRating).toBe('C');
    });
  });

  // 5. 30 / 60 / 90 Days Cash Flow Projection
  describe('5. Cash Flow Projections (Decimal.js)', () => {
    const treasury: TreasuryTransaction[] = [
      {
        id: 1,
        type: 'capital_injection',
        amount: 500000,
        currency: 'MAD',
        created_at: '2026-09-01',
      } as TreasuryTransaction,
    ];

    const openInvoices: Invoice[] = [
      {
        id: 101,
        client_id: '1',
        invoice_number: 'INV-101',
        total_amount: '100000.00',
        paid_amount: '0.00',
        status: 'sent',
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], // 15 days ahead
        currency: 'MAD',
        input_mode: 'manual',
      },
    ];

    const velocities = [
      {
        clientId: '1',
        clientName: 'FRIGO ATLANTIC',
        totalPaidInvoices: 1,
        averageDelayDays: 0,
        reliabilityRating: 'A' as const,
        unpaidInvoicesCount: 1,
        totalOutstandingMad: '100000.00',
        totalOutstandingEur: '0.00',
      },
    ];

    it('computes projected liquid cash correctly without floating point errors', () => {
      const projections = computeCashFlowProjections(treasury, openInvoices, velocities);

      expect(projections).toHaveLength(3);
      const day30 = projections.find((p) => p.horizonDays === 30);
      const day60 = projections.find((p) => p.horizonDays === 60);

      expect(day30).toBeDefined();
      expect(day30?.currentLiquidCashMad).toBe('500000.00');
      // Inbound = 100,000.00 MAD
      expect(day30?.projectedInboundMad).toBe('100000.00');
      // Net cash must be exact decimal string
      expect(new Decimal(day30!.projectedNetCashMad).toNumber()).toBeGreaterThan(0);
      expect(day30?.liquidityStatus).toBe('surplus');
    });
  });
});

