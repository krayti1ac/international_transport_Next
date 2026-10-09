import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { MultiTempGuardService } from '../services/multi-temp-guard.service';
import {
  createCompartmentProfileSchema,
  recordCompartmentTelemetrySchema,
  resolveBulkheadAlertSchema,
} from '../types/multi-temp.types';
import type {
  ReeferCompartmentProfile,
  ReeferCompartmentTelemetryLog,
  ReeferCrossBulkheadAlert,
} from '../types/multi-temp.types';

describe('Multi-Temp & Multi-Compartment Reefer Telematics Engine (EN 12830 / ATP)', () => {
  describe('1. Compartment MKT Calculation (Arrhenius Equation)', () => {
    it('returns exact value for single temperature reading', () => {
      const mkt = MultiTempGuardService.calculateCompartmentMkt([4.0]);
      expect(mkt).toBe(4.0);
    });

    it('calculates MKT accurately weighting temperature spikes higher than arithmetic mean', () => {
      // 4 readings: 4.0, 4.0, 4.0, and a spike to 12.0
      // Arithmetic average = 6.0
      // MKT will be higher than 6.0 because of the Arrhenius non-linear weighting
      const temps = [4.0, 4.0, 4.0, 12.0];
      const mkt = MultiTempGuardService.calculateCompartmentMkt(temps);
      expect(mkt).toBeGreaterThan(6.0);
      expect(mkt).toBeLessThan(12.0);
    });

    it('handles negative temperatures in deep freeze compartment (-20°C)', () => {
      const frozenTemps = [-20.0, -19.5, -20.2, -18.8];
      const mkt = MultiTempGuardService.calculateCompartmentMkt(frozenTemps);
      expect(mkt).toBeGreaterThanOrEqual(-20.5);
      expect(mkt).toBeLessThanOrEqual(-18.5);
    });

    it('handles empty temperature array gracefully', () => {
      const mkt = MultiTempGuardService.calculateCompartmentMkt([]);
      expect(mkt).toBe(0);
    });
  });

  describe('2. Cross-Bulkhead Thermal Leakage Detection', () => {
    const baseSourceProfile: ReeferCompartmentProfile = {
      id: 'comp-c1',
      companyId: 1,
      trailerId: 101,
      configurationType: 'bi_temp',
      compartmentCode: 'C1',
      compartmentName: 'Front Deep Freeze',
      cargoCategory: 'deep_frozen',
      setpointTempC: -20.0,
      minTempLimitC: -25.0,
      maxTempLimitC: -18.0,
      hasSideDoor: false,
      hasRearDoor: false,
      bulkheadPositionPct: 50,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const baseAdjacentProfile: ReeferCompartmentProfile = {
      id: 'comp-c2',
      companyId: 1,
      trailerId: 101,
      configurationType: 'bi_temp',
      compartmentCode: 'C2',
      compartmentName: 'Rear Fresh Produce',
      cargoCategory: 'fresh_produce',
      setpointTempC: 4.0,
      minTempLimitC: 2.0,
      maxTempLimitC: 6.0,
      hasSideDoor: true,
      hasRearDoor: true,
      bulkheadPositionPct: 50,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('returns null when temperatures are stable across the bulkhead', () => {
      const now = Date.now();
      const sourceLogs: ReeferCompartmentTelemetryLog[] = [
        {
          id: '1',
          companyId: 1,
          compartmentId: 'comp-c1',
          trailerId: 101,
          supplyAirTempC: -22.5,
          returnAirTempC: -19.8,
          cargoProbeTempC: -20.0,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
        {
          id: '2',
          companyId: 1,
          compartmentId: 'comp-c1',
          trailerId: 101,
          supplyAirTempC: -22.4,
          returnAirTempC: -20.0,
          cargoProbeTempC: -20.1,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now - 3600 * 1000).toISOString(),
          createdAt: new Date(now - 3600 * 1000).toISOString(),
        },
      ];

      const adjLogs: ReeferCompartmentTelemetryLog[] = [
        {
          id: '3',
          companyId: 1,
          compartmentId: 'comp-c2',
          trailerId: 101,
          supplyAirTempC: 3.0,
          returnAirTempC: 4.2,
          cargoProbeTempC: 4.0,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
      ];

      const alert = MultiTempGuardService.evaluateCrossBulkheadIntegrity({
        sourceProfile: baseSourceProfile,
        adjacentProfile: baseAdjacentProfile,
        sourceLogs,
        adjacentLogs: adjLogs,
      });

      expect(alert).toBeNull();
    });

    it('detects cross-bulkhead thermal breach when cold compartment rises rapidly with closed doors', () => {
      const now = Date.now();
      // Cold compartment rose from -20°C to -18°C in 1 hour -> +2.0°C/hr rise rate
      const sourceLogs: ReeferCompartmentTelemetryLog[] = [
        {
          id: '1',
          companyId: 1,
          compartmentId: 'comp-c1',
          trailerId: 101,
          supplyAirTempC: -17.0,
          returnAirTempC: -18.0,
          cargoProbeTempC: -18.5,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
        {
          id: '2',
          companyId: 1,
          compartmentId: 'comp-c1',
          trailerId: 101,
          supplyAirTempC: -22.5,
          returnAirTempC: -20.0,
          cargoProbeTempC: -20.0,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now - 3600 * 1000).toISOString(),
          createdAt: new Date(now - 3600 * 1000).toISOString(),
        },
      ];

      const adjLogs: ReeferCompartmentTelemetryLog[] = [
        {
          id: '3',
          companyId: 1,
          compartmentId: 'comp-c2',
          trailerId: 101,
          supplyAirTempC: 3.5,
          returnAirTempC: 4.5,
          cargoProbeTempC: 4.2,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        },
      ];

      const alert = MultiTempGuardService.evaluateCrossBulkheadIntegrity({
        sourceProfile: baseSourceProfile,
        adjacentProfile: baseAdjacentProfile,
        sourceLogs,
        adjacentLogs: adjLogs,
      });

      expect(alert).not.toBeNull();
      expect(alert?.deltaTC).toBe(22.5); // |-18 - 4.5| = 22.5°C
      expect(alert?.leakageRateCPerHr).toBeGreaterThanOrEqual(1.8);
      expect(alert?.severity).toBe('high');
      expect(alert?.description).toContain('Cross-bulkhead thermal breach');
    });
  });

  describe('3. Compartment Audit & Excursions', () => {
    it('audits compliant compartment with zero excursions', () => {
      const profile: ReeferCompartmentProfile = {
        id: 'comp-1',
        companyId: 1,
        trailerId: 101,
        configurationType: 'bi_temp',
        compartmentCode: 'C2',
        compartmentName: 'Rear Fresh Produce',
        cargoCategory: 'fresh_produce',
        setpointTempC: 4.0,
        minTempLimitC: 2.0,
        maxTempLimitC: 6.0,
        hasSideDoor: true,
        hasRearDoor: true,
        bulkheadPositionPct: 50,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const logs: ReeferCompartmentTelemetryLog[] = [
        {
          id: '1',
          companyId: 1,
          compartmentId: 'comp-1',
          trailerId: 101,
          supplyAirTempC: 2.5,
          returnAirTempC: 4.2,
          cargoProbeTempC: 4.0,
          evaporatorMode: 'cooling',
          doorOpen: false,
          doorType: 'none',
          isExcursion: false,
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      const audit = MultiTempGuardService.auditCompartment(profile, logs);
      expect(audit.isCompliant).toBe(true);
      expect(audit.status).toBe('compliant');
      expect(audit.excursionMinutes).toBe(0);
      expect(audit.doorOpenCount).toBe(0);
    });

    it('flags breached compartment when excursions exceed allowed limits', () => {
      const profile: ReeferCompartmentProfile = {
        id: 'comp-1',
        companyId: 1,
        trailerId: 101,
        configurationType: 'bi_temp',
        compartmentCode: 'C1',
        compartmentName: 'Deep Freeze',
        cargoCategory: 'deep_frozen',
        setpointTempC: -20.0,
        minTempLimitC: -25.0,
        maxTempLimitC: -18.0,
        hasSideDoor: false,
        hasRearDoor: false,
        bulkheadPositionPct: 50,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 7 logs of excursion (7 * 10 mins = 70 mins > 60 mins)
      const logs: ReeferCompartmentTelemetryLog[] = Array.from({ length: 7 }, (_, i) => ({
        id: `l-${i}`,
        companyId: 1,
        compartmentId: 'comp-1',
        trailerId: 101,
        supplyAirTempC: -12.0,
        returnAirTempC: -14.0, // Above max -18.0°C!
        cargoProbeTempC: -15.0,
        evaporatorMode: 'cooling',
        doorOpen: false,
        doorType: 'none',
        isExcursion: true,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }));

      const audit = MultiTempGuardService.auditCompartment(profile, logs);
      expect(audit.isCompliant).toBe(false);
      expect(audit.status).toBe('breached');
      expect(audit.excursionMinutes).toBe(70);
    });
  });

  describe('4. Trailer Matrix Aggregation & Bulkhead Integrity', () => {
    it('aggregates multi-temp summary and deducts integrity score for active alerts', () => {
      const profiles: ReeferCompartmentProfile[] = [
        {
          id: 'p1',
          companyId: 1,
          trailerId: 101,
          configurationType: 'bi_temp',
          compartmentCode: 'C1',
          compartmentName: 'Front',
          cargoCategory: 'deep_frozen',
          setpointTempC: -20,
          minTempLimitC: -25,
          maxTempLimitC: -18,
          hasSideDoor: false,
          hasRearDoor: false,
          bulkheadPositionPct: 50,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'p2',
          companyId: 1,
          trailerId: 101,
          configurationType: 'bi_temp',
          compartmentCode: 'C2',
          compartmentName: 'Rear',
          cargoCategory: 'fresh_produce',
          setpointTempC: 4,
          minTempLimitC: 2,
          maxTempLimitC: 6,
          hasSideDoor: true,
          hasRearDoor: true,
          bulkheadPositionPct: 50,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const alerts: ReeferCrossBulkheadAlert[] = [
        {
          id: 'alt-1',
          companyId: 1,
          trailerId: 101,
          sourceCompartmentCode: 'C1',
          adjacentCompartmentCode: 'C2',
          deltaTC: 24,
          leakageRateCPerHr: 2.1,
          severity: 'high',
          description: 'Bulkhead leak',
          recommendedAction: 'Check seals',
          isResolved: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const summary = MultiTempGuardService.aggregateTrailerMatrix({
        trailerId: 101,
        trailerPlate: 'REM-101',
        profiles,
        logsByCompartment: {
          p1: [],
          p2: [],
        },
        alerts,
      });

      expect(summary.totalCompartments).toBe(2);
      expect(summary.configurationType).toBe('bi_temp');
      expect(summary.activeBulkheadAlertsCount).toBe(1);
      // Starts at 100%, high severity penalty is 25% -> 75%
      expect(summary.bulkheadIntegrityScore).toBe(75);
      expect(summary.overallStatus).toBe('warning');
    });
  });

  describe('5. Zod Schema Validations', () => {
    it('validates correct compartment profile input', () => {
      const valid = {
        trailerId: 12,
        configurationType: 'bi_temp',
        compartmentCode: 'C1',
        compartmentName: 'Front Deep Freeze',
        cargoCategory: 'deep_frozen',
        setpointTempC: -20.0,
        minTempLimitC: -25.0,
        maxTempLimitC: -18.0,
        hasSideDoor: false,
        hasRearDoor: false,
        bulkheadPositionPct: 50,
      };

      const parsed = createCompartmentProfileSchema.parse(valid);
      expect(parsed.trailerId).toBe(12);
      expect(parsed.compartmentCode).toBe('C1');
      expect(parsed.bulkheadPositionPct).toBe(50);
    });

    it('validates telemetry input and rejects invalid compartment UUID', () => {
      const valid = {
        compartmentId: '123e4567-e89b-12d3-a456-426614174000',
        trailerId: 12,
        supplyAirTempC: -22.0,
        returnAirTempC: -19.5,
        cargoProbeTempC: -20.0,
        evaporatorMode: 'cooling',
        doorOpen: false,
        doorType: 'none',
      };

      const parsed = recordCompartmentTelemetrySchema.parse(valid);
      expect(parsed.compartmentId).toBe('123e4567-e89b-12d3-a456-426614174000');

      const invalid = {
        ...valid,
        compartmentId: 'invalid-not-a-uuid',
      };

      expect(() => recordCompartmentTelemetrySchema.parse(invalid)).toThrow();
    });

    it('validates resolve bulkhead alert schema', () => {
      const valid = {
        alertId: '123e4567-e89b-12d3-a456-426614174000',
        notes: 'Replaced rubber gasket and inflated pneumatic seal.',
      };

      const parsed = resolveBulkheadAlertSchema.parse(valid);
      expect(parsed.alertId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});

