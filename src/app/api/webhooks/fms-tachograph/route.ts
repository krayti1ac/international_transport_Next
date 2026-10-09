import { NextRequest, NextResponse } from 'next/server';
import { FmsTachographSyncService } from '@/features/fleet/services/fms-tachograph-sync.service';
import { recordTachographActivityAction } from '@/features/fleet/services/tachograph.actions';
import type { FmsTachographRawPacket } from '@/features/fleet/types/fms-tachograph.types';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.FMS_WEBHOOK_SECRET;

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized FMS endpoint' }, { status: 401 });
    }

    const payload: FmsTachographRawPacket & { driverId: string } = await req.json();

    if (!payload.vehicleId || !payload.driverId) {
      return NextResponse.json({ error: 'Missing vehicleId or driverId' }, { status: 400 });
    }

    const parsed = FmsTachographSyncService.parseTco1Packet(payload, payload.driverId);

    // تسجيل النشاط تلقائياً في دورة التاكوغراف وإعادة احتساب الرادار
    const actionResult = await recordTachographActivityAction({
      driverId: parsed.driverId,
      vehicleId: parsed.vehicleId,
      activityType: parsed.activityType,
      startedAt: parsed.timestamp,
      source: 'auto_sync',
      notes: parsed.isAutoSpeedOverride
        ? `CAN-Bus Speed Override: ${parsed.speedKmh} km/h`
        : `TCO1 Working State: ${payload.driverWorkingState}`,
    });

    return NextResponse.json({
      success: true,
      data: parsed,
      snapshotUpdated: !actionResult.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

