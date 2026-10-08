import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  evaluateThermalDeviation,
  evaluateDoorBreachRisk,
  resolveCurrentGeofenceZone,
  calculateColdChainIntegrityScore,
  generateIncidentAlerts,
} from '../services/mission-control.service';
import {
  dispatchIncidentEmergencyAlertAction,
  acknowledgeIncidentAlertAction,
} from '../services/mission-control.actions';
import type { TelematicsTelemetry } from '../types';

// Mock External Modules
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-emergency-99' }),
}));

vi.mock('@/features/push/services/push-notifications.actions', () => ({
  sendCriticalFleetAlertPushNotification: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Mission Control & Reefer Telematics Radar Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Thermal Deviation & Cold Chain Safety (Decimal.js)', () => {
    it('evaluates frozen fish (-25°C) within tolerance as optimal', () => {
      // Setpoint -25.0°C, measured -24.2°C (deviation 0.8°C <= 2.0°C)
      const res = evaluateThermalDeviation(-24.2, -25.0, 'frozen_fish');
      expect(res.tempDeviation).toBe(0.8);
      expect(res.tempStatus).toBe('optimal');
    });

    it('flags warning for moderate temperature drift', () => {
      // Setpoint -25.0°C, measured -21.5°C (deviation 3.5°C > 2.0°C and <= 4.5°C)
      const res = evaluateThermalDeviation(-21.5, -25.0, 'frozen_fish');
      expect(res.tempDeviation).toBe(3.5);
      expect(res.tempStatus).toBe('warning');
    });

    it('triggers critical_drift for severe temperature deviation', () => {
      // Setpoint -25.0°C, measured -18.0°C (deviation 7.0°C > 4.5°C)
      const res = evaluateThermalDeviation(-18.0, -25.0, 'frozen_fish');
      expect(res.tempDeviation).toBe(7.0);
      expect(res.tempStatus).toBe('critical_drift');
    });

    it('evaluates fresh produce (+4.0°C) strict tolerance (1.5°C)', () => {
      // Setpoint 4.0°C, measured 4.8°C (deviation 0.8°C <= 1.5°C)
      const optimalRes = evaluateThermalDeviation(4.8, 4.0, 'fresh_produce');
      expect(optimalRes.tempDeviation).toBe(0.8);
      expect(optimalRes.tempStatus).toBe('optimal');

      // Setpoint 4.0°C, measured 9.5°C (deviation 5.5°C > 4.0°C)
      const criticalRes = evaluateThermalDeviation(9.5, 4.0, 'fresh_produce');
      expect(criticalRes.tempDeviation).toBe(5.5);
      expect(criticalRes.tempStatus).toBe('critical_drift');
    });
  });

  describe('2. Reefer Door Sensor & Moving Security Breach', () => {
    it('allows door open when truck is stationary at loading dock (speed = 0)', () => {
      const risk = evaluateDoorBreachRisk(0, true);
      expect(risk).toBe(false);
    });

    it('flags emergency door breach when truck is moving with open door (speed > 10 km/h)', () => {
      const risk = evaluateDoorBreachRisk(65, true);
      expect(risk).toBe(true);
    });

    it('remains secure when doors are closed during highway driving', () => {
      const risk = evaluateDoorBreachRisk(85, false);
      expect(risk).toBe(false);
    });
  });

  describe('3. Strategic Geofence Detection (Tanger Med & Guerguerat)', () => {
    it('detects Tanger Med Port within 5km radius', () => {
      // Tanger Med coords: 35.885, -5.505
      const zone = resolveCurrentGeofenceZone(35.887, -5.503);
      expect(zone).toBeDefined();
      expect(zone?.id).toBe('port_tanger_med');
      expect(zone?.name_ar).toBe('ميناء طنجة المتوسط');
    });

    it('detects Guerguerat Border post in the African Corridor', () => {
      // Guerguerat coords: 21.353, -16.953
      const zone = resolveCurrentGeofenceZone(21.355, -16.951);
      expect(zone).toBeDefined();
      expect(zone?.id).toBe('border_guerguerat');
    });

    it('returns null for coordinates in open highway or non-port zones', () => {
      // Near Kenitra on the A1 motorway
      const zone = resolveCurrentGeofenceZone(34.25, -6.58);
      expect(zone).toBeNull();
    });
  });

  describe('4. Cold Chain Fleet Integrity Score (Decimal.js)', () => {
    it('returns 100% when all telemetry is optimal', () => {
      const mockList: TelematicsTelemetry[] = [
        {
          truckId: 1,
          truckPlate: '11111-A-1',
          truckModel: 'Volvo',
          latitude: 35.8,
          longitude: -5.5,
          speed: 80,
          ignition: true,
          recordedAt: new Date().toISOString(),
          cargoProfile: 'frozen_fish',
          currentTemp: -24.5,
          targetTemp: -25.0,
          tempDeviation: 0.5,
          tempStatus: 'optimal',
          doorOpen: false,
          doorBreachRisk: false,
          reeferEngineHours: 400,
          reeferSdiScore: 95,
          reeferStatus: 'optimal',
        },
      ];

      const score = calculateColdChainIntegrityScore(mockList);
      expect(score).toBe(100);
    });

    it('deducts weighted penalties for critical drifts and door breaches', () => {
      const mockList: TelematicsTelemetry[] = [
        {
          truckId: 1,
          truckPlate: '11111-A-1',
          truckModel: 'Volvo',
          latitude: 35.8,
          longitude: -5.5,
          speed: 80,
          ignition: true,
          recordedAt: new Date().toISOString(),
          cargoProfile: 'frozen_fish',
          currentTemp: -16.0,
          targetTemp: -25.0,
          tempDeviation: 9.0,
          tempStatus: 'critical_drift', // -25 penalty
          doorOpen: true,
          doorBreachRisk: true, // -15 penalty
          reeferEngineHours: 1200,
          reeferSdiScore: 45,
          reeferStatus: 'high_risk', // -10 penalty
        },
      ];

      // Total penalty = 25 + 15 + 10 = 50 -> Score = 50%
      const score = calculateColdChainIntegrityScore(mockList);
      expect(score).toBe(50);
    });
  });

  describe('5. Incident Alerts Generation & Emergency Actions', () => {
    it('generates trilingual critical alerts for temperature drift and door open', () => {
      const mockItem: TelematicsTelemetry = {
        truckId: 101,
        truckPlate: '44556-H-9',
        truckModel: 'Scania',
        latitude: 35.8,
        longitude: -5.5,
        speed: 70,
        ignition: true,
        recordedAt: new Date().toISOString(),
        cargoProfile: 'frozen_fish',
        currentTemp: -17.5,
        targetTemp: -25.0,
        tempDeviation: 7.5,
        tempStatus: 'critical_drift',
        doorOpen: true,
        doorBreachRisk: true,
        reeferEngineHours: 800,
        reeferSdiScore: 60,
        reeferStatus: 'service_due',
      };

      const alerts = generateIncidentAlerts([mockItem]);
      expect(alerts.length).toBe(2);

      const driftAlert = alerts.find((a) => a.alertType === 'temp_drift');
      expect(driftAlert).toBeDefined();
      expect(driftAlert?.severity).toBe('critical');
      expect(driftAlert?.titleAr).toContain('انحراف حراري حرج');
      expect(driftAlert?.titleFr).toContain('Dérive thermique critique');
      expect(driftAlert?.titleEs).toContain('Desviación térmica crítica');

      const doorAlert = alerts.find((a) => a.alertType === 'door_open_moving');
      expect(doorAlert).toBeDefined();
      expect(doorAlert?.severity).toBe('critical');
      expect(doorAlert?.titleAr).toContain('باب حاوية التبريد مفتوح أثناء الحركة');
    });

    it('dispatches emergency WhatsApp & Push alert and records audit log', async () => {
      const { sendWhatsAppCloudMessage } = await import('@/lib/whatsapp');
      const { sendCriticalFleetAlertPushNotification } = await import(
        '@/features/push/services/push-notifications.actions'
      );
      const { recordAuditLog } = await import('@/lib/audit.server');

      const res = await dispatchIncidentEmergencyAlertAction({
        alertId: 'alert-123',
        truckPlate: '12345-A-1',
        driverId: 501,
        driverPhone: '0661234567',
        alertType: 'انحراف حرارة Frigo',
        message: 'انحراف حرارة الحاوية إلى -16°C والمستهدف -25°C',
      });

      expect(res.success).toBe(true);
      expect(res.whatsappDispatched).toBe(true);
      expect(res.pushDispatched).toBe(true);

      expect(sendWhatsAppCloudMessage).toHaveBeenCalledTimes(1);
      expect(sendCriticalFleetAlertPushNotification).toHaveBeenCalledTimes(1);
      expect(recordAuditLog).toHaveBeenCalledTimes(1);
    });

    it('records acknowledgment audit entry when incident is marked resolved', async () => {
      const { recordAuditLog } = await import('@/lib/audit.server');

      const res = await acknowledgeIncidentAlertAction('alert-123', '12345-A-1', 'تم الاتصال بالسائق وإعادة ضبط Frigo');
      expect(res.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledTimes(1);
      const call = vi.mocked(recordAuditLog).mock.calls[0][0];
      expect(call.entityType).toBe('mission_control');
      expect(call.entityId).toBe('alert-123');
    });
  });
});
