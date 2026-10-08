'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { dispatchTripLifecycleNotifications } from './notification-dispatcher';

export async function submitProofOfDelivery(input: {
  tripOrderId: number;
  signatureBase64: string;
  cmrImageBase64?: string;
  recipientName: string;
  latitude?: number;
  longitude?: number;
  leg: 'export' | 'import';
}): Promise<{ success: boolean; signatureUrl?: string; cmrUrl?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const timestamp = Date.now();
    const signatureFileName = `delivery-proofs/signature-${input.tripOrderId}-${timestamp}.png`;
    const cmrFileName = `delivery-proofs/cmr-${input.tripOrderId}-${timestamp}.jpg`;

    const signatureBuffer = Buffer.from(input.signatureBase64.split(',')[1] || input.signatureBase64, 'base64');
    const cmrBuffer = input.cmrImageBase64
      ? Buffer.from(input.cmrImageBase64.split(',')[1] || input.cmrImageBase64, 'base64')
      : null;

    let signatureUrl = '';
    try {
      const [sigUpload] = await Promise.all([
        supabase.storage.from('delivery-proofs').upload(signatureFileName, signatureBuffer, {
          contentType: 'image/png',
          upsert: true,
        }),
      ]);

      if (!sigUpload.error) {
        const { data: { publicUrl } } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(signatureFileName);
        signatureUrl = publicUrl;
      }
    } catch {
      // Storage upload failed or bucket not available
    }

    if (!signatureUrl) {
      signatureUrl = input.signatureBase64.startsWith('data:')
        ? input.signatureBase64
        : `data:image/png;base64,${input.signatureBase64}`;
    }

    let cmrUrl: string | undefined;
    if (cmrBuffer) {
      try {
        const { error: cmrError } = await supabase.storage.from('delivery-proofs').upload(cmrFileName, cmrBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
        if (!cmrError) {
          const { data: { publicUrl } } = supabase.storage.from('delivery-proofs').getPublicUrl(cmrFileName);
          cmrUrl = publicUrl;
        }
      } catch {
        // Storage upload failed
      }
      if (!cmrUrl) {
        cmrUrl = input.cmrImageBase64?.startsWith('data:')
          ? input.cmrImageBase64
          : `data:image/jpeg;base64,${input.cmrImageBase64}`;
      }
    }

    const { error: insertError } = await supabase
      .from('delivery_signatures')
      .insert({
        trip_order_id: input.tripOrderId,
        signature_image_url: signatureUrl,
        receipt_image_url: cmrUrl,
        recipient_name: input.recipientName,
        delivered_at: new Date().toISOString(),
        latitude: input.latitude,
        longitude: input.longitude,
      });

    if (insertError) throw insertError;

    const updateData: Record<string, unknown> = {
      status: 'completed',
    };

    if (cmrUrl) {
      if (input.leg === 'export') {
        updateData.cmr_export_url = cmrUrl;
      } else {
        updateData.cmr_import_url = cmrUrl;
      }
    }

    const { error: updateError } = await supabase
      .from('trip_orders')
      .update(updateData)
      .eq('id', input.tripOrderId);

    if (updateError) throw updateError;

    try {
      revalidatePath('/trips');
      revalidatePath('/driver-tasks');
      revalidatePath('/dashboard');
    } catch {
      // Safe no-op outside Next.js request context
    }

    dispatchTripLifecycleNotifications(input.tripOrderId, 'delivery_completed', {
      recipientName: input.recipientName,
      signedAt: new Date().toISOString(),
      latitude: input.latitude,
      longitude: input.longitude,
      signatureUrl,
      cmrUrl,
    }).catch((notifyErr) => console.warn('Notification trigger error:', notifyErr));

    return { success: true, signatureUrl, cmrUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء حفظ إثبات التسليم' };
  }
}
