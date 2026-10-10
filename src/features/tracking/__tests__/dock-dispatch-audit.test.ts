import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  fetchDockArrivalsAuditAction,
  resendTargetedDispatchAction,
} from '../services/dock-dispatch-audit.actions';
import { TargetedReceiverDispatcherService } from '../services/targeted-receiver-dispatcher.service';
import * as CertActions from '../services/multi-temp-certificate.actions';

let mockAuditLogs: any[] = [];
let mockTrip: any = null;
let mockCompartment: any = null;

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: (table: string) => {
      if (table === 'audit_logs') {
        return {
          select: () => {
            const chain: any = {
              eq: () => chain,
              in: () => chain,
              order: () => chain,
              limit: async () => ({
                data: mockAuditLogs,
                error: null,
              }),
              gte: () => chain,
              lte: () => chain,
            };
            return chain;
          },
        };
      }
      if (table === 'trip_orders') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: mockTrip,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'reefer_compartment_profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mockCompartment,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      };
    },
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

describe('Unloading Docks & Auto-Dispatch Audit Log Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTrip = {
      id: 8840,
      trip_number: 'TRIP-2026-8840',
      cmr_number: 'CMR-2026-8840',
      trailer_id: 42,
      trucks: { plate_number: '67890-A-40' },
      trailers: { id: 42, plate_number: 'MA-R-8821' },
    };

    mockCompartment = {
      id: 'comp-uuid-c1',
      compartment_code: 'C1',
      compartment_name: 'Front Frozen Zone',
      cargo_category: 'deep_frozen',
      setpoint_temp_c: -20.0,
      trailer_id: 42,
    };

    const now = Date.now();
    mockAuditLogs = [
      {
        id: 901,
        action: 'whatsapp_notification',
        entity_type: 'geofence_arrival',
        entity_id: '8840',
        created_at: new Date(now - 15 * 60 * 1000).toISOString(),
        new_values: JSON.stringify({
          event: 'AUTO_GEOFENCE_RECEIVER_DISPATCH',
          tripId: 8840,
          truckPlate: '67890-A-40',
          zoneName: 'Mercamadrid - Muelle 14 Frutas',
          dispatchedCount: 2,
          receivers: [
            { compartment: 'C1', phone: '+34612345678', success: true, skippedCooldown: false },
            { compartment: 'C2', phone: '+34612345678', success: true, skippedCooldown: false },
          ],
        }),
      },
      {
        id: 902,
        action: 'whatsapp_notification',
        entity_type: 'trip_order',
        entity_id: '8835',
        created_at: new Date(now - 80 * 60 * 1000).toISOString(),
        new_values: JSON.stringify({
          compartmentCode: 'C1',
          receiverName: 'Jean-Luc Dubois (Perpignan)',
          receiverPhone: '+33612987654',
          trailerPlate: 'MA-R-7714',
          arrivalLocationName: 'Marché Saint-Charles Perpignan',
          status: 'compliant',
          mktTempC: 3.8,
          isSimulated: false,
          messageId: 'wamid.12345678',
        }),
      },
    ];

    vi.spyOn(CertActions, 'generateCompartmentGdpCertificateAction').mockImplementation(
      async (input: any) => ({
        success: true,
        payload: {
          certificateNumber: 'GDP-TEST-001',
          compartmentCode: input.compartmentId ? 'C1' : 'C1',
          compartmentName: 'Front Frozen Zone',
          cargoCategory: 'deep_frozen',
          trailerId: 42,
          trailerPlate: 'MA-R-8821',
          tripId: 8840,
          tripNumber: 'TRIP-2026-8840',
          cmrNumber: 'CMR-2026-8840',
          clientName: 'Mercamadrid Frigo Distribución S.L.',
          setpointTempC: -20.0,
          minTempLimitC: -22.0,
          maxTempLimitC: -18.0,
          mktTempC: -19.45,
          avgSupplyAirTempC: -20.1,
          avgReturnAirTempC: -19.5,
          excursionMinutes: 0,
          doorOpenCount: 0,
          bulkheadPositionPct: 50,
          status: 'compliant',
          complianceScore: 100,
          issuedAt: new Date().toISOString(),
          verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          verificationUrl: 'https://tms.transbodanon.com/verify/cold-chain/e3b0c44298fc1c14',
          logsSample: [],
          locale: input.locale,
        },
      })
    );

    vi.spyOn(TargetedReceiverDispatcherService, 'dispatchCompartmentToReceiver').mockImplementation(
      async (params: any) => ({
        success: true,
        phone: params.payload.receiverPhone,
        receiverName: params.payload.receiverName,
        compartmentCode: params.payload.compartmentCode,
        isSimulated: true,
        messageId: `wamid.mock.resend.${Date.now()}`,
      })
    );
  });

  describe('1. Audit Log Retrieval & Stats Calculation', () => {
    it('retrieves dock arrival items and parses them correctly', async () => {
      const res = await fetchDockArrivalsAuditAction();

      expect(res.success).toBe(true);
      expect(res.items.length).toBeGreaterThanOrEqual(3);
      expect(res.stats.totalArrivals).toBe(res.items.length);
      expect(res.stats.successRatePct).toBeGreaterThan(0);

      const firstItem = res.items[0];
      expect(firstItem.truckPlate).toBe('67890-A-40');
      expect(firstItem.zoneName).toContain('Mercamadrid');
      expect(firstItem.compartmentCode).toBe('C1');
      expect(firstItem.isCooldownActive).toBe(true);
      expect(firstItem.cooldownRemainingMinutes).toBeGreaterThan(0);
    });

    it('filters items accurately by compartmentCode', async () => {
      const res = await fetchDockArrivalsAuditAction({ compartmentCode: 'C2' });

      expect(res.success).toBe(true);
      expect(res.items.every((i) => i.compartmentCode === 'C2')).toBe(true);
    });

    it('filters items accurately by searchQuery (truck plate or dock name)', async () => {
      const res = await fetchDockArrivalsAuditAction({ searchQuery: 'Perpignan' });

      expect(res.success).toBe(true);
      expect(res.items.length).toBe(1);
      expect(res.items[0].zoneName).toContain('Perpignan');
      expect(res.items[0].receiverName).toContain('Jean-Luc');
    });

    it('calculates cooldown state accurately (inactive after 60 minutes)', async () => {
      const res = await fetchDockArrivalsAuditAction();
      const perpignanItem = res.items.find((i) => i.zoneName.includes('Perpignan'));

      expect(perpignanItem).toBeDefined();
      expect(perpignanItem?.isCooldownActive).toBe(false);
      expect(perpignanItem?.cooldownRemainingMinutes).toBe(0);
    });
  });

  describe('2. Manual Resend with Cooldown Bypass', () => {
    it('successfully triggers immediate manual resend and returns updated item', async () => {
      const res = await resendTargetedDispatchAction({
        tripId: 8840,
        compartmentCode: 'C1',
        receiverName: 'Carlos Rodriguez',
        receiverPhone: '+34612345678',
        zoneName: 'Mercamadrid - Muelle 14',
        forceBypassCooldown: true,
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toContain('wamid.mock.resend');
      expect(res.item).toBeDefined();
      expect(res.item?.compartmentCode).toBe('C1');
      expect(res.item?.receiverName).toBe('Carlos Rodriguez');
      expect(res.item?.dispatchStatus).toBe('sent');
    });

    it('fails gracefully when trip is not found', async () => {
      mockTrip = null;

      const res = await resendTargetedDispatchAction({
        tripId: 9999,
        compartmentCode: 'C1',
        receiverName: 'Carlos Rodriguez',
        receiverPhone: '+34612345678',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('تعذر العثور على الرحلة');
    });

    it('rejects invalid inputs based on Zod schema', async () => {
      const res = await resendTargetedDispatchAction({
        tripId: -5,
        compartmentCode: '',
        receiverName: '',
        receiverPhone: '123',
      });

      expect(res.success).toBe(false);
    });
  });

  describe('3. Fallback Demo Protection', () => {
    it('returns structured demo data when audit_logs table returns empty', async () => {
      mockAuditLogs = [];

      const res = await fetchDockArrivalsAuditAction();

      expect(res.success).toBe(true);
      expect(res.items.length).toBeGreaterThan(0);
      expect(res.stats.topDocks.length).toBeGreaterThan(0);
    });
  });
});

