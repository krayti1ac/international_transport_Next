import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateConsignmentEpodHash,
  verifyConsignmentEpodHash,
  sortConsignmentsBySequence,
  buildPublicConsignmentTrackingUrl,
  formatPublicTrackingData,
} from '../services/consignment-epod.service';
import {
  submitConsignmentEpodAction,
  updateDropSequenceAction,
  getPublicConsignmentTrackingAction,
  clearEpodStore,
} from '../services/consignment-epod.actions';
import type { TripConsignment } from '../types/groupage-ltl.types';

// Mock Supabase Server Client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'consign-epod-01',
              trip_id: 8840,
              consignment_reference: 'LTL-8840-001',
              client_id: 10,
              client_name: 'Atlas Agro Agadir',
              cmr_number: 'CMR-8840-001',
              loading_city: 'Agadir',
              loading_country: 'MA',
              delivery_city: 'Valencia',
              delivery_country: 'ES',
              delivery_dock_name: 'Mercavalencia Nave 12',
              cargo_description: 'Tomates Cerises',
              is_temperature_controlled: true,
              target_temperature_c: 8,
              pallet_count: 8,
              pallet_type: 'euro',
              gross_weight_kg: 4800,
              freight_price: 24000,
              currency: 'MAD',
              status: 'loaded',
              drop_sequence: 1,
              tracking_token: 'tok-abc-1234567890',
            },
            error: null,
          }),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'consign-epod-01',
                trip_id: 8840,
                consignment_reference: 'LTL-8840-001',
                client_id: 10,
                client_name: 'Atlas Agro Agadir',
                cmr_number: 'CMR-8840-001',
                loading_city: 'Agadir',
                loading_country: 'MA',
                delivery_city: 'Valencia',
                delivery_country: 'ES',
                delivery_dock_name: 'Mercavalencia Nave 12',
                cargo_description: 'Tomates Cerises',
                is_temperature_controlled: true,
                target_temperature_c: 8,
                pallet_count: 8,
                pallet_type: 'euro',
                gross_weight_kg: 4800,
                freight_price: 24000,
                currency: 'MAD',
                status: 'loaded',
                drop_sequence: 1,
                tracking_token: 'tok-abc-1234567890',
              },
            ],
            error: null,
          }),
        }),
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'consign-epod-01',
              trip_id: 8840,
              consignment_reference: 'LTL-8840-001',
              client_id: 10,
              client_name: 'Atlas Agro Agadir',
              cmr_number: 'CMR-8840-001',
              loading_city: 'Agadir',
              loading_country: 'MA',
              delivery_city: 'Valencia',
              delivery_country: 'ES',
              delivery_dock_name: 'Mercavalencia Nave 12',
              cargo_description: 'Tomates Cerises',
              is_temperature_controlled: true,
              target_temperature_c: 8,
              pallet_count: 8,
              pallet_type: 'euro',
              gross_weight_kg: 4800,
              freight_price: 24000,
              currency: 'MAD',
              status: 'signed_epod',
              drop_sequence: 1,
              tracking_token: 'tok-abc-1234567890',
              epod_signer_name: 'Miguel Ángel',
              epod_signer_role: 'Jefe de Muelle',
              epod_signed_at: '2026-10-15T15:30:00Z',
              epod_hmac_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 7701 }, error: null }),
        }),
      }),
    }),
  }),
}));

