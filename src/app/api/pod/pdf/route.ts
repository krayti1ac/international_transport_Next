import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const tripOrderId = req.nextUrl.searchParams.get('tripOrderId');

    if (!tripOrderId) {
      return NextResponse.json({ error: 'tripOrderId مطلوب' }, { status: 400 });
    }

    const { data: tripOrder, error: tripError } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripOrderId)
      .single();

    if (tripError || !tripOrder) {
      return NextResponse.json({ error: 'الرحلة غير موجودة' }, { status: 404 });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('delivery_signatures')
      .select('*')
      .eq('trip_order_id', tripOrderId)
      .maybeSingle();

    if (deliveryError) {
      return NextResponse.json({ error: deliveryError.message }, { status: 500 });
    }

    const signedAt = delivery?.signed_at ? new Date(delivery.signed_at).toLocaleString('ar-MA') : '—';
    const mapsUrl = delivery?.latitude && delivery?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${delivery.latitude},${delivery.longitude}`
      : null;

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إثبات التسليم - رحلة #${tripOrder.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff;
      color: #0f172a;
      padding: 24px;
      line-height: 1.6;
    }
    .page {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #0f172a;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 { font-size: 20px; letter-spacing: 0.5px; }
    .header .doc-number { font-family: monospace; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .box { border: 1px solid #0f172a; padding: 10px; min-height: 80px; }
    .box label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .full { grid-column: 1 / -1; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
    .signature-box { border: 1px solid #0f172a; padding: 10px; text-align: center; }
    .signature-box label { font-size: 10px; font-weight: bold; color: #64748b; display: block; margin-bottom: 6px; }
    .signature-box img { max-height: 100px; max-width: 100%; object-fit: contain; }
    .cmr-img { max-height: 180px; max-width: 100%; object-fit: contain; border: 1px solid #e2e8f0; padding: 4px; }
    .meta { font-size: 12px; color: #475569; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #059669; color: #fff; }
    @media print {
      body { padding: 0; }
      .page { border: 2px solid #000; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <h1>إثبات التسليم الرقمي (E-POD)</h1>
        <p class="meta">TRANS BODANON INTERNATIONAL LOGISTICS</p>
      </div>
      <div class="doc-number">
        <p>رحلة #${tripOrder.id}</p>
        <p>${tripOrder.route}</p>
        <span class="badge">E-POD</span>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <label>1. تفاصيل الرحلة</label>
        <p><strong>المسار:</strong> ${tripOrder.route}</p>
        <p><strong>تاريخ الانطلاق:</strong> ${tripOrder.departure_date}</p>
        <p><strong>الحالة:</strong> ${tripOrder.status}</p>
        ${tripOrder.cmr_number ? `<p><strong>رقم CMR:</strong> ${tripOrder.cmr_number}</p>` : ''}
      </div>
      <div class="box">
        <label>2. تفاصيل التسليم</label>
        <p><strong>المستلم:</strong> ${delivery?.signed_by || '—'}</p>
        <p><strong>تاريخ التوقيع:</strong> ${signedAt}</p>
        ${mapsUrl ? `<p><strong>الموقع:</strong> <a href="${mapsUrl}" target="_blank">عرض على الخريطة</a></p>` : '<p><strong>الموقع:</strong> غير متاح</p>'}
      </div>
      <div class="box full">
        <label>3. التوقيع</label>
        ${delivery?.signature_url ? `<img src="${delivery.signature_url}" alt="Signature" class="cmr-img" />` : '<p>لا يوجد توقيع</p>'}
      </div>
      ${delivery?.cmr_image_url ? `
      <div class="box full">
        <label>4. صورة CMR المختوم</label>
        <img src="${delivery.cmr_image_url}" alt="CMR" class="cmr-img" />
      </div>
      ` : ''}
    </div>

    <div class="signatures">
      <div class="signature-box">
        <label>توقيع المرسل</label>
        <div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>
      </div>
      <div class="signature-box">
        <label>توقيع الناقل</label>
        <div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>
      </div>
      <div class="signature-box">
        <label>توقيع المستلم</label>
        ${delivery?.signature_url ? `<img src="${delivery.signature_url}" alt="Signature" style="max-height: 60px;" />` : '<div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>'}
      </div>
    </div>

    <div class="no-print" style="margin-top: 24px; text-align: center;">
      <button onclick="window.print()" style="padding: 10px 20px; border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 6px; cursor: pointer; font-size: 14px;">
        طباعة / حفظ كـ PDF
      </button>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
