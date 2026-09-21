import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDeliverySignatureHash } from '@/lib/signature-crypto';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const tripOrderId =
      req.nextUrl.searchParams.get('tripId') ||
      req.nextUrl.searchParams.get('tripOrderId');

    if (!tripOrderId) {
      return NextResponse.json(
        { error: 'tripId أو tripOrderId مطلوب' },
        { status: 400 }
      );
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

    const effectiveSigUrl = delivery?.signature_url || delivery?.signature_image_url || null;
    const effectiveRecipient = delivery?.signed_by || delivery?.recipient_name || 'UNKNOWN';
    const effectiveSignedAt = delivery?.signed_at || delivery?.delivered_at || new Date().toISOString();

    const signedAt = (delivery?.signed_at || delivery?.delivered_at)
      ? new Date(delivery.signed_at || delivery.delivered_at).toLocaleString('ar-MA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

    const mapsUrl =
      delivery?.latitude && delivery?.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${delivery.latitude},${delivery.longitude}`
        : null;

    // Generate cryptographic integrity hash
    let integrityHash: string | null = null;
    if (effectiveSigUrl) {
      try {
        integrityHash = generateDeliverySignatureHash({
          tripOrderId: tripOrder.id,
          recipientName: effectiveRecipient,
          signedAt: effectiveSignedAt,
          latitude: delivery.latitude,
          longitude: delivery.longitude,
          signatureUrl: effectiveSigUrl,
        });
      } catch {
        integrityHash = null;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إثبات التسليم الإلكتروني المعتمد - رحلة #${tripOrder.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px;
      line-height: 1.6;
    }
    .page {
      max-width: 840px;
      margin: 0 auto;
      background: #fff;
      padding: 32px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 20px;
      font-weight: 800;
      color: #0284c7;
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #e0f2fe;
      color: #0369a1;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .box {
      border: 1px solid #e2e8f0;
      padding: 16px;
      border-radius: 6px;
      background: #f8fafc;
    }
    .box.full {
      grid-column: span 2;
    }
    .box label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .box p {
      font-size: 14px;
      font-weight: 500;
      color: #0f172a;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
      background: #fff;
    }
    .signature-box label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 8px;
    }
    .cmr-img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      margin-top: 8px;
    }
    .hash-badge {
      background: #f1f5f9;
      padding: 10px;
      border-radius: 6px;
      border: 1px dashed #94a3b8;
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
      margin-top: 16px;
      direction: ltr;
      text-align: left;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { border: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">TRANS BODANON TMS</div>
        <h1>وثيقة إثبات التسليم الرسمية (e-POD Report)</h1>
      </div>
      <div style="text-align: left;">
        <span class="badge">معتمد إلكترونياً</span>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">رقم الرحلة: #${tripOrder.id}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <label>1. بيانات الرحلة والمسار</label>
        <p><strong>المسار:</strong> ${tripOrder.route || 'غير محدد'}</p>
        <p><strong>تاريخ الانطلاق:</strong> ${tripOrder.departure_date ? new Date(tripOrder.departure_date).toLocaleDateString('ar-MA') : '—'}</p>
        <p><strong>رقم الـ CMR:</strong> ${tripOrder.cmr_number || tripOrder.cmr_export_number || '—'}</p>
      </div>

      <div class="box">
        <label>2. تفاصيل التسليم والمستلم</label>
        <p><strong>اسم المستلم:</strong> ${effectiveRecipient}</p>
        <p><strong>تاريخ وتوقيت التوقيع:</strong> ${signedAt}</p>
        ${
          mapsUrl
            ? `<p><strong>إحداثيات التسليم:</strong> <a href="${mapsUrl}" target="_blank" style="color:#0284c7; text-decoration: underline;">${delivery?.latitude?.toFixed(4)}, ${delivery?.longitude?.toFixed(4)} (Google Maps)</a></p>`
            : '<p><strong>إحداثيات التسليم:</strong> تم التسجيل الرقمي</p>'
        }
        <p><strong>حالة الإرسالية:</strong> ${tripOrder.status === 'completed' || tripOrder.status === 'settled' ? 'مكتملة ومسلّمة بنجاح' : tripOrder.status}</p>
      </div>

      <div class="box full">
        <label>3. التوقيع الحي للمستلم (Consignee Handwritten Signature)</label>
        <div style="text-align: center; padding: 8px;">
          ${
            effectiveSigUrl
              ? `<img src="${effectiveSigUrl}" alt="Signature" class="cmr-img" style="max-height: 120px;" />`
              : '<p style="color: #64748b;">لا يوجد توقيع مسجل</p>'
          }
        </div>
      </div>

      ${
        delivery?.cmr_image_url
          ? `
      <div class="box full">
        <label>4. صورة وثيقة الـ CMR المؤشرة بختم الوصول (Stamped CMR Document)</label>
        <div style="text-align: center; padding: 8px;">
          <img src="${delivery.cmr_image_url}" alt="Stamped CMR" class="cmr-img" />
        </div>
      </div>
      `
          : ''
      }
    </div>

    ${
      integrityHash
        ? `
    <div class="hash-badge">
      <div style="font-weight: bold; margin-bottom: 4px; color: #0f172a;">🔒 Cryptographic Proof (HMAC-SHA256):</div>
      <div>${integrityHash}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">هذه الوثيقة مشفرة ومحمية ضد التزوير والتلاعب في بيانات الاستلام الدولية.</div>
    </div>
    `
        : ''
    }

    <div class="signatures">
      <div class="signature-box">
        <label>توقيع وختم المرسل (Expéditeur)</label>
        <div style="height: 65px; border-bottom: 1px dashed #94a3b8;"></div>
      </div>
      <div class="signature-box">
        <label>توقيع وختم الناقل (Transporteur)</label>
        <div style="height: 65px; border-bottom: 1px dashed #94a3b8; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 11px; font-weight: bold; color: #0284c7;">TRANS BODANON TMS</span>
        </div>
      </div>
      <div class="signature-box">
        <label>توقيع وختم المستلم (Destinataire)</label>
        ${
          effectiveSigUrl
            ? `<img src="${effectiveSigUrl}" alt="Signature" style="max-height: 55px;" />`
            : '<div style="height: 65px; border-bottom: 1px dashed #94a3b8;"></div>'
        }
      </div>
    </div>

    <div class="no-print" style="margin-top: 24px; text-align: center; display: flex; justify-content: center; gap: 12px;">
      <button onclick="window.print()" style="padding: 10px 24px; border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
        طباعة الوثيقة / حفظ كـ PDF
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
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
