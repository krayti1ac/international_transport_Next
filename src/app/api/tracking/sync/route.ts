import { NextRequest, NextResponse } from 'next/server';
import { syncTraccarPositions } from '@/features/tracking/services/traccar.actions';

export async function POST(req: NextRequest) {
  try {
    const result = await syncTraccarPositions();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, count: 0, error: message }, { status: 500 });
  }
}
