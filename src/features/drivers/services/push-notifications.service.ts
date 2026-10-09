import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';

// ---------------------------------------------------------------------------
// 1. Constants & VAPID Setup
// ---------------------------------------------------------------------------
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BOnjxaV-V4RmV_EZ_N6H2NuCxXaOWNaWS4ba9jop956SGjT6d5BTV5hLeV0IjSqe8ZMmUKhObfzUXglgqELrOqg';
export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'pXN86lq6_gU_p0Q9f-8l2z9J-qL5X_o4kY-3Q8Z-x7I';
export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:operations@transbodanon.ma';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[WebPush VAPID Init Error]:', err);
  }
}

// Vibration patterns (milliseconds: [vibrate, pause, vibrate...])
export const EMERGENCY_VIBRATION_PATTERN = [500, 150, 500, 150, 500, 150, 800];
export const MISSION_VIBRATION_PATTERN = [300, 100, 300, 100, 400];
export const ROUTE_UPDATE_VIBRATION_PATTERN = [200, 100, 200, 100, 300];
export const INFO_VIBRATION_PATTERN = [200, 100, 200];

// ---------------------------------------------------------------------------
// 2. Types & Interfaces
// ---------------------------------------------------------------------------
export type DriverAlertType =
  | 'tire_wear'
  | 'frigo_drift'
  | 'engine_temp'
  | 'geofence_breach'
  | 'customs_hold';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  dir: 'rtl' | 'ltr';
  lang: string;
  tag: string;
  renotify: boolean;
  requireInteraction: boolean;
  vibrate: number[];
  data: {
    url: string;
    tripId?: number | null;
    alertType?: string;
    timestamp: number;
    [key: string]: unknown;
  };
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface DriverPushSendResult {
  success: boolean;
  sentCount: number;
  expiredCount: number;
  reason?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// 3. Payload Builders (Trilingual Ready)
// ---------------------------------------------------------------------------

/**
 * Builds standard rich notification payload for new mission dispatches
 */
export function buildMissionPushPayload(params: {
  tripId: number;
  routeTitle: string;
  departureDate: string;
  locale?: 'ar' | 'fr' | 'es';
}): PushNotificationPayload {
  const loc = params.locale || 'ar';

  const titles = {
    ar: '🚛 مأمورية شحن دولية جديدة!',
    fr: '🚛 Nouvelle mission de transport international !',
    es: '🚛 ¡Nueva misión de transporte internacional!',
  };

  const bodies = {
    ar: `تم تكليفكم برحلة: ${params.routeTitle}\nموعد الانطلاق: ${params.departureDate}`,
    fr: `Mission assignée : ${params.routeTitle}\nDépart prévu : ${params.departureDate}`,
    es: `Misión asignada: ${params.routeTitle}\nSalida prevista: ${params.departureDate}`,
  };

  const actionDetails = {
    ar: 'عرض تفاصيل الرحلة 🚛',
    fr: 'Détails du voyage 🚛',
    es: 'Ver detalles 🚛',
  };

  const actionClose = {
    ar: 'إغلاق',
    fr: 'Fermer',
    es: 'Cerrar',
  };

  return {
    title: titles[loc],
    body: bodies[loc],
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    dir: loc === 'ar' ? 'rtl' : 'ltr',
    lang: loc,
    tag: `mission-${params.tripId}`,
    renotify: true,
    requireInteraction: true,
    vibrate: MISSION_VIBRATION_PATTERN,
    data: {
      url: `/driver-tasks?tripId=${params.tripId}`,
      tripId: params.tripId,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_mission', title: actionDetails[loc] },
      { action: 'dismiss', title: actionClose[loc] },
    ],
  };
}

/**
 * Builds high-urgency emergency fleet alert payload with distinct vibration
 */
export function buildCriticalAlertPushPayload(params: {
  alertType: DriverAlertType;
  message: string;
  tripId?: number;
  locale?: 'ar' | 'fr' | 'es';
}): PushNotificationPayload {
  const loc = params.locale || 'ar';

  let title = '⚠️ تنبيه أمان ميداني عاجل';
  if (params.alertType === 'tire_wear') {
    title =
      loc === 'es'
        ? '🚨 Alerta crítica: Desgaste severo de neumáticos (TWI ≥ 90%)'
        : loc === 'fr'
          ? '🚨 Alerte critique : Usure sévère des pneus (TWI ≥ 90%)'
          : '🚨 إنذار حرج: تآكل شديد في الإطارات (TWI ≥ 90%)';
  } else if (params.alertType === 'frigo_drift') {
    title =
      loc === 'es'
        ? '❄️ Alerta de emergencia: Deriva térmica de la cámara frigorífica'
        : loc === 'fr'
          ? '❄️ Alerte d’urgence : Dérive thermique du groupe frigorifique'
          : '❄️ إنذار طوارئ: انحراف حرارة حاوية التبريد Frigo';
  } else if (params.alertType === 'engine_temp') {
    title =
      loc === 'es'
        ? '🔥 Alerta de motor: Sobrecalentamiento crítico'
        : loc === 'fr'
          ? '🔥 Alerte moteur : Surchauffe critique détectée'
          : '🔥 إنذار حرارة المحرك: سخونة خطيرة في سائل التبريد';
  } else if (params.alertType === 'geofence_breach') {
    title =
      loc === 'es'
        ? '🛑 Desviación de ruta / Alerta Geofence'
        : loc === 'fr'
          ? '🛑 Déviation d’itinéraire / Alerte Géorepérage'
          : '🛑 انحراف عن المسار الدولي المعتمد (Geofence Breach)';
  } else if (params.alertType === 'customs_hold') {
    title =
      loc === 'es'
        ? '🏛️ Retención aduanera en frontera'
        : loc === 'fr'
          ? '🏛️ Blocage douanier au point de passage'
          : '🏛️ توقف جمركي / فحص طارئ بالمعبر الحدودي';
  }

  const actionAcknowledge = {
    ar: 'فحص التنبيه فوراً ⚠️',
    fr: 'Examiner immédiatement ⚠️',
    es: 'Inspeccionar ahora ⚠️',
  };

  return {
    title,
    body: params.message,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    dir: loc === 'ar' ? 'rtl' : 'ltr',
    lang: loc,
    tag: `emergency-alert-${params.alertType}-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: EMERGENCY_VIBRATION_PATTERN,
    data: {
      url: params.tripId ? `/driver-tasks?tripId=${params.tripId}` : '/driver-tasks',
      tripId: params.tripId || null,
      alertType: params.alertType,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_mission', title: actionAcknowledge[loc] },
      { action: 'dismiss', title: loc === 'ar' ? 'إغلاق' : loc === 'fr' ? 'Fermer' : 'Cerrar' },
    ],
  };
}

/**
 * Builds route modification notification payload
 */
export function buildRouteUpdatePushPayload(params: {
  tripId: number;
  oldRoute: string;
  newRoute: string;
  reason?: string;
  locale?: 'ar' | 'fr' | 'es';
}): PushNotificationPayload {
  const loc = params.locale || 'ar';

  const title =
    loc === 'es'
      ? `🔄 Actualización de ruta — Viaje #${params.tripId}`
      : loc === 'fr'
        ? `🔄 Mise à jour d’itinéraire — Voyage #${params.tripId}`
        : `🔄 تعديل مسار الرحلة #${params.tripId}`;

  const body =
    loc === 'es'
      ? `El itinerario se ha modificado a: ${params.newRoute}${params.reason ? `\nMotivo: ${params.reason}` : ''}`
      : loc === 'fr'
        ? `L’itinéraire a été modifié vers : ${params.newRoute}${params.reason ? `\nMotif : ${params.reason}` : ''}`
        : `تم تغيير المسار المعتمد إلى: ${params.newRoute}${params.reason ? `\nالسبب: ${params.reason}` : ''}`;

  return {
    title,
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    dir: loc === 'ar' ? 'rtl' : 'ltr',
    lang: loc,
    tag: `route-update-${params.tripId}`,
    renotify: true,
    requireInteraction: true,
    vibrate: ROUTE_UPDATE_VIBRATION_PATTERN,
    data: {
      url: `/driver-tasks?tripId=${params.tripId}`,
      tripId: params.tripId,
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open_mission',
        title: loc === 'es' ? 'Ver nueva ruta 🗺️' : loc === 'fr' ? 'Voir le nouvel itinéraire 🗺️' : 'عرض المسار الجديد 🗺️',
      },
      { action: 'dismiss', title: loc === 'ar' ? 'إغلاق' : loc === 'fr' ? 'Fermer' : 'Cerrar' },
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. Batch Dispatch Engine
// ---------------------------------------------------------------------------
async function dispatchPushToSubscriptions(
  subscriptions: Array<{
    id: number;
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  }>,
  payload: PushNotificationPayload,
  supabase: any
): Promise<DriverPushSendResult> {
  let sentCount = 0;
  const expiredIds: number[] = [];
  const payloadStr = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        },
        payloadStr
      );
      sentCount++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredIds.push(sub.id);
      } else {
        console.error('[WebPush Driver Service Dispatch Warn]:', err.message);
      }
    }
  }

  // Auto clean-up expired endpoints
  if (expiredIds.length > 0) {
    await supabase
      .from('driver_push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', expiredIds);
  }

  return {
    success: sentCount > 0,
    sentCount,
    expiredCount: expiredIds.length,
  };
}

