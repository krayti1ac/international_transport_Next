import Decimal from 'decimal.js';
import { createClient } from '@supabase/supabase-js';
import { recordAuditLog } from '@/lib/audit.server';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TelegramInlineButton {
  text: string;
  url: string;
}

export interface TelegramDispatchOptions {
  /** معرف المحادثة للعميل أو السائق أو جروب إدارة الشركة (مثال: -100192837465) */
  chatId: string | number;
  /** نص الرسالة بدعم تنسيق HTML */
  message: string;
  /** أزرار تفاعلية مدمجة أسفل الرسالة (روابط التتبع الفضائي، تحميل الفواتير أو الـ e-POD) */
  inlineButtons?: TelegramInlineButton[][];
  /** كتم صوت الإشعار (مفيد للتقارير الصباحية غير الطارئة) */
  silent?: boolean;
  /** ربط الإشعار بسجل التدقيق الأمني */
  auditEntity?: {
    type: string;
    id: string | number;
  };
}

export interface TelegramDispatchResult {
  success: boolean;
  messageId?: number;
  effectiveChatId?: string;
  safetyRedirected?: boolean;
  error?: string;
}

export interface TelegramWebhookMessage {
  message_id: number;
  chat: {
    id: number | string;
    type?: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  from?: {
    id: number;
    first_name?: string;
    username?: string;
    language_code?: string;
  };
  text?: string;
  date?: number;
}

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
}

export interface TelegramTrackedTripSnapshot {
  tripId: number;
  companyId?: number | null;
  cmrNumber: string;
  route: string;
  status: string;
  plateNumber?: string;
  driverName?: string;
  departureDate?: string;
  currentLocationLabel?: string;
  reeferSetpointC?: string | number | null;
  reeferSupplyTempC?: string | number | null;
  etaText?: string;
}

/**
 * دالة موحدة لإرسال إشعارات تيليجرام الفورية (Telegram Bot API)
 * تدعم العزل متعدد المستأجرين (Multi-Tenant) والأزرار التفاعلية (Inline Keyboards)
 */
