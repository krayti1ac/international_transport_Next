import { describe, it, expect, beforeEach } from 'vitest';
import {
  STRATEGIC_PORT_ZONES,
  calculateHaversineDistanceKm,
  isAlertCooldownActive,
  resetAlertCooldown,
  ALERT_COOLDOWN_MS,
} from '@/features/tracking/services/port-geofence.actions';
import { normalizeGPSPayload } from '@/app/api/webhooks/gps/route';

describe('Traccar GPS Ingestion & Automated Port/Border Geofencing Engine', () => {
  beforeEach(() => {
    resetAlertCooldown();
  });

  describe('1. Traccar GPS Payload Normalization', () => {
    it('normalizes standard Traccar webhook payload with device and position', () => {
      const rawPayload = {
        device: {
          id: 101,
          name: '12345-A-40',
          uniqueId: 'TELTONIKA-FMC130-9988',
        },
        position: {
          latitude: 35.8883,
          longitude: -5.5033,
          speed: 42.5,
          course: 180,
          accuracy: 5.2,
          fixTime: '2026-09-20T10:15:00Z',
          attributes: {
            ignition: true,
            temp1: -18.5, // Frigo reefer trailer temperature
            battery: 12.8,
          },
        },
      };

      const normalized = normalizeGPSPayload(rawPayload);

      expect(normalized.plateNumber).toBe('12345-A-40');
      expect(normalized.traccarUniqueId).toBe('TELTONIKA-FMC130-9988');
      expect(normalized.deviceId).toBe(101);
      expect(normalized.latitude).toBeCloseTo(35.8883, 4);
      expect(normalized.longitude).toBeCloseTo(-5.5033, 4);
      expect(normalized.speed).toBe(42.5);
      expect(normalized.heading).toBe(180);
      expect(normalized.accuracy).toBe(5.2);
      expect(normalized.ignition).toBe(true);
      expect(normalized.frigoTemperature).toBe(-18.5);
      expect(new Date(normalized.timestampMs).toISOString()).toBe('2026-09-20T10:15:00.000Z');
    });

    it('handles direct/legacy flat GPS payloads gracefully', () => {
      const flatPayload = {
        plate_number: '54321-B-26',
        truck_id: 15,
        latitude: 21.3656,
        longitude: -16.9583,
        speed: 65,
        course: 210,
        attributes: {
          ignition: true,
          temperature: 4.0,
        },
      };

      const normalized = normalizeGPSPayload(flatPayload);

      expect(normalized.truckId).toBe(15);
      expect(normalized.plateNumber).toBe('54321-B-26');
      expect(normalized.latitude).toBe(21.3656);
      expect(normalized.longitude).toBe(-16.9583);
      expect(normalized.speed).toBe(65);
      expect(normalized.heading).toBe(210);
      expect(normalized.ignition).toBe(true);
      expect(normalized.frigoTemperature).toBe(4.0);
    });
  });

  describe('2. Geofence Distance Calculation (Haversine)', () => {
    it('calculates zero distance for identical coordinates', () => {
      const dist = calculateHaversineDistanceKm(35.885, -5.505, 35.885, -5.505);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance across Gibraltar Strait (Tanger Med to Algeciras)', () => {
      // Tanger Med (35.885, -5.505) to Algeciras (36.132, -5.438)
      const dist = calculateHaversineDistanceKm(35.885, -5.505, 36.132, -5.438);
      expect(dist).toBeGreaterThan(25);
      expect(dist).toBeLessThan(35);
    });

    it('calculates accurate distance between Guerguerat and Nouadhibou', () => {
      // Guerguerat (21.3656, -16.9583) to Nouadhibou (20.9412, -17.0347)
      const dist = calculateHaversineDistanceKm(21.3656, -16.9583, 20.9412, -17.0347);
      expect(dist).toBeGreaterThan(45);
      expect(dist).toBeLessThan(65);
    });
  });

  describe('3. Strategic Ports & Crossings Coverage (European & African)', () => {
    it('covers all major European ferry ports', () => {
      const zoneIds = STRATEGIC_PORT_ZONES.map((z) => z.id);
      expect(zoneIds).toContain('port_tanger_med');
      expect(zoneIds).toContain('port_algeciras');
      expect(zoneIds).toContain('port_almeria');
      expect(zoneIds).toContain('port_motril');

      const almeria = STRATEGIC_PORT_ZONES.find((z) => z.id === 'port_almeria')!;
      expect(almeria.zoneType).toBe('seaport');
      expect(almeria.latitude).toBeCloseTo(36.834, 2);
    });

    it('covers all strategic African Overland Corridor waypoints', () => {
      const zoneIds = STRATEGIC_PORT_ZONES.map((z) => z.id);
      expect(zoneIds).toContain('border_guerguerat');
      expect(zoneIds).toContain('hub_nouadhibou');
      expect(zoneIds).toContain('hub_nouakchott');
      expect(zoneIds).toContain('border_rosso');
      expect(zoneIds).toContain('port_dakar');

      const rosso = STRATEGIC_PORT_ZONES.find((z) => z.id === 'border_rosso')!;
      expect(rosso.zoneType).toBe('border_crossing');
      expect(rosso.latitude).toBeCloseTo(16.5133, 2);

      const dakar = STRATEGIC_PORT_ZONES.find((z) => z.id === 'port_dakar')!;
      expect(dakar.zoneType).toBe('seaport');
      expect(dakar.latitude).toBeCloseTo(14.7167, 2);
      expect(dakar.radiusKm).toBe(6.0);
    });
  });

  describe('4. Geofence Alert Deduplication Guard (30 Minutes Window)', () => {
    it('verifies the cooldown window constant is exactly 30 minutes', () => {
      expect(ALERT_COOLDOWN_MS).toBe(30 * 60 * 1000);
    });

    it('allows initial alert and blocks duplicate alerts within 30 minutes', () => {
      const truckId = 42;
      const zoneId = 'port_tanger_med';
      const now = Date.now();

      // First alert should not be active cooldown (allowed)
      const first = isAlertCooldownActive(truckId, zoneId, 'enter', now);
      expect(first).toBe(false);

      // Subsequent check 5 minutes later should be blocked by cooldown
      const fiveMinLater = now + 5 * 60 * 1000;
      const second = isAlertCooldownActive(truckId, zoneId, 'enter', fiveMinLater);
      expect(second).toBe(true);

      // Check after 31 minutes should be allowed again
      const thirtyOneMinLater = now + 31 * 60 * 1000;
      const third = isAlertCooldownActive(truckId, zoneId, 'enter', thirtyOneMinLater);
      expect(third).toBe(false);
    });

    it('tracks enter and exit alerts independently', () => {
      const truckId = 42;
      const zoneId = 'border_guerguerat';
      const now = Date.now();

      // Enter is allowed
      expect(isAlertCooldownActive(truckId, zoneId, 'enter', now)).toBe(false);
      // Exit for same zone is also allowed on its own key
      expect(isAlertCooldownActive(truckId, zoneId, 'exit', now + 1000)).toBe(false);

      // Second enter within cooldown is blocked
      expect(isAlertCooldownActive(truckId, zoneId, 'enter', now + 2000)).toBe(true);
    });
  });
});
