import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { ColdChainGuardService } from '../services/cold-chain-guard.service';
import type {
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';

describe('ColdChainGuardService - Mean Kinetic Temperature & Cold Chain Auditing', () => {
  describe('Mean Kinetic Temperature (MKT) Calculations', () => {
    it('returns 0 for empty temperature array', () => {
      const mkt = ColdChainGuardService.calculateMeanKineticTemperature([]);
      expect(mkt.toNumber()).toBe(0);
    });

    it('returns exact temperature for single reading', () => {
      const mkt = ColdChainGuardService.calculateMeanKineticTemperature([4.5]);
      expect(mkt.toNumber()).toBe(4.5);
    });

    it('returns identical temperature for identical series', () => {
      const mkt = ColdChainGuardService.calculateMeanKineticTemperature([5.0, 5.0, 5.0, 5.0]);
      expect(mkt.toNumber()).toBe(5.0);
    });

    it('weighs higher temperatures more heavily than arithmetic mean (Arrhenius principle)', () => {
      // For [2.0, 8.0], arithmetic mean is 5.0°C.
      // Mean Kinetic Temperature must be strictly > 5.0°C due to accelerated kinetics.
      const mkt = ColdChainGuardService.calculateMeanKineticTemperature([2.0, 8.0]);
      expect(mkt.toNumber()).toBeGreaterThan(5.0);
      expect(mkt.toNumber()).toBeCloseTo(5.54, 1);
    });

    it('handles negative temperatures correctly for deep frozen cargo', () => {
      // Frozen goods: [-22.0, -18.0], arithmetic mean is -20.0°C.
      const mkt = ColdChainGuardService.calculateMeanKineticTemperature([-22.0, -18.0]);
      expect(mkt.toNumber()).toBeGreaterThan(-20.0);
      expect(mkt.toNumber()).toBeLessThan(-18.0);
    });
  });

  describe('evaluateColdChainTrip', () => {
    const mockProfile: TripReeferMonitoringProfile = {
      id: 'prof-101',
      companyId: 1,
      tripId: 501,
      trailerId: 201,
      coolingUnitBrand: 'Carrier Transicold Vector 1550',
      atpClass: 'class_c',
      cargoCategory: 'fresh_produce',
      setpointTemp: 4.0,
      minTempThreshold: 2.0,
      maxTempThreshold: 6.0,
      maxAllowedExcursionMinutes: 45,
      mktActivationEnergyKj: 83.144,
      isActive: true,
    };

    it('returns compliant evaluation when all logs are within thresholds', () => {
      const compliantLogs: ReeferTelemetryLog[] = [
        {
          id: 'log-1',
          tripId: 501,
          supplyAirTemp: 3.8,
          returnAirTemp: 4.2,
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          dieselBurnRateLph: 2.1,
          recordedAt: '2026-10-09T10:00:00Z',
        },
        {
          id: 'log-2',
          tripId: 501,
          supplyAirTemp: 3.9,
          returnAirTemp: 4.1,
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          dieselBurnRateLph: 2.1,
          recordedAt: '2026-10-09T10:10:00Z',
        },
        {
          id: 'log-3',
          tripId: 501,
          supplyAirTemp: 4.0,
          returnAirTemp: 4.3,
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          dieselBurnRateLph: 2.0,
          recordedAt: '2026-10-09T10:20:00Z',
        },
      ];

      const evaluation = ColdChainGuardService.evaluateColdChainTrip(mockProfile, compliantLogs);

      expect(evaluation.complianceStatus).toBe('compliant');
      expect(evaluation.totalExcursionMinutes).toBe(0);
      expect(evaluation.doorBreachesCount).toBe(0);
      expect(evaluation.complianceScorePercent).toBe(100);
      expect(evaluation.certificateHash).toMatch(/^ATP-CLASS_C-501-[A-F0-9]{16}$/);
      expect(evaluation.totalDieselBurnedLiters).toBeGreaterThan(0);
    });

    it('flags breached status when cumulative excursions exceed allowed minutes', () => {
      // 5 logs with excursions = 50 minutes (exceeding 45 allowed minutes)
      const excursionLogs: ReeferTelemetryLog[] = Array.from({ length: 5 }, (_, i) => ({
        id: `log-exc-${i}`,
        tripId: 501,
        supplyAirTemp: 7.5, // > max 6.0
        returnAirTemp: 8.2, // > max 6.0
        compressorStatus: 'running',
        isDefrostActive: false,
        doorOpenSensor: false,
        isGeofenceSafe: true,
        dieselBurnRateLph: 2.5,
        recordedAt: `2026-10-09T11:0${i}:00Z`,
      }));

      const evaluation = ColdChainGuardService.evaluateColdChainTrip(mockProfile, excursionLogs);

      expect(evaluation.complianceStatus).toBe('breached');
      expect(evaluation.totalExcursionMinutes).toBe(50);
      expect(evaluation.complianceScorePercent).toBeLessThan(75);
    });

    it('detects door breach during transit outside authorized geofence', () => {
      const breachLogs: ReeferTelemetryLog[] = [
        {
          id: 'log-door-1',
          tripId: 501,
          supplyAirTemp: 4.0,
          returnAirTemp: 4.2,
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: true, // Door opened!
          isGeofenceSafe: false, // In transit / unauthorized zone!
          recordedAt: '2026-10-09T12:00:00Z',
        },
      ];

      const evaluation = ColdChainGuardService.evaluateColdChainTrip(mockProfile, breachLogs);

      expect(evaluation.doorBreachesCount).toBe(1);
      expect(evaluation.complianceStatus).toBe('warning');
      expect(evaluation.complianceScorePercent).toBeLessThanOrEqual(85);
    });
  });

  describe('detectExcursionIncidents', () => {
    const mockProfile: TripReeferMonitoringProfile = {
      id: 'prof-202',
      companyId: 1,
      tripId: 502,
      trailerId: 202,
      coolingUnitBrand: 'Thermo King SLXi-400',
      atpClass: 'class_c',
      cargoCategory: 'pharma_cold',
      setpointTemp: 5.0,
      minTempThreshold: 2.0,
      maxTempThreshold: 8.0,
      maxAllowedExcursionMinutes: 15,
      mktActivationEnergyKj: 83.144,
      isActive: true,
    };

    it('detects multiple incident types accurately', () => {
      const logs: ReeferTelemetryLog[] = [
        {
          id: 'l1',
          tripId: 502,
          supplyAirTemp: 11.5,
          returnAirTemp: 12.0, // High excursion (max 8.0)
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          recordedAt: '2026-10-09T14:00:00Z',
        },
        {
          id: 'l2',
          tripId: 502,
          supplyAirTemp: 1.0,
          returnAirTemp: 1.2, // Low excursion (min 2.0)
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          recordedAt: '2026-10-09T14:10:00Z',
        },
        {
          id: 'l3',
          tripId: 502,
          supplyAirTemp: 5.0,
          returnAirTemp: 5.0,
          compressorStatus: 'running',
          isDefrostActive: false,
          doorOpenSensor: true, // Door breach
          isGeofenceSafe: false,
          recordedAt: '2026-10-09T14:20:00Z',
        },
        {
          id: 'l4',
          tripId: 502,
          supplyAirTemp: 9.0,
          returnAirTemp: 9.5, // Compressor failure while high
          compressorStatus: 'off',
          isDefrostActive: false,
          doorOpenSensor: false,
          isGeofenceSafe: true,
          recordedAt: '2026-10-09T14:30:00Z',
        },
      ];

      const incidents = ColdChainGuardService.detectExcursionIncidents(mockProfile, logs);

      expect(incidents.length).toBeGreaterThanOrEqual(4);
      expect(incidents.some((i) => i.incidentType === 'temp_high')).toBe(true);
      expect(incidents.some((i) => i.incidentType === 'temp_low')).toBe(true);
      expect(incidents.some((i) => i.incidentType === 'door_breach_transit')).toBe(true);
      expect(incidents.some((i) => i.incidentType === 'compressor_failure')).toBe(true);
    });
  });
});

