import { formatPhoneNumber } from '@/lib/phone-utils';
import { sendWhatsAppText } from './whatsapp-meta-client';
import {
  WhatsAppFinancialTemplates,
  FuelTheftAlertPayload,
  DriverClearanceAlertPayload,
} from './whatsapp-financial-templates';
import type { WhatsAppLocale } from '../types/whatsapp.types';

// In-memory cooldown cache to prevent message spamming
// Key: incidentId or statementId, Value: timestamp of last dispatch
const ALERT_COOLDOWN_MAP = new Map<string, number>();
const COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown

export interface DispatchFinancialResult {
  success: boolean;
  phone: string;
  isSimulated: boolean;
  messageId?: string;
  skippedCooldown?: boolean;
  error?: string;
}

export class FinancialWhatsAppDispatcherService {
  /**
   * Normalize and validate international phone numbers
   */
  public static normalizePhoneNumber(rawPhone: string): string {
    return formatPhoneNumber(rawPhone);
  }

  /**
   * Check if an alert is on cooldown
   */
  public static isAlertOnCooldown(key: string): boolean {
    const lastSent = ALERT_COOLDOWN_MAP.get(key);
    if (!lastSent) return false;
    return Date.now() - lastSent < COOLDOWN_DURATION_MS;
  }

  /**
   * Clear cooldown for testing or explicit manager override
   */
  public static resetCooldown(key?: string): void {
    if (key) {
      ALERT_COOLDOWN_MAP.delete(key);
    } else {
      ALERT_COOLDOWN_MAP.clear();
    }
  }

  /**
   * 1. Dispatch Critical Fuel Theft & Siphoning WhatsApp Alert
   */
  public static async dispatchFuelTheftAlert(params: {
    incidentId: string;
    phone: string;
    payload: FuelTheftAlertPayload;
    locale?: WhatsAppLocale;
    forceBypassCooldown?: boolean;
  }): Promise<DispatchFinancialResult> {
    const normalizedPhone = this.normalizePhoneNumber(params.phone);
    if (!normalizedPhone) {
      return {
        success: false,
        phone: params.phone,
        isSimulated: false,
        error: 'Invalid phone number format',
      };
    }

    const cooldownKey = `theft_${params.incidentId}_${normalizedPhone}`;
    if (!params.forceBypassCooldown && this.isAlertOnCooldown(cooldownKey)) {
      return {
        success: true,
        phone: normalizedPhone,
        isSimulated: false,
        skippedCooldown: true,
      };
    }

    const messageText = WhatsAppFinancialTemplates.buildFuelTheftAlert(
      params.payload,
      params.locale || 'ar'
    );

    const result = await sendWhatsAppText({
      to: normalizedPhone,
      message: messageText,
    });

    if (result.success) {
      ALERT_COOLDOWN_MAP.set(cooldownKey, Date.now());
    }

    return {
      success: result.success,
      phone: normalizedPhone,
      isSimulated: result.isTestMode ?? false,
      messageId: result.messageId,
      error: result.reason,
    };
  }

  /**
   * 2. Dispatch Driver Clearance Statement / Payslip Notification
   */
  public static async dispatchDriverClearance(params: {
    statementId: string;
    phone: string;
    payload: DriverClearanceAlertPayload;
    locale?: WhatsAppLocale;
  }): Promise<DispatchFinancialResult> {
    const normalizedPhone = this.normalizePhoneNumber(params.phone);
    if (!normalizedPhone) {
      return {
        success: false,
        phone: params.phone,
        isSimulated: false,
        error: 'Invalid phone number format',
      };
    }

    const messageText = WhatsAppFinancialTemplates.buildDriverClearanceAlert(
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
}
