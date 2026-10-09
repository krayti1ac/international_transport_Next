/**
 * Trans Bodanon TMS — Meta WhatsApp Cloud API Client
 * Enterprise-grade gateway supporting Text, Interactive Buttons, Lists, and Documents.
 * Enforces Safety Override Guard & Multi-tenant audit logging.
 */

import { formatPhoneNumber } from '@/lib/phone-utils';
import { recordAuditLog } from '@/lib/audit.server';
import { createClient } from '@/lib/supabase/server';
import type {
  SendInteractiveButtonsOptions,
  SendInteractiveListOptions,
  SendDocumentOptions,
} from '../types/whatsapp.types';
import type { SendWhatsAppTextOptions, WhatsAppSendResult } from '@/lib/whatsapp';

export { formatPhoneNumber };

function resolveRouting(originalTo: string) {
  const originalPhone = formatPhoneNumber(originalTo);
  const isLiveDispatch = process.env.WHATSAPP_LIVE_DISPATCH === 'true';
  const defaultTestPhone = '212694585307';
  const safeTestPhone = formatPhoneNumber(process.env.SAFE_TEST_PHONE || defaultTestPhone);

  const isTestMode = !isLiveDispatch || originalPhone === safeTestPhone;
  const targetPhone = isLiveDispatch ? originalPhone : safeTestPhone;

  return { originalPhone, targetPhone, isTestMode, isLiveDispatch };
}

async function logOutboundToDatabase(params: {
  phone: string;
  messageType: 'text' | 'interactive' | 'document' | 'template';
  content: string;
  status: 'sent' | 'failed';
  wamid?: string;
  error?: string;
  relatedEntityType?: 'trip_order' | 'invoice' | 'driver' | 'client' | 'emergency';
  relatedEntityId?: number;
  rawPayload?: Record<string, unknown>;
}) {
  try {
    const supabase = await createClient();
    await supabase.from('whatsapp_message_logs').insert({
      phone: params.phone,
      direction: 'outbound',
      message_type: params.messageType,
      content: params.content,
      status: params.status,
      wamid: params.wamid || null,
      error_message: params.error || null,
      related_entity_type: params.relatedEntityType || null,
      related_entity_id: params.relatedEntityId || null,
      raw_payload: params.rawPayload || {},
    });
  } catch (dbErr) {
    // Non-blocking log persistence failure
    console.warn('[WhatsApp DB Log Error]:', dbErr);
  }
}

/**
 * 1. Dispatches standard WhatsApp text message
 */
export async function sendWhatsAppText(
  options: SendWhatsAppTextOptions
): Promise<WhatsAppSendResult> {
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { originalPhone, targetPhone, isTestMode, isLiveDispatch } = resolveRouting(options.to);

  const finalMessage =
    !isLiveDispatch && originalPhone !== targetPhone
      ? `[وضع التجربة 🧪]\n🎯 الرقم الأصلي: +${originalPhone}\n---------------------------\n${options.message}`
      : options.message;

  if (!metaToken || !phoneNumberId) {
    console.warn('⚠️ Missing Meta WhatsApp credentials: WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID');

    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'text',
      content: options.message,
      status: 'failed',
      error: 'Missing Meta WhatsApp credentials',
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });

    return {
      success: false,
      provider: 'none',
      originalPhone,
      targetPhone,
      isTestMode,
      reason: 'Missing Meta WhatsApp credentials',
    };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: targetPhone,
      type: 'text',
      text: {
        preview_url: true,
        body: finalMessage,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Meta WhatsApp API error');
    }

    const messageId = data?.messages?.[0]?.id;

    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'text',
      content: options.message,
      status: 'sent',
      wamid: messageId,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
      rawPayload: data,
    });

    await recordAuditLog({
      entityType: options.auditEntity?.type || 'whatsapp_notification',
      entityId: options.auditEntity?.id || originalPhone,
      actionType: 'whatsapp_notification',
      reason: isTestMode
        ? `إرسال نصي تجريبي لواتساب (+${originalPhone} -> +${targetPhone})`
        : `إرسال نصي مباشر لواتساب (+${originalPhone})`,
      newData: {
        originalPhone,
        targetPhone,
        isTestMode,
        messageId,
        success: true,
      },
    }).catch(() => {});

    return {
      success: true,
      provider: 'meta',
      originalPhone,
      targetPhone,
      isTestMode,
      messageId,
      data,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'text',
      content: options.message,
      status: 'failed',
      error: errorMsg,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });
    throw error;
  }
}

/**
 * 2. Dispatches interactive quick reply button message (Up to 3 action buttons)
 */
