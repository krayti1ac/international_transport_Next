import { NextRequest, NextResponse } from 'next/server';
import { ingestFmsTelematicsPacket } from '@/features/fleet/services/canbus-telematics.actions';
import type { FmsTelematicsPacket } from '@/features/fleet/types/telematics.types';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.TELEMATICS_WEBHOOK_SECRET;

    // Optional secret key validation if configured
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized telematics source' }, { status: 401 });
    }

    const body = await request.json();

    if (Array.isArray(body)) {
      const results = [];
      const allAlerts = [];
      for (const packet of body as FmsTelematicsPacket[]) {
        const res = await ingestFmsTelematicsPacket(packet);
        results.push(res);
        if (res.alerts && res.alerts.length > 0) {
          allAlerts.push(...res.alerts);
        }
      }
      return NextResponse.json({
        success: true,
        processedCount: results.length,
        alerts: allAlerts,
      });
    } else {
      const packet = body as FmsTelematicsPacket;
      if (!packet.truck_plate && !packet.imei) {
        return NextResponse.json(
          { error: 'Invalid payload: truck_plate or imei is required' },
          { status: 400 }
        );
      }
      const res = await ingestFmsTelematicsPacket(packet);
      return NextResponse.json(res);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error in telematics ingestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

