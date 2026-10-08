import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateHaversineDistance,
  enqueueBreadcrumb,
  getPendingBreadcrumbs,
  getPendingBreadcrumbsCount,
  removeBreadcrumbs,
  clearBreadcrumbsQueue,
} from '@/lib/offline/driver-geo-db';
import { autonomousGeoTracker } from '../services/autonomous-geo-tracker.service';
import { syncGeoBreadcrumbsBatchAction } from '../services/geo-queue-sync.actions';
import { flushOfflineGeoBreadcrumbs } from '@/lib/offline/driver-geo-sync';
import type { GeoBreadcrumbPoint, AutonomousTrackingConfig } from '../types/offline-geolocation.types';

// In-memory mock for truck_locations table
const mockTruckLocationsTable: any[] = [];
let mockTrucksTable: any[] = [{ id: 10, current_location: null }];

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => ({
      select: () => ({
        in: (_col1: string, _vals1: any[]) => ({
          in: (_col2: string, _vals2: any[]) => {
            // Check for existing duplicates
            const found = mockTruckLocationsTable.filter((row) =>
              _vals1.includes(row.trip_id) && _vals2.includes(row.recorded_at)
            );
            return Promise.resolve({ data: found, error: null });
          },
        }),
      }),
      insert: async (rows: any[]) => {
        mockTruckLocationsTable.push(...rows);
        return { data: rows, error: null };
      },
      update: (fields: any) => ({
        eq: async (_col: string, val: any) => {
          const t = mockTrucksTable.find((truck) => truck.id === val);
          if (t) Object.assign(t, fields);
          return { data: t, error: null };
        },
      }),
    }),
  }),
}));