export async function sendWhatsAppInteractiveButtons(
  options: SendInteractiveButtonsOptions
): Promise<WhatsAppSendResult> {
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { originalPhone, targetPhone, isTestMode, isLiveDispatch } = resolveRouting(options.to);

  const safeBody =
    !isLiveDispatch && originalPhone !== targetPhone
      ? `[وضع التجربة 🧪]\n🎯 المستلم: +${originalPhone}\n---------------------------\n${options.body}`
      : options.body;

  const buttonsPayload = options.buttons.slice(0, 3).map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id.substring(0, 256),
      title: btn.title.substring(0, 20),
    },
  }));

  const interactiveObject: Record<string, unknown> = {
    type: 'button',
    body: { text: safeBody },
    action: {
      buttons: buttonsPayload,
    },
  };

  if (options.headerText) {
    interactiveObject.header = {
      type: 'text',
      text: options.headerText.substring(0, 60),
    };
  }

  if (options.footerText) {
    interactiveObject.footer = {
      text: options.footerText.substring(0, 60),
    };
  }

  if (!metaToken || !phoneNumberId) {
    console.warn('⚠️ Missing Meta credentials for interactive WhatsApp message');
    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'interactive',
      content: options.body,
      status: 'failed',
      error: 'Missing Meta WhatsApp credentials',
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });

    return {
      success: false,
      provider: 'none',
      originalPhone,
      targetPhone,
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
        to: targetPhone,
        type: 'interactive',
        interactive: interactiveObject,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Meta WhatsApp Interactive API error');
    }

    const messageId = data?.messages?.[0]?.id;

    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'interactive',
      content: options.body,
      status: 'sent',
      wamid: messageId,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
      rawPayload: data,
    });

    return {
      success: true,
      provider: 'meta',
      originalPhone,
      targetPhone,
      isTestMode,
      messageId,
      data,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'interactive',
      content: options.body,
      status: 'failed',
      error: errorMsg,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });
    throw error;
  }
}

/**
 * 3. Dispatches interactive menu list message (Sections & Rows)
 */
export async function sendWhatsAppInteractiveList(
  options: SendInteractiveListOptions
): Promise<WhatsAppSendResult> {
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { originalPhone, targetPhone, isTestMode, isLiveDispatch } = resolveRouting(options.to);

  const safeBody =
    !isLiveDispatch && originalPhone !== targetPhone
      ? `[وضع التجربة 🧪]\n🎯 المستلم: +${originalPhone}\n---------------------------\n${options.body}`
      : options.body;

  const sectionsPayload = options.sections.slice(0, 10).map((sec) => ({
    title: sec.title.substring(0, 24),
    rows: sec.rows.slice(0, 10).map((r) => ({
      id: r.id.substring(0, 200),
      title: r.title.substring(0, 24),
      description: r.description ? r.description.substring(0, 72) : undefined,
    })),
  }));

  const interactiveObject: Record<string, unknown> = {
    type: 'list',
    body: { text: safeBody },
    action: {
      button: options.buttonText.substring(0, 20),
      sections: sectionsPayload,
    },
  };

  if (options.headerText) {
    interactiveObject.header = {
      type: 'text',
      text: options.headerText.substring(0, 60),
    };
  }

  if (options.footerText) {
    interactiveObject.footer = {
      text: options.footerText.substring(0, 60),
    };
  }

  if (!metaToken || !phoneNumberId) {
    console.warn('⚠️ Missing Meta credentials for list WhatsApp message');
    return {
      success: false,
      provider: 'none',
      originalPhone,
      targetPhone,
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
        to: targetPhone,
        type: 'interactive',
        interactive: interactiveObject,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Meta WhatsApp List API error');
    }

    const messageId = data?.messages?.[0]?.id;

    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'interactive',
      content: options.body,
      status: 'sent',
      wamid: messageId,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
      rawPayload: data,
    });

    return {
      success: true,
      provider: 'meta',
      originalPhone,
      targetPhone,
      isTestMode,
      messageId,
      data,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'interactive',
      content: options.body,
      status: 'failed',
      error: errorMsg,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });
    throw error;
  }
}

/**
 * 4. Dispatches PDF document attachment (e-CMR, e-POD, Invoice)
 */
export async function sendWhatsAppDocument(
  options: SendDocumentOptions
): Promise<WhatsAppSendResult> {
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const { originalPhone, targetPhone, isTestMode } = resolveRouting(options.to);

  if (!metaToken || !phoneNumberId) {
    return {
      success: false,
      provider: 'none',
      originalPhone,
      targetPhone,
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
        to: targetPhone,
        type: 'document',
        document: {
          link: options.documentUrl,
          caption: options.caption || undefined,
          filename: options.filename,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Meta WhatsApp Document API error');
    }

    const messageId = data?.messages?.[0]?.id;

    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'document',
      content: `[Document: ${options.filename}] ${options.documentUrl}`,
      status: 'sent',
      wamid: messageId,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
      rawPayload: data,
    });

    return {
      success: true,
      provider: 'meta',
      originalPhone,
      targetPhone,
      isTestMode,
      messageId,
      data,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await logOutboundToDatabase({
      phone: originalPhone,
      messageType: 'document',
      content: `[Document: ${options.filename}] ${options.documentUrl}`,
      status: 'failed',
      error: errorMsg,
      relatedEntityType: options.auditEntity?.type as any,
      relatedEntityId: Number(options.auditEntity?.id) || undefined,
    });
    throw error;
  }
}

