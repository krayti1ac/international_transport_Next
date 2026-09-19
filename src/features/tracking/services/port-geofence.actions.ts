'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface StrategicPortZone {
  id: string;
  name: string;
  name_ar: string;
  name_fr: string;
  name_es: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  zoneType: 'seaport' | 'border_crossing';
}

const STRATEGIC_PORT_ZONES: StrategicPortZone[] = [
  {
    id: 'port_tanger_med',
    name: 'Tanger Med Port',
    name_ar: 'ميناء طنجة المتوسط',
    name_fr: 'Port Tanger Med',
    name_es: 'Puerto Tánger Med',
    latitude: 35.885,
    longitude: -5.505,
    radiusKm: 3.5,
    zoneType: 'seaport',
  },
  {
    id: 'port_algeciras',
    name: 'Algeciras Port',
    name_ar: 'ميناء الجزيرة الخضراء',
    name_fr: 'Port d’Algésiras',
    name_es: 'Puerto de Algeciras',
    latitude: 36.132,
    longitude: -5.438,
    radiusKm: 3.0,
    zoneType: 'seaport',
  },
  {
    id: 'border_la_jonquera',
    name: 'La Jonquera Border',
    name_ar: 'معبر لا خونكيرا الحدودي (إسبانيا / فرنسا)',
    name_fr: 'Frontière La Jonquera (Espagne / France)',
    name_es: 'Frontera de La Jonquera (España / Francia)',
    latitude: 42.417,
    longitude: 2.879,
    radiusKm: 2.5,
    zoneType: 'border_crossing',
  },
  {
    id: 'border_irun',
    name: 'Irún Border',
    name_ar: 'معبر إيرون الحدودي (إسبانيا / فرنسا)',
    name_fr: 'Frontière d’Irún (Espagne / France)',
    name_es: 'Frontera de Irún (España / Francia)',
    latitude: 43.342,
    longitude: -1.789,
    radiusKm: 2.5,
    zoneType: 'border_crossing',
  },
  {
    id: 'border_guerguerat',
    name: 'El Guerguerat Border Crossing',
    name_ar: 'معبر الكركارات الحدودي (المغرب / موريتانيا)',
    name_fr: 'Poste Frontière El Guerguerat (Maroc / Mauritanie)',
    name_es: 'Paso Fronterizo El Guerguerat (Marruecos / Mauritania)',
    latitude: 21.3656,
    longitude: -16.9583,
    radiusKm: 5.0,
    zoneType: 'border_crossing',
  },
];

// Memory cache to track last known port presence per truck to prevent spam notifications
const portPresenceCache = new Map<string, string>(); // truckKey -> zoneId

function calculateHaversineDistanceKm(
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
    const truckKey = `truck-${truckId}`;
    const previousZoneId = portPresenceCache.get(truckKey);

    let matchedZone: StrategicPortZone | null = null;

    // 1. Check proximity against all strategic port zones
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

    // If state did not transition, no alert needed
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
    let eventType: 'enter' | 'exit' = 'enter';

    if (currentZoneId && previousZoneId !== currentZoneId) {
      // ENTER EVENT
      eventType = 'enter';
      portPresenceCache.set(truckKey, currentZoneId);

      const zoneNameAr = matchedZone?.name_ar || 'الميناء / المعبر الدولي';
      const zoneNameFr = matchedZone?.name_fr || 'Port / Frontière';

      // Update trip status if entering a seaport or Guerguerat border
      if (activeTrip && matchedZone?.zoneType === 'seaport') {
        await supabase
          .from('trip_orders')
          .update({
            status: 'at_ferry_port',
            notes: `وصلت الشاحنة إلى ${zoneNameAr} في ${new Date(nowIso).toLocaleTimeString('ar-MA')}`,
          })
          .eq('id', activeTrip.id);
      } else if (activeTrip && matchedZone?.id === 'border_guerguerat') {
        await supabase
          .from('trip_orders')
          .update({
            notes: `وصلت الشاحنة إلى معبر الكركارات الحدودي في ${new Date(nowIso).toLocaleTimeString('ar-MA')} استعداداً للعبور إلى موريتانيا`,
          })
          .eq('id', activeTrip.id);
      }

      // Dispatch WhatsApp Alert to Operations & Admin
      if (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY) {
        const isGuerguerat = matchedZone?.id === 'border_guerguerat';
        let actionProcedure = `🛂 الإجراء: عبور المعبر الحدودي الأوروبي بنجاح.`;
        if (isGuerguerat) {
          actionProcedure = `🌍 الإجراء: إنهاء إجراءات التفتيش الجمركي بمعبر الكركارات والتراخيص للعبور نحو موريتانيا وغرب إفريقيا.`;
        } else if (matchedZone?.zoneType === 'seaport') {
          actionProcedure = `🚢 الإجراء: الاستعداد لركوب العبّارة البحرية وإنهاء المعاملات الجمركية.`;
        }

        const msgLines = [
          isGuerguerat
            ? `🌍 *تنبيه الممر الإفريقي البري - معبر الكركارات - Trans Bodanon*`
            : `⚓ *تنبيه عبور الموانئ والمعابر الدولية - Trans Bodanon*`,
          `---------------------------`,
          `🚛 الشاحنة: *${effectivePlate || `#${truckId}`}*`,
          `📍 الموقع: *${zoneNameAr}* (${zoneNameFr})`,
          `⏰ التوقيت: ${new Date(nowIso).toLocaleString('ar-MA')}`,
          activeTrip ? `📦 الرحلة: #${activeTrip.id} (${activeTrip.route || 'شحنة دولية'})` : null,
          actionProcedure,
        ]
          .filter(Boolean)
          .join('\n');

        await sendWhatsAppCloudMessage({
          to: adminPhone,
          message: msgLines,
        }).catch((err) => console.warn('Port geofence WhatsApp notification error:', err));
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
      eventType = 'exit';
      portPresenceCache.delete(truckKey);

      const exitedZone = STRATEGIC_PORT_ZONES.find((z) => z.id === previousZoneId);
      const zoneNameAr = exitedZone?.name_ar || 'الميناء الدولي';
      const isGuergueratExit = previousZoneId === 'border_guerguerat';

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