export async function sendTelegramAlert(
  options: TelegramDispatchOptions
): Promise<TelegramDispatchResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultTestChatId =
    process.env.TELEGRAM_DEFAULT_CHAT_ID || '-100192837465';
  const isLiveDispatch = process.env.TELEGRAM_LIVE_DISPATCH === 'true';

  if (!botToken) {
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN غير مضبوط في متغيرات البيئة',
    };
  }

  const targetChatId = String(options.chatId).trim();
  if (!targetChatId) {
    return {
      success: false,
      error: 'معرف محادثة تيليجرام (chatId) فارغ',
    };
  }

  // صمام الأمان: توجيه الرسائل إلى جروب الاختبار ما لم يتم تفعيل الوضع الحي
  const effectiveChatId = isLiveDispatch ? targetChatId : defaultTestChatId;
  const safetyRedirected = !isLiveDispatch && targetChatId !== defaultTestChatId;

  const finalMessage = safetyRedirected
    ? `⚠️ <b>[وضع المحاكاة الآمن - Redirected from Chat: ${targetChatId}]</b>\n\n${options.message}`
    : options.message;

  try {
    const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload: Record<string, unknown> = {
      chat_id: effectiveChatId,
      text: finalMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      disable_notification: options.silent ?? false,
    };

    if (options.inlineButtons && options.inlineButtons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: options.inlineButtons,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };

    if (!res.ok || !data.ok) {
      const errMsg = data?.description || `Telegram HTTP ${res.status}`;
      console.error('[Telegram Bot Error]:', errMsg);
      return {
        success: false,
        effectiveChatId,
        safetyRedirected,
        error: errMsg,
      };
    }

    const msgId = data.result?.message_id;

    // توثيق الإشعار في سجل التدقيق الأمني
    if (options.auditEntity) {
      await recordAuditLog({
        entityType: options.auditEntity.type,
        entityId: options.auditEntity.id,
        actionType: 'telegram_notification',
        reason: `إشعار Telegram مرسل إلى المحادثة ${effectiveChatId}${
          safetyRedirected ? ` (محول من ${targetChatId})` : ''
        }`,
        newData: {
          chatId: effectiveChatId,
          intendedChatId: targetChatId,
          messageId: msgId,
          liveMode: isLiveDispatch,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      messageId: msgId,
      effectiveChatId,
      safetyRedirected,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Telegram network error';
    console.error('[Telegram Dispatch Exception]:', message);
    return {
      success: false,
      effectiveChatId,
      safetyRedirected,
      error: message,
    };
  }
}

/**
 * تنسيق درجة حرارة المبرد بدقة Decimal.js
 */
export function formatReeferTempDisplay(
  tempC?: string | number | null
): string {
  if (tempC === undefined || tempC === null || String(tempC).trim() === '') {
    return 'N/A';
  }
  try {
    const d = new Decimal(String(tempC));
    const prefix = d.greaterThan(0) ? '+' : '';
    return `${prefix}${d.toFixed(1)}°C`;
  } catch {
    return String(tempC);
  }
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * معالج أوامر بوت تيليجرام التفاعلي (Interactive Telegram Bot Webhook Handler)
 * يدعم الأوامر:
 * - /start أو /help
 * - /track <TripID أو رقم CMR>
 * - /reefer <TripID أو رقم CMR>
 */
export async function handleTelegramBotWebhookUpdate(
  update: TelegramWebhookUpdate,
  options?: {
    lookupTrip?: (
      query: string,
      chatId: string
    ) => Promise<TelegramTrackedTripSnapshot | null>;
  }
): Promise<{
  handled: boolean;
  command?: string;
  query?: string;
  replyDispatched?: boolean;
  replyText?: string;
}> {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text || !msg.chat?.id) {
    return { handled: false };
  }

  const chatId = String(msg.chat.id);
  const rawText = msg.text.trim();
  if (!rawText.startsWith('/')) {
    return { handled: false };
  }

  const parts = rawText.split(/\s+/);
  const rawCmd = parts[0].toLowerCase().split('@')[0]; // strip @BotUsername if in group
  const queryArg = parts.slice(1).join(' ').trim();
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

  if (rawCmd === '/start' || rawCmd === '/help') {
    const helpHtml =
      `🤖 <b>مرحباً بكم في المساعد اللوجستي الذكي — Trans Bodanon TMS</b>\n\n` +
      `الأوامر الفورية المتاحة:\n` +
      `• <code>/track [رقم الرحلة أو CMR]</code> — تتبع موقع الشاحنة، المسار، وحالة العبور.\n` +
      `• <code>/reefer [رقم الرحلة أو CMR]</code> — فحص درجة حرارة مقطورة التبريد الحية (Cold Chain).\n\n` +
      `🌐 <i>Suivi en temps réel (AR / FR / ES) • Seguimiento Internacional</i>`;

    const dispatchRes = await sendTelegramAlert({
      chatId,
      message: helpHtml,
      inlineButtons: [
        [{ text: '🌐 بوابة العملاء / Client Portal', url: `${siteUrl}/portal` }],
      ],
    });

    return {
      handled: true,
      command: rawCmd,
      replyDispatched: dispatchRes.success,
      replyText: helpHtml,
    };
  }

  if (rawCmd === '/track' || rawCmd === '/reefer') {
    if (!queryArg) {
      const usageHtml =
        `ℹ️ <b>يرجى تحديد رقم الرحلة أو رقم الـ CMR بعد الأمر:</b>\n` +
        `مثال: <code>/track 1042</code> أو <code>/track CMR-2026-8841</code>`;

      const dispatchRes = await sendTelegramAlert({
        chatId,
        message: usageHtml,
      });

      return {
        handled: true,
        command: rawCmd,
        replyDispatched: dispatchRes.success,
        replyText: usageHtml,
      };
    }

    const normalizedQuery = queryArg.replace(/^#/, '').trim();
    let snapshot: TelegramTrackedTripSnapshot | null = null;

    if (options?.lookupTrip) {
      snapshot = await options.lookupTrip(normalizedQuery, chatId);
    } else {
      snapshot = await lookupTripFromDatabase(normalizedQuery, chatId);
    }

    if (!snapshot) {
      const notFoundHtml =
        `⚠️ <b>لم يتم العثور على شحنة مطابقة للرمز:</b> <code>${normalizedQuery}</code>\n` +
        `تأكد من رقم الإرسالية أو وثيقة الشحن الدولي (CMR).`;

      const dispatchRes = await sendTelegramAlert({
        chatId,
        message: notFoundHtml,
      });

      return {
        handled: true,
        command: rawCmd,
        query: normalizedQuery,
        replyDispatched: dispatchRes.success,
        replyText: notFoundHtml,
      };
    }

    const supplyDisplay = formatReeferTempDisplay(snapshot.reeferSupplyTempC);
    const setpointDisplay = formatReeferTempDisplay(snapshot.reeferSetpointC);
    const trackingUrl = `${siteUrl}/track/${snapshot.tripId}`;
    const podUrl = `${siteUrl}/api/pod?tripId=${snapshot.tripId}`;

    const replyHtml =
      `🛰️ <b>تقرير التتبع الفضائي الفوري | Trans Bodanon TMS</b>\n\n` +
      `• <b>رقم الإرسالية:</b> #${snapshot.tripId}\n` +
      `• <b>وثيقة الشحن (CMR):</b> <code>${snapshot.cmrNumber}</code>\n` +
      `• <b>المسار اللوجستي:</b> ${snapshot.route}\n` +
      (snapshot.plateNumber
        ? `• <b>الشاحنة المخصصة:</b> <code>${snapshot.plateNumber}</code>\n`
        : '') +
      `• <b>الحالة التشغيلية:</b> ${snapshot.status}\n` +
      (snapshot.currentLocationLabel
        ? `• <b>الموقع الحالي:</b> ${snapshot.currentLocationLabel}\n`
        : '') +
      `• <b>حرارة المبرد (Reefer):</b> ❄️ <b>${supplyDisplay}</b> (الهدف: ${setpointDisplay})\n` +
      (snapshot.etaText ? `• <b>الوصول المتوقع (ETA):</b> ${snapshot.etaText}\n` : '');

    const inlineButtons: TelegramInlineButton[][] = [
      [{ text: '📍 خريطة التتبع الفضائي الحية', url: trackingUrl }],
    ];

    if (
      snapshot.status === 'delivered' ||
      snapshot.status === 'completed' ||
      snapshot.status === 'تم التسليم'
    ) {
      inlineButtons.push([
        { text: '📄 تحميل شهادة التسليم e-POD (PDF)', url: podUrl },
      ]);
    }

    const dispatchRes = await sendTelegramAlert({
      chatId,
      message: replyHtml,
      inlineButtons,
      auditEntity: {
        type: 'trip_order',
        id: snapshot.tripId,
      },
    });

    return {
      handled: true,
      command: rawCmd,
      query: normalizedQuery,
      replyDispatched: dispatchRes.success,
      replyText: replyHtml,
    };
  }

  return { handled: false, command: rawCmd };
}

async function lookupTripFromDatabase(
  normalizedQuery: string,
  chatId: string
): Promise<TelegramTrackedTripSnapshot | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  // فحص ما إذا كانت المحادثة مرتبطة بشركة مستأجرة معينة لعزل النتائج (Multi-Tenant Isolation)
  const { data: companyMatch } = await supabase
    .from('companies')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  const numericId = /^\d+$/.test(normalizedQuery)
    ? Number(normalizedQuery)
    : null;

  let queryBuilder = supabase
    .from('trip_orders')
    .select(
      'id, company_id, route, route_export, departure_date, cmr_number, cmr_export_number, status, truck_id'
    );

  if (companyMatch?.id) {
    queryBuilder = queryBuilder.eq('company_id', companyMatch.id);
  }

  if (numericId !== null) {
    queryBuilder = queryBuilder.eq('id', numericId);
  } else {
    queryBuilder = queryBuilder.or(
      `cmr_number.ilike.%${normalizedQuery}%,cmr_export_number.ilike.%${normalizedQuery}%`
    );
  }

  const { data: trip } = await queryBuilder.limit(1).maybeSingle();
  if (!trip) return null;

  let plateNumber: string | undefined;
  let currentLocationLabel: string | undefined;

  if (trip.truck_id) {
    const { data: truck } = await supabase
      .from('trucks')
      .select('plate_number, current_location')
      .eq('id', trip.truck_id)
      .maybeSingle();
    if (truck?.plate_number) plateNumber = String(truck.plate_number);
    if (truck?.current_location)
      currentLocationLabel = String(truck.current_location);
  }

  // جلب أحدث قراءة تليمترية للمبرد إن وجدت
  let reeferSupplyTempC: string | number | null = null;
  let reeferSetpointC: string | number | null = null;

  const { data: reeferProfile } = await supabase
    .from('trip_reefer_monitoring_profiles')
    .select('target_temp_celsius, last_recorded_temp_celsius')
    .eq('trip_id', trip.id)
    .maybeSingle();

  if (reeferProfile) {
    reeferSetpointC = reeferProfile.target_temp_celsius;
    reeferSupplyTempC = reeferProfile.last_recorded_temp_celsius;
  }

  return {
    tripId: Number(trip.id),
    companyId: trip.company_id ? Number(trip.company_id) : null,
    cmrNumber: String(
      trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`
    ),
    route: String(trip.route_export || trip.route || 'مسار دولي'),
    status: String(trip.status || 'in_transit'),
    plateNumber,
    departureDate: trip.departure_date ? String(trip.departure_date) : undefined,
    currentLocationLabel,
    reeferSetpointC,
    reeferSupplyTempC,
  };
}
