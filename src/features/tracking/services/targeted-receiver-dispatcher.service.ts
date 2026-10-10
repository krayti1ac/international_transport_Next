/**
 * Trans Bodanon TMS — Targeted Receiver WhatsApp Dispatcher Service
 * Standards: EN 12830 / ATP Treaty / EU GDP Guidelines (2013/C 343/01)
 * Manages targeted receiver notifications per compartment with cooldown and audit trail.
 */

import { formatPhoneNumber } from '@/lib/phone-utils';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppText } from '@/features/whatsapp/services/whatsapp-meta-client';
import {
  WhatsAppTargetedReceiverTemplates,
  type TargetedReceiverCertificatePayload,
} from '@/features/whatsapp/services/whatsapp-targeted-receiver-templates';
import type { WhatsAppLocale } from '@/features/whatsapp/types/whatsapp.types';

// In-memory cooldown cache to prevent spamming receivers
const RECEIVER_COOLDOWN_MAP = new Map<string, number>();
const COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown

export interface DispatchReceiverCertificateResult {
  success: boolean;
  phone: string;
  receiverName: string;
  compartmentCode: string;
  isSimulated: boolean;
  messageId?: string;
  skippedCooldown?: boolean;
  error?: string;
}

export interface DispatchReceiverBatchResult {
  success: boolean;
  trailerPlate?: string;
  dispatchedCount: number;
  results: DispatchReceiverCertificateResult[];
  error?: string;
}

export class TargetedReceiverDispatcherService {
  /**
   * Normalizes international phone numbers
   */
  public static normalizePhoneNumber(rawPhone: string): string {
    return formatPhoneNumber(rawPhone);
  }

  /**
   * Checks if a notification to a specific receiver & compartment is on cooldown
   */
  public static isReceiverOnCooldown(key: string): boolean {
    const lastSent = RECEIVER_COOLDOWN_MAP.get(key);
    if (!lastSent) return false;
    return Date.now() - lastSent < COOLDOWN_DURATION_MS;
  }

  /**
   * Resets cooldown map (for test suites or administrator override)
   */
  public static resetCooldown(key?: string): void {
    if (key) {
      RECEIVER_COOLDOWN_MAP.delete(key);
    } else {
      RECEIVER_COOLDOWN_MAP.clear();
    }
  }

  /**
   * Dispatches a compartment GDP certificate notification to its designated receiver
   */
  public static async dispatchCompartmentToReceiver(params: {
    payload: TargetedReceiverCertificatePayload;
    locale?: WhatsAppLocale;
    forceBypassCooldown?: boolean;
    tripId?: number | null;
  }): Promise<DispatchReceiverCertificateResult> {
    const normalizedPhone = this.normalizePhoneNumber(params.payload.receiverPhone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      return {
        success: false,
        phone: params.payload.receiverPhone,
        receiverName: params.payload.receiverName,
        compartmentCode: params.payload.compartmentCode,
        isSimulated: false,
        error: 'رقم هاتف المستلم غير صالح أو غير مكتمل',
      };
    }

    const cooldownKey = `rcv_${params.payload.compartmentCode}_${normalizedPhone}_${params.tripId || params.payload.tripNumber || 'generic'}`;
    if (!params.forceBypassCooldown && this.isReceiverOnCooldown(cooldownKey)) {
      return {
        success: true,
        phone: normalizedPhone,
        receiverName: params.payload.receiverName,
        compartmentCode: params.payload.compartmentCode,
        isSimulated: false,
        skippedCooldown: true,
      };
    }

    const messageText = WhatsAppTargetedReceiverTemplates.buildTargetedReceiverNotification(
      params.payload,
      params.locale || 'ar'
    );

    const result = await sendWhatsAppText({
      to: normalizedPhone,
      message: messageText,
    });

    if (result.success) {
      RECEIVER_COOLDOWN_MAP.set(cooldownKey, Date.now());

      // Record immutable security audit log
      try {
        await recordAuditLog({
          actionType: 'whatsapp_notification',
          entityType: 'trip_order',
          entityId: params.tripId ? String(params.tripId) : params.payload.trailerPlate,
          reason: `إرسال شهادة تبريد الحجرة ${params.payload.compartmentCode} إلى مستلم الشحنة (${params.payload.receiverName}) عبر WhatsApp`,
          newData: {
            compartmentCode: params.payload.compartmentCode,
            receiverName: params.payload.receiverName,
            receiverPhone: normalizedPhone,
            status: params.payload.status,
            mktTempC: params.payload.mktTempC,
            verificationHash: params.payload.verificationHash,
            isSimulated: result.isTestMode ?? false,
            messageId: result.messageId,
          },
        });
      } catch (auditErr) {
        console.warn('[Audit Log Warning]:', auditErr);
      }
    }

    return {
      success: result.success,
      phone: normalizedPhone,
      receiverName: params.payload.receiverName,
      compartmentCode: params.payload.compartmentCode,
      isSimulated: result.isTestMode ?? false,
      messageId: result.messageId,
      error: result.reason,
    };
  }

  /**
   * Dispatches notifications to multiple compartment receivers in batch
   */
  public static async dispatchBatchReceivers(params: {
    items: Array<{
      payload: TargetedReceiverCertificatePayload;
      locale?: WhatsAppLocale;
      forceBypassCooldown?: boolean;
      tripId?: number | null;
    }>;
  }): Promise<DispatchReceiverBatchResult> {
    const results: DispatchReceiverCertificateResult[] = [];

    for (const item of params.items) {
      const res = await this.dispatchCompartmentToReceiver(item);
      results.push(res);
    }

    const anySuccess = results.some((r) => r.success);
    const trailerPlate = params.items[0]?.payload.trailerPlate;

    return {
      success: anySuccess,
      trailerPlate,
      dispatchedCount: results.filter((r) => r.success && !r.skippedCooldown).length,
      results,
    };
  }
}

