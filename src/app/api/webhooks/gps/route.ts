import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findMatchingZone, calculateDistance } from '@/lib/geofence';
import { evaluatePortGeofences } from '@/features/tracking/services/port-geofence.actions';

interface RawGPSPayload {
  plate_number?: string;
  truck_id?: number;
  latitude?: number;
  longitude?: number;
  speed?: number;
  timestamp?: string | number;
  address?: string;
  device_id?: number;
  deviceId?: number;
  traccar_unique_id?: string;
  heading?: number;
  course?: number;
  accuracy?: number;
  device?: {
    id?: number;
    name?: string;
    uniqueId?: string;
  };
  position?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    course?: number;
    accuracy?: number;
    attributes?: Record<string, unknown>;
    deviceTime?: string;
    fixTime?: string;
    serverTime?: string;
  };
  attributes?: Record<string, unknown>;
}

export interface NormalizedGPSData {
  truckId?: number;
  plateNumber?: string;
  traccarUniqueId?: string;
  deviceId?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  ignition?: boolean;
  frigoTemperature?: number | null;
  timestampMs: number;
  address?: string;
}

/**
 * تطبيع بيانات أجهزة Traccar أو رسائل الـ GPS العادية إلى صيغة موحدة
 */
export function normalizeGPSPayload(item: RawGPSPayload): NormalizedGPSData {
  const pos = item.position || {};
  const dev = item.device || {};
  const attrs = pos.attributes || item.attributes || {};

  const latitude = typeof pos.latitude === 'number' ? pos.latitude : (typeof item.latitude === 'number' ? item.latitude : 0);
  const longitude = typeof pos.longitude === 'number' ? pos.longitude : (typeof item.longitude === 'number' ? item.longitude : 0);

  const speed = typeof pos.speed === 'number' ? pos.speed : item.speed;
  const heading = typeof pos.course === 'number' ? pos.course : (typeof item.course === 'number' ? item.course : item.heading);
  const accuracy = typeof pos.accuracy === 'number' ? pos.accuracy : item.accuracy;

  // استخراج حالة المحرك ودرجة حرارة مقطورة التبريد Frigo
  let ignition: boolean | undefined = undefined;
  if ('ignition' in attrs && typeof attrs.ignition === 'boolean') {
    ignition = attrs.ignition;
  }

  let frigoTemperature: number | null = null;
  if ('temp1' in attrs && typeof attrs.temp1 === 'number') {
    frigoTemperature = attrs.temp1;
  } else if ('temperature' in attrs && typeof attrs.temperature === 'number') {
    frigoTemperature = attrs.temperature;
  }

  let timestampMs = Date.now();
  if (pos.fixTime) {
    timestampMs = new Date(pos.fixTime).getTime();
  } else if (item.timestamp) {
    timestampMs = typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime();
  }

  return {
    truckId: item.truck_id,
    plateNumber: item.plate_number || dev.name,
    traccarUniqueId: item.traccar_unique_id || dev.uniqueId,
    deviceId: item.device_id || item.deviceId || dev.id,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    ignition,
    frigoTemperature,
    timestampMs,
    address: item.address,
  };
}

export function isWebhookAuthorized(
  req: { headers: { get: (name: string) => string | null }; url: string },
  expectedSecret?: string
): boolean {
  if (!expectedSecret) return true;
  const authHeader = req.headers.get('x-gps-secret') || req.headers.get('x-api-key');
  const bearerHeader = req.headers.get('authorization');
  const url = new URL(req.url, 'http://localhost');
  const querySecret = url.searchParams.get('secret') || url.searchParams.get('key');
  const token = bearerHeader?.startsWith('Bearer ') ? bearerHeader.slice(7).trim() : null;

  return (
    authHeader === expectedSecret ||
    token === expectedSecret ||
    querySecret === expectedSecret
  );
}

