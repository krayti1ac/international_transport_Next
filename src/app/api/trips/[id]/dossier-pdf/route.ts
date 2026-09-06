import { NextRequest, NextResponse } from 'next/server';
import { getTripDossierData, buildTripDossierHtml } from '@/lib/trip-dossier-pdf';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tripId = parseInt(id, 10);

    if (isNaN(tripId)) {
      return new NextResponse('معرّف رحلة غير صالح', { status: 400 });
    }

    const dossierResult = await getTripDossierData(tripId);

    if (!dossierResult.success || !dossierResult.data) {
      return new NextResponse(dossierResult.error || 'تعذر استخراج ملف الأرشيف', {
        status: 404,
      });
    }

    const html = buildTripDossierHtml(dossierResult.data);

    return new NextResponse(html, {
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
