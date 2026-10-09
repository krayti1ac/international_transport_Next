import { describe, expect, it, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  getTripReeferAuditSchema,
  generateReeferCertificateSchema,
  logReeferTelemetrySchema,
  upsertTripReeferProfileSchema,
} from '../schemas/reefer-compliance.schemas';
import { REEFER_CARGO_CATALOG } from '../types/reefer-compliance.types';
import { ColdChainGuardService } from '../services/cold-chain-guard.service';
import type {
  ColdChainAuditEvaluation,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';

describe('Reefer Compliance Actions, Schemas & UI Integration', () => {
  describe('Zod Schemas Validation', () => {
    it('validates getTripReeferAuditSchema with string or numeric tripId', () => {
      const parsedNum = getTripReeferAuditSchema.parse({ tripId: 101 });
      expect(parsedNum.tripId).toBe(101);

      const parsedStr = getTripReeferAuditSchema.parse({ tripId: 'trip-202' });
      expect(parsedStr.tripId).toBe('trip-202');
    });

    it('validates generateReeferCertificateSchema defaults', () => {
      const parsed = generateReeferCertificateSchema.parse({ tripId: 303 });
      expect(parsed.tripId).toBe(303);
      expect(parsed.forceReissue).toBe(false);
    });

    it('validates logReeferTelemetrySchema with default values', () => {
      const parsed = logReeferTelemetrySchema.parse({
        tripId: 404,
        supplyAirTemp: 3.5,
        returnAirTemp: 4.1,
      });

      expect(parsed.tripId).toBe(404);
      expect(parsed.supplyAirTemp).toBe(3.5);
      expect(parsed.returnAirTemp).toBe(4.1);
      expect(parsed.compressorStatus).toBe('running');
      expect(parsed.isDefrostActive).toBe(false);
      expect(parsed.doorOpenSensor).toBe(false);
      expect(parsed.isGeofenceSafe).toBe(true);
    });

    it('validates upsertTripReeferProfileSchema with category presets', () => {
      const parsed = upsertTripReeferProfileSchema.parse({
        tripId: 505,
        coolingUnitBrand: 'Carrier Transicold Vector 1550',
        atpClass: 'class_c',
        cargoCategory: 'deep_frozen',
        setpointTemp: -20.0,
        minTempThreshold: -25.0,
        maxTempThreshold: -18.0,
      });

      expect(parsed.cargoCategory).toBe('deep_frozen');
      expect(parsed.setpointTemp).toBe(-20.0);
      expect(parsed.maxAllowedExcursionMinutes).toBe(45);
      expect(parsed.mktActivationEnergyKj).toBe(83.144);
    });
  });

  describe('REEFER_CARGO_CATALOG Standards', () => {
    it('contains all four core cargo categories with valid temperature bands', () => {
      const fresh = REEFER_CARGO_CATALOG.fresh_produce;
      expect(fresh.targetTemp).toBe(4.0);
      expect(fresh.minTemp).toBeLessThan(fresh.maxTemp);

      const frozen = REEFER_CARGO_CATALOG.deep_frozen;
      expect(frozen.targetTemp).toBe(-20.0);
      expect(frozen.minTemp).toBe(-25.0);
      expect(frozen.maxTemp).toBe(-18.0);

      const pharma = REEFER_CARGO_CATALOG.pharma_cold;
      expect(pharma.targetTemp).toBe(5.0);
      expect(pharma.maxAllowedExcursionMinutes).toBe(15); // Strictest excursion window

      const meat = REEFER_CARGO_CATALOG.meat_chilled;
      expect(meat.targetTemp).toBe(2.0);
      expect(meat.minTemp).toBe(0.0);
      expect(meat.maxTemp).toBe(4.0);
    });
  });

  describe('Certificate Hash Verification Format', () => {
    const mockProfile: TripReeferMonitoringProfile = {
      id: 'prof-99',
      companyId: 1,
      tripId: 999,
      trailerId: 88,
      coolingUnitBrand: 'Carrier Transicold',
      atpClass: 'class_c',
      cargoCategory: 'fresh_produce',
      setpointTemp: 4.0,
      minTempThreshold: 2.0,
      maxTempThreshold: 6.0,
      maxAllowedExcursionMinutes: 45,
      mktActivationEnergyKj: 83.144,
      isActive: true,
    };

    it('generates compliant SHA-256 stamp matching ATP-CLASS_C prefix', () => {
      const hash = ColdChainGuardService.generateCertificateHash(
        mockProfile,
        'compliant',
        new Decimal('4.15'),
        0,
        100
      );

      expect(hash).toMatch(/^ATP-CLASS_C-999-[0-9A-F]{16}$/);
    });
  });
});

