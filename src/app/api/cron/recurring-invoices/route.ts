import { NextRequest, NextResponse } from 'next/server';
import { processDueRecurringInvoicesAction } from '@/features/payments/services/payments.actions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Optional secret check
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In development or simulation allow execution
      if (process.env.NODE_ENV === 'production' && !req.nextUrl.searchParams.get('debug')) {
        return NextResponse.json({ error: 'Unauthorized cron invocation' }, { status: 401 });
      }
    }

    const asOfDate = req.nextUrl.searchParams.get('date') || undefined;
    const result = await processDueRecurringInvoicesAction(asOfDate);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Recurring invoices cron error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