// ---------------------------------------------------------------------------
// 5. High-Level Service Methods
// ---------------------------------------------------------------------------

/**
 * Dispatches a new mission notification to all registered devices of a driver
 */
export async function sendMissionDispatchPush(
  driverId: number,
  params: {
    tripId: number;
    routeTitle: string;
    departureDate: string;
    locale?: 'ar' | 'fr' | 'es';
  }
): Promise<DriverPushSendResult> {
  try {
    const supabase = await createClient();

    const { data: subscriptions } = await supabase
      .from('driver_push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('driver_id', driverId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, sentCount: 0, expiredCount: 0, reason: 'لا توجد أجهزة مسجلة ونشطة للسائق' };
    }

    const payload = buildMissionPushPayload({
      tripId: params.tripId,
      routeTitle: params.routeTitle,
      departureDate: params.departureDate,
      locale: params.locale,
    });

    const result = await dispatchPushToSubscriptions(subscriptions, payload, supabase);

    await recordAuditLog({
      entityType: 'push_dispatch',
      entityId: driverId,
      actionType: 'create',
      reason: `إرسال إشعار ويب فوري بمأمورية الرحلة #${params.tripId} للسائق #${driverId}`,
      newData: {
        driverId,
        tripId: params.tripId,
        sentDevices: result.sentCount,
        expiredDevices: result.expiredCount,
      },
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إرسال إشعار المأمورية';
    return { success: false, sentCount: 0, expiredCount: 0, error: message };
  }
}

/**
 * Dispatches high-urgency emergency alert (frigo temperature, tyre wear, etc.)
 */
export async function sendCriticalEmergencyAlert(
  driverId: number,
  params: {
    alertType: DriverAlertType;
    message: string;
    tripId?: number;
    locale?: 'ar' | 'fr' | 'es';
  }
): Promise<DriverPushSendResult> {
  try {
    const supabase = await createClient();

    const { data: subscriptions } = await supabase
      .from('driver_push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('driver_id', driverId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, sentCount: 0, expiredCount: 0, reason: 'لا توجد أجهزة مسجلة ونشطة للسائق' };
    }

    const payload = buildCriticalAlertPushPayload({
      alertType: params.alertType,
      message: params.message,
      tripId: params.tripId,
      locale: params.locale,
    });

    const result = await dispatchPushToSubscriptions(subscriptions, payload, supabase);

    await recordAuditLog({
      entityType: 'push_dispatch',
      entityId: driverId,
      actionType: 'create',
      reason: `إرسال إنذار طوارئ أسطول حرج (${params.alertType}) للسائق #${driverId}`,
      newData: {
        driverId,
        alertType: params.alertType,
        message: params.message,
        sentDevices: result.sentCount,
      },
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إرسال إنذار الطوارئ';
    return { success: false, sentCount: 0, expiredCount: 0, error: message };
  }
}

/**
 * Dispatches route update notification
 */
export async function sendRouteUpdatePush(
  driverId: number,
  params: {
    tripId: number;
    oldRoute: string;
    newRoute: string;
    reason?: string;
    locale?: 'ar' | 'fr' | 'es';
  }
): Promise<DriverPushSendResult> {
  try {
    const supabase = await createClient();

    const { data: subscriptions } = await supabase
      .from('driver_push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('driver_id', driverId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, sentCount: 0, expiredCount: 0, reason: 'لا توجد أجهزة مسجلة ونشطة للسائق' };
    }

    const payload = buildRouteUpdatePushPayload({
      tripId: params.tripId,
      oldRoute: params.oldRoute,
      newRoute: params.newRoute,
      reason: params.reason,
      locale: params.locale,
    });

    return await dispatchPushToSubscriptions(subscriptions, payload, supabase);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إرسال إشعار تحديث المسار';
    return { success: false, sentCount: 0, expiredCount: 0, error: message };
  }
}

/**
 * Queries the count of active push devices for a given driver
 */
export async function getDriverActiveSubscriptionsCount(
  driverId: number
): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('driver_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('is_active', true);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

