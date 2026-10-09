import { describe, expect, it, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { verifyReeferColdChainByHashAction } from '../services/reefer-verification.actions';
import { ColdChainGuardService } from '../services/cold-chain-guard.service';
import type { TripReeferMonitoringProfile } from '../types/reefer-compliance.types';

// Mock Supabase Server Client
const mockTrip = {
  id: 402,
  cmr_number: 'CMR-2026-402',
  route_name: 'Tanger Med → Algeciras → Rungis',
  truck_plate: '11223-A-40',
  company_id: 1,
};

const mockCompany = {
  id: 1,
  name: 'Trans Bodanon Transport & Logistique S.A.R.L.',
  ice: '002938475000084',
  address: 'Zone Franche Port Tanger Med, Route Principale, Maroc',
  phone: '+212 539 94 82 10',
  email: 'contact@transbodanon.com',
};

const mockProfile: TripReeferMonitoringProfile = {
  id: 'prof-402-test',
  companyId: 1,
  tripId: 402,
  trailerId: 8821,
  coolingUnitBrand: 'Carrier Transicold Vector 1550',
  atpClass: 'class_c',
  cargoCategory: 'fresh_produce',
  setpointTemp: 4.0,
  minTempThreshold: 2.0,
  maxTempThreshold: 6.0,
  maxAllowedExcursionMinutes: 45,
  mktActivationEnergyKj: 83.144,
  isActive: true,
  certificateHash: 'ATP-CLASS_C-402-ABCDEF0123456789',
};

const mockLogs = [
  {
    id: 'log-1',
    trip_id: 402,
    supply_air_temp: 3.8,
    return_air_temp: 4.2,
    ambient_temp: 24.5,
    compressor_status: 'running',
    is_defrost_active: false,
    door_open_sensor: false,
    diesel_fuel_level_liters: 120,
    diesel_burn_rate_lph: 2.1,
    is_geofence_safe: true,
    recorded_at: '2026-10-09T10:00:00Z',
  },
  {
    id: 'log-2',
    trip_id: 402,
    supply_air_temp: 3.9,
    return_air_temp: 4.1,
    ambient_temp: 25.0,
    compressor_status: 'running',
    is_defrost_active: false,
    door_open_sensor: false,
    diesel_fuel_level_liters: 118,
    diesel_burn_rate_lph: 2.1,
    is_geofence_safe: true,
    recorded_at: '2026-10-09T10:10:00Z',
  },
];

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trip_reefer_monitoring_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: mockProfile.id,
                  company_id: mockProfile.companyId,
                  trip_id: mockProfile.tripId,
                  trailer_id: mockProfile.trailerId,
                  cooling_unit_brand: mockProfile.coolingUnitBrand,
                  atp_class: mockProfile.atpClass,
                  cargo_category: mockProfile.cargoCategory,
                  setpoint_temp: mockProfile.setpointTemp,
                  min_temp_threshold: mockProfile.minTempThreshold,
                  max_temp_threshold: mockProfile.maxTempThreshold,
                  max_allowed_excursion_minutes: mockProfile.maxAllowedExcursionMinutes,
                  mkt_activation_energy_kj: mockProfile.mktActivationEnergyKj,
                  certificate_hash: mockProfile.certificateHash,
                },
                error: null,
              }),
            }),
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: mockProfile.id,
                      company_id: mockProfile.companyId,
                      trip_id: mockProfile.tripId,
                      trailer_id: mockProfile.trailerId,
                      cooling_unit_brand: mockProfile.coolingUnitBrand,
                      atp_class: mockProfile.atpClass,
                      cargo_category: mockProfile.cargoCategory,
                      setpoint_temp: mockProfile.setpointTemp,
                      min_temp_threshold: mockProfile.minTempThreshold,
                      max_temp_threshold: mockProfile.maxTempThreshold,
                      max_allowed_excursion_minutes: mockProfile.maxAllowedExcursionMinutes,
                      mkt_activation_energy_kj: mockProfile.mktActivationEnergyKj,
                      certificate_hash: mockProfile.certificateHash,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'trip_orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockTrip, error: null }),
            }),
          }),
        };
      }

      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockCompany, error: null }),
            }),
          }),
        };
      }

      if (table === 'reefer_temperature_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
            }),
          }),
        };
      }

      if (table === 'reefer_excursion_incidents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
    }),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Public QR Code Reefer Cold Chain Verification Engine (EN 12830 / GDP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Parameter Validation & Unregistered Handling', () => {
    it('returns unregistered status when hash is empty or whitespace', async () => {
      const res = await verifyReeferColdChainByHashAction('   ');
      expect(res.isValid).toBe(false);
      expect(res.securityBadge).toBe('unregistered');
      expect(res.isTamperEvident).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('2. Authentic Certificate Verification', () => {
    it('successfully validates authentic certificate matching stored certificate_hash', async () => {
      const res = await verifyReeferColdChainByHashAction('ATP-CLASS_C-402-ABCDEF0123456789');

      expect(res.isValid).toBe(true);
      expect(res.securityBadge).toBe('verified');
      expect(res.isTamperEvident).toBe(false);
      expect(res.tripId).toBe(402);
      expect(res.atpClass).toBe('class_c');
      expect(res.cargoCategory).toBe('fresh_produce');
      expect(res.setpointTemp).toBe(4.0);
      expect(res.complianceStatus).toBe('compliant');
      expect(res.complianceScorePercent).toBe(99);
      expect(res.verificationHash).toBeDefined();
      expect(res.cmrNumber).toBe('CMR-2026-402');
    });

    it('computes and returns Mean Kinetic Temperature (MKT)', async () => {
      const res = await verifyReeferColdChainByHashAction('ATP-CLASS_C-402-ABCDEF0123456789');

      expect(res.mktTemperatureCelsius).toBeGreaterThan(3.5);
      expect(res.mktTemperatureCelsius).toBeLessThan(5.0);
      expect(res.avgReturnTemp).toBe(4.15);
    });

    it('validates candidate using HMAC-SHA256 verification seal prefix', async () => {
      const secretKey = process.env.PDF_SIGNING_KEY || 'trans_bodanon_reefer_audit_secret_2026';
      const mkt = 4.15;
      const hashPayload = `REEFER_AUDIT_402_2_${mkt}_4_compliant`;
      const expectedHmac = crypto
        .createHmac('sha256', secretKey)
        .update(hashPayload)
        .digest('hex')
        .toUpperCase();

      const res = await verifyReeferColdChainByHashAction(expectedHmac.substring(0, 16), 402);

      expect(res.isValid).toBe(true);
      expect(res.securityBadge).toBe('verified');
    });
  });

  describe('3. Tamper Detection & Fraud Prevention', () => {
    it('flags tampered certificate when candidate hash does not match computed telemetry seal', async () => {
      const forgedHash = 'ATP-CLASS_C-402-FORGED9999999999';
      // When candidate hash mentions trip 402 but the hash suffix doesn't match stored or computed hashes
      const res = await verifyReeferColdChainByHashAction(forgedHash, 402);

      expect(res.isValid).toBe(false);
      expect(res.isTamperEvident).toBe(true);
      expect(res.securityBadge).toBe('tampered');
      expect(res.tamperReason).toContain('عدم تطابق البصمة المشفرة');
    });
  });

  describe('4. Data Masking for Public Access', () => {
    it('masks internal financial figures, carrier costs, and driver salaries', async () => {
      const res = await verifyReeferColdChainByHashAction('ATP-CLASS_C-402-ABCDEF0123456789');

      // Ensure no financial/cost fields exist on public result
      expect((res as any).totalCostMad).toBeUndefined();
      expect((res as any).freightRateMad).toBeUndefined();
      expect((res as any).driverPayoutMad).toBeUndefined();
      expect((res as any).profitMargin).toBeUndefined();
      expect((res as any).fuelCostMad).toBeUndefined();

      // Ensure public logistics info is appropriately masked
      expect(res.company).toBeDefined();
      expect(res.company?.name).toBe('Trans Bodanon Transport & Logistique S.A.R.L.');
      expect(res.company?.ice).toBe('002938475000084');
      expect(res.trailerPlate).toBe('MA-R-8821');
    });

    it('returns compact downsampled telemetry logs (<= 25 items)', async () => {
      const res = await verifyReeferColdChainByHashAction('ATP-CLASS_C-402-ABCDEF0123456789');

      expect(res.logsSample).toBeDefined();
      expect(res.logsSample!.length).toBeLessThanOrEqual(25);
      expect(res.logsSample![0].returnAirTemp).toBe(4.2);
    });
  });
});

