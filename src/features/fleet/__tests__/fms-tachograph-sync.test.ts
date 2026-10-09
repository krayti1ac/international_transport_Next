import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FmsTachographSyncService } from '../services/fms-tachograph-sync.service';
import type { FmsTachographRawPacket } from '../types/fms-tachograph.types';
import { POST } from '@/app/api/webhooks/fms-tachograph/route';
import { NextRequest } from 'next/server';

vi.mock('../services/tachograph.actions', () => ({
  recordTachographActivityAction: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 999 },
  }),
}));

describe('FMS / CAN-Bus Tachograph Telematics Sync Service', () => {
  describe('SAE J1939 TCO1 SPN 1612 State Mapping', () => {
    it('correctly maps 00 to rest (استراحة / راحة)', () => {
      expect(FmsTachographSyncService.mapWorkingStateToActivity('00')).toBe('rest');
    });

    it('correctly maps 01 to available (جاهزية / متاح)', () => {
      expect(FmsTachographSyncService.mapWorkingStateToActivity('01')).toBe('available');
    });

    it('correctly maps 10 to work (عمل آخر / تحميل)', () => {
      expect(FmsTachographSyncService.mapWorkingStateToActivity('10')).toBe('work');
    });

    it('correctly maps 11 to drive (قيادة فعلية)', () => {
      expect(FmsTachographSyncService.mapWorkingStateToActivity('11')).toBe('drive');
    });

    it('defaults unknown state to drive for safety', () => {
      expect(FmsTachographSyncService.mapWorkingStateToActivity('unknown' as any)).toBe('drive');
    });
  });

  describe('Anti-Tampering Auto-Drive Override (Speed > 1 km/h)', () => {
    it('overrides resting state to drive when physical speed exceeds 1 km/h', () => {
      const packet: FmsTachographRawPacket = {
        vehicleId: '45821-B-40',
        driverWorkingState: '00', // Driver set card to rest
        tachographVehicleSpeedKmh: 65.5, // But truck is moving at 65.5 km/h!
        timestamp: '2026-10-09T14:00:00.000Z',
        sourceDevice: 'teltonika',
      };

      const result = FmsTachographSyncService.parseTco1Packet(packet, '101');

      expect(result.activityType).toBe('drive');
      expect(result.isAutoSpeedOverride).toBe(true);
      expect(result.speedKmh).toBe(65.5);
      expect(result.driverId).toBe('101');
    });

    it('maintains rest activity when truck is stationary (speed <= 1 km/h)', () => {
      const packet: FmsTachographRawPacket = {
        vehicleId: '45821-B-40',
        driverWorkingState: '00',
        tachographVehicleSpeedKmh: 0.0,
        timestamp: '2026-10-09T14:00:00.000Z',
        sourceDevice: 'teltonika',
      };

      const result = FmsTachographSyncService.parseTco1Packet(packet, '101');

      expect(result.activityType).toBe('rest');
      expect(result.isAutoSpeedOverride).toBe(false);
    });

    it('correctly keeps drive activity without override flag when driverWorkingState is already 11', () => {
      const packet: FmsTachographRawPacket = {
        vehicleId: '45821-B-40',
        driverWorkingState: '11',
        tachographVehicleSpeedKmh: 82.0,
        timestamp: '2026-10-09T14:00:00.000Z',
        sourceDevice: 'teltonika',
      };

      const result = FmsTachographSyncService.parseTco1Packet(packet, '101');

      expect(result.activityType).toBe('drive');
      expect(result.isAutoSpeedOverride).toBe(false);
    });
  });

  describe('FMS Webhook HTTP Route (/api/webhooks/fms-tachograph)', () => {
    const originalSecret = process.env.FMS_WEBHOOK_SECRET;

    beforeEach(() => {
      process.env.FMS_WEBHOOK_SECRET = 'test-fms-secret-key-123';
    });

    it('rejects unauthorized requests when secret does not match', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/fms-tachograph', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret',
        },
        body: JSON.stringify({ vehicleId: 'TRK-1', driverId: '101' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('rejects request when vehicleId or driverId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/fms-tachograph', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-fms-secret-key-123',
        },
        body: JSON.stringify({ vehicleId: 'TRK-1' }), // Missing driverId
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('successfully processes valid TCO1 packet and returns 200', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhooks/fms-tachograph', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-fms-secret-key-123',
        },
        body: JSON.stringify({
          vehicleId: '45821-B-40',
          driverId: '101',
          driverWorkingState: '11',
          tachographVehicleSpeedKmh: 75.0,
          timestamp: '2026-10-09T14:30:00.000Z',
          sourceDevice: 'teltonika',
        }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.activityType).toBe('drive');
      expect(json.snapshotUpdated).toBe(true);
    });
  });
});

