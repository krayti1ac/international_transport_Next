import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeTruckTireWear,
  computeReeferHealth,
  computeEngineOilHealth,
  computeFleetPredictiveHealth,
} from '@/features/predictive/services/fleet-predictive.service';
import {
  evaluateColdChainTemperatureDrift,
  resetColdChainDriftTracking,
  getColdChainDriftState,
} from '@/features/predictive/services/cold-chain-monitor.service';
import {
  computeClientPaymentVelocities,
  computeCashFlowProjections,
} from '@/features/predictive/services/cashflow-predictive.service';
import { validateTripTransition } from '@/features/trips/services/trip-state-machine';
import type { Truck, Trailer, Invoice, Client, TreasuryTransaction, Driver, TripOrder } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';

// Mock External Alert Dispatchers
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/features/push/services/push-notifications.actions', () => ({
  sendCriticalFleetAlertPushNotification: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Epic 4: Predictive Analytics, Fleet Asset Health & Cold Chain Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetColdChainDriftTracking();
  });

  const mockTruck: Truck = {
    id: 101,
    plate_number: '12345-A-1',
    model: 'Volvo FH 500 Globetrotter',
    status: 'active',
    fuel_consumption_rate: 36.0,
    created_at: '2026-01-01',
  };

  const mockDriver: Driver = {
    id: 501,
    name: 'Mohamed Alami',
    phone: '0661000000',
    license: 'B-12345',
    status: 'active',
    has_valid_visa: true,
    base_salary: 5000,
    bonus_percentage: 10,
  };

  const mockTripOrder: TripOrder = {
    id: 801,
    route: 'Casablanca -> Algeciras',
    corridor_type: 'european_maritime',
    status: 'draft',
    price: 32000,
    departure_date: '2026-10-20',
    created_at: '2026-10-15',
  };

  // -------------------------------------------------------------------------
  // 4.1 Tire Wear Index (TWI Engine) & Hard Operational Lock
  // -------------------------------------------------------------------------
  describe('4.1 Tire Wear Index (TWI Engine) & State Machine Operational Lock', () => {
    it('applies corridor roughness factors: African (1.4), European (1.0), Domestic (1.1)', () => {
      const africanTrip: RawTripOrderWithRelations = {
        id: 1,
        truck_id: 101,
        route: 'Agadir -> Guerguerat -> Dakar',
        corridor_type: 'african_overland',
        road_distance_km: 2800,
        departure_date: '2026-09-01',
        status: 'completed',
        created_at: '2026-09-01',
        price: 45000,
      };

      const euroTrip: RawTripOrderWithRelations = {
        id: 2,
        truck_id: 101,
        route: 'Tanger Med -> Algeciras',
        corridor_type: 'european_maritime',
        road_distance_km: 1850,
        departure_date: '2026-09-10',
        status: 'completed',
        created_at: '2026-09-10',
        price: 25000,
      };

      const domesticTrip: RawTripOrderWithRelations = {
        id: 3,
        truck_id: 101,
        route: 'Casablanca -> Tanger Med',
        corridor_type: 'domestic',
        road_distance_km: 350,
        departure_date: '2026-09-15',
        status: 'completed',
        created_at: '2026-09-15',
        price: 8000,
      };

      const result = computeTruckTireWear(mockTruck, [africanTrip, euroTrip, domesticTrip]);

      // Accumulated: 2800 + 1850 + 350 = 5000 km
      expect(result.accumulatedKm).toBe(5000);
      // Weighted: (2800 * 1.4) + (1850 * 1.0) + (350 * 1.1) = 3920 + 1850 + 385 = 6155 km
      expect(result.weightedKm).toBe(6155);
      // TWI: (6155 / 120000) * 100 = 5.1%
      expect(result.twiPercentage).toBe(5.1);
      expect(result.status).toBe('normal');
      expect(result.allowedLongHaul).toBe(true);
    });

    it('prohibits long-haul international trips when TWI reaches >= 90%', () => {
      // 28 African trips of 2800 km: 28 * 2800 * 1.4 = 109,760 weighted km = 91.5% TWI
      const highMileageTrips: RawTripOrderWithRelations[] = Array.from({ length: 28 }, (_, i) => ({
        id: i + 10,
        truck_id: 101,
        route: 'Agadir -> Dakar',
        corridor_type: 'african_overland',
        road_distance_km: 2800,
        departure_date: '2026-07-01',
        status: 'completed',
        created_at: '2026-07-01',
        price: 45000,
      }));

      const twiResult = computeTruckTireWear(mockTruck, highMileageTrips);
      expect(twiResult.twiPercentage).toBeGreaterThanOrEqual(90);
      expect(twiResult.status).toBe('critical');
      expect(twiResult.allowedLongHaul).toBe(false);
      expect(twiResult.recommendedActionAr).toContain('حظر فوري');
    });

    it('blocks trip assignment in State Machine when truck TWI >= 90%', () => {
      // 1. Truck with safe TWI (<90%) passes transition guard
      const safeValidation = validateTripTransition('draft', 'assigned', {
        trip: mockTripOrder,
        driver: mockDriver,
        truck: mockTruck,
        truckTwiPercentage: 88.5,
      });
      expect(safeValidation.valid).toBe(true);

      // 2. Truck with critical TWI (>=90%) is HARD-LOCKED
      const blockedValidation = validateTripTransition('draft', 'assigned', {
        trip: mockTripOrder,
        driver: mockDriver,
        truck: mockTruck,
        truckTwiPercentage: 90.0,
      });

      expect(blockedValidation.valid).toBe(false);
      expect(blockedValidation.code).toBe('TRUCK_TIRE_WEAR_CRITICAL');
      expect(blockedValidation.error).toContain('حظر فوري لإسناد الشاحنة');
      expect(blockedValidation.error).toContain('90%');
    });
  });

  // -------------------------------------------------------------------------
  // 4.2 Reefer SDI & Cold Chain Drift Alarm Dispatch
  // -------------------------------------------------------------------------
  describe('4.2 Reefer SDI & Real-Time Cold Chain Drift Monitor', () => {
    const mockTrailer: Trailer = {
      id: 301,
      plate_number: 'REM-3322-MA',
      model: 'Carrier Vector 1550 Frigo Bi-Temp',
      status: 'active',
      created_at: '2026-01-01',
    };

    it('computes Reefer SDI based on 1,500 service hours and penalizes temperature drift events', () => {
      const trips: RawTripOrderWithRelations[] = [
        {
          id: 50,
          trailer_id: 301,
          route: 'Agadir -> Nouakchott',
          corridor_type: 'african_overland',
          road_distance_km: 2400,
          departure_date: '2026-09-01',
          status: 'completed',
          created_at: '2026-09-01',
          price: 45000,
        },
      ];

      // Hours: 2400 / 50 + 4 = 52 hours
      // Usage penalty: (52 / 1500) * 40 = 1.39 pts
      // Drift penalty: 3 events * 5 = 15 pts
      // Score: 100 - (1.39 + 15) = 83.61 -> 84
      const health = computeReeferHealth(mockTrailer, trips, 3);
      expect(health.engineHours).toBe(52);
      expect(health.tempDriftPenalty).toBe(15);
      expect(health.healthScore).toBe(84);
      expect(health.status).toBe('optimal');
    });

    it('does not dispatch alarm if temperature excursion is within safe 2°C threshold', async () => {
      const result = await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -17.5, // Target is -18.0°C (diff is 0.5°C <= 2.0°C)
        targetTemp: -18.0,
        timestampMs: 1000000,
        driverId: 501,
      });

      expect(result.isDrifting).toBe(false);
      expect(result.alertDispatched).toBe(false);
      expect(result.severity).toBe('normal');
      expect(getColdChainDriftState(101)).toBeUndefined();
    });

    it('flags excursion (>2°C) as warning when under 45 minutes and does not dispatch emergency alarm yet', async () => {
      const t0 = 1000000;
      // Target: -18°C, Current: -14°C (diff = 4°C > 2°C)
      const res1 = await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -14.0,
        targetTemp: -18.0,
        timestampMs: t0,
        driverId: 501,
      });

      expect(res1.isDrifting).toBe(true);
      expect(res1.driftDurationMinutes).toBe(0);
      expect(res1.alertDispatched).toBe(false);
      expect(res1.severity).toBe('warning');

      // 30 minutes later (still under 45 min)
      const t30 = t0 + 30 * 60 * 1000;
      const res2 = await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -13.5,
        targetTemp: -18.0,
        timestampMs: t30,
        driverId: 501,
      });

      expect(res2.isDrifting).toBe(true);
      expect(res2.driftDurationMinutes).toBe(30);
      expect(res2.alertDispatched).toBe(false);
      expect(res2.severity).toBe('warning');
    });

    it('dispatches critical Web Push & WhatsApp emergency alarms when excursion exceeds 45 minutes', async () => {
      const t0 = 1000000;
      // 1. Initial drift detection
      await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -14.0,
        targetTemp: -18.0,
        timestampMs: t0,
        driverId: 501,
        truckPlate: '12345-A-1',
        tripId: 801,
      });

      // 2. 46 minutes later (> 45 min threshold)
      const t46 = t0 + 46 * 60 * 1000;
      const criticalResult = await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -13.8,
        targetTemp: -18.0,
        timestampMs: t46,
        driverId: 501,
        truckPlate: '12345-A-1',
        tripId: 801,
      });

      expect(criticalResult.isDrifting).toBe(true);
      expect(criticalResult.driftDurationMinutes).toBe(46);
      expect(criticalResult.severity).toBe('critical');
      expect(criticalResult.alertDispatched).toBe(true);

      // Verify External Dispatches
      const { sendCriticalFleetAlertPushNotification } = await import(
        '@/features/push/services/push-notifications.actions'
      );
      const { sendWhatsAppCloudMessage } = await import('@/lib/whatsapp');
      const { recordAuditLog } = await import('@/lib/audit.server');

      expect(sendCriticalFleetAlertPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          driverId: 501,
          alertType: 'frigo_drift',
          message: expect.stringContaining('انحراف حرارة حاوية التبريد'),
        })
      );

      expect(sendWhatsAppCloudMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('انحراف حرارة سلسلة التبريد'),
        })
      );

      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'cold_chain',
          actionType: 'security_alert',
        })
      );
    });

    it('clears drift tracker and records recovery when temperature returns to safe boundary', async () => {
      const t0 = 1000000;
      // Trigger drift
      await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -13.0,
        targetTemp: -18.0,
        timestampMs: t0,
        driverId: 501,
      });

      // Trigger critical alarm at t46
      await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -13.0,
        targetTemp: -18.0,
        timestampMs: t0 + 46 * 60 * 1000,
        driverId: 501,
      });

      // Now frigo compressor engages and cools back down to -18.2°C
      const recoveredResult = await evaluateColdChainTemperatureDrift({
        truckId: 101,
        currentTemp: -18.2,
        targetTemp: -18.0,
        timestampMs: t0 + 60 * 60 * 1000,
        driverId: 501,
      });

      expect(recoveredResult.isDrifting).toBe(false);
      expect(recoveredResult.severity).toBe('normal');
      expect(getColdChainDriftState(101)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4.3 PVI & Cash Flow 30/60/90 Days Horizons with Decimal.js
  // -------------------------------------------------------------------------
  describe('4.3 Payment Velocity Index (PVI) & 30/60/90 Days Cash Flow Horizons', () => {
    const mockClients: Client[] = [
      { id: 1, name: 'AGRO EXPORT MAROC', ice: '123456789012345' } as unknown as Client,
      { id: 2, name: 'FRIGO ATLANTIC DAKAR', ice: '987654321098765' } as unknown as Client,
    ];

    it('calculates accurate PVI based on historical settlement lag', () => {
      const invoices: Invoice[] = [
        // Client 1 paid on time (due: Oct 1, settled: Oct 1 -> lag = 0)
        {
          id: 101,
          client_id: '1',
          invoice_number: 'INV-001',
          total_amount: '30000',
          paid_amount: '30000',
          currency: 'MAD',
          input_mode: 'manual',
          status: 'paid',
          due_date: '2026-10-01',
          created_at: '2026-09-01',
        },
        // Client 2 delayed by 20 days (due: Oct 1, settled: Oct 21 -> lag = +20)
        {
          id: 102,
          client_id: '2',
          invoice_number: 'INV-002',
          total_amount: '50000',
          paid_amount: '50000',
          currency: 'MAD',
          input_mode: 'manual',
          status: 'paid',
          due_date: '2026-10-01',
          created_at: '2026-09-01',
        },
      ];

      const allocations = [
        { payment_id: 1, invoice_id: 101, allocated_amount: 30000, created_at: '2026-10-01T10:00:00Z' },
        { payment_id: 2, invoice_id: 102, allocated_amount: 50000, created_at: '2026-10-21T10:00:00Z' },
      ];

      const velocities = computeClientPaymentVelocities(mockClients, invoices, allocations);

      const client1 = velocities.find((v) => String(v.clientId) === '1');
      const client2 = velocities.find((v) => String(v.clientId) === '2');

      expect(client1?.averageDelayDays).toBe(0);
      expect(client1?.reliabilityRating).toBe('A');

      expect(client2?.averageDelayDays).toBe(20);
      expect(client2?.reliabilityRating).toBe('C'); // > 15 days delay = Grade C
    });

    it('projects cash flows strictly using Decimal.js across 30, 60, and 90 day horizons', () => {
      const currentTreasury: TreasuryTransaction[] = [
        {
          id: 1,
          type: 'capital_injection',
          amount: 150000,
          currency: 'MAD',
          description: 'Capital Injection',
          reconciliation_status: 'reconciled',
          created_at: '2026-10-01',
        },
      ];

      const unpaidInvoices: Invoice[] = [
        {
          id: 201,
          client_id: '1',
          invoice_number: 'INV-UNPAID-01',
          total_amount: '60000',
          paid_amount: '0',
          currency: 'MAD',
          input_mode: 'manual',
          status: 'issued',
          due_date: new Date(Date.now() + 15 * 86400000).toISOString(), // in 15 days
        },
      ];

      const clientVelocities = [
        {
          clientId: 1,
          clientName: 'AGRO EXPORT MAROC',
          totalPaidInvoices: 5,
          averageDelayDays: 0, // Prompt payer
          reliabilityRating: 'A' as const,
          unpaidInvoicesCount: 1,
          totalOutstandingMad: '60000.00',
          totalOutstandingEur: '0.00',
        },
      ];

      const projections = computeCashFlowProjections(
        currentTreasury,
        unpaidInvoices,
        clientVelocities,
        []
      );

      expect(projections.length).toBe(3);
      const day30 = projections.find((p) => p.horizonDays === 30);
      const day60 = projections.find((p) => p.horizonDays === 60);
      const day90 = projections.find((p) => p.horizonDays === 90);

      expect(day30).toBeDefined();
      expect(day60).toBeDefined();
      expect(day90).toBeDefined();

      // Liquid cash starts at 150,000.00 MAD
      expect(day30?.currentLiquidCashMad).toBe('150000.00');
      // Inbound: 60,000.00 MAD falls within 30 days
      expect(day30?.projectedInboundMad).toBe('60000.00');
      // Outbound: (35k fuel + 18k ferry + 22k allowances) = 75,000.00 MAD
      expect(day30?.projectedOutboundMad).toBe('75000.00');
      // Net: 150k + 60k - 75k = 135,000.00 MAD
      expect(day30?.projectedNetCashMad).toBe('135000.00');
      expect(day30?.liquidityStatus).toBe('balanced');
    });
  });
});

