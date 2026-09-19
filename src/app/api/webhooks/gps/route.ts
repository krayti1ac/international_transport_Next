import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findMatchingZone, calculateDistance } from '@/lib/geofence';
import { evaluatePortGeofences } from '@/features/tracking/services/port-geofence.actions';

interface GPSPayload {
  plate_number?: string;
  truck_id?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp?: string;
  address?: string;
  device_id?: number;
  traccar_unique_id?: string;
  heading?: number;
  accuracy?: number;
}

interface AlertPayload {
  zone_id: number;
  truck_id: number;
  event_type: 'enter' | 'exit';
  latitude: number;
  longitude: number;
  timestamp: string;
  notified: boolean;
}

interface TraccarPositionPayload {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  accuracy?: number;
  altitude?: number;
  batteryLevel?: number;
  timestamp: number;
  address?: string;
  attributes?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-gps-secret');
    const expectedSecret = process.env.GPS_WEBHOOK_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'غير مصرح بالوصول (Unauthorized)' }, { status: 401 });
    }

    const body = await req.json();
    const rawData = Array.isArray(body) ? body : [body];
    const data = rawData as (GPSPayload | TraccarPositionPayload)[];

    if (!data.length) {
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

    for (const rawItem of data) {
      const item = rawItem as GPSPayload & Partial<TraccarPositionPayload>;
      let truckId = item.truck_id;

      if (!truckId) {
        if ('traccar_unique_id' in item && item.traccar_unique_id) {
          const { data: mapping } = await supabase
            .from('traccar_device_mappings')
            .select('truck_id')
            .eq('traccar_unique_id', item.traccar_unique_id)
            .eq('is_active', true)
            .single();

          if (mapping) {
            truckId = mapping.truck_id;
          }
        } else if ('deviceId' in item && item.deviceId) {
          const { data: mapping } = await supabase
            .from('traccar_device_mappings')
            .select('truck_id')
            .eq('traccar_device_id', item.deviceId)
            .eq('is_active', true)
            .single();

          if (mapping) {
            truckId = mapping.truck_id;
          }
        } else if ('plate_number' in item && item.plate_number) {
          const { data: truck } = await supabase
            .from('trucks')
            .select('id')
            .ilike('plate_number', `%${item.plate_number.trim()}%`)
            .single();

          if (truck) {
            truckId = truck.id;
          }
        }
      }

      if (!truckId) {
        results.push({ success: false, error: 'No truck found' });
        continue;
      }

      const timestampMs = 'timestamp' in item && item.timestamp ? (typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime()) : Date.now();
      const recordTime = new Date(timestampMs).toISOString();
      const latitude = 'latitude' in item ? item.latitude : 0;
      const longitude = 'longitude' in item ? item.longitude : 0;

      const insertPayload: Record<string, unknown> = {
        truck_id: truckId,
        latitude,
        longitude,
        recorded_at: recordTime,
        timestamp: recordTime,
      };

      if ('speed' in item && item.speed !== undefined) {
        insertPayload.speed = item.speed;
      }
      if ('course' in item && item.course !== undefined) {
        insertPayload.heading = item.course;
      }
      if ('heading' in item && item.heading !== undefined) {
        insertPayload.heading = item.heading;
      }
      if ('accuracy' in item && item.accuracy !== undefined) {
        insertPayload.accuracy = item.accuracy;
      }
      if ('deviceId' in item && item.deviceId) {
        insertPayload.device_id = item.deviceId;
      }

      const { error: insertError } = await supabase.from('truck_locations').insert(insertPayload);

      if (insertError) {
        results.push({ success: false, truckId, error: insertError.message });
        continue;
      }

      const address = 'address' in item ? item.address : undefined;
      if (address || (latitude && longitude)) {
        const locationDesc = address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        await supabase
          .from('trucks')
          .update({ current_location: locationDesc })
          .eq('id', truckId);
      }

      await processGeofenceAlerts(supabase, truckId, latitude, longitude, recordTime);
      await evaluatePortGeofences({
        truckId,
        latitude,
        longitude,
        timestamp: recordTime,
      });
      results.push({ success: true, truckId });
    }

    const successCount = results.filter(r => r.success).length;
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
    .select('zone_id, event_type')
    .eq('truck_id', truckId)
    .order('timestamp', { ascending: false })
    .limit(zones.length);

  const currentlyInsideZones = new Set<number>();
  if (previousAlerts) {
    for (const alert of previousAlerts) {
      if (alert.event_type === 'enter') {
        currentlyInsideZones.add(alert.zone_id);
      } else if (alert.event_type === 'exit') {
        currentlyInsideZones.delete(alert.zone_id);
      }
    }
  }

  const alertsToInsert: AlertPayload[] = [];

  if (currentMatch) {
    if (!currentlyInsideZones.has(currentMatch.zoneId)) {
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

  for (const zoneId of currentlyInsideZones) {
    if (currentMatch && currentMatch.zoneId === zoneId) {
      continue;
    }
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) continue;
    const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
    if (distance > zone.radius_km) {
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

  if (alertsToInsert.length > 0) {
    await supabase.from('geofence_alerts').insert(alertsToInsert);
  }
}
