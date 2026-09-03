'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

    const [sigUpload] = await Promise.all([
      supabase.storage.from('delivery-proofs').upload(signatureFileName, signatureBuffer, {
        contentType: 'image/png',
        upsert: true,
      }),
    ]);

    if (sigUpload.error) throw sigUpload.error;

    const { data: { publicUrl: signatureUrl } } = supabase.storage
      .from('delivery-proofs')
      .getPublicUrl(signatureFileName);

    let cmrUrl: string | undefined;
    if (cmrBuffer) {
      const { error: cmrError } = await supabase.storage.from('delivery-proofs').upload(cmrFileName, cmrBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
      if (cmrError) throw cmrError;
      const { data: { publicUrl } } = supabase.storage.from('delivery-proofs').getPublicUrl(cmrFileName);
      cmrUrl = publicUrl;
    }

    const { error: insertError } = await supabase
      .from('delivery_signatures')
      .insert({
        trip_order_id: input.tripOrderId,
        signature_url: signatureUrl,
        cmr_image_url: cmrUrl,
        signed_by: input.recipientName,
        signed_at: new Date().toISOString(),
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

    revalidatePath('/trips');
    revalidatePath('/driver-tasks');
    revalidatePath('/dashboard');

    return { success: true, signatureUrl, cmrUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء حفظ إثبات التسليم' };
  }
}
