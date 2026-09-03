import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findMatchingZone, calculateDistance } from '@/lib/geofence';

interface GPSPayload {
  plate_number?: string;
  truck_id?: number;
  latitude: number;
  longitude: number;
  speed?: number;
  timestamp?: string;
  address?: string;
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

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-gps-secret');
    const expectedSecret = process.env.GPS_WEBHOOK_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'غير مصرح بالوصول (Unauthorized)' }, { status: 401 });
    }

    const body = await req.json();
    const data: GPSPayload | GPSPayload[] = Array.isArray(body) ? body : [body];

    if (!data.length) {
      return NextResponse.json({ error: 'البيانات المرسلة فارغة' }, { status: 400 });
    }

    const supabase = await createClient();

    for (const item of data) {
      let truckId = item.truck_id;

      if (!truckId && item.plate_number) {
        const { data: truck } = await supabase
          .from('trucks')
          .select('id')
          .ilike('plate_number', `%${item.plate_number.trim()}%`)
          .single();

        if (truck) {
          truckId = truck.id;
        }
      }

      if (!truckId) continue;

      const recordTime = item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString();

      await supabase.from('truck_locations').insert({
        truck_id: truckId,
        latitude: item.latitude,
        longitude: item.longitude,
        timestamp: recordTime,
      });

      if (item.address || (item.latitude && item.longitude)) {
        const locationDesc = item.address || `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
        await supabase
          .from('trucks')
          .update({ current_location: locationDesc })
          .eq('id', truckId);
      }

      await processGeofenceAlerts(supabase, truckId, item.latitude, item.longitude, recordTime);
    }

    return NextResponse.json({ success: true, count: data.length });
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
