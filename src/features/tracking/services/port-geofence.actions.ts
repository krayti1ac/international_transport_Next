'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { dispatchTripLifecycleNotifications } from '@/features/trips/services/notification-dispatcher';
import { updateTripStatus } from '@/features/trips/services/trips.actions';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

import {
  type StrategicPortZone,
  STRATEGIC_PORT_ZONES,
  ALERT_COOLDOWN_MS,
} from './port-geofence.constants';

export type { StrategicPortZone };
export { STRATEGIC_PORT_ZONES, ALERT_COOLDOWN_MS };

// Memory cache to track last known port presence per truck
const portPresenceCache = new Map<string, string>(); // truckKey -> zoneId

const portAlertCooldownCache = new Map<string, number>(); // truckId_zoneId_event -> timestampMs

export function isAlertCooldownActive(
  truckId: number,
  zoneId: string,
  event: 'enter' | 'exit',
  nowMs: number = Date.now()
): boolean {
  const key = `${truckId}_${zoneId}_${event}`;
  const lastAlertTime = portAlertCooldownCache.get(key);
  if (lastAlertTime && nowMs - lastAlertTime < ALERT_COOLDOWN_MS) {
    return true;
  }
  portAlertCooldownCache.set(key, nowMs);
  return false;
}

export function resetAlertCooldown(truckId?: number) {
  if (truckId) {
    for (const key of portAlertCooldownCache.keys()) {
      if (key.startsWith(`${truckId}_`)) {
        portAlertCooldownCache.delete(key);
      }
    }
  } else {
    portAlertCooldownCache.clear();
    portPresenceCache.clear();
  }
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export async function evaluatePortGeofences(params: {
  truckId: number;
  truckPlate?: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
}): Promise<{
  matchedZone: StrategicPortZone | null;
  event: 'enter' | 'exit' | 'inside' | 'outside';
  alertDispatched: boolean;
}> {
  try {
    const { truckId, truckPlate, latitude, longitude } = params;
    const nowIso = params.timestamp || new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();
    const truckKey = `truck-${truckId}`;
    const previousZoneId = portPresenceCache.get(truckKey);

    let matchedZone: StrategicPortZone | null = null;

    // 1. Check proximity against all strategic port & border zones
    for (const zone of STRATEGIC_PORT_ZONES) {
      const distance = calculateHaversineDistanceKm(
        latitude,
        longitude,
        zone.latitude,
        zone.longitude
      );
      if (distance <= zone.radiusKm) {
        matchedZone = zone;
        break;
      }
    }

    const currentZoneId = matchedZone ? matchedZone.id : null;

    // If state did not transition, truck remains inside or outside
    if (previousZoneId === currentZoneId) {
      return {
        matchedZone,
        event: matchedZone ? 'inside' : 'outside',
        alertDispatched: false,
      };
    }

    const supabase = await createClient();
    const adminPhone = process.env.ADMIN_ALERT_PHONE || '212694585307';

    // 2. Resolve truck plate if missing
    let effectivePlate = truckPlate || '';
    if (!effectivePlate && truckId > 0) {
      const { data: truck } = await supabase
        .from('trucks')
        .select('plate_number')
        .eq('id', truckId)
        .maybeSingle();
      if (truck?.plate_number) {
        effectivePlate = truck.plate_number;
      }
    }

    // 3. Resolve active trip for the truck
    const { data: activeTrip } = await supabase
      .from('trip_orders')
      .select('id, cmr_number, route, client_id, driver_id, status')
      .eq('truck_id', truckId)
      .in('status', ['in_transit', 'pending', 'loading', 'customs_export'])
      .order('departure_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Handle State Transitions (ENTER vs EXIT)
    if (currentZoneId && previousZoneId !== currentZoneId) {
      // ENTER EVENT
      portPresenceCache.set(truckKey, currentZoneId);

      // Check deduplication guard
      if (isAlertCooldownActive(truckId, currentZoneId, 'enter', nowMs)) {
        return { matchedZone, event: 'enter', alertDispatched: false };
      }

      const zoneNameAr = matchedZone?.name_ar || 'الميناء / المعبر الدولي';
      const zoneNameFr = matchedZone?.name_fr || 'Port / Frontière';

      // Update trip status via Trip State Machine: automate transition to 'customs_export' when entering strategic port/border zones
      if (activeTrip && activeTrip.status === 'in_transit') {
        const transitionRes = await updateTripStatus(activeTrip.id, 'customs_export');
        if (!transitionRes.success) {
          console.warn(
            `[PortGeofence] Could not transition trip #${activeTrip.id} to customs_export:`,
            transitionRes.error
          );
        }
      }

      // Dispatch WhatsApp Alert to Operations & Admin
      if (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY) {
        const isGuerguerat = matchedZone?.id === 'border_guerguerat';
        const isRosso = matchedZone?.id === 'border_rosso';
        const isDakar = matchedZone?.id === 'port_dakar';

        let actionProcedure = `🛂 الإجراء: عبور الميناء / المعبر بنجاح.`;
        if (isGuerguerat) {
          actionProcedure = `🌍 الإجراء: إنهاء إجراءات التفتيش الجمركي بالكركارات والترخيص للعبور نحو موريتانيا وغرب إفريقيا.`;
        } else if (isRosso) {
          actionProcedure = `🚢 الإجراء: ركوب العبارة النهرية بروصو ودخول الأراضي السنغالية.`;
        } else if (isDakar) {
          actionProcedure = `🏁 الإجراء: تفريغ الحمولة في مستودعات التوزيع بميناء دكار.`;
        } else if (matchedZone?.zoneType === 'seaport') {
          actionProcedure = `🚢 الإجراء: الاستعداد لركوب العبّارة البحرية وإنهاء المعاملات الجمركية.`;
        }

        const msgLines = [
          isGuerguerat || isRosso || isDakar
            ? `🌍 *تنبيه الممر الإفريقي البري - Trans Bodanon*`
            : `⚓ *تنبيه عبور الموانئ والمعابر الدولية - Trans Bodanon*`,
          `---------------------------`,
          `🚛 الشاحنة: *${effectivePlate || `#${truckId}`}*`,
          `📍 الموقع: *${zoneNameAr}* (${zoneNameFr})`,
          `⏰ التوقيت: ${new Date(nowIso).toLocaleString('ar-MA')}`,
          activeTrip ? `📦 الرحلة: #${activeTrip.id} (${activeTrip.route || 'شحنة دولية'})` : null,
          actionProcedure,
          activeTrip ? `🌐 رابط التتبع: ${process.env.NEXT_PUBLIC_APP_URL || ''}/track/${activeTrip.id}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        await sendWhatsAppCloudMessage({
          to: adminPhone,
          message: msgLines,
        }).catch((err) => console.warn('Port geofence WhatsApp notification error:', err));
      }

      // Dispatch automated port entry alert to client if trip is active
      if (activeTrip?.id) {
        dispatchTripLifecycleNotifications(activeTrip.id, 'port_geofence_entry', {
          plateNumber: effectivePlate,
          zoneId: matchedZone?.id,
          zoneNameAr,
          zoneNameFr,
          zoneNameEs: matchedZone?.name_fr,
          zoneType: matchedZone?.zoneType,
        }).catch((err) => console.warn('Client port geofence notification error:', err));
      }

      // Record Audit Log
      await recordAuditLog({
        entityType: 'port_geofence',
        entityId: String(truckId),
        actionType: 'security_alert',
        reason: `دخول الشاحنة ${effectivePlate} إلى نطاق ${zoneNameAr}`,
        newData: {
          event: 'PORT_GEOFENCE_ENTER',
          zone: matchedZone,
          truckId,
          plate: effectivePlate,
          tripId: activeTrip?.id,
          coordinates: { latitude, longitude },
          timestamp: nowIso,
        },
      });

      return { matchedZone, event: 'enter', alertDispatched: true };
    } else if (!currentZoneId && previousZoneId) {
      // EXIT EVENT
      portPresenceCache.delete(truckKey);

      // Check deduplication guard
      if (isAlertCooldownActive(truckId, previousZoneId, 'exit', nowMs)) {
        return { matchedZone: null, event: 'exit', alertDispatched: false };
      }

      const exitedZone = STRATEGIC_PORT_ZONES.find((z) => z.id === previousZoneId);
      const zoneNameAr = exitedZone?.name_ar || 'الميناء الدولي';
      const isGuergueratExit = previousZoneId === 'border_guerguerat';

      // Transition trip status back to in_transit when exiting customs/port zone via State Machine
      if (activeTrip && activeTrip.status === 'customs_export') {
        const transitionRes = await updateTripStatus(activeTrip.id, 'in_transit');
        if (!transitionRes.success) {
          console.warn(
            `[PortGeofence] Could not transition trip #${activeTrip.id} back to in_transit:`,
            transitionRes.error
          );
        }
      }

      if (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY) {
        const exitAction = isGuergueratExit
          ? `🌍 الحالة: مغادرة التراب الوطني ودخول موريتانيا بنجاح - مواصلة السير في الممر الإفريقي البري.`
          : (activeTrip ? `📦 الرحلة: #${activeTrip.id} - متجهة نحو الوجهة النهائية.` : null);

        const msgLines = [
          isGuergueratExit
            ? `🌍 *مغادرة معبر الكركارات ودخول موريتانيا - Trans Bodanon*`
            : `🚢 *مغادرة الميناء / المعبر الدولي - Trans Bodanon*`,
          `---------------------------`,
          `🚛 الشاحنة: *${effectivePlate || `#${truckId}`}*`,
          `📍 غادرت نطاق: *${zoneNameAr}*`,
          `⏰ التوقيت: ${new Date(nowIso).toLocaleString('ar-MA')}`,
          exitAction,
        ]
          .filter(Boolean)
          .join('\n');

        await sendWhatsAppCloudMessage({
          to: adminPhone,
          message: msgLines,
        }).catch((err) => console.warn('Port geofence exit WhatsApp notification error:', err));
      }

      // Dispatch automated port exit alert to client if trip is active
      if (activeTrip?.id) {
        dispatchTripLifecycleNotifications(activeTrip.id, 'port_geofence_exit', {
          plateNumber: effectivePlate,
          zoneId: exitedZone?.id,
          zoneNameAr,
          zoneNameFr: exitedZone?.name_fr,
          zoneNameEs: exitedZone?.name_fr,
          zoneType: exitedZone?.zoneType,
        }).catch((err) => console.warn('Client port exit notification error:', err));
      }

      await recordAuditLog({
        entityType: 'port_geofence',
        entityId: String(truckId),
        actionType: 'security_alert',
        reason: `مغادرة الشاحنة ${effectivePlate} لنطاق ${zoneNameAr}`,
        newData: {
          event: 'PORT_GEOFENCE_EXIT',
          zone: exitedZone,
          truckId,
          plate: effectivePlate,
          tripId: activeTrip?.id,
          coordinates: { latitude, longitude },
          timestamp: nowIso,
        },
      });

      return { matchedZone: null, event: 'exit', alertDispatched: true };
    }

    return { matchedZone, event: 'outside', alertDispatched: false };
  } catch (err) {
    console.error('Error evaluating port geofences:', err);
    return { matchedZone: null, event: 'outside', alertDispatched: false };
  }
}
