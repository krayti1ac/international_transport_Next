import { NextResponse } from 'next/server';
import { syncDailyForexRate } from '@/features/treasury/services/forex.actions';

export async function POST() {
  const result = await syncDailyForexRate();

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, rate: result.eurToMad },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      eurToMad: result.eurToMad,
      madToEur: result.madToEur,
      date: result.rateDate,
      source: result.source,
    },
  });
}

export async function GET() {
  return POST();
}
