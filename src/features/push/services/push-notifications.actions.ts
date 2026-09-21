'use server';

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';

// Initialize VAPID details if configured
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:operations@transbodanon.ma';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error('[WebPush Init Error]:', err);
  }
}

export interface PushSubscriptionInput {
  driverId?: number;
  deviceId?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export interface SendPushResult {
  success: boolean;
  sentCount?: number;
  expiredCount?: number;
  reason?: string;
  error?: string;
}

/**
 * Registers or updates a driver's Web Push subscription.
 */
export async function subscribeDriverPushAction(
  input: PushSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Determine company ID
    let companyId = 1;
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.company_id) companyId = profile.company_id;
    }

    // Upsert subscription
    const { error } = await supabase.from('driver_push_subscriptions').upsert(
      {
        company_id: companyId,
        driver_id: input.driverId || null,
        user_id: user?.id || null,
        device_id: input.deviceId || null,
        endpoint: input.endpoint,
        p256dh_key: input.p256dh,
        auth_key: input.auth,
        user_agent: input.userAgent || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) throw error;

    await recordAuditLog({
      entityType: 'push_subscription',
      entityId: input.driverId || 0,
      actionType: 'create',
      reason: `تسجيل اشتراك إشعارات ويب جديد للجهاز (${input.deviceId || 'غير معروف'})`,
      newData: {
        driverId: input.driverId,
        deviceId: input.deviceId,
        endpoint: input.endpoint.substring(0, 40) + '...',
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'فشل تسجيل اشتراك الإشعارات';
    return { success: false, error: message };
  }
}

/**
 * Deactivates a driver's Web Push subscription.
 */
export async function unsubscribeDriverPushAction(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('driver_push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('endpoint', endpoint);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'فشل إلغاء اشتراك الإشعارات';
    return { success: false, error: message };
  }
}

/**
 * Dispatches a push notification to active device subscriptions.
 */
async function dispatchPushBatch(
  subscriptions: Array<{
    id: number;
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  }>,
  payload: string,
  supabase: any
): Promise<SendPushResult> {
  let sentCount = 0;
  const expiredIds: number[] = [];

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
        payload
      );
      sentCount++;
    } catch (err: any) {
      // If client unregistered or endpoint expired (HTTP 410 Gone or 404 Not Found)
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredIds.push(sub.id);
      } else {
        console.error('[WebPush Dispatch Error]:', err.message);
      }
    }
  }

  // Deactivate expired subscriptions automatically
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

/**
 * Sends a new mission dispatch notification to a driver's mobile device.
 */
export async function sendDriverMissionPushNotification(params: {
  driverId: number;
  tripId: number;
  routeTitle: string;
  departureDate: string;
}): Promise<SendPushResult> {
  try {
    const supabase = await createClient();

    const { data: subscriptions } = await supabase
      .from('driver_push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('driver_id', params.driverId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, reason: 'لا توجد أجهزة مسجلة للسائق' };
    }

    const payload = JSON.stringify({
      title: '🚛 مأمورية شحن دولية جديدة!',
      body: `تم تكليفكم برحلة: ${params.routeTitle}\nموعد الانطلاق: ${params.departureDate}`,
      url: `/driver-tasks?tripId=${params.tripId}`,
      tripId: params.tripId,
      tag: `mission-${params.tripId}`,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 400],
      actions: [
        { action: 'open_mission', title: 'عرض تفاصيل الرحلة 🚛' },
        { action: 'dismiss', title: 'إغلاق' },
      ],
    });

    return await dispatchPushBatch(subscriptions, payload, supabase);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'فشل إرسال إشعار المأمورية';
    return { success: false, error: message };
  }
}

/**
 * Sends a critical fleet safety alert (Tire wear TWI >= 90%, Reefer temperature drift).
 */
export async function sendCriticalFleetAlertPushNotification(params: {
  driverId: number;
  alertType: 'tire_wear' | 'frigo_drift' | 'engine_temp';
  message: string;
}): Promise<SendPushResult> {
  try {
    const supabase = await createClient();

    const { data: subscriptions } = await supabase
      .from('driver_push_subscriptions')
      .select('id, endpoint, p256dh_key, auth_key')
      .eq('driver_id', params.driverId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, reason: 'لا توجد أجهزة مسجلة للسائق' };
    }

    const title =
      params.alertType === 'tire_wear'
        ? '🚨 إنذار حرج: تآكل شديد في الإطارات (TWI ≥ 90%)'
        : params.alertType === 'frigo_drift'
        ? '❄️ إنذار طوارئ: انحراف حرارة حاوية التبريد'
        : '⚠️ تنبيه صيانة ومحرك عاجل';

    const payload = JSON.stringify({
      title,
      body: params.message,
      url: '/driver-tasks',
      tag: `fleet-alert-${Date.now()}`,
      requireInteraction: true,
      vibrate: [500, 150, 500, 150, 500],
      actions: [
        { action: 'open_mission', title: 'فحص التنبيه فوراً ⚠️' },
        { action: 'dismiss', title: 'إغلاق' },
      ],
    });

    return await dispatchPushBatch(subscriptions, payload, supabase);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'فشل إرسال إنذار الطوارئ';
    return { success: false, error: message };
  }
}

