import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findMatchingZone, calculateDistance } from '@/lib/geofence';
import { evaluatePortGeofences } from '@/features/tracking/services/port-geofence.actions';
import { evaluateColdChainTemperatureDrift } from '@/features/predictive/services/cold-chain-monitor.service';
import { parseFrigoTelemetryPacket } from '@/features/tracking/services/frigo-telematics-parser.service';
import { GeofenceReceiverTriggerService } from '@/features/tracking/services/geofence-receiver-trigger.service';
import { HotspotProximityRadarService } from '@/features/tracking/services/hotspot-proximity-radar.service';
import type { ParsedFrigoIoTData } from '@/features/tracking/types/frigo-iot.types';

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
  // Frigo IoT & Telematics Attributes
  suction_pressure?: number;
  discharge_pressure?: number;
  defrost?: boolean;
  defrost_duration?: number;
  defrost_coil_temp?: number;
  battery_v?: number;
  reefer_mode?: string;
  unit_brand?: string;
  model?: string;
  target_temp?: number;
  ambient_temp?: number;
  alarm_codes?: string[] | string;
  door_open?: boolean;
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
  frigoIoT?: ParsedFrigoIoTData;
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

  // استخراج وتحليل حزم تيليماتكس مقطورة التبريد الموسعة (Carrier / Thermo King)
  const rawSuction = typeof attrs.suction_pressure === 'number' ? attrs.suction_pressure : item.suction_pressure;
  const rawDischarge = typeof attrs.discharge_pressure === 'number' ? attrs.discharge_pressure : item.discharge_pressure;
  const rawDefrost = typeof attrs.defrost === 'boolean' ? attrs.defrost : item.defrost;
  const rawDefrostDur = typeof attrs.defrost_duration === 'number' ? attrs.defrost_duration : item.defrost_duration;
  const rawDefrostCoil = typeof attrs.defrost_coil_temp === 'number' ? attrs.defrost_coil_temp : item.defrost_coil_temp;
  const rawBatteryV = typeof attrs.battery_v === 'number' ? attrs.battery_v : (typeof attrs.batteryVdc === 'number' ? attrs.batteryVdc : item.battery_v);
  const rawReeferMode = (attrs.reefer_mode || attrs.operatingMode || item.reefer_mode) as string | undefined;
  const rawUnitBrand = (attrs.unit_brand || attrs.brand || item.unit_brand) as string | undefined;
  const rawModel = (attrs.model || item.model) as string | undefined;
  const rawTargetTemp = typeof attrs.target_temp === 'number' ? attrs.target_temp : item.target_temp;
  const rawAmbientTemp = typeof attrs.ambient_temp === 'number' ? attrs.ambient_temp : item.ambient_temp;
  const rawAlarms = (attrs.alarm_codes || attrs.alarms || item.alarm_codes) as string[] | string | undefined;
  const rawDoor = typeof attrs.door_open === 'boolean' ? attrs.door_open : (typeof attrs.door === 'boolean' ? attrs.door : item.door_open);

  const hasFrigoIoT =
    frigoTemperature !== null ||
    rawSuction !== undefined ||
    rawDischarge !== undefined ||
    rawDefrost !== undefined ||
    rawBatteryV !== undefined ||
    rawAlarms !== undefined;

  let frigoIoT: ParsedFrigoIoTData | undefined = undefined;
  if (hasFrigoIoT) {
    frigoIoT = parseFrigoTelemetryPacket({
      truckId: item.truck_id,
      truckPlate: item.plate_number || dev.name,
      unitBrand: rawUnitBrand,
      model: rawModel,
      currentTemp: frigoTemperature !== null ? frigoTemperature : undefined,
      targetTemp: rawTargetTemp,
      ambientTemp: rawAmbientTemp,
      suctionPressureBar: rawSuction,
      dischargePressureBar: rawDischarge,
      defrostActive: rawDefrost,
      defrostDurationMin: rawDefrostDur,
      defrostCoilTemp: rawDefrostCoil,
      backupBatteryVdc: rawBatteryV,
      operatingMode: rawReeferMode,
      alarmCodes: rawAlarms,
      doorOpen: rawDoor,
      timestamp: timestampMs,
    });
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
    frigoIoT,
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

// Sliding deduplication cache for recent GPS telemetry pings (5-minute TTL)
const recentGpsPingsCache = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;

export function isGpsPingDuplicate(truckId: number, timestampMs: number, lat: number, lng: number): boolean {
  const key = `${truckId}_${Math.floor(timestampMs / 1000)}_${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const now = Date.now();

  if (recentGpsPingsCache.size > 2000) {
    for (const [k, time] of recentGpsPingsCache.entries()) {
      if (now - time > DEDUPLICATION_WINDOW_MS) {
        recentGpsPingsCache.delete(k);
      }
    }
  }

  if (recentGpsPingsCache.has(key)) {
    return true;
  }
  recentGpsPingsCache.set(key, now);
  return false;
}

export function resetGpsDeduplicationCache(): void {
  recentGpsPingsCache.clear();
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

    const results: { success: boolean; truckId?: number; error?: string; frigoIoT?: ParsedFrigoIoTData }[] = [];

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

      // Deduplicate rapid duplicate GPS pings to preserve database throughput
      if (isGpsPingDuplicate(truckId, norm.timestampMs, norm.latitude, norm.longitude)) {
        results.push({ success: true, truckId });
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

      // 5.5 رادار رصد الاقتراب من البؤر الحرجة للأرصفة (DVI ≥ 60) وتنبيه السائق عبر واتساب
      await HotspotProximityRadarService.evaluateApproachingHotspot({
        truckId,
        latitude: norm.latitude,
        longitude: norm.longitude,
        speedKmh: norm.speed || 45,
        timestamp: recordTime,
        truckPlate: norm.plateNumber,
      }).catch((radarErr) => console.warn('Hotspot proximity radar evaluation error:', radarErr));

      // 6. رصد انحراف درجات حرارة مقطورات التبريد Frigo في الوقت الفعلي
      if (norm.frigoTemperature !== null && norm.frigoTemperature !== undefined) {
        const { data: activeTrip } = await supabase
          .from('trip_orders')
          .select('id, driver_id, status')
          .eq('truck_id', truckId)
          .in('status', ['in_transit', 'loading', 'customs_export'])
          .order('departure_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        await evaluateColdChainTemperatureDrift({
          truckId,
          currentTemp: norm.frigoTemperature,
          timestampMs: norm.timestampMs,
          driverId: activeTrip?.driver_id,
          tripId: activeTrip?.id,
          truckPlate: norm.plateNumber,
        }).catch((driftErr) => console.warn('Cold chain drift evaluation error:', driftErr));
      }

      // 7. معالجة مؤشرات وتنبيهات أجهزة Frigo IoT المتقدمة (Carrier / Thermo King)
      if (norm.frigoIoT && norm.frigoIoT.anomalies.length > 0) {
        const criticalAnomalies = norm.frigoIoT.anomalies.filter((a) => a.severity === 'critical');
        if (criticalAnomalies.length > 0) {
          try {
            const { recordAuditLog } = await import('@/lib/audit.server');
            await recordAuditLog({
              entityType: 'cold_chain',
              entityId: String(truckId),
              actionType: 'security_alert',
              reason: `إنذار حرج في دارة تبريد الشاحنة #${truckId} (${criticalAnomalies.map((a) => a.titleAr).join(' - ')})`,
              newData: {
                truckId,
                sdiScore: norm.frigoIoT.sdiScore,
                anomalies: criticalAnomalies,
                pressures: {
                  suction: norm.frigoIoT.suctionPressureBar,
                  discharge: norm.frigoIoT.dischargePressureBar,
                  ratio: norm.frigoIoT.compressionRatio,
                },
              },
            });
          } catch {
            // Non-blocking
          }
        }
      }

      results.push({ success: true, truckId, frigoIoT: norm.frigoIoT });
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
    .select('id, name, latitude, longitude, radius_km, zone_type')
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

        // Auto-Geofence Targeted Receiver Dispatch Hook
        const matchedZoneRecord = zones.find((z) => z.id === currentMatch.zoneId);
        GeofenceReceiverTriggerService.evaluateGeofenceReceiverArrival({
          truckId,
          latitude,
          longitude,
          zoneName: currentMatch.zoneName,
          zoneId: currentMatch.zoneId,
          zoneType: (matchedZoneRecord as any)?.zone_type,
          timestamp,
        }).catch((err) => console.warn('[Auto-Geofence Receiver Trigger Error]:', err));
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
