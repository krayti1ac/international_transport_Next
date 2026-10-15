import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateConsignmentMetrics,
  calculateTrailerUtilization,
} from '../services/groupage-calculator.service';
import {
  createLtlConsignmentAction,
  fetchTripConsignmentsAction,
  updateConsignmentStatusAction,
  clearConsignmentsCache,
} from '../services/groupage-consignment.actions';
import {
  LTL_TRAILER_STANDARDS,
  type TripConsignment,
  type CreateLtlConsignmentInput,
} from '../types/groupage-ltl.types';

// Mock Supabase Server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'uuid-consign-101' }, error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'db-consign-1',
                company_id: 'tenant-001',
                trip_id: 9901,
                consignment_reference: 'LTL-9901-4411',
                client_id: 12,
                client_name: 'Atlas Agro Export',
                sender_name: 'Atlas Agro Agadir',
                sender_address: 'Agadir Port Hub',
                receiver_name: 'Mercamadrid Fruits',
                receiver_address: 'Mercamadrid Nave 4, Madrid',
                loading_city: 'Agadir',
                loading_country: 'MA',
                delivery_city: 'Madrid',
                delivery_country: 'ES',
                cargo_description: 'Tomates Cerises Premium',
                is_temperature_controlled: true,
                target_temperature_c: 8,
                pallet_count: 8,
                pallet_type: 'euro',
                is_stackable: true,
                length_cm: 120,
                width_cm: 80,
                height_cm: 160,
                ldm_meters: 1.6,
                volume_m3: 12.29,
                gross_weight_kg: 3800,
                chargeable_weight_kg: 4092.57,
                freight_price: 18500,
                currency: 'MAD',
                cmr_number: 'CMR-LTL-9901-4411',
                customs_mrn: '26MADUM0091823',
                status: 'manifested',
                notes: 'Handle with care',
                created_at: '2026-10-15T10:00:00Z',
                updated_at: '2026-10-15T10:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
}));

