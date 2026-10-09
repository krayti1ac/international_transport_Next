import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateHaversineDistanceKm,
  findNearestSafeParking,
  CERTIFIED_SAFE_PARKING_AREAS,
} from '../types/safe-parking.types';
import {
  TachographRestAlertService,
} from '../services/tachograph-rest-alert.service';
import { triggerDriverRestAlertAction } from '../services/tachograph.actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockDriver = {
  id: 101,
  name: 'Mohammed El Mansouri',
  phone: '212694585307',
  default_truck_id: 10,
};

const mockTruck = {
  id: 10,
  plate_number: '45821-B-40',
};

const mockSnapshot = {
  id: 1,
  driver_id: 101,
  remaining_continuous_drive_minutes: 12,
  radar_status: 'critical_urgency',
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-dispatcher-1' } } }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'drivers') return Promise.resolve({ data: mockDriver, error: null });
            if (table === 'trucks') return Promise.resolve({ data: mockTruck, error: null });
            if (table === 'driver_compliance_snapshots')
              return Promise.resolve({ data: mockSnapshot, error: null });
            if (table === 'truck_tracking')
              return Promise.resolve({
                data: { latitude: 42.4, longitude: 2.85 },
                error: null,
              });
            return Promise.resolve({ data: null, error: null });
          }),
          order: () => ({
            limit: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { latitude: 42.4, longitude: 2.85 },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('@/features/whatsapp/services/whatsapp-meta-client', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({
    success: true,
    provider: 'meta',
    messageId: 'wamid.HBgLMjEyNjk0NTg1MzA3FQIAERgSR',
  }),
}));

describe('Tachograph Critical Rest & Safe Parking Alerts Service', () => {
  beforeEach(() => {
    TachographRestAlertService.resetCooldown();
  });

  describe('Geospatial Haversine & Nearest Safe Parking Engine', () => {
    it('calculates accurate distance between two geographical points', () => {
      // Distance between Perpignan (42.6986, 2.8956) and La Jonquera (42.4172, 2.8794) is ~31 km
      const distance = calculateHaversineDistanceKm(42.6986, 2.8956, 42.4172, 2.8794);
      expect(distance).toBeGreaterThan(25);
      expect(distance).toBeLessThan(35);
    });

    it('finds nearest certified parking near Catalan border (La Jonquera AP-7)', () => {
      const nearest = findNearestSafeParking(42.42, 2.88);
      expect(nearest).not.toBeNull();
      expect(nearest?.parking.id).toBe('es-jonquera-ap7');
      expect(nearest?.distanceKm).toBeLessThan(5);
    });

    it('finds nearest parking at Tanger Med Port Hub', () => {
      const nearest = findNearestSafeParking(35.88, -5.51);
      expect(nearest).not.toBeNull();
      expect(nearest?.parking.id).toBe('ma-tanger-med-village');
      expect(nearest?.distanceKm).toBeLessThan(5);
    });

    it('finds nearest overland station on African corridor near Guerguerat', () => {
      const nearest = findNearestSafeParking(21.43, -16.96, 'african_rn1');
      expect(nearest).not.toBeNull();
      expect(nearest?.parking.id).toBe('ma-guerguerat-buffer');
    });
  });

  describe('Localized Message Formatter (AR / FR / ES)', () => {
    const sampleParking = CERTIFIED_SAFE_PARKING_AREAS[0]; // La Jonquera

    it('builds Arabic rest alert message with Google Maps URL and driver details', () => {
      const msg = TachographRestAlertService.buildRestAlertMessage({
        driverName: 'Mohammed El Mansouri',
        truckPlate: '45821-B-40',
        remainingMinutes: 10,
        parking: sampleParking,
        distanceKm: 8.5,
        language: 'ar',
      });

      expect(msg).toContain('تنبيه تاكوغراف عاجل');
      expect(msg).toContain('Mohammed El Mansouri');
      expect(msg).toContain('45821-B-40');
      expect(msg).toContain('10 دقيقة');
      expect(msg).toContain(sampleParking.name);
      expect(msg).toContain(sampleParking.googleMapsUrl);
    });

    it('builds French rest alert message with European regulation headers', () => {
      const msg = TachographRestAlertService.buildRestAlertMessage({
        driverName: 'Mohammed El Mansouri',
        truckPlate: '45821-B-40',
        remainingMinutes: 15,
        parking: sampleParking,
        distanceKm: 12.0,
        language: 'fr',
      });

      expect(msg).toContain('ALERTE TACHYGRAPHE URGENTE');
      expect(msg).toContain('CE 561/2006');
      expect(msg).toContain('15 minutes');
      expect(msg).toContain(sampleParking.googleMapsUrl);
    });

    it('builds Spanish rest alert message with SSTPA security info', () => {
      const msg = TachographRestAlertService.buildRestAlertMessage({
        driverName: 'Mohammed El Mansouri',
        truckPlate: '45821-B-40',
        remainingMinutes: 12,
        parking: sampleParking,
        distanceKm: 9.0,
        language: 'es',
      });

      expect(msg).toContain('AVISO URGENTE DE TACÓGRAFO');
      expect(msg).toContain('SSTPA');
      expect(msg).toContain(sampleParking.googleMapsUrl);
    });
  });

  describe('Proactive Alert Dispatching & Spam Cooldown Protection', () => {
    it('successfully dispatches rest alert to driver via WhatsApp', async () => {
      const result = await TachographRestAlertService.triggerCriticalRestAlert({
        driverId: 101,
        remainingMinutes: 12,
        radarStatus: 'critical_urgency',
      });

      expect(result.success).toBe(true);
      expect(result.alertSent).toBe(true);
      expect(result.driverName).toBe('Mohammed El Mansouri');
      expect(result.parking).toBeDefined();
      expect(result.messageId).toBeDefined();
    });

    it('activates cooldown and prevents duplicate spam alerts within 45 minutes', async () => {
      // First send
      const first = await TachographRestAlertService.triggerCriticalRestAlert({
        driverId: 101,
        remainingMinutes: 12,
      });
      expect(first.alertSent).toBe(true);

      // Immediate second send should be blocked by cooldown
      const second = await TachographRestAlertService.triggerCriticalRestAlert({
        driverId: 101,
        remainingMinutes: 10,
        forceSend: false,
      });
      expect(second.success).toBe(true);
      expect(second.alertSent).toBe(false);
      expect(second.reason).toBe('cooldown_active');

      // But forceSend bypasses cooldown
      const forced = await TachographRestAlertService.triggerCriticalRestAlert({
        driverId: 101,
        remainingMinutes: 8,
        forceSend: true,
      });
      expect(forced.alertSent).toBe(true);
    });
  });

  describe('Server Action Integration (triggerDriverRestAlertAction)', () => {
    it('executes triggerDriverRestAlertAction and returns dispatch confirmation', async () => {
      const res = await triggerDriverRestAlertAction(101, { forceSend: true });

      expect(res.success).toBe(true);
      expect(res.alertSent).toBe(true);
      expect(res.driverName).toBe('Mohammed El Mansouri');
    });
  });
});

