import { formatPhoneNumber } from '@/lib/phone-utils';
import { sendWhatsAppText } from '@/features/whatsapp/services/whatsapp-meta-client';
import {
  WhatsAppReeferTemplates,
  type GdpCertificateNotificationPayload,
  type ReeferExcursionAlertPayload,
} from '@/features/whatsapp/services/whatsapp-reefer-templates';
import type { WhatsAppLocale } from '@/features/whatsapp/types/whatsapp.types';

// In-memory cooldown cache to prevent alert flooding
// Key: incidentId or tripId + recipient, Value: timestamp of last dispatch
const REEFER_ALERT_COOLDOWN_MAP = new Map<string, number>();
const REEFER_COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown

export interface DispatchReeferWhatsAppResult {
  success: boolean;
  phone: string;
  isSimulated: boolean;
  messageId?: string;
  skippedCooldown?: boolean;
  error?: string;
}

export class ReeferWhatsAppDispatcherService {
  /**
   * Normalize and validate international phone numbers
   */
  public static normalizePhoneNumber(rawPhone: string): string {
    return formatPhoneNumber(rawPhone);
  }

  /**
   * Check if a reefer alert is on cooldown
   */
  public static isAlertOnCooldown(key: string): boolean {
    const lastSent = REEFER_ALERT_COOLDOWN_MAP.get(key);
    if (!lastSent) return false;
    return Date.now() - lastSent < REEFER_COOLDOWN_DURATION_MS;
  }

  /**
   * Clear cooldown for tests or manual operator overrides
   */
  public static resetCooldown(key?: string): void {
    if (key) {
      REEFER_ALERT_COOLDOWN_MAP.delete(key);
    } else {
      REEFER_ALERT_COOLDOWN_MAP.clear();
    }
  }

  /**
   * 1. Dispatch Official GDP/ATP Cold Chain Certificate via WhatsApp
   */
  public static async dispatchGdpCertificate(params: {
    tripId: string | number;
    phone: string;
    payload: GdpCertificateNotificationPayload;
    locale?: WhatsAppLocale;
  }): Promise<DispatchReeferWhatsAppResult> {
    const normalizedPhone = this.normalizePhoneNumber(params.phone);
    if (!normalizedPhone) {
      return {
        success: false,
        phone: params.phone,
        isSimulated: false,
        error: 'Invalid phone number format',
      };
    }

    const messageText = WhatsAppReeferTemplates.buildGdpCertificateNotification(
      params.payload,
      params.locale || 'ar'
    );

    const result = await sendWhatsAppText({
      to: normalizedPhone,
      message: messageText,
    });

    return {
      success: result.success,
      phone: normalizedPhone,
      isSimulated: result.isTestMode ?? false,
      messageId: result.messageId,
      error: result.reason,
    };
  }

  /**
   * 2. Dispatch Critical Temperature Excursion & Transit Breach WhatsApp Alert
   */
  public static async dispatchReeferExcursionAlert(params: {
    incidentId: string;
    phone: string;
    payload: ReeferExcursionAlertPayload;
    locale?: WhatsAppLocale;
    forceBypassCooldown?: boolean;
  }): Promise<DispatchReeferWhatsAppResult> {
    const normalizedPhone = this.normalizePhoneNumber(params.phone);
    if (!normalizedPhone) {
      return {
        success: false,
        phone: params.phone,
        isSimulated: false,
        error: 'Invalid phone number format',
      };
    }

    const cooldownKey = `reefer_exc_${params.incidentId}_${normalizedPhone}`;
    if (!params.forceBypassCooldown && this.isAlertOnCooldown(cooldownKey)) {
      return {
        success: true,
        phone: normalizedPhone,
        isSimulated: false,
        skippedCooldown: true,
      };
    }

    const messageText = WhatsAppReeferTemplates.buildReeferExcursionAlert(
      params.payload,
      params.locale || 'ar'
    );

    const result = await sendWhatsAppText({
      to: normalizedPhone,
      message: messageText,
    });

    if (result.success) {
      REEFER_ALERT_COOLDOWN_MAP.set(cooldownKey, Date.now());
    }

    return {
      success: result.success,
      phone: normalizedPhone,
      isSimulated: result.isTestMode ?? false,
      messageId: result.messageId,
      skippedCooldown: false,
      error: result.reason,
    };
  }
}

