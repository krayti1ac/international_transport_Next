import { NextRequest, NextResponse } from 'next/server';
import { syncTraccarPositions } from '@/features/tracking/services/traccar.actions';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncTraccarPositions();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, count: 0, error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
