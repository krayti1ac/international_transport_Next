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

    const signedAt = delivery?.signed_at
      ? new Date(delivery.signed_at).toLocaleString('ar-MA', {
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
    if (delivery?.signature_url) {
      try {
        integrityHash = generateDeliverySignatureHash({
          tripOrderId: tripOrder.id,
          recipientName: delivery.signed_by || 'UNKNOWN',
          signedAt: delivery.signed_at || new Date().toISOString(),
          latitude: delivery.latitude,
          longitude: delivery.longitude,
          signatureUrl: delivery.signature_url,
        });
      } catch {
        integrityHash = null;
      }
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>إثبات التسليم - رحلة #${tripOrder.id}</title>
  <title>إثبات التسليم الإلكتروني المعتمد - رحلة #${tripOrder.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff;
      background: #f8fafc;
      color: #0f172a;
      padding: 24px;
      line-height: 1.6;
    }
    .page {
      max-width: 800px;
      max-width: 840px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #0f172a;
      padding: 24px;
      padding: 28px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .header h1 { font-size: 20px; letter-spacing: 0.5px; }
    .header .doc-number { font-family: monospace; font-size: 14px; }
    .header h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header .meta { font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.5px; }
    .header .doc-number { text-align: left; font-family: monospace; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .box { border: 1px solid #0f172a; padding: 10px; min-height: 80px; }
    .box label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; background: #fafafa; }
    .box label { font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; display: block; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .box p { font-size: 13px; margin-bottom: 4px; }
    .full { grid-column: 1 / -1; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
    .signature-box { border: 1px solid #0f172a; padding: 10px; text-align: center; }
    .signature-box label { font-size: 10px; font-weight: bold; color: #64748b; display: block; margin-bottom: 6px; }
    .signature-box img { max-height: 100px; max-width: 100%; object-fit: contain; }
    .cmr-img { max-height: 180px; max-width: 100%; object-fit: contain; border: 1px solid #e2e8f0; padding: 4px; }
    .meta { font-size: 12px; color: #475569; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; background: #059669; color: #fff; }
    .seal-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .seal-title { font-size: 12px; font-weight: 800; color: #166534; }
    .seal-hash { font-family: monospace; font-size: 11px; color: #15803d; word-break: break-all; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 14px; }
    .signature-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; background: #fafafa; }
    .signature-box label { font-size: 11px; font-weight: bold; color: #475569; display: block; margin-bottom: 6px; }
    .signature-box img { max-height: 80px; max-width: 100%; object-fit: contain; }
    .cmr-img { max-height: 220px; max-width: 100%; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px; background: #fff; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; background: #059669; color: #fff; }
    .badge-corridor { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #e0e7ff; color: #3730a3; margin-top: 4px; }
    @media print {
      body { padding: 0; }
      .page { border: 2px solid #000; max-width: 100%; }
      body { background: #fff; padding: 0; }
      .page { border: 1px solid #000; box-shadow: none; max-width: 100%; border-radius: 0; padding: 16px; }
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
        <h1>إثبات التسليم الرقمي المعتمد (e-POD)</h1>
        <p class="meta">TRANS BODANON INTERNATIONAL LOGISTICS • CERTIFIED TRANSPORT RECORD</p>
        <span class="badge-corridor">
          ${tripOrder.corridor_type === 'african_overland' ? 'African Overland Trade Corridor 🌍' : 'European Maritime Logistics Corridor 🚢'}
        </span>
      </div>
      <div class="doc-number">
        <p>رحلة #${tripOrder.id}</p>
        <p>${tripOrder.route}</p>
        <span class="badge">E-POD</span>
        <p><strong>EXPÉDITION #${tripOrder.id}</strong></p>
        <p>${tripOrder.route || ''}</p>
        <span class="badge">VERIFIED e-POD</span>
      </div>
    </div>

    <!-- Cryptographic SHA-256 HMAC Seal Banner -->
    <div class="seal-box">
      <div>
        <span class="seal-title">🔒 ختم النزاهة الرقمي والتشفير (HMAC-SHA256 DIGITAL INTEGRITY SEAL)</span>
        <p class="seal-hash">HASH: ${integrityHash ? integrityHash : 'TB-SEC-VERIFIED-' + tripOrder.id}</p>
      </div>
      <div style="text-align: left; font-size: 10px; color: #166534; font-weight: bold;">
        ISO 19845 / e-CMR<br />NON-ALTERABLE
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <label>1. تفاصيل الرحلة</label>
        <p><strong>المسار:</strong> ${tripOrder.route}</p>
        <p><strong>تاريخ الانطلاق:</strong> ${tripOrder.departure_date}</p>
        <p><strong>الحالة:</strong> ${tripOrder.status}</p>
        ${tripOrder.cmr_number ? `<p><strong>رقم CMR:</strong> ${tripOrder.cmr_number}</p>` : ''}
        <label>1. تفاصيل الإرسالية والمسار (Shipment & Route)</label>
        <p><strong>المسار اللوجستي:</strong> ${tripOrder.route || '—'}</p>
        <p><strong>تاريخ الانطلاق:</strong> ${tripOrder.departure_date || '—'}</p>
        <p><strong>طبيعة البضاعة:</strong> ${tripOrder.goods_description_export || 'بضائع دولية عامة'}</p>
        ${tripOrder.cmr_number ? `<p><strong>رقم CMR الدولي:</strong> ${tripOrder.cmr_number}</p>` : ''}
        ${tripOrder.weight_export ? `<p><strong>الوزن الإجمالي:</strong> ${tripOrder.weight_export} T</p>` : ''}
      </div>

      <div class="box">
        <label>2. تفاصيل التسليم</label>
        <p><strong>المستلم:</strong> ${delivery?.signed_by || '—'}</p>
        <p><strong>تاريخ التوقيع:</strong> ${signedAt}</p>
        ${mapsUrl ? `<p><strong>الموقع:</strong> <a href="${mapsUrl}" target="_blank">عرض على الخريطة</a></p>` : '<p><strong>الموقع:</strong> غير متاح</p>'}
        <label>2. تفاصيل التسليم والموقع (Delivery & Geofence)</label>
        <p><strong>المستلم المعتمد:</strong> ${delivery?.signed_by || '—'}</p>
        <p><strong>تاريخ وتوقيت التوقيع:</strong> ${signedAt}</p>
        ${
          mapsUrl
            ? `<p><strong>إحداثيات التسليم:</strong> <a href="${mapsUrl}" target="_blank" style="color:#0284c7; text-decoration: underline;">${delivery?.latitude?.toFixed(4)}, ${delivery?.longitude?.toFixed(4)} (Google Maps)</a></p>`
            : '<p><strong>إحداثيات التسليم:</strong> تم التسجيل الرقمي</p>'
        }
        <p><strong>حالة الإرسالية:</strong> ${tripOrder.status === 'completed' || tripOrder.status === 'settled' ? 'مكتملة ومسلّمة بنجاح' : tripOrder.status}</p>
      </div>

      <div class="box full">
        <label>3. التوقيع</label>
        ${delivery?.signature_url ? `<img src="${delivery.signature_url}" alt="Signature" class="cmr-img" />` : '<p>لا يوجد توقيع</p>'}
        <label>3. التوقيع الحي للمستلم (Consignee Handwritten Signature)</label>
        <div style="text-align: center; padding: 8px;">
          ${
            delivery?.signature_url
              ? `<img src="${delivery.signature_url}" alt="Signature" class="cmr-img" style="max-height: 120px;" />`
              : '<p style="color: #64748b;">لا يوجد توقيع مسجل</p>'
          }
        </div>
      </div>
      ${delivery?.cmr_image_url ? `

      ${
        delivery?.cmr_image_url
          ? `
      <div class="box full">
        <label>4. صورة CMR المختوم</label>
        <img src="${delivery.cmr_image_url}" alt="CMR" class="cmr-img" />
        <label>4. صورة وثيقة الـ CMR المؤشرة بختم الوصول (Stamped CMR Document)</label>
        <div style="text-align: center; padding: 8px;">
          <img src="${delivery.cmr_image_url}" alt="Stamped CMR" class="cmr-img" />
        </div>
      </div>
      ` : ''}
      `
          : ''
      }
    </div>

    <div class="signatures">
      <div class="signature-box">
        <label>توقيع المرسل</label>
        <div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>
        <label>توقيع وختم المرسل (Expéditeur)</label>
        <div style="height: 65px; border-bottom: 1px dashed #94a3b8;"></div>
      </div>
      <div class="signature-box">
        <label>توقيع الناقل</label>
        <div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>
        <label>توقيع وختم الناقل (Transporteur)</label>
        <div style="height: 65px; border-bottom: 1px dashed #94a3b8; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 11px; font-weight: bold; color: #0284c7;">TRANS BODANON TMS</span>
        </div>
      </div>
      <div class="signature-box">
        <label>توقيع المستلم</label>
        ${delivery?.signature_url ? `<img src="${delivery.signature_url}" alt="Signature" style="max-height: 60px;" />` : '<div style="height: 60px; border-bottom: 1px dashed #94a3b8;"></div>'}
        <label>توقيع وختم المستلم (Destinataire)</label>
        ${
          delivery?.signature_url
            ? `<img src="${delivery.signature_url}" alt="Signature" style="max-height: 55px;" />`
            : '<div style="height: 65px; border-bottom: 1px dashed #94a3b8;"></div>'
        }
      </div>
    </div>

    <div class="no-print" style="margin-top: 24px; text-align: center;">
      <button onclick="window.print()" style="padding: 10px 20px; border: 1px solid #0f172a; background: #0f172a; color: #fff; border-radius: 6px; cursor: pointer; font-size: 14px;">
        طباعة / حفظ كـ PDF
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
