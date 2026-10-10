'use server';

/**
 * Trans Bodanon TMS — Multi-Temp Targeted Receiver WhatsApp Server Actions
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP Guidelines (2013/C 343/01)
 */

import { createClient } from '@/lib/supabase/server';
import { generateCompartmentGdpCertificateAction } from './multi-temp-certificate.actions';
import {
  TargetedReceiverDispatcherService,
  type DispatchReceiverCertificateResult,
  type DispatchReceiverBatchResult,
} from './targeted-receiver-dispatcher.service';
import {
  dispatchCompartmentReceiverSchema,
  dispatchBatchReceiversSchema,
  type DispatchCompartmentReceiverInput,
  type DispatchBatchReceiversInput,
} from '../types/multi-temp-certificate.types';
import type { TargetedReceiverCertificatePayload } from '@/features/whatsapp/services/whatsapp-targeted-receiver-templates';

/**
 * Dispatches a compartment GDP compliance certificate to a designated receiver via WhatsApp
 */
export async function dispatchCompartmentReceiverWhatsAppAction(
  rawInput: DispatchCompartmentReceiverInput
): Promise<DispatchReceiverCertificateResult> {
  try {
    const parseRes = dispatchCompartmentReceiverSchema.safeParse(rawInput);
    if (!parseRes.success) {
      return {
        success: false,
        phone: rawInput?.receiverPhone || '',
        receiverName: rawInput?.receiverName || '',
        compartmentCode: 'C1',
        isSimulated: false,
        error: `بيانات الإدخال غير صالحة: ${parseRes.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const input = parseRes.data;

    // 1. Generate or fetch official GDP certificate payload
    const certRes = await generateCompartmentGdpCertificateAction({
      compartmentId: input.compartmentId,
      trailerId: input.trailerId,
      tripId: input.tripId,
      locale: input.locale,
    });

    if (!certRes.success || !certRes.payload) {
      return {
        success: false,
        phone: input.receiverPhone,
        receiverName: input.receiverName,
        compartmentCode: 'C1',
        isSimulated: false,
        error: certRes.error || 'فشل توليد وثيقة الاعتماد الحراري للحجرة',
      };
    }

    const certPayload = certRes.payload;

    // 2. Build targeted receiver notification payload
    const targetedPayload: TargetedReceiverCertificatePayload = {
      receiverName: input.receiverName,
      receiverPhone: input.receiverPhone,
      compartmentCode: certPayload.compartmentCode,
      compartmentName: certPayload.compartmentName,
      cargoCategory: certPayload.cargoCategory,
      trailerPlate: certPayload.trailerPlate,
      tripNumber: certPayload.tripNumber,
      cmrNumber: certPayload.cmrNumber,
      clientName: certPayload.clientName,
      setpointTempC: certPayload.setpointTempC,
      mktTempC: certPayload.mktTempC,
      avgSupplyTempC: certPayload.avgSupplyAirTempC,
      avgReturnTempC: certPayload.avgReturnAirTempC,
      status: certPayload.status,
      complianceScore: certPayload.complianceScore,
      verificationHash: certPayload.verificationHash,
      verificationUrl: certPayload.verificationUrl,
      arrivalLocationName: input.arrivalLocationName,
      isGeofenceTriggered: input.isGeofenceTriggered,
      issuedAt: certPayload.issuedAt,
    };

    // 3. Dispatch via WhatsApp engine
    return await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
      payload: targetedPayload,
      locale: input.locale,
      forceBypassCooldown: input.forceBypassCooldown,
      tripId: input.tripId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ غير متوقع أثناء إرسال إشعار WhatsApp للمستلم';
    return {
      success: false,
      phone: rawInput?.receiverPhone || '',
      receiverName: rawInput?.receiverName || '',
      compartmentCode: 'C1',
      isSimulated: false,
      error: msg,
    };
  }
}

/**
 * Dispatches notifications to all designated receivers for multiple compartments in batch
 */
export async function dispatchBatchReceiversWhatsAppAction(
  rawInput: DispatchBatchReceiversInput
): Promise<DispatchReceiverBatchResult> {
  try {
    const parseRes = dispatchBatchReceiversSchema.safeParse(rawInput);
    if (!parseRes.success) {
      return {
        success: false,
        dispatchedCount: 0,
        results: [],
        error: `بيانات الإدخال غير صالحة: ${parseRes.error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    const input = parseRes.data;
    const supabase = await createClient();

    // Fetch active compartment profiles for this trailer
    const { data: profiles, error: pErr } = await supabase
      .from('reefer_compartment_profiles')
      .select('id, compartment_code')
      .eq('trailer_id', input.trailerId)
      .eq('is_active', true);

    if (pErr || !profiles || profiles.length === 0) {
      return {
        success: false,
        dispatchedCount: 0,
        results: [],
        error: 'لا توجد حجرات نشطة مسجلة لهذه المقطورة',
      };
    }

    const itemsToDispatch: Array<{
      payload: TargetedReceiverCertificatePayload;
      locale?: 'ar' | 'fr' | 'es';
      forceBypassCooldown?: boolean;
      tripId?: number | null;
    }> = [];

    for (const rcv of input.receivers) {
      const matchedComp = profiles.find((p) => p.compartment_code === rcv.compartmentCode);
      if (!matchedComp) continue;

      const certRes = await generateCompartmentGdpCertificateAction({
        compartmentId: matchedComp.id,
        trailerId: input.trailerId,
        tripId: input.tripId,
        locale: input.locale,
      });

      if (!certRes.success || !certRes.payload) continue;

      itemsToDispatch.push({
        payload: {
          receiverName: rcv.receiverName,
          receiverPhone: rcv.receiverPhone,
          compartmentCode: certRes.payload.compartmentCode,
          compartmentName: certRes.payload.compartmentName,
          cargoCategory: certRes.payload.cargoCategory,
          trailerPlate: certRes.payload.trailerPlate,
          tripNumber: certRes.payload.tripNumber,
          cmrNumber: certRes.payload.cmrNumber,
          clientName: certRes.payload.clientName,
          setpointTempC: certRes.payload.setpointTempC,
          mktTempC: certRes.payload.mktTempC,
          avgSupplyTempC: certRes.payload.avgSupplyAirTempC,
          avgReturnTempC: certRes.payload.avgReturnAirTempC,
          status: certRes.payload.status,
          complianceScore: certRes.payload.complianceScore,
          verificationHash: certRes.payload.verificationHash,
          verificationUrl: certRes.payload.verificationUrl,
          arrivalLocationName: input.arrivalLocationName,
          isGeofenceTriggered: input.isGeofenceTriggered,
          issuedAt: certRes.payload.issuedAt,
        },
        locale: input.locale,
        forceBypassCooldown: input.forceBypassCooldown,
        tripId: input.tripId,
      });
    }

    if (itemsToDispatch.length === 0) {
      return {
        success: false,
        dispatchedCount: 0,
        results: [],
        error: 'لم يتم العثور على شهادات مطابقة للحجرات المحددة للمستلمين',
      };
    }

    return await TargetedReceiverDispatcherService.dispatchBatchReceivers({
      items: itemsToDispatch,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل بث رسائل المستلمين عبر WhatsApp';
    return {
      success: false,
      dispatchedCount: 0,
      results: [],
      error: msg,
    };
  }
}