// Mock Audit Logger
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Groupage & LTL Multi-Consignment Engine', () => {
  beforeEach(async () => {
    await clearConsignmentsCache();
    vi.clearAllMocks();
  });

  describe('LDM & Volumetric Loading Calculator (Decimal.js)', () => {
    it('computes exact LDM for non-stackable Euro-pallets (0.40 LDM each)', () => {
      const res = calculateConsignmentMetrics({
        palletType: 'euro',
        palletCount: 10,
        isStackable: false,
        grossWeightKg: 4000,
      });

      // 10 * 0.40 = 4.00 LDM
      expect(res.ldmMeters).toBe(4.0);
      expect(res.volumeM3).toBe(14.4); // 10 * 1.44 m³ default
      // Chargeable weight: max(4000, 14.4 * 333 = 4795.2, 4.0 * 1850 = 7400)
      expect(res.chargeableWeightKg).toBe(7400);
    });

    it('halves floor LDM when pallets are stackable (gerbable 2 tiers)', () => {
      const res = calculateConsignmentMetrics({
        palletType: 'euro',
        palletCount: 10,
        isStackable: true,
        grossWeightKg: 4000,
      });

      // 10 * 0.40 / 2 = 2.00 LDM
      expect(res.ldmMeters).toBe(2.0);
    });

    it('computes exact LDM for Industrial pallets (0.50 LDM each)', () => {
      const res = calculateConsignmentMetrics({
        palletType: 'industrial',
        palletCount: 6,
        isStackable: false,
        grossWeightKg: 3000,
      });

      // 6 * 0.50 = 3.00 LDM
      expect(res.ldmMeters).toBe(3.0);
      expect(res.volumeM3).toBe(10.8); // 6 * 1.8 m³ default
      // Chargeable weight: max(3000, 10.8 * 333 = 3596.4, 3.0 * 1850 = 5550)
      expect(res.chargeableWeightKg).toBe(5550);
    });

    it('computes custom dimensions LDM via formula (L * W / 2.4)', () => {
      // Custom pallet: 1.50m x 1.20m = 1.80m² / 2.40m = 0.75 LDM per item
      const res = calculateConsignmentMetrics({
        palletType: 'custom',
        palletCount: 4,
        isStackable: false,
        lengthCm: 150,
        widthCm: 120,
        heightCm: 200,
        grossWeightKg: 2500,
      });

      // 4 * 0.75 = 3.00 LDM
      expect(res.ldmMeters).toBe(3.0);
      // Volume: 1.5 * 1.2 * 2.0 * 4 = 14.4 m³
      expect(res.volumeM3).toBe(14.4);
      // Chargeable: max(2500, 14.4 * 333 = 4795.2, 3.0 * 1850 = 5550)
      expect(res.chargeableWeightKg).toBe(5550);
    });

    it('respects actual gross weight when it exceeds volumetric and LDM equivalents', () => {
      const res = calculateConsignmentMetrics({
        palletType: 'euro',
        palletCount: 2,
        isStackable: false,
        grossWeightKg: 5000, // Very dense load: 5,000 kg on 2 pallets (0.8 LDM)
      });

      // LDM = 0.8 -> 0.8 * 1850 = 1480 kg
      // Vol = 2.88 -> 2.88 * 333 = 959.04 kg
      // Max is 5000 kg
      expect(res.chargeableWeightKg).toBe(5000);
    });
  });

  describe('Trailer Capacity Utilization Radar', () => {
    it('aggregates multiple consignments and computes utilization percentages', () => {
      const sampleConsignments: TripConsignment[] = [
        {
          id: 'c1',
          tripId: 8850,
          consignmentReference: 'LTL-8850-1001',
          clientId: 1,
          clientName: 'Exporter A',
          loadingCity: 'Agadir',
          loadingCountry: 'MA',
          deliveryCity: 'Paris',
          deliveryCountry: 'FR',
          cargoDescription: 'Fruits',
          isTemperatureControlled: true,
          palletCount: 10,
          palletType: 'euro',
          isStackable: false,
          ldmMeters: 4.0,
          volumeM3: 20.0,
          grossWeightKg: 6000,
          chargeableWeightKg: 7400,
          freightPrice: 22000,
          currency: 'MAD',
          cmrNumber: 'CMR-LTL-8850-1001',
          status: 'manifested',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'c2',
          tripId: 8850,
          consignmentReference: 'LTL-8850-1002',
          clientId: 2,
          clientName: 'Exporter B',
          loadingCity: 'Casablanca',
          loadingCountry: 'MA',
          deliveryCity: 'Lyon',
          deliveryCountry: 'FR',
          cargoDescription: 'Textiles',
          isTemperatureControlled: false,
          palletCount: 8,
          palletType: 'industrial',
          isStackable: true,
          ldmMeters: 2.0, // 8 * 0.5 / 2
          volumeM3: 15.0,
          grossWeightKg: 4000,
          chargeableWeightKg: 4995,
          freightPrice: 16000,
          currency: 'MAD',
          cmrNumber: 'CMR-LTL-8850-1002',
          status: 'loaded',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const radar = calculateTrailerUtilization(sampleConsignments);

      expect(radar.totalLdm).toBe(6.0);
      expect(radar.maxLdm).toBe(13.6);
      expect(radar.ldmUtilizationPct).toBe(44.1); // 6.0 / 13.6 * 100
      expect(radar.totalGrossWeightKg).toBe(10000);
      expect(radar.maxWeightKg).toBe(24000);
      expect(radar.weightUtilizationPct).toBe(41.7); // 10000 / 24000 * 100
      expect(radar.totalFreightRevenue).toBe(38000);
      expect(radar.totalPallets).toBe(18);
      expect(radar.consignmentsCount).toBe(2);
      expect(radar.isOverloaded).toBe(false);
      expect(radar.isOverLdm).toBe(false);
    });

    it('triggers overload and over-LDM alerts when limits are exceeded', () => {
      const heavyConsignments: TripConsignment[] = [
        {
          id: 'c-heavy',
          tripId: 8850,
          consignmentReference: 'LTL-OVERLOAD',
          clientId: 1,
          clientName: 'Heavy Machinery Co.',
          loadingCity: 'Tangier',
          loadingCountry: 'MA',
          deliveryCity: 'Valencia',
          deliveryCountry: 'ES',
          cargoDescription: 'Steel Parts',
          isTemperatureControlled: false,
          palletCount: 30,
          palletType: 'euro',
          isStackable: false,
          ldmMeters: 14.0, // Exceeds 13.6m
          volumeM3: 50.0,
          grossWeightKg: 25500, // Exceeds 24,000 kg
          chargeableWeightKg: 25900,
          freightPrice: 35000,
          currency: 'MAD',
          cmrNumber: 'CMR-HEAVY',
          status: 'manifested',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const radar = calculateTrailerUtilization(heavyConsignments);

      expect(radar.isOverLdm).toBe(true);
      expect(radar.isOverloaded).toBe(true);
      expect(radar.ldmUtilizationPct).toBe(100);
      expect(radar.weightUtilizationPct).toBe(100);
    });
  });

  describe('Server Actions Execution', () => {
    it('creates an LTL consignment and generates unique CMR number', async () => {
      const input: CreateLtlConsignmentInput = {
        tripId: 9901,
        clientName: 'Primeurs du Souss',
        loadingCity: 'Agadir',
        loadingCountry: 'MA',
        deliveryCity: 'Perpignan',
        deliveryCountry: 'FR',
        cargoDescription: 'Courgettes & Poivrons Extra',
        isTemperatureControlled: true,
        targetTemperatureC: 9,
        palletCount: 6,
        palletType: 'euro',
        isStackable: true,
        grossWeightKg: 2800,
        freightPrice: 17500,
        currency: 'MAD',
        customsMrn: '26FR00984128172',
      };

      const res = await createLtlConsignmentAction(input);

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.consignmentReference).toMatch(/^LTL-9901-\d{4}$/);
      expect(res.data?.cmrNumber).toMatch(/^CMR-LTL-9901-\d{4}$/);
      expect(res.data?.ldmMeters).toBe(1.2); // 6 * 0.4 / 2
      expect(res.data?.status).toBe('manifested');
    });

    it('rejects invalid inputs with Zod validation error', async () => {
      const invalidInput: any = {
        tripId: -5,
        clientName: '',
        palletCount: 0,
      };

      const res = await createLtlConsignmentAction(invalidInput);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('fetches consignments for a trip from Supabase database', async () => {
      const res = await fetchTripConsignmentsAction(9901);

      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0].clientName).toBe('Atlas Agro Export');
      expect(res.data[0].cmrNumber).toBe('CMR-LTL-9901-4411');
    });

    it('updates consignment status through lifecycle phases', async () => {
      // First create a consignment
      const input: CreateLtlConsignmentInput = {
        tripId: 9902,
        clientName: 'Sidi Ali Mineral',
        loadingCity: 'Tanger Med',
        deliveryCity: 'Algeciras',
        cargoDescription: 'Packaged Goods',
        isTemperatureControlled: false,
        palletCount: 4,
        palletType: 'euro',
        isStackable: false,
        grossWeightKg: 1500,
        freightPrice: 8000,
      };

      const createRes = await createLtlConsignmentAction(input);
      expect(createRes.success).toBe(true);
      const consignmentId = createRes.data!.id;

      // Update to 'loaded'
      const updateRes1 = await updateConsignmentStatusAction({
        consignmentId,
        status: 'loaded',
      });
      expect(updateRes1.success).toBe(true);
      expect(updateRes1.data?.status).toBe('loaded');

      // Update to 'customs_cleared'
      const updateRes2 = await updateConsignmentStatusAction({
        consignmentId,
        status: 'customs_cleared',
      });
      expect(updateRes2.success).toBe(true);
      expect(updateRes2.data?.status).toBe('customs_cleared');

      // Update to 'delivered'
      const updateRes3 = await updateConsignmentStatusAction({
        consignmentId,
        status: 'delivered',
      });
      expect(updateRes3.success).toBe(true);
      expect(updateRes3.data?.status).toBe('delivered');
    });
  });
});
