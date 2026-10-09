import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateTripCarbonFootprint,
  generateCertificateSeal,
  buildGreenFreightCertificate,
  resolveEfficiencyRating,
} from '../services/carbon-footprint.service';
import {
  calculateTripCarbonFootprintAction,
  auditAndSaveTripCarbonAction,
  issueGreenFreightCertificateAction,
} from '../services/carbon-audit.actions';

const mockTrip = {
  id: 501,
  route: 'Agadir ➔ Perpignan',
  route_export: 'Agadir ➔ Perpignan (Fruits & Primeurs)',
  status: 'completed',
  departure_date: '2026-10-01',
  cmr_number: 'CMR-MA-501',
  cmr_export_number: 'CMR-EXP-501',
  truck_id: 10,
  client_id: 20,
  road_distance_km: 1850.0,
  ferry_distance_km: 45.0,
};

const mockClient = {
  id: 20,
  name: 'Atlas Export Frigo S.A.',
  shipping_country: 'France',
};

const mockTruck = {
  id: 10,
  plate_number: '12345-A-40',
};

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-admin-123' } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: any) => ({
          single: () => {
            if (table === 'trip_orders') return Promise.resolve({ data: mockTrip, error: null });
            if (table === 'clients') return Promise.resolve({ data: mockClient, error: null });
            if (table === 'trucks') return Promise.resolve({ data: mockTruck, error: null });
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, trip_id: 501, total_wtw_emissions_kg: 4412.576 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

describe('Green Freight & ESG Carbon Footprint Audit Engine (GLEC v3.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Decimal.js Mathematical Precision & GLEC Factors', () => {
    it('calculates exact Well-to-Wheel (WTW) and Tank-to-Wheel (TTW) emissions without float drift', () => {
      const result = calculateTripCarbonFootprint({
        cargoWeightTons: 22.50, // 22.5 tons
        roadDistanceKm: 1850.0, // 1,850 km overland
        ferryDistanceKm: 45.0,  // 45 km maritime ferry
        truckEuroClass: 'euro_6',
        isReefer: true,
        reeferHours: 48.0,
      });

      // 1. Ton-km calculation:
      // Road t-km: 22.5 * 1850 = 41625.00
      // Ferry t-km: 22.5 * 45 = 1012.50
      // Total t-km: 42637.50
      expect(result.tonKilometers).toBe('42637.50');

      // 2. Road WTW: 41625 * 95.40 / 1000 = 3971.025 kg CO2e
      expect(result.roadWtwEmissionsKg).toBe('3971.025');

      // 3. Ferry WTW: 1012.5 * 52.10 / 1000 = 52.751 kg CO2e
      expect(result.ferryWtwEmissionsKg).toBe('52.751');

      // 4. Reefer WTW: 48 * 2.5 L/h * 3.24 kg/L = 388.800 kg CO2e
      expect(result.reeferWtwEmissionsKg).toBe('388.800');

      // 5. Total WTW: 3971.025 + 52.751 + 388.800 = 4412.576 kg CO2e
      expect(result.totalWtwEmissionsKg).toBe('4412.576');

      // 6. Savings vs all-road baseline:
      const savedDec = new Decimal(result.emissionsSavedKg);
      expect(savedDec.greaterThan(0)).toBe(true);

      const savingsPctDec = new Decimal(result.emissionsSavingsPercentage);
      expect(savingsPctDec.greaterThan(0)).toBe(true);
    });

    it('demonstrates higher emissions for Euro 5 trucks compared to Euro 6', () => {
      const euro6 = calculateTripCarbonFootprint({
        cargoWeightTons: 20,
        roadDistanceKm: 1000,
        truckEuroClass: 'euro_6',
        isReefer: false,
      });

      const euro5 = calculateTripCarbonFootprint({
        cargoWeightTons: 20,
        roadDistanceKm: 1000,
        truckEuroClass: 'euro_5',
        isReefer: false,
      });

      // Euro 6: 20 * 1000 * 95.4 / 1000 = 1908.000 kg
      // Euro 5: 20 * 1000 * 108.2 / 1000 = 2164.000 kg
      expect(euro6.totalWtwEmissionsKg).toBe('1908.000');
      expect(euro5.totalWtwEmissionsKg).toBe('2164.000');
      expect(new Decimal(euro5.totalWtwEmissionsKg).greaterThan(euro6.totalWtwEmissionsKg)).toBe(true);
    });

    it('handles zero or dry freight (no reefer unit) cleanly', () => {
      const dryResult = calculateTripCarbonFootprint({
        cargoWeightTons: 15.0,
        roadDistanceKm: 500.0,
        isReefer: false,
      });

      expect(dryResult.reeferWtwEmissionsKg).toBe('0.000');
      expect(dryResult.totalWtwEmissionsKg).toBe('715.500'); // 15 * 500 * 95.40 / 1000
    });
  });

  describe('2. Efficiency Rating Thresholds', () => {
    it('accurately resolves ratings from A+ to E', () => {
      expect(resolveEfficiencyRating(new Decimal(55.0)).rating).toBe('A+');
      expect(resolveEfficiencyRating(new Decimal(72.5)).rating).toBe('A');
      expect(resolveEfficiencyRating(new Decimal(88.0)).rating).toBe('B');
      expect(resolveEfficiencyRating(new Decimal(102.0)).rating).toBe('C');
      expect(resolveEfficiencyRating(new Decimal(120.0)).rating).toBe('D');
      expect(resolveEfficiencyRating(new Decimal(145.0)).rating).toBe('E');
    });
  });

  describe('3. Forensic Certificate Sealing (HMAC-SHA256)', () => {
    it('generates consistent cryptographic seal and detects tampering', () => {
      const calcResult = calculateTripCarbonFootprint({
        cargoWeightTons: 22.0,
        roadDistanceKm: 1500,
      });

      const issuedAt = '2026-10-09T12:00:00.000Z';
      const seal1 = generateCertificateSeal({
        tripId: 501,
        results: calcResult,
        issuedAt,
      });

      const seal2 = generateCertificateSeal({
        tripId: 501,
        results: calcResult,
        issuedAt,
      });

      expect(seal1).toBe(seal2);
      expect(seal1.length).toBe(64); // SHA-256 hex string

      // Tampered data should yield different seal
      const tamperedResult = {
        ...calcResult,
        totalWtwEmissionsKg: '9999.000',
      };

      const tamperedSeal = generateCertificateSeal({
        tripId: 501,
        results: tamperedResult,
        issuedAt,
      });

      expect(tamperedSeal).not.toBe(seal1);
    });

    it('builds complete official Green Freight Certificate with ISO 14083 metadata', () => {
      const cert = buildGreenFreightCertificate({
        tripId: 501,
        cmrNumber: 'CMR-MA-501',
        route: 'Agadir ➔ Perpignan',
        clientName: 'Atlas Export S.A.',
        calculationInput: {
          cargoWeightTons: 22.5,
          roadDistanceKm: 1850,
          ferryDistanceKm: 45,
        },
      });

      expect(cert.certificateId).toContain('GFC-MA-501');
      expect(cert.standardsCompliance.iso14083Compliant).toBe(true);
      expect(cert.standardsCompliance.euCbamAligned).toBe(true);
      expect(cert.standardsCompliance.glecVersion).toBe('v3.0');
    });
  });

  describe('4. Server Actions Execution', () => {
    it('executes calculateTripCarbonFootprintAction with Zod validation', async () => {
      const res = await calculateTripCarbonFootprintAction({
        cargoWeightTons: 24.0,
        roadDistanceKm: 1200.0,
        ferryDistanceKm: 35.0,
        truckEuroClass: 'euro_6',
        isReefer: true,
        reeferHours: 24.0,
      });

      expect(res.success).toBe(true);
      expect(res.result).toBeDefined();
      expect(new Decimal(res.result!.totalWtwEmissionsKg).greaterThan(0)).toBe(true);
    });

    it('executes auditAndSaveTripCarbonAction and updates database with GLEC rating', async () => {
      const res = await auditAndSaveTripCarbonAction({
        tripId: 501,
        cargoWeightTons: 22.5,
        roadDistanceKm: 1850.0,
        ferryDistanceKm: 45.0,
      });

      expect(res.success).toBe(true);
      expect(res.results).toBeDefined();
      expect(res.results!.efficiencyRating).toBeDefined();
    });

    it('executes issueGreenFreightCertificateAction and attaches cryptographic seal', async () => {
      const res = await issueGreenFreightCertificateAction({
        tripId: 501,
      });

      expect(res.success).toBe(true);
      expect(res.certificate).toBeDefined();
      expect(res.certificate!.certificateHash).toBeDefined();
    });
  });
});