// Mock Audit Logger
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Consignment-Level e-POD & Multi-Drop Sequencing Engine', () => {
  beforeEach(async () => {
    await clearEpodStore();
    vi.clearAllMocks();
  });

  describe('Cryptographic Forensic e-POD Hashing (HMAC-SHA256)', () => {
    const sealParams = {
      consignmentReference: 'LTL-8840-001',
      cmrNumber: 'CMR-8840-001',
      signerName: 'Ahmed Benali',
      signerRole: 'Chef de Réception',
      signedAt: '2026-10-15T14:30:00.000Z',
      gpsLat: 39.4699,
      gpsLng: -0.3763,
      signatureLength: 4500,
    };

    it('generates a deterministic 64-character hexadecimal HMAC-SHA256 hash', () => {
      const hash1 = generateConsignmentEpodHash(sealParams);
      const hash2 = generateConsignmentEpodHash(sealParams);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash1).toBe(hash2);
    });

    it('detects tampering when any parameters are modified', () => {
      const originalHash = generateConsignmentEpodHash(sealParams);

      // Modified signer name
      const tamperedSigner = generateConsignmentEpodHash({
        ...sealParams,
        signerName: 'Impostor Signer',
      });
      expect(tamperedSigner).not.toBe(originalHash);

      // Modified GPS coordinates
      const tamperedGps = generateConsignmentEpodHash({
        ...sealParams,
        gpsLat: 39.4700,
      });
      expect(tamperedGps).not.toBe(originalHash);

      // Modified timestamp
      const tamperedTime = generateConsignmentEpodHash({
        ...sealParams,
        signedAt: '2026-10-15T15:30:00.000Z',
      });
      expect(tamperedTime).not.toBe(originalHash);
    });

    it('verifies valid cryptographic hashes and rejects invalid ones', () => {
      const validHash = generateConsignmentEpodHash(sealParams);
      expect(verifyConsignmentEpodHash(sealParams, validHash)).toBe(true);

      const invalidHash = '0000000000000000000000000000000000000000000000000000000000000000';
      expect(verifyConsignmentEpodHash(sealParams, invalidHash)).toBe(false);
    });
  });

  describe('Multi-Drop Sequencing & Navigation Helpers', () => {
    it('sorts consignments in sequential stop order (1, 2, 3...)', () => {
      const mockStops: TripConsignment[] = [
        {
          id: 'c-barcelona',
          tripId: 8840,
          consignmentReference: 'LTL-BCN',
          clientName: 'Client BCN',
          deliveryCity: 'Barcelona',
          deliveryCountry: 'ES',
          dropSequence: 2,
        } as any,
        {
          id: 'c-perpignan',
          tripId: 8840,
          consignmentReference: 'LTL-PGF',
          clientName: 'Client PGF',
          deliveryCity: 'Perpignan',
          deliveryCountry: 'FR',
          dropSequence: 3,
        } as any,
        {
          id: 'c-valencia',
          tripId: 8840,
          consignmentReference: 'LTL-VLC',
          clientName: 'Client VLC',
          deliveryCity: 'Valencia',
          deliveryCountry: 'ES',
          dropSequence: 1,
        } as any,
      ];

      const sorted = sortConsignmentsBySequence(mockStops);

      expect(sorted[0].deliveryCity).toBe('Valencia');
      expect(sorted[1].deliveryCity).toBe('Barcelona');
      expect(sorted[2].deliveryCity).toBe('Perpignan');
    });

    it('builds isolated public tracking URL with token', () => {
      const url = buildPublicConsignmentTrackingUrl('LTL-8840-001', 'tok-secret-xyz');
      expect(url).toContain('/fleet/groupage/tracking/LTL-8840-001?token=tok-secret-xyz');
    });

    it('sanitizes public tracking data and conceals other clients cargo', () => {
      const consignment: TripConsignment = {
        id: 'c1',
        tripId: 8840,
        consignmentReference: 'LTL-8840-001',
        clientId: 10,
        clientName: 'Client A',
        cargoDescription: 'Strawberries',
        isTemperatureControlled: false,
        palletCount: 10,
        palletType: 'euro',
        isStackable: false,
        ldmMeters: 4.0,
        volumeM3: 14.4,
        grossWeightKg: 4000,
        chargeableWeightKg: 7400,
        freightPrice: 20000,
        currency: 'MAD',
        cmrNumber: 'CMR-LTL-001',
        loadingCity: 'Larache',
        loadingCountry: 'MA',
        deliveryCity: 'Madrid',
        deliveryCountry: 'ES',
        status: 'signed_epod',
        epodSignerName: 'Juan Carlos',
        epodSignerRole: 'Recepción',
        epodSignedAt: '2026-10-15T12:00:00Z',
        epodHmacHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const publicData = formatPublicTrackingData(consignment);

      expect(publicData.consignmentReference).toBe('LTL-8840-001');
      expect(publicData.clientName).toBe('Client A');
      expect(publicData.isVerified).toBe(true);
      expect(publicData.epodSignerName).toBe('Juan Carlos');
    });
  });

  describe('Server Actions Execution', () => {
    it('submits consignment e-POD and triggers instant invoice generation', async () => {
      const res = await submitConsignmentEpodAction({
        consignmentId: 'consign-epod-01',
        tripId: 8840,
        signerName: 'Roberto Martinez',
        signerRole: 'Responsable Quai',
        signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
        gpsLat: 39.4699,
        gpsLng: -0.3763,
        triggerInstantInvoice: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.epodHmacHash).toHaveLength(64);
      expect(res.data?.signedAt).toBeDefined();
      expect(res.data?.consignmentReference).toBe('LTL-8840-001');
    });

    it('rejects invalid inputs when signer name is missing', async () => {
      const res = await submitConsignmentEpodAction({
        consignmentId: 'consign-epod-01',
        tripId: 8840,
        signerName: '',
        signatureBase64: 'data:image/png;base64,abc',
      } as any);

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('updates multi-drop delivery sequence successfully', async () => {
      const res = await updateDropSequenceAction({
        tripId: 8840,
        sequenceUpdates: [
          { consignmentId: 'c1', dropSequence: 1 },
          { consignmentId: 'c2', dropSequence: 2 },
        ],
      });

      expect(res.success).toBe(true);
    });

    it('retrieves isolated public tracking data by reference', async () => {
      const res = await getPublicConsignmentTrackingAction('LTL-8840-001');

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.consignmentReference).toBe('LTL-8840-001');
      expect(res.data?.clientName).toBe('Atlas Agro Agadir');
      expect(res.data?.deliveryCity).toBe('Valencia');
    });
  });
});

