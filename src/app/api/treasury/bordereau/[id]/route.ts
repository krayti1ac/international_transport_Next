import { NextRequest, NextResponse } from 'next/server';
import { getRemittanceBordereauByIdAction } from '@/features/treasury/services/remittance-bordereau.actions';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return new NextResponse('معرّف جدول التسليم مفقود', { status: 400 });
    }

    const result = await getRemittanceBordereauByIdAction(id);

    if (!result.success || !result.html) {
      return new NextResponse(result.error || 'تعذر استخراج جدول التسليم البنكي', {
        status: 404,
      });
    }

    return new NextResponse(result.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
    return new NextResponse(message, { status: 500 });
  }
}
