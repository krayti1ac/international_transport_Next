import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeofenceReceiverTriggerService } from '../services/geofence-receiver-trigger.service';
import { TargetedReceiverDispatcherService } from '../services/targeted-receiver-dispatcher.service';
import * as CertActions from '../services/multi-temp-certificate.actions';

let mockActiveTrip: any = null;
let mockCompartments: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: (table: string) => {
      if (table === 'trip_orders') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: mockActiveTrip,
                      error: null,
                    }),
                  }),
                }),
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
                order: async () => ({
                  data: mockCompartments,
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

describe('Auto-Geofence Traccar Webhook to Targeted Receiver Dispatch Engine', () => {
  beforeEach(() => {
    GeofenceReceiverTriggerService.resetArrivalCooldown();
    TargetedReceiverDispatcherService.resetCooldown();
    vi.clearAllMocks();

    mockActiveTrip = {
      id: 8840,
      trip_number: 'TRIP-2026-8840',
      cmr_number: 'CMR-2026-8840',
      truck_id: 15,
      trailer_id: 42,
      client_id: 99,
      status: 'in_transit',
      destination_city: 'Mercamadrid, Spain',
      truck: { plate_number: '67890-A-40' },
      trailer: { id: 42, plate_number: 'MA-R-8821' },
      client: {
        name: 'Mercamadrid Frigo Distribución S.L.',
        phone: '+34612345678',
        client_type: 'importer',
      },
    };

    mockCompartments = [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        compartment_code: 'C1',
        compartment_name: 'Front Frozen Zone',
        cargo_category: 'deep_frozen',
        setpoint_temp_c: -20.0,
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        compartment_code: 'C2',
        compartment_name: 'Chilled Produce Zone',
        cargo_category: 'fresh_produce',
        setpoint_temp_c: 4.0,
      },
    ];

    vi.spyOn(CertActions, 'generateCompartmentGdpCertificateAction').mockImplementation(
      async (input: any) => ({
        success: true,
        payload: {
          certificateNumber: `GDP-${input.compartmentId.substring(0, 4)}`,
          compartmentCode: input.compartmentId.endsWith('1') ? 'C1' : 'C2',
          compartmentName: input.compartmentId.endsWith('1') ? 'Front Frozen Zone' : 'Chilled Produce Zone',
          cargoCategory: input.compartmentId.endsWith('1') ? 'deep_frozen' : 'fresh_produce',
          trailerId: 42,
          trailerPlate: 'MA-R-8821',
          tripId: 8840,
          tripNumber: 'TRIP-2026-8840',
          cmrNumber: 'CMR-2026-8840',
          clientName: 'Mercamadrid Frigo Distribución S.L.',
          setpointTempC: input.compartmentId.endsWith('1') ? -20.0 : 4.0,
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
        messageId: `wamid.mock.${Date.now()}`,
      })
    );
  });

  describe('1. Unloading Geofence Arrival & Auto-Dispatch Trigger', () => {
    it('triggers automated WhatsApp dispatch for all compartments upon entering warehouse geofence', async () => {
      const result = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga - Mercamadrid',
        zoneId: 901,
        zoneType: 'customer_warehouse',
      });

      expect(result.triggered).toBe(true);
      expect(result.tripId).toBe(8840);
      expect(result.dispatchedCount).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].compartmentCode).toBe('C1');
      expect(result.results[1].compartmentCode).toBe('C2');
    });

    it('detects Spanish locale automatically for Spanish recipient phone (+34)', async () => {
      const dispatchSpy = vi.spyOn(TargetedReceiverDispatcherService, 'dispatchCompartmentToReceiver');

      await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Mercamadrid Unloading Dock',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      expect(dispatchSpy).toHaveBeenCalled();
      const firstCallArgs = dispatchSpy.mock.calls[0][0];
      expect(firstCallArgs.locale).toBe('es');
      expect(firstCallArgs.payload.isGeofenceTriggered).toBe(true);
      expect(firstCallArgs.payload.arrivalLocationName).toContain('Mercamadrid');
    });

    it('ignores non-unloading zones (e.g. gas stations or highway stops)', async () => {
      const result = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 38.9876,
        longitude: -3.9234,
        zoneName: 'Station Repsol Valdepeñas',
        zoneId: 504,
        zoneType: 'gas_station',
      });

      expect(result.triggered).toBe(false);
      expect(result.dispatchedCount).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('2. Idempotency & Cooldown Radar Protection', () => {
    it('prevents duplicate dispatches when truck stays inside the unloading geofence', async () => {
      // First entry
      const res1 = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      expect(res1.triggered).toBe(true);
      expect(res1.dispatchedCount).toBe(2);

      // Immediate second ping in same zone
      const res2 = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      expect(res2.triggered).toBe(false);
      expect(res2.dispatchedCount).toBe(0);
    });

    it('allows re-dispatching when forceBypassCooldown is set to true', async () => {
      await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      const resForced = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
        forceBypassCooldown: true,
      });

      expect(resForced.triggered).toBe(true);
      expect(resForced.dispatchedCount).toBe(2);
    });

    it('clears idempotency cache cleanly on resetArrivalCooldown', async () => {
      await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      GeofenceReceiverTriggerService.resetArrivalCooldown();

      const resAfterReset = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga Mercamadrid',
        zoneId: 901,
        zoneType: 'unloading_zone',
      });

      expect(resAfterReset.triggered).toBe(true);
      expect(resAfterReset.dispatchedCount).toBe(2);
    });
  });

  describe('3. Edge Cases & Resilience', () => {
    it('handles truck with no active trip gracefully without throwing', async () => {
      mockActiveTrip = null;

      const result = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 999,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga',
        zoneType: 'unloading_zone',
      });

      expect(result.triggered).toBe(false);
      expect(result.dispatchedCount).toBe(0);
    });

    it('handles client with missing phone gracefully', async () => {
      mockActiveTrip.client.phone = '';

      const result = await GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
        truckId: 15,
        latitude: 40.3541,
        longitude: -3.6842,
        zoneName: 'Muelle de Descarga',
        zoneType: 'unloading_zone',
      });

      expect(result.triggered).toBe(false);
      expect(result.error).toContain('رقم هاتف مستلم الشحنة غير مسجل');
    });
  });
});
