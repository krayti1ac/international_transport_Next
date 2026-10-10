/**
 * Trans Bodanon TMS — Approaching Hotspot Driver Proximity Radar Unit Tests
 * Rigorous validation of Haversine distance, Decimal.js ETA, cooldown guards, and WhatsApp dispatch.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { HotspotProximityRadarService } from '../services/hotspot-proximity-radar.service';
import { WhatsAppHotspotAlertTemplates } from '@/features/whatsapp/services/whatsapp-hotspot-alert-templates';
import { simulateApproachingHotspotAlertAction } from '../services/hotspot-proximity-radar.actions';
import type { DriverHotspotUrgentAlertPayload } from '../types/hotspot-alert.types';

// Mock Supabase & Audit Log
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'usr-fleet-manager-2026', email: 'dispatch@transbodanon.com' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 8840,
          driver_id: 105,
          status: 'in_transit',
          drivers: {
            id: 105,
            full_name: 'Mohamed El Idrissi',
            phone_number: '+212661998877',
            preferred_language: 'ar',
          },
          trucks: {
            plate_number: '67890-A-40',
          },
        },
        error: null,
      }),
    })),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn(async () => ({ success: true })),
}));

describe('Trans Bodanon TMS — Approaching Hotspot Driver Alert Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HotspotProximityRadarService.resetAlertCooldown();
  });

  describe('1. Haversine Distance & ETA Calculation with Decimal.js', () => {
    it('calculates zero distance for identical coordinates', () => {
      const dist = HotspotProximityRadarService.calculateHaversineDistanceKm(
        35.8885,
        -5.5032,
        35.8885,
        -5.5032
      );
      expect(dist.toNumber()).toBe(0.0);
    });

    it('calculates accurate distance across Tanger Med and Algeciras (~27.7 km)', () => {
      // Tanger Med (35.8885, -5.5032) to Algeciras (36.1332, -5.4451)
      const dist = HotspotProximityRadarService.calculateHaversineDistanceKm(
        35.8885,
        -5.5032,
        36.1332,
        -5.4451
      );
      expect(dist.toNumber()).toBeGreaterThan(25.0);
      expect(dist.toNumber()).toBeLessThan(32.0);
    });

    it('calculates ETA in minutes using strict Decimal.js precision', () => {
      const distance = new Decimal(15.0);
      const eta = HotspotProximityRadarService.calculateEtaMinutes(distance, 45); // 15 km / 45 km/h * 60 = 20.0 mins
      expect(eta.toNumber()).toBe(20.0);
    });

    it('handles minimum speed safety cap for stationary/crawling traffic', () => {
      const distance = new Decimal(5.0);
      const eta = HotspotProximityRadarService.calculateEtaMinutes(distance, 0); // clamped to 15 km/h -> 20 mins
      expect(eta.toNumber()).toBe(20.0);
    });
  });

  describe('2. Trilingual WhatsApp Urgent Action Templates', () => {
    const mockPayload: DriverHotspotUrgentAlertPayload = {
      alertId: 'alert-test-01',
      driverId: 'drv-105',
      driverName: 'Mohamed El Idrissi',
      driverPhone: '+212661998877',
      tripId: 8840,
      tripNumber: 'TRIP-2026-8840',
      truckPlate: '67890-A-40',
      dockId: 'DOCK-MAD-04',
      dockName: 'Mercamadrid Hall 4 Frigo',
      facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
      city: 'Madrid',
      countryCode: 'ES',
      dviScore: 85.0,
      riskLevel: 'critical',
      watchStatus: 'normal',
      currentLat: 40.32,
      currentLng: -3.65,
      speedKmh: 45,
      distanceKm: 5.2,
      etaMinutes: 6.9,
      cargoCategories: ['deep_frozen'],
      mandatoryProtocols: {
        lockContinuousRunMode: true,
        disallowCycleSentry: true,
        preCoolingMandatory: true,
        curtainProtocol: true,
        keepDoorsSealedUntilDocked: true,
        targetTempVerification: true,
      },
      localizedActions: [],
      alertTimestamp: new Date().toISOString(),
      idempotencyKey: 'test_key',
      locale: 'ar',
    };

    it('formats urgent Arabic template with mandatory Continuous Run instructions', () => {
      const msg = WhatsAppHotspotAlertTemplates.buildDriverAlertMessage({
        ...mockPayload,
        locale: 'ar',
      });

      expect(msg).toContain('تنبيه لوجستي عاجل');
      expect(msg).toContain('Continuous Run');
      expect(msg).toContain('Cycle-Sentry');
      expect(msg).toContain('Mercamadrid');
      expect(msg).toContain('85/100');
    });

    it('formats urgent French template with GDP guidelines and thermal bulkhead notices', () => {
      const msg = WhatsAppHotspotAlertTemplates.buildDriverAlertMessage({
        ...mockPayload,
        locale: 'fr',
      });

      expect(msg).toContain('ALERTE LOGISTIQUE');
      expect(msg).toContain('Continuous Run');
      expect(msg).toContain('Cycle-Sentry');
      expect(msg).toContain('cloison thermique');
    });

    it('formats urgent Spanish template with clear dock rules for Mercamadrid', () => {
      const msg = WhatsAppHotspotAlertTemplates.buildDriverAlertMessage({
        ...mockPayload,
        locale: 'es',
      });

      expect(msg).toContain('ALERTA LOGÍSTICA');
      expect(msg).toContain('Continuous Run');
      expect(msg).toContain('abrigo inflable');
    });
  });

  describe('3. Proximity Radar Hotspot Evaluation & Cooldown Guard', () => {
    it('returns approachingHotspot: false when vehicle is distant (> 100 km)', async () => {
      // Vehicle in Rabat (34.02, -6.83) distant from Tanger Med or Mercamadrid
      const res = await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId: 101,
        latitude: 34.0209,
        longitude: -6.8416,
        speedKmh: 60,
      });

      expect(res.evaluated).toBe(true);
      expect(res.approachingHotspot).toBe(false);
      expect(res.dispatched).toBe(false);
    });

    it('triggers urgent alert dispatch when vehicle approaches a critical hotspot (< 15 km)', async () => {
      // Mercamadrid is at (40.3642, -3.6663); place truck at (40.33, -3.65) ~ 4 km away
      const res = await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId: 101,
        latitude: 40.33,
        longitude: -3.65,
        speedKmh: 45,
        truckPlate: '67890-A-40',
      });

      expect(res.evaluated).toBe(true);
      expect(res.approachingHotspot).toBe(true);
      expect(res.dispatched).toBe(true);
      expect(res.alertPayload).toBeDefined();
      expect(res.alertPayload?.dviScore).toBeGreaterThanOrEqual(60);
      expect(res.alertPayload?.mandatoryProtocols.lockContinuousRunMode).toBe(true);
    });

    it('enforces cooldown guard and suppresses duplicate alerts within 2 hours', async () => {
      // First approach triggers
      const firstRes = await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId: 101,
        latitude: 40.33,
        longitude: -3.65,
        speedKmh: 45,
      });
      expect(firstRes.dispatched).toBe(true);

      // Immediate second ping inside cooldown
      const secondRes = await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId: 101,
        latitude: 40.335,
        longitude: -3.652,
        speedKmh: 45,
      });
      expect(secondRes.approachingHotspot).toBe(true);
      expect(secondRes.dispatched).toBe(false);
      expect(secondRes.cooldownActive).toBe(true);

      // Forced bypass allows immediate re-trigger
      const bypassRes = await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId: 101,
        latitude: 40.335,
        longitude: -3.652,
        speedKmh: 45,
        forceBypassCooldown: true,
      });
      expect(bypassRes.dispatched).toBe(true);
    });
  });

  describe('4. Server Action Integration', () => {
    it('executes simulateApproachingHotspotAlertAction with forced bypass successfully', async () => {
      const res = await simulateApproachingHotspotAlertAction({
        truckId: 101,
        latitude: 40.33,
        longitude: -3.65,
        speedKmh: 45,
        truckPlate: '67890-A-40',
      });

      expect(res.evaluated).toBe(true);
      expect(res.approachingHotspot).toBe(true);
      expect(res.dispatched).toBe(true);
      expect(res.alertPayload?.dockName).toBeDefined();
    });
  });
});