export async function POST(req: NextRequest) {
  try {
    // 1. فحص التوثيق الأمني المرن
    const expectedSecret = process.env.GPS_WEBHOOK_SECRET;
    if (!isWebhookAuthorized(req, expectedSecret)) {
      return NextResponse.json({ error: 'غير مصرح بالوصول (Unauthorized)' }, { status: 401 });
    }

    const body = await req.json();
    const rawData = Array.isArray(body) ? body : [body];

    if (!rawData.length) {
      return NextResponse.json({ error: 'البيانات المرسلة فارغة' }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServiceRole = serviceRoleKey && !serviceRoleKey.includes('your-service-role') && serviceRoleKey.length > 50;

    const supabase = isServiceRole
      ? (await import('@supabase/supabase-js')).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : await createClient();

    const results: { success: boolean; truckId?: number; error?: string }[] = [];

    for (const rawItem of rawData) {
      const norm = normalizeGPSPayload(rawItem);
      let truckId = norm.truckId;

      // 2. مطابقة معرف الجهاز مع الشاحنة
      if (!truckId) {
        if (norm.traccarUniqueId) {
          const { data: mapping } = await supabase
            .from('traccar_device_mappings')
            .select('truck_id')
            .eq('traccar_unique_id', norm.traccarUniqueId)
            .eq('is_active', true)
            .maybeSingle();

          if (mapping?.truck_id) {
            truckId = mapping.truck_id;
          }
        } else if (norm.deviceId) {
          const { data: mapping } = await supabase
            .from('traccar_device_mappings')
            .select('truck_id')
            .eq('traccar_device_id', norm.deviceId)
            .eq('is_active', true)
            .maybeSingle();

          if (mapping?.truck_id) {
            truckId = mapping.truck_id;
          }
        } else if (norm.plateNumber) {
          const { data: truck } = await supabase
            .from('trucks')
            .select('id')
            .ilike('plate_number', `%${norm.plateNumber.trim()}%`)
            .maybeSingle();

          if (truck?.id) {
            truckId = truck.id;
          }
        }
      }

      if (!truckId) {
        results.push({ success: false, error: 'No associated truck found for device' });
        continue;
      }

      const recordTime = new Date(norm.timestampMs).toISOString();

      // 3. إدراج الموقع في جدول truck_locations
      const insertPayload: Record<string, unknown> = {
        truck_id: truckId,
        latitude: norm.latitude,
        longitude: norm.longitude,
        recorded_at: recordTime,
        timestamp: recordTime,
      };

      if (norm.speed !== undefined) insertPayload.speed = norm.speed;
      if (norm.heading !== undefined) insertPayload.heading = norm.heading;
      if (norm.accuracy !== undefined) insertPayload.accuracy = norm.accuracy;
      if (norm.ignition !== undefined) insertPayload.ignition = norm.ignition;
      if (norm.frigoTemperature !== null) insertPayload.frigo_temperature = norm.frigoTemperature;
      if (norm.deviceId) insertPayload.device_id = norm.deviceId;

      const { error: insertError } = await supabase.from('truck_locations').insert(insertPayload);

      if (insertError) {
        results.push({ success: false, truckId, error: insertError.message });
        continue;
      }

      // 4. تحديث الموقع الحالي في جدول الشاحنات
      const address = norm.address;
      const locationDesc = address || `${norm.latitude.toFixed(4)}, ${norm.longitude.toFixed(4)}`;
      await supabase
        .from('trucks')
        .update({ current_location: locationDesc })
        .eq('id', truckId);

      // 5. فحص مناطق السياج الجغرافي والموانئ الاستراتيجية مع منع التكرار
      await processGeofenceAlerts(supabase, truckId, norm.latitude, norm.longitude, recordTime);
      await evaluatePortGeofences({
        truckId,
        latitude: norm.latitude,
        longitude: norm.longitude,
        timestamp: recordTime,
      });

      results.push({ success: true, truckId });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({ success: true, count: successCount, results });
  } catch (error: unknown) {
    console.error('GPS Webhook Error:', error);
    const message = error instanceof Error ? error.message : 'خطأ داخلي في الخادم';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function processGeofenceAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  truckId: number,
  latitude: number,
  longitude: number,
  timestamp: string
) {
  const { data: zones, error: zonesError } = await supabase
    .from('geofence_zones')
    .select('id, name, latitude, longitude, radius_km')
    .eq('is_active', true);

  if (zonesError || !zones || zones.length === 0) {
    return;
  }

  const currentMatch = findMatchingZone(latitude, longitude, zones);

  const { data: previousAlerts } = await supabase
    .from('geofence_alerts')
    .select('zone_id, event_type, timestamp')
    .eq('truck_id', truckId)
    .order('timestamp', { ascending: false })
    .limit(zones.length);

  const currentlyInsideZones = new Set<number>();
  const lastAlertTimes = new Map<string, number>();

  if (previousAlerts) {
    for (const alert of previousAlerts) {
      if (alert.event_type === 'enter') {
        currentlyInsideZones.add(alert.zone_id);
      } else if (alert.event_type === 'exit') {
        currentlyInsideZones.delete(alert.zone_id);
      }
      const key = `${alert.zone_id}_${alert.event_type}`;
      if (!lastAlertTimes.has(key)) {
        lastAlertTimes.set(key, new Date(alert.timestamp).getTime());
      }
    }
  }

  const alertsToInsert: Array<{
    zone_id: number;
    truck_id: number;
    event_type: 'enter' | 'exit';
    latitude: number;
    longitude: number;
    timestamp: string;
    notified: boolean;
  }> = [];

  const nowMs = new Date(timestamp).getTime();
  const cooldownMs = 30 * 60 * 1000; // 30 minutes cooldown

  if (currentMatch) {
    if (!currentlyInsideZones.has(currentMatch.zoneId)) {
      const lastEnterTime = lastAlertTimes.get(`${currentMatch.zoneId}_enter`) || 0;
      if (nowMs - lastEnterTime > cooldownMs) {
        alertsToInsert.push({
          zone_id: currentMatch.zoneId,
          truck_id: truckId,
          event_type: 'enter',
          latitude,
          longitude,
          timestamp,
          notified: false,
        });
        currentlyInsideZones.add(currentMatch.zoneId);
      }
    }
  }

  for (const zoneId of currentlyInsideZones) {
    if (currentMatch && currentMatch.zoneId === zoneId) {
      continue;
    }
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) continue;
    const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
    if (distance > zone.radius_km) {
      const lastExitTime = lastAlertTimes.get(`${zoneId}_exit`) || 0;
      if (nowMs - lastExitTime > cooldownMs) {
        alertsToInsert.push({
          zone_id: zoneId,
          truck_id: truckId,
          event_type: 'exit',
          latitude,
          longitude,
          timestamp,
          notified: false,
        });
        currentlyInsideZones.delete(zoneId);
      }
    }
  }

  if (alertsToInsert.length > 0) {
    await supabase.from('geofence_alerts').insert(alertsToInsert);
  }
}
