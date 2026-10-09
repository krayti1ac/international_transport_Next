import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { ReeferCalibrationService } from '../services/reefer-calibration.service';
import {
  recordAtpCertificationSchema,
  recordSensorCalibrationSchema,
} from '../types/reefer-calibration.types';
import type {
  ReeferAtpCertification,
  ReeferSensorCalibrationLog,
} from '../types/reefer-calibration.types';

describe('Reefer Sensor Calibration & ATP Recertification Engine (EN 12830 / ATP)', () => {
  describe('1. Drift Delta & Calibration Accuracy (EN 12830)', () => {
    it('calculates drift delta with Decimal precision and passes within ±0.5°C tolerance', () => {
      const res = ReeferCalibrationService.calculateDriftDelta(0.35, 0.0);
      expect(res.driftDelta).toBe(0.35);
      expect(res.isPassed).toBe(true);

      const resNegative = ReeferCalibrationService.calculateDriftDelta(3.6, 4.0);
      expect(resNegative.driftDelta).toBe(-0.4);
      expect(resNegative.isPassed).toBe(true);
    });

    it('fails calibration when drift delta exceeds maximum allowed ±0.50°C', () => {
      const resHigh = ReeferCalibrationService.calculateDriftDelta(0.65, 0.0);
      expect(resHigh.driftDelta).toBe(0.65);
      expect(resHigh.isPassed).toBe(false);

      const resLow = ReeferCalibrationService.calculateDriftDelta(-0.8, 0.0);
      expect(resLow.driftDelta).toBe(-0.8);
      expect(resLow.isPassed).toBe(false);
    });
  });

  describe('2. ATP Agreement K-Value Thermal Insulation Compliance', () => {
    it('approves FRC classification when K-Value is <= 0.400 W/m²·K', () => {
      const evalGood = ReeferCalibrationService.evaluateKValueCompliance('FRC', 0.38);
      expect(evalGood.isCompliant).toBe(true);
      expect(evalGood.maxThreshold).toBe(0.4);
      expect(evalGood.message).toContain('معامل العزل ممتاز');
    });

    it('rejects FRC classification when insulation degrades beyond 0.400 W/m²·K', () => {
      const evalDegraded = ReeferCalibrationService.evaluateKValueCompliance('FRC', 0.425);
      expect(evalDegraded.isCompliant).toBe(false);
      expect(evalDegraded.message).toContain('غير مطابق');
    });

    it('evaluates FNA standard with 0.700 W/m²·K threshold', () => {
      const evalFna = ReeferCalibrationService.evaluateKValueCompliance('FNA', 0.65);
      expect(evalFna.isCompliant).toBe(true);
      expect(evalFna.maxThreshold).toBe(0.7);
    });
  });

  describe('3. Multi-tier Expiry Radar & Warning Gradation', () => {
    const fixedNow = new Date('2026-10-09T12:00:00Z');

    it('classifies expiry beyond 60 days as safe and valid', () => {
      const future = new Date('2026-12-30T12:00:00Z').toISOString();
      const res = ReeferCalibrationService.evaluateExpiry(future, fixedNow);
      expect(res.warningLevel).toBe('safe');
      expect(res.status).toBe('valid');
      expect(res.daysRemaining).toBeGreaterThan(60);
    });

    it('classifies 45 days remaining as notice_60d', () => {
      const target = new Date('2026-11-23T12:00:00Z').toISOString();
      const res = ReeferCalibrationService.evaluateExpiry(target, fixedNow);
      expect(res.warningLevel).toBe('notice_60d');
      expect(res.status).toBe('valid');
    });

    it('classifies 15 days remaining as urgent_30d', () => {
      const target = new Date('2026-10-24T12:00:00Z').toISOString();
      const res = ReeferCalibrationService.evaluateExpiry(target, fixedNow);
      expect(res.warningLevel).toBe('urgent_30d');
      expect(res.status).toBe('expiring_soon');
    });

    it('classifies 3 days remaining as critical_7d', () => {
      const target = new Date('2026-10-12T12:00:00Z').toISOString();
      const res = ReeferCalibrationService.evaluateExpiry(target, fixedNow);
      expect(res.warningLevel).toBe('critical_7d');
      expect(res.status).toBe('expiring_soon');
    });

    it('identifies past dates as expired', () => {
      const past = new Date('2026-10-01T12:00:00Z').toISOString();
      const res = ReeferCalibrationService.evaluateExpiry(past, fixedNow);
      expect(res.warningLevel).toBe('expired');
      expect(res.status).toBe('expired');
      expect(res.daysRemaining).toBeLessThan(0);
    });
  });

  describe('4. Pre-Trip Gatekeeper Compliance Clearance', () => {
    const validAtp: ReeferAtpCertification = {
      id: 'atp-1',
      companyId: 1,
      trailerId: 101,
      trailerPlate: 'REM-101',
      certificateNumber: 'FRC-2026-101',
      atpType: 'FRC',
      issueDate: '2026-01-01',
      expiryDate: '2028-01-01',
      kValue: 0.36,
      testingStation: 'CEMAFROID',
      status: 'valid',
      warningLevel: 'safe',
      daysRemaining: 440,
      renewalCycleYears: 3,
      createdAt: '2026-01-01T00:00:00Z',
    };

    const validLogs: ReeferSensorCalibrationLog[] = [
      {
        id: 'cal-1',
        companyId: 1,
        trailerId: 101,
        sensorType: 'return_air_probe',
        calibratedAt: '2026-05-01',
        nextDueDate: '2027-05-01',
        referenceTemp: 0.0,
        measuredTemp: 0.2,
        driftDelta: 0.2,
        isPassed: true,
        warningLevel: 'safe',
        daysRemaining: 200,
        calibratedBy: 'LNE',
        createdAt: '2026-05-01T00:00:00Z',
      },
    ];

    it('grants clearance when both ATP certificate and sensor calibrations are fully valid', () => {
      const res = ReeferCalibrationService.evaluatePreTripCompliance(101, 'REM-101', validAtp, validLogs);
      expect(res.isClearedForDispatch).toBe(true);
      expect(res.blockingReasons).toHaveLength(0);
      expect(res.atpCertificateNumber).toBe('FRC-2026-101');
    });

    it('blocks dispatch when ATP certificate is missing or expired', () => {
      const expiredAtp: ReeferAtpCertification = {
        ...validAtp,
        expiryDate: '2026-01-01',
        status: 'expired',
      };
      const res = ReeferCalibrationService.evaluatePreTripCompliance(101, 'REM-101', expiredAtp, validLogs);
      expect(res.isClearedForDispatch).toBe(false);
      expect(res.blockingReasons.some((r) => r.includes('منتهية الصلاحية'))).toBe(true);
    });

    it('blocks dispatch when sensor calibration exceeds allowed drift tolerance', () => {
      const failedLogs: ReeferSensorCalibrationLog[] = [
        {
          ...validLogs[0],
          measuredTemp: 0.8,
          driftDelta: 0.8,
          isPassed: false,
        },
      ];
      const res = ReeferCalibrationService.evaluatePreTripCompliance(101, 'REM-101', validAtp, failedLogs);
      expect(res.isClearedForDispatch).toBe(false);
      expect(res.sensorCalibrationStatus).toBe('drift_fail');
      expect(res.blockingReasons.some((r) => r.includes('يتجاوز الحد المسموح'))).toBe(true);
    });
  });

  describe('5. Radar Summary & Fleet Compliance Health Aggregation', () => {
    it('accurately calculates fleet metrics and compliance percentage with Decimal precision', () => {
      const trailers = [
        { id: 1, plateNumber: 'REM-1' },
        { id: 2, plateNumber: 'REM-2' },
      ];
      const atpCerts: ReeferAtpCertification[] = [
        {
          id: 'atp-1',
          companyId: 1,
          trailerId: 1,
          certificateNumber: 'FRC-001',
          atpType: 'FRC',
          issueDate: '2026-01-01',
          expiryDate: '2028-01-01',
          kValue: 0.38,
          testingStation: 'CEMAFROID',
          status: 'valid',
          warningLevel: 'safe',
          daysRemaining: 400,
          renewalCycleYears: 3,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];
      const calibrations: ReeferSensorCalibrationLog[] = [
        {
          id: 'cal-1',
          companyId: 1,
          trailerId: 1,
          sensorType: 'return_air_probe',
          calibratedAt: '2026-01-01',
          nextDueDate: '2027-01-01',
          referenceTemp: 0.0,
          measuredTemp: 0.1,
          driftDelta: 0.1,
          isPassed: true,
          warningLevel: 'safe',
          daysRemaining: 200,
          calibratedBy: 'LNE',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      const summary = ReeferCalibrationService.calculateRadarSummary(trailers, atpCerts, calibrations);
      expect(summary.totalReeferTrailers).toBe(2);
      expect(summary.validAtpCount).toBe(1);
      expect(summary.groundedTrailersCount).toBe(1); // Trailer 2 has no ATP or Calibrations
      expect(summary.fleetComplianceHealthRate).toBe(50.0); // 1 out of 2 compliant = 50%
    });
  });

  describe('6. Zod Schema Validation', () => {
    it('validates correct ATP input', () => {
      const valid = {
        trailerId: 10,
        certificateNumber: 'FRC-MA-2026-88',
        atpType: 'FRC',
        issueDate: '2026-01-01',
        expiryDate: '2029-01-01',
        kValue: 0.38,
        testingStation: 'Cematrans',
      };
      const parsed = recordAtpCertificationSchema.parse(valid);
      expect(parsed.trailerId).toBe(10);
      expect(parsed.atpType).toBe('FRC');
    });

    it('validates sensor calibration input', () => {
      const valid = {
        trailerId: 10,
        sensorType: 'return_air_probe',
        calibratedAt: '2026-05-01',
        nextDueDate: '2027-05-01',
        referenceTemp: 0,
        measuredTemp: 0.1,
        calibratedBy: 'LNE Lab',
      };
      const parsed = recordSensorCalibrationSchema.parse(valid);
      expect(parsed.sensorType).toBe('return_air_probe');
    });
  });
});

