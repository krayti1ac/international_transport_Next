import { recordAuditLog } from '@/lib/audit.server';

export interface SendWhatsAppTextOptions {
  to: string;
  message: string;
  auditEntity?: {
    type: string;
    id: string | number;
  };
}

export interface SendWhatsAppTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

export interface WhatsAppSendResult {
  success: boolean;
  provider: 'meta' | 'mock' | 'none';
  originalPhone: string;
  targetPhone: string;
  isTestMode: boolean;
  messageId?: string;
  data?: unknown;
  reason?: string;
}

/**
 * Normalizes and formats international phone numbers:
 * - Strips all non-digit and non-plus characters
 * - Normalizes Moroccan local prefixes (06..., 07..., 05... -> 212...)
 * - Handles leading +, 00, or raw digits
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
  return cleaned;
}

/**
 * Dispatches an outbound WhatsApp text message via Meta Cloud API
 * Protected with a strict Safety Override Guard for development/testing
 */
export async function sendWhatsAppCloudMessage({
  to,
  message,
  auditEntity,
}: SendWhatsAppTextOptions): Promise<WhatsAppSendResult> {
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const originalPhone = formatPhoneNumber(to);

  // Safety Override Guard
  // By default, messages are safely routed to admin test numbers unless live dispatch is explicitly activated
  const isLiveDispatch = process.env.WHATSAPP_LIVE_DISPATCH === 'true';
  const defaultTestPhone = '212694585307';
  const safeTestPhone = formatPhoneNumber(process.env.SAFE_TEST_PHONE || defaultTestPhone);

  const isTestMode = !isLiveDispatch || originalPhone === safeTestPhone;
  const finalPhone = isLiveDispatch ? originalPhone : safeTestPhone;

  const finalMessage =
    !isLiveDispatch && originalPhone !== safeTestPhone
      ? `[وضع التجربة 🧪]\n🎯 الرقم الأصلي: +${originalPhone}\n---------------------------\n${message}`
      : message;

  if (!metaToken || !phoneNumberId) {
    console.warn('⚠️ Missing Meta WhatsApp credentials: WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID');

    // Audit the simulated/failed attempt
    await recordAuditLog({
      entityType: auditEntity?.type || 'whatsapp_notification',
      entityId: auditEntity?.id || originalPhone,
      actionType: 'whatsapp_notification',
      reason: 'محاولة إرسال واتساب (مفتاح API غير متوفر)',
      newData: {
        originalPhone,
        targetPhone: finalPhone,
        isTestMode,
        success: false,
        reason: 'Missing credentials',
      },
    }).catch(() => {});

    return {
      success: false,
      provider: 'none',
      originalPhone,
      targetPhone: finalPhone,
      isTestMode,
      reason: 'Missing Meta WhatsApp credentials',
    };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: finalPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: finalMessage,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Meta WhatsApp API error');
    }

    const messageId = data?.messages?.[0]?.id;
    console.log(`✅ WhatsApp message sent via Meta Cloud API. Target: ${finalPhone} (Original: ${originalPhone})`);

    // Audit successful delivery in audit_logs
    await recordAuditLog({
      entityType: auditEntity?.type || 'whatsapp_notification',
      entityId: auditEntity?.id || originalPhone,
      actionType: 'whatsapp_notification',
      reason: isTestMode
        ? `إرسال إشعار تجريبي لواتساب (+${originalPhone} -> +${finalPhone})`
        : `إرسال إشعار واتساب مباشر للعميل (+${originalPhone})`,
      newData: {
        originalPhone,
        targetPhone: finalPhone,
        isTestMode,
        messageId,
        messageLength: finalMessage.length,
        success: true,
      },
    }).catch(() => {});

    return {
      success: true,
      provider: 'meta',
      originalPhone,
      targetPhone: finalPhone,
      isTestMode,
      messageId,
      data,
    };
  } catch (error) {
    console.error('Meta WhatsApp Error:', error);

    // Audit failure in audit_logs
    await recordAuditLog({
      entityType: auditEntity?.type || 'whatsapp_notification',
      entityId: auditEntity?.id || originalPhone,
      actionType: 'whatsapp_notification',
      reason: 'فشل إرسال إشعار واتساب',
      newData: {
        originalPhone,
        targetPhone: finalPhone,
        isTestMode,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => {});

    throw error;
  }
}
