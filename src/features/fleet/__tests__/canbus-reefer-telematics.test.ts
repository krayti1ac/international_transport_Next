import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  ingestFmsTelematicsPacket,
} from '../services/canbus-telematics.actions';
import { POST } from '@/app/api/telematics/fms/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data:
          table === 'trucks'
            ? { id: 101, plate_number: '12345-A-26', model: 'Volvo FH540', status: 'active' }
            : table === 'trip_orders'
            ? {
                id: 701,
                cmr_number: 'CMR-TIR-2026-701',
                goods_description_export: 'Fresh Strawberries (Fraises fraîches)',
                goods_description_import: null,
                driver_id: 11,
              }
            : table === 'drivers'
            ? { id: 11, name: 'Karim Mansouri' }
            : null,
        error: null,
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../services/frigo-guard.actions', () => ({
  processFrigoTelematicsGuard: vi.fn().mockResolvedValue({ isBreached: false }),
}));

vi.mock('@/features/tracking/services/port-geofence.actions', () => ({
  evaluatePortGeofences: vi.fn().mockResolvedValue({}),
}));

describe('IoT FMS CAN-Bus & Extended Reefer Telematics Stream Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Standard Cruise Telemetry Ingestion', () => {
    it('successfully ingests normal cruise packet with optimal cold chain parameters', async () => {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: '12345-A-26',
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 82,
        fuel_level_percent: 78,
        engine_speed_rpm: 1450,
        engine_coolant_temp_c: 88,
        odometer_km: 195000,
        reefer_temp_c: -18.5,
        reefer_mode: 'cooling',
        is_defrost_active: false,
        refrigerant_pressure_bar: 15.2,
      });

      expect(res.success).toBe(true);
      expect(res.alerts).toHaveLength(0);
      expect(res.state).toBeDefined();
      expect(res.state?.plate_number).toBe('12345-A-26');
      expect(res.state?.reefer_temp_c).toBe(-18.5);
      expect(res.state?.reefer_mode).toBe('cooling');
      expect(res.state?.refrigerant_pressure_bar).toBe(15.2);
      expect(res.state?.engine_health).toBe('healthy');
    });
  });

  describe('2. Defrost Cycle Anomaly Radar (Stuck Defrost > 45 mins)', () => {
    it('triggers REEFER_DEFROST_STUCK alert when defrost duration exceeds 45 minutes', async () => {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: '12345-A-26',
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 80,
        fuel_level_percent: 75,
        engine_speed_rpm: 1420,
        engine_coolant_temp_c: 89,
        odometer_km: 195200,
        reefer_temp_c: 7.2,
        reefer_mode: 'defrost',
        is_defrost_active: true,
        defrost_duration_minutes: 54, // Exceeds 45 min threshold!
        refrigerant_pressure_bar: 14.8,
      });

      expect(res.success).toBe(true);
      const defrostAlert = res.alerts.find((a) => a.alert_type === 'REEFER_DEFROST_STUCK');
      expect(defrostAlert).toBeDefined();
      expect(defrostAlert?.severity).toBe('warning');
      expect(defrostAlert?.metrics.defrost_duration_minutes).toBe(54);
      expect(defrostAlert?.title).toContain('Defrost Cycle Stuck');
      expect(defrostAlert?.title_fr).toContain('Defrost Bloqué');
      expect(defrostAlert?.title_es).toContain('desescarche');
    });

    it('escalates REEFER_DEFROST_STUCK to critical severity when duration exceeds 60 minutes', async () => {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: '12345-A-26',
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 80,
        fuel_level_percent: 74,
        engine_speed_rpm: 1420,
        engine_coolant_temp_c: 89,
        odometer_km: 195250,
        reefer_temp_c: 6.5,
        reefer_mode: 'defrost',
        is_defrost_active: true,
        defrost_duration_minutes: 68,
      });

      const defrostAlert = res.alerts.find((a) => a.alert_type === 'REEFER_DEFROST_STUCK');
      expect(defrostAlert?.severity).toBe('critical');
    });
  });

  describe('3. Refrigerant Leak & Expansion Valve (TXV) Radar', () => {
    it('detects refrigerant leak when circuit pressure collapses below 8.0 bar', async () => {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: '12345-A-26',
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 84,
        fuel_level_percent: 72,
        engine_speed_rpm: 1460,
        engine_coolant_temp_c: 90,
        odometer_km: 195300,
        reefer_temp_c: 6.8,
        reefer_mode: 'cooling',
        refrigerant_pressure_bar: 4.2, // Critical pressure drop
        refrigerant_leak_detected: true,
      });

      expect(res.success).toBe(true);
      const leakAlert = res.alerts.find((a) => a.alert_type === 'REEFER_REFRIGERANT_LEAK');
      expect(leakAlert).toBeDefined();
      expect(leakAlert?.severity).toBe('critical');
      expect(leakAlert?.metrics.refrigerant_pressure_bar).toBe(4.2);
      expect(leakAlert?.title).toContain('Refrigerant Leak Detected');
      expect(leakAlert?.description).toContain('4.2 bar');
    });
  });

  describe('4. Critical Cold Chain Breach & Automated Insurance Claim Generation', () => {
    it('automatically generates an insurance claim dossier when temperature breach is severe', async () => {
      const res = await ingestFmsTelematicsPacket({
        truck_plate: '12345-A-26',
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 75,
        fuel_level_percent: 70,
        engine_speed_rpm: 1410,
        engine_coolant_temp_c: 91,
        odometer_km: 195400,
        reefer_temp_c: 9.8, // Severe excursion > 8°C for fresh produce
        cargo_setpoint_c: 4.0,
        trip_id: 701,
        refrigerant_pressure_bar: 4.0,
        refrigerant_leak_detected: true,
      });

      expect(res.success).toBe(true);
      const claimAlert = res.alerts.find((a) => a.alert_type === 'REEFER_CARGO_LOSS_IMMINENT');
      expect(claimAlert).toBeDefined();
      expect(claimAlert?.severity).toBe('critical');
      expect(claimAlert?.metrics.claim_reference).toMatch(/^CLM-701-/);

      // Verify claim object created via CargoLossAssessmentService
      expect(res.claim).toBeDefined();
      expect(res.claim?.tripId).toBe(701);
      expect(res.claim?.truckPlate).toBe('12345-A-26');
      expect(res.claim?.claimDossierHash).toBeDefined();
      expect(res.claim?.claimDossierHash.length).toBe(64); // HMAC-SHA256 hex string

      // Verify financial precision via Decimal.js (deductible = 5000 MAD)
      const grossLoss = new Decimal(res.claim!.grossLossAmount);
      const deductible = new Decimal(res.claim!.deductibleAmount);
      const netIndemnity = new Decimal(res.claim!.netIndemnityAmount);

      expect(deductible.toNumber()).toBe(5000);
      expect(netIndemnity.toNumber()).toBe(grossLoss.minus(deductible).toNumber());

      // Verify state reflects active claim reference
      expect(res.state?.active_claim_reference).toBe(res.claim?.claimReference);
    });
  });

  describe('5. REST API Webhook (/api/telematics/fms)', () => {
    it('processes batch telematics packets and returns alerts and created claims', async () => {
      const batchPayload = [
        {
          truck_plate: '12345-A-26',
          latitude: 35.7595,
          longitude: -5.834,
          speed_kmh: 80,
          fuel_level_percent: 68,
          engine_speed_rpm: 1400,
          engine_coolant_temp_c: 89,
          odometer_km: 195500,
          reefer_temp_c: -18.0,
          reefer_mode: 'cooling',
          refrigerant_pressure_bar: 14.8,
        },
      ];

      const req = new NextRequest('http://localhost:3000/api/telematics/fms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batchPayload),
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processedCount).toBe(1);
      expect(Array.isArray(json.alerts)).toBe(true);
      expect(Array.isArray(json.claimsCreated)).toBe(true);
    });

    it('rejects payload missing truck_plate and imei with 400 Bad Request', async () => {
      const invalidPayload = {
        latitude: 35.7595,
        longitude: -5.834,
        speed_kmh: 80,
      };

      const req = new NextRequest('http://localhost:3000/api/telematics/fms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('truck_plate or imei is required');
    });
  });
});
