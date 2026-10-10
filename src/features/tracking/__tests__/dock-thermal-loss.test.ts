/**
 * Trans Bodanon TMS — Unloading Dock Door Open Duration & Thermal Loss Tracker Unit Tests
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Agreement (FRC)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { DockThermalLossService } from '../services/dock-thermal-loss.service';
import {
  attachThermalAnnexToEpodAction,
  logDockDoorCycleAction,
  queryDockThermalLossAnnexesAction,
} from '../services/dock-thermal-loss.actions';
import {
  attachThermalAnnexToEpodSchema,
  logDockDoorCycleSchema,
} from '../types/thermal-loss-tracker.types';

// Mock Supabase server and audit log
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })
  ),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Trans Bodanon TMS — Unloading Dock Door Open Duration & Thermal Loss Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Decimal.js Calculations & Metrics Computation', () => {
    it('calculates duration, delta T, and rise rate correctly for normal door cycle', () => {
      const openTime = '2026-10-10T10:00:00.000Z';
      const closeTime = '2026-10-10T10:12:00.000Z'; // 12 minutes

      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: openTime,
        doorCloseTimestamp: closeTime,
        tempAtOpenC: 3.0,
        tempAtCloseC: 4.5,
        ambientTempC: 25.0,
        maxAllowedTempC: 6.0,
      });

      expect(metrics.durationMinutes).toBe(12.0);
      expect(metrics.tempRiseDeltaC).toBe(1.5); // 4.5 - 3.0
      expect(metrics.thermalRiseRatePerMin).toBe(0.125); // 1.5 / 12
      expect(metrics.mktEstimatedImpactC).toBe(0); // within max allowed temp
    });

    it('calculates MKT impact elevation when temperature exceeds product threshold', () => {
      const openTime = '2026-10-10T10:00:00.000Z';
      const closeTime = '2026-10-10T10:30:00.000Z'; // 30 minutes

      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: openTime,
        doorCloseTimestamp: closeTime,
        tempAtOpenC: 3.5,
        tempAtCloseC: 8.5, // 2.5°C over 6.0°C limit
        ambientTempC: 28.0,
        maxAllowedTempC: 6.0,
      });

      expect(metrics.durationMinutes).toBe(30.0);
      expect(metrics.tempRiseDeltaC).toBe(5.0);
      // excess = 2.5, durationHours = 0.5, impact = (2.5 * 0.5) / 4 = 0.3125 -> 0.31
      expect(metrics.mktEstimatedImpactC).toBeGreaterThan(0.3);
      expect(metrics.mktEstimatedImpactC).toBeLessThan(0.35);
    });

    it('simulates heat ingress accurately when close temperature is omitted', () => {
      const openTime = '2026-10-10T10:00:00.000Z';
      const closeTime = '2026-10-10T10:15:00.000Z'; // 15 mins

      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: openTime,
        doorCloseTimestamp: closeTime,
        tempAtOpenC: 2.0,
        ambientTempC: 22.0,
        maxAllowedTempC: 6.0,
      });

      expect(metrics.tempAtCloseC).toBeGreaterThan(metrics.tempAtOpenC);
      expect(metrics.tempRiseDeltaC).toBeGreaterThan(0);
    });
  });

  describe('2. Incident Classification Standards (EN 12830 / GDP)', () => {
    it('classifies cycle as normal when under 15 minutes and delta T <= 2.0°C', () => {
      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:10:00.000Z',
        tempAtOpenC: 3.0,
        tempAtCloseC: 4.2,
        ambientTempC: 24.0,
        maxAllowedTempC: 6.0,
      });

      const classification = DockThermalLossService.classifyIncident(metrics);
      expect(classification).toBe('normal');
    });

    it('classifies cycle as warning when duration is between 15-30 minutes', () => {
      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:22:00.000Z', // 22 mins
        tempAtOpenC: 3.0,
        tempAtCloseC: 5.5,
        ambientTempC: 24.0,
        maxAllowedTempC: 6.0,
      });

      const classification = DockThermalLossService.classifyIncident(metrics);
      expect(classification).toBe('warning');
    });

    it('classifies cycle as critical when duration exceeds 30 minutes', () => {
      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:35:00.000Z', // 35 mins
        tempAtOpenC: 3.0,
        tempAtCloseC: 7.5,
        ambientTempC: 26.0,
        maxAllowedTempC: 6.0,
      });

      const classification = DockThermalLossService.classifyIncident(metrics);
      expect(classification).toBe('critical');
    });

    it('classifies cycle as critical when delta T exceeds 5.0°C even under 30 minutes', () => {
      const metrics = DockThermalLossService.calculateDoorCycleMetrics({
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:14:00.000Z', // 14 mins
        tempAtOpenC: 2.0,
        tempAtCloseC: 7.5, // +5.5°C rise
        ambientTempC: 32.0,
        maxAllowedTempC: 6.0,
      });

      const classification = DockThermalLossService.classifyIncident(metrics);
      expect(classification).toBe('critical');
    });
  });

  describe('3. HMAC-SHA256 Cryptographic Seal Integrity', () => {
    it('generates a 64-character hexadecimal signature seal', () => {
      const seal = DockThermalLossService.generateCryptographicSeal({
        annexId: 'ANNEX-8840-TEST',
        tripId: 8840,
        truckId: 101,
        dockId: 'DOCK-MAD-04',
        compartment: 'C1',
        durationMinutes: 25.0,
        tempRiseDeltaC: 3.5,
        incidentLevel: 'warning',
        timestamp: '2026-10-10T12:00:00.000Z',
      });

      expect(typeof seal).toBe('string');
      expect(seal).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(seal)).toBe(true);
    });

    it('produces deterministic output for identical input values', () => {
      const params = {
        annexId: 'ANNEX-8840-IDENTICAL',
        tripId: 8840,
        truckId: 101,
        dockId: 'DOCK-MAD-04',
        compartment: 'C1',
        durationMinutes: 20.0,
        tempRiseDeltaC: 2.8,
        incidentLevel: 'warning',
        timestamp: '2026-10-10T12:00:00.000Z',
      };

      const seal1 = DockThermalLossService.generateCryptographicSeal(params);
      const seal2 = DockThermalLossService.generateCryptographicSeal(params);
      expect(seal1).toBe(seal2);
    });

    it('changes completely when any parameter is altered', () => {
      const params = {
        annexId: 'ANNEX-8840-IDENTICAL',
        tripId: 8840,
        truckId: 101,
        dockId: 'DOCK-MAD-04',
        compartment: 'C1',
        durationMinutes: 20.0,
        tempRiseDeltaC: 2.8,
        incidentLevel: 'warning',
        timestamp: '2026-10-10T12:00:00.000Z',
      };

      const seal1 = DockThermalLossService.generateCryptographicSeal(params);
      const seal2 = DockThermalLossService.generateCryptographicSeal({
        ...params,
        durationMinutes: 20.1, // Slight change
      });
      expect(seal1).not.toBe(seal2);
    });
  });

  describe('4. Process Dock Door Cycle & Annex Generation', () => {
    it('creates an e-POD Annex with status draft when warning or critical threshold is reached', async () => {
      const annex = await DockThermalLossService.processDockDoorCycle({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        compartment: 'C1',
        cargoCategory: 'fresh_produce',
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:25:00.000Z', // 25 mins -> warning
        tempAtOpenC: 3.2,
        tempAtCloseC: 6.8,
        ambientTempC: 26.0,
        maxAllowedTempC: 6.0,
        receiverName: 'Carlos Gomez',
      });

      expect(annex.annexId).toBeDefined();
      expect(annex.annexRequired).toBe(true);
      expect(annex.incidentLevel).toBe('warning');
      expect(annex.status).toBe('draft');
      expect(annex.cryptographicSeal).toHaveLength(64);
    });

    it('attaches digital signatures and sets status to annex_attached', async () => {
      const annex = await DockThermalLossService.attachSignaturesToAnnex({
        annexId: 'ANNEX-TEST-SIGN',
        tripId: 8840,
        receiverSignature: 'data:image/png;base64,sampleReceiverSignature',
        driverSignature: 'data:image/png;base64,sampleDriverSignature',
        receiverName: 'Carlos Gomez (Mercamadrid)',
      });

      expect(annex.status).toBe('annex_attached');
      expect(annex.receiverSignature).toBeDefined();
      expect(annex.driverSignature).toBeDefined();
      expect(annex.receiverName).toBe('Carlos Gomez (Mercamadrid)');
    });
  });

  describe('5. Zod Schema Validation', () => {
    it('validates correct log dock door cycle schema', () => {
      const valid = logDockDoorCycleSchema.safeParse({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        compartment: 'C1',
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        tempAtOpenC: 3.5,
      });

      expect(valid.success).toBe(true);
    });

    it('rejects attach signature schema when signature strings are too short', () => {
      const invalid = attachThermalAnnexToEpodSchema.safeParse({
        annexId: 'ANNEX-123',
        tripId: 8840,
        receiverSignature: 'short', // Minimum 10 chars
        driverSignature: 'data:image/png;base64,sampleDriverSignature',
        receiverName: 'Carlos Gomez',
      });

      expect(invalid.success).toBe(false);
    });
  });

  describe('6. Server Actions Execution', () => {
    it('executes logDockDoorCycleAction successfully', async () => {
      const res = await logDockDoorCycleAction({
        tripId: 8840,
        tripNumber: 'TRIP-2026-8840',
        truckId: 101,
        truckPlate: '67890-A-40',
        driverId: 105,
        driverName: 'Mohamed El Idrissi',
        dockId: 'DOCK-MAD-04',
        dockName: 'Mercamadrid Hall 4 Frigo',
        facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
        compartment: 'C1',
        cargoCategory: 'fresh_produce',
        doorOpenTimestamp: '2026-10-10T10:00:00.000Z',
        doorCloseTimestamp: '2026-10-10T10:18:00.000Z',
        tempAtOpenC: 3.2,
        tempAtCloseC: 5.6,
        ambientTempC: 25.0,
        maxAllowedTempC: 6.0,
        receiverName: 'Carlos Gomez',
      });

      expect(res.success).toBe(true);
      expect(res.data?.annexId).toBeDefined();
    });

    it('executes attachThermalAnnexToEpodAction successfully', async () => {
      const res = await attachThermalAnnexToEpodAction({
        annexId: 'ANNEX-TEST-ACTION',
        tripId: 8840,
        receiverSignature: 'data:image/png;base64,validReceiverSignatureLongEnough',
        driverSignature: 'data:image/png;base64,validDriverSignatureLongEnough',
        receiverName: 'Carlos Gomez',
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('annex_attached');
    });

    it('executes queryDockThermalLossAnnexesAction successfully', async () => {
      const res = await queryDockThermalLossAnnexesAction({ limit: 10 });
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data?.items)).toBe(true);
      expect(res.data?.totalCount).toBeGreaterThanOrEqual(1);
    });
  });
});

