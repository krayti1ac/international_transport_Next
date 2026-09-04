import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function fetchLiveEurMadRate(): Promise<number> {
  // Strategy 1: open.er-api.com
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.MAD;
      if (typeof rate === 'number' && rate > 0) {
        return rate;
      }
    }
  } catch (e) {
    console.warn('Strategy 1 (open.er-api.com) failed:', e);
  }

  // Strategy 2: Frankfurter API fallback
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=MAD', {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.MAD;
      if (typeof rate === 'number' && rate > 0) {
        return rate;
      }
    }
  } catch (e) {
    console.warn('Strategy 2 (frankfurter.app) failed:', e);
  }

  // Strategy 3: exchangerate-api fallback
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.MAD;
      if (typeof rate === 'number' && rate > 0) {
        return rate;
      }
    }
  } catch (e) {
    console.warn('Strategy 3 (exchangerate-api) failed:', e);
  }

  throw new Error('تعذر الاتصال بجميع مزودي أسعار الصرف المباشرة');
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'CONFIG_ERROR', message: 'إعدادات الاتصال بقاعدة البيانات غير مكتملة' },
        { status: 500 }
      );
    }

    const eurToMad = await fetchLiveEurMadRate();
    const madToEur = 1 / eurToMad;
    const today = new Date().toISOString().split('T')[0];

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('forex_rates').upsert(
      {
        rate_date: today,
        eur_to_mad: Number(eurToMad.toFixed(4)),
        mad_to_eur: Number(madToEur.toFixed(6)),
        source: 'api_live',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'rate_date' }
    ).select().single();

    if (error) {
      if (error.code === 'PGRST205') {
        return NextResponse.json(
          {
            success: false,
            error: 'TABLE_MISSING',
            message:
              'جدول أسعار الصرف (forex_rates) غير موجود في قاعدة بيانات Supabase. يرجى تطبيق ملف migration في لوحة تحكم Supabase.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'DB_ERROR', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rate: {
        rate_date: today,
        eur_to_mad: Number(eurToMad.toFixed(4)),
        mad_to_eur: Number(madToEur.toFixed(6)),
        source: 'api_live',
      },
      record: data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'تعذر مزامنة سعر الصرف';
    return NextResponse.json({ success: false, error: 'SYNC_ERROR', message }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