describe('Driver Autonomous Geolocation & Offline Sync Engine (IndexedDB & Desert Pipeline)', () => {
  beforeEach(async () => {
    await clearBreadcrumbsQueue();
    mockTruckLocationsTable.length = 0;
    mockTrucksTable = [{ id: 10, current_location: null }];
  });

  describe('1. Haversine Distance & Deadband Noise Filter', () => {
    it('should compute exact great-circle distance between two GPS coordinates', () => {
      // Tanger Med (35.8869, -5.5031) to Algeciras Port (36.1329, -5.4431) ~ 27-28 km
      const distance = calculateHaversineDistance(35.8869, -5.5031, 36.1329, -5.4431);
      expect(Math.round(distance / 1000)).toBeGreaterThanOrEqual(27);
      expect(Math.round(distance / 1000)).toBeLessThanOrEqual(30);
    });

    it('should filter out GPS drift when vehicle displacement is under 15m (Deadband Guard)', async () => {
      const config: AutonomousTrackingConfig = {
        fastIntervalMs: 60000,
        slowIntervalMs: 180000,
        stationaryIntervalMs: 600000,
        deadbandDistanceMeters: 15,
        maxBreadcrumbsQueueSize: 5000,
        batchSyncSize: 50,
        maxAccuracyThresholdMeters: 100,
      };

      // Point 1: Parked in Agadir
      const pt1: GeoBreadcrumbPoint = {
        id: 'pt-1',
        tripId: 272,
        latitude: 30.4278,
        longitude: -9.5981,
        speed: 0,
        state: 'stationary',
        timestamp: '2026-10-08T10:00:00Z',
        idempotencyKey: 'geo_272_1',
        synced: false,
      };
      const res1 = await enqueueBreadcrumb(pt1, config);
      expect(res1).toBe(true);

      // Point 2: GPS jitter moved by only 4 meters while standing still
      const pt2: GeoBreadcrumbPoint = {
        id: 'pt-2',
        tripId: 272,
        latitude: 30.42783, // ~3.3 meters difference
        longitude: -9.5981,
        speed: 0,
        state: 'stationary',
        timestamp: '2026-10-08T10:05:00Z',
        idempotencyKey: 'geo_272_2',
        synced: false,
      };
      const res2 = await enqueueBreadcrumb(pt2, config);
      expect(res2).toBe(false); // Discarded due to deadband

      // Point 3: Truck resumed driving (> 15 meters away)
      const pt3: GeoBreadcrumbPoint = {
        id: 'pt-3',
        tripId: 272,
        latitude: 30.435, // ~800 meters away
        longitude: -9.5981,
        speed: 65,
        state: 'moving_fast',
        timestamp: '2026-10-08T10:06:00Z',
        idempotencyKey: 'geo_272_3',
        synced: false,
      };
      const res3 = await enqueueBreadcrumb(pt3, config);
      expect(res3).toBe(true);

      const count = await getPendingBreadcrumbsCount();
      expect(count).toBe(2); // Only pt1 and pt3 were saved
    });

    it('should discard inaccurate GPS fixes when accuracy error exceeds 100m', async () => {
      const inaccuratePoint: GeoBreadcrumbPoint = {
        id: 'pt-err',
        tripId: 272,
        latitude: 30.4278,
        longitude: -9.5981,
        accuracy: 250, // 250 meters error
        state: 'moving_slow',
        timestamp: '2026-10-08T10:10:00Z',
        idempotencyKey: 'geo_272_err',
        synced: false,
      };

      const enqueued = await enqueueBreadcrumb(inaccuratePoint);
      expect(enqueued).toBe(false);
    });
  });

  describe('2. Adaptive Movement State & Sampling Intervals', () => {
    it('should classify movement state into stationary, moving_slow, and moving_fast', () => {
      expect(autonomousGeoTracker.evaluateMovementState(0)).toBe('stationary');
      expect(autonomousGeoTracker.evaluateMovementState(4)).toBe('stationary');
      expect(autonomousGeoTracker.evaluateMovementState(25)).toBe('moving_slow');
      expect(autonomousGeoTracker.evaluateMovementState(80)).toBe('moving_fast');
      expect(autonomousGeoTracker.evaluateMovementState(null)).toBe('stationary');
    });

    it('should adapt tracking interval to conserve driver phone battery', () => {
      const fastInterval = autonomousGeoTracker.computeNextIntervalMs('moving_fast');
      const slowInterval = autonomousGeoTracker.computeNextIntervalMs('moving_slow');
      const stationaryInterval = autonomousGeoTracker.computeNextIntervalMs('stationary');

      expect(fastInterval).toBe(60000); // 1 min
      expect(slowInterval).toBe(180000); // 3 min
      expect(stationaryInterval).toBe(600000); // 10 min
    });
  });

  describe('3. Pruning Guard & Capacity Enforcement', () => {
    it('should enforce the maximum breadcrumb queue ceiling', async () => {
      const smallConfig: AutonomousTrackingConfig = {
        fastIntervalMs: 60000,
        slowIntervalMs: 180000,
        stationaryIntervalMs: 600000,
        deadbandDistanceMeters: 0,
        maxBreadcrumbsQueueSize: 5,
        batchSyncSize: 5,
        maxAccuracyThresholdMeters: 100,
      };

      for (let i = 1; i <= 7; i++) {
        await enqueueBreadcrumb(
          {
            id: `p-${i}`,
            tripId: 272,
            latitude: 21.0 + i * 0.01,
            longitude: -17.0,
            speed: 50,
            state: 'moving_fast',
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            idempotencyKey: `key-${i}`,
            synced: false,
          },
          smallConfig
        );
      }

      const count = await getPendingBreadcrumbsCount();
      expect(count).toBeLessThanOrEqual(5);
    });
  });

  describe('4. Server Action Batch Sync & Idempotency', () => {
    it('should batch insert breadcrumbs into truck_locations and skip duplicates', async () => {
      const breadcrumbs: GeoBreadcrumbPoint[] = [
        {
          id: 'b-1',
          tripId: 272,
          truckId: 10,
          latitude: 23.71,
          longitude: -15.95,
          speed: 82.4,
          heading: 195,
          accuracy: 8,
          state: 'moving_fast',
          timestamp: '2026-10-08T14:00:00Z',
          idempotencyKey: 'geo_272_1400',
          synced: false,
        },
        {
          id: 'b-2',
          tripId: 272,
          truckId: 10,
          latitude: 23.65,
          longitude: -15.98,
          speed: 78.1,
          heading: 198,
          accuracy: 6,
          state: 'moving_fast',
          timestamp: '2026-10-08T14:05:00Z',
          idempotencyKey: 'geo_272_1405',
          synced: false,
        },
      ];

      // First sync
      const res1 = await syncGeoBreadcrumbsBatchAction(breadcrumbs);
      expect(res1.success).toBe(true);
      expect(res1.insertedCount).toBe(2);
      expect(res1.skippedDuplicates).toBe(0);
      expect(mockTruckLocationsTable.length).toBe(2);

      // Verify truck's current location was updated
      expect(mockTrucksTable[0].current_location).toContain('23.650000');

      // Duplicate sync attempt with identical timestamps
      const res2 = await syncGeoBreadcrumbsBatchAction(breadcrumbs);
      expect(res2.success).toBe(true);
      expect(res2.insertedCount).toBe(0);
      expect(res2.skippedDuplicates).toBe(2);
      expect(mockTruckLocationsTable.length).toBe(2); // No extra inserts
    });
  });

  describe('5. Desert Outage Simulation: Full Disconnected Queue & Batch Flush', () => {
    it('should queue breadcrumbs across Mauritania desert corridor and flush them on reconnect', async () => {
      // Simulate disconnected breadcrumbs across the Mauritanian Sahara
      const desertWaypoints = [
        { name: 'Guerguerat Border', lat: 21.432, lng: -16.96 },
        { name: 'PK55 Customs Halt', lat: 21.32, lng: -16.88 },
        { name: 'Chami Waypoint', lat: 20.17, lng: -15.96 },
        { name: 'Nouamghar Coast', lat: 19.33, lng: -16.53 },
        { name: 'Nouakchott Entry', lat: 18.08, lng: -15.97 },
      ];

      for (let i = 0; i < desertWaypoints.length; i++) {
        const wp = desertWaypoints[i];
        await enqueueBreadcrumb({
          id: `wp-${i}`,
          tripId: 272,
          truckId: 10,
          latitude: wp.lat,
          longitude: wp.lng,
          speed: 75,
          state: 'moving_fast',
          timestamp: new Date(Date.now() + i * 60000).toISOString(),
          idempotencyKey: `wp_key_${i}`,
          synced: false,
        });
      }

      // Check local queue holds 5 pending records
      const initialPending = await getPendingBreadcrumbsCount();
      expect(initialPending).toBe(5);

      // Connection restored: Flush offline queue
      const syncResult = await flushOfflineGeoBreadcrumbs(50);
      expect(syncResult.totalSynced).toBe(5);
      expect(syncResult.remaining).toBe(0);

      // Verify local queue is completely empty
      const finalPending = await getPendingBreadcrumbsCount();
      expect(finalPending).toBe(0);

      // Verify server received all 5 rows
      expect(mockTruckLocationsTable.length).toBe(5);
    });
  });
});

