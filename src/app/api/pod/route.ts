import { NextRequest, NextResponse } from 'next/server';
import { GET as getPdfHandler } from './pdf/route';
import { createClient } from '@/lib/supabase/server';
import {
  generateDeliverySignatureHash,
  verifyDeliverySignatureIntegrity,
} from '@/lib/signature-crypto';

export async function GET(req: NextRequest) {
  const isVerify = req.nextUrl.searchParams.get('verify') === 'true';
  const isJson = req.nextUrl.searchParams.get('format') === 'json';

  if (!isVerify && !isJson) {
    return getPdfHandler(req);
  }

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

    const idNum = parseInt(tripOrderId, 10);
    const { data: tripOrder, error: tripError } = await supabase
      .from('trip_orders')
      .select('id, status, cmr_number, cmr_export_number')
      .eq('id', idNum)
      .single();

    if (tripError || !tripOrder) {
      return NextResponse.json({ error: 'الرحلة غير موجودة' }, { status: 404 });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from('delivery_signatures')
      .select('*')
      .eq('trip_order_id', idNum)
      .maybeSingle();

    if (deliveryError) {
      return NextResponse.json({ error: deliveryError.message }, { status: 500 });
    }

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: 'لم يتم العثور على إثبات تسليم مسجل لهذه الرحلة',
        },
        { status: 404 }
      );
    }

    const effectiveSigUrl = delivery.signature_url || delivery.signature_image_url || '';
    const effectiveRecipient = delivery.signed_by || delivery.recipient_name || 'UNKNOWN';
    const effectiveSignedAt = delivery.signed_at || delivery.delivered_at || '';

    const expectedHash = generateDeliverySignatureHash({
      tripOrderId: tripOrder.id,
      recipientName: effectiveRecipient,
      signedAt: effectiveSignedAt,
      latitude: delivery.latitude,
      longitude: delivery.longitude,
      signatureUrl: effectiveSigUrl,
    });

    const providedHash = req.nextUrl.searchParams.get('hash');
    const isVerified = providedHash
      ? verifyDeliverySignatureIntegrity(
          {
            tripOrderId: tripOrder.id,
            recipientName: effectiveRecipient,
            signedAt: effectiveSignedAt,
            latitude: delivery.latitude,
            longitude: delivery.longitude,
            signatureUrl: effectiveSigUrl,
          },
          providedHash
        )
      : true;

    return NextResponse.json({
      success: true,
      verified: isVerified,
      tripOrderId: tripOrder.id,
      status: tripOrder.status,
      cmrNumber: tripOrder.cmr_number || tripOrder.cmr_export_number,
      delivery: {
        signedBy: effectiveRecipient,
        signedAt: effectiveSignedAt,
        latitude: delivery.latitude,
        longitude: delivery.longitude,
        signatureUrl: effectiveSigUrl,
        cmrImageUrl: delivery.cmr_image_url || delivery.receipt_image_url || null,
      },
      cryptographicSeal: {
        algorithm: 'SHA256-HMAC',
        hash: expectedHash,
        verifiedMatch: providedHash ? isVerified : undefined,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tripOrderId,
      recipientName,
      signedAt,
      latitude,
      longitude,
      signatureUrl,
      hash,
    } = body;

    if (!tripOrderId || !hash) {
      return NextResponse.json(
        { error: 'tripOrderId و hash مطلوبان للتحقق الأمني' },
        { status: 400 }
      );
    }

    let payloadToVerify = {
      tripOrderId: Number(tripOrderId),
      recipientName: recipientName || '',
      signedAt: signedAt || '',
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      signatureUrl: signatureUrl || '',
    };

    // If caller didn't provide full payload details, fetch from DB
    if (!payloadToVerify.signatureUrl || !payloadToVerify.signedAt) {
      const supabase = await createClient();
      const { data: delivery } = await supabase
        .from('delivery_signatures')
        .select('*')
        .eq('trip_order_id', Number(tripOrderId))
        .maybeSingle();

      if (delivery) {
        payloadToVerify = {
          tripOrderId: Number(tripOrderId),
          recipientName: payloadToVerify.recipientName || delivery.signed_by || delivery.recipient_name || '',
          signedAt: payloadToVerify.signedAt || delivery.signed_at || delivery.delivered_at || '',
          latitude: payloadToVerify.latitude ?? delivery.latitude,
          longitude: payloadToVerify.longitude ?? delivery.longitude,
          signatureUrl: payloadToVerify.signatureUrl || delivery.signature_url || delivery.signature_image_url || '',
        };
      }
    }

    const verified = verifyDeliverySignatureIntegrity(payloadToVerify, hash);
    const expectedHash = generateDeliverySignatureHash(payloadToVerify);

    return NextResponse.json({
      success: true,
      verified,
      algorithm: 'SHA256-HMAC',
      tripOrderId: payloadToVerify.tripOrderId,
      providedHash: hash,
      expectedHash,
      message: verified
        ? 'تم التحقق من سلامة البصمة المشفرة بنجاح - الوثيقة موثقة ولم يطرأ عليها أي تغيير'
        : 'فشل التحقق من النزاهة التشفيرية - البيانات أو التوقيع تم تعديلها أو غير مطابقة',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'خطأ غير متوقع أثناء فحص البصمة' },
      { status: 500 }
    );
  }
}
