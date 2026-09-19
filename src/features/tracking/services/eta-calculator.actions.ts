'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import {
  calculateHaversineDistance,
  calculateBearing,
  calculateCrossTrackDistance,
} from '@/lib/geofence';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface EtaResult {
  remainingDistanceKm: number;
  estimatedHoursRemaining: number;
  estimatedArrivalDate: string | null;
  isOffRoute: boolean;
  crossTrackDistanceKm?: number;
  destinationName?: string;
}

// Well-known logistics destination hubs coordinates fallback (Morocco & Europe)
const LOGISTICS_HUBS: Record<string, { lat: number; lon: number; name: string }> = {
  madrid: { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
  barcelona: { lat: 41.3879, lon: 2.1699, name: 'Barcelona' },
  valencia: { lat: 39.4699, lon: -0.3763, name: 'Valencia' },
  sevilla: { lat: 37.3891, lon: -5.9845, name: 'Sevilla' },
  algeciras: { lat: 36.1408, lon: -5.4562, name: 'Algeciras' },
  almeria: { lat: 36.834, lon: -2.4637, name: 'Almería' },
  perpignan: { lat: 42.6886, lon: 2.8948, name: 'Perpignan' },
  paris: { lat: 48.8566, lon: 2.3522, name: 'Paris' },
  lyon: { lat: 45.764, lon: 4.8357, name: 'Lyon' },
  bordeaux: { lat: 44.8378, lon: -0.5792, name: 'Bordeaux' },
  rotterdam: { lat: 51.9244, lon: 4.4777, name: 'Rotterdam' },
  casablanca: { lat: 33.5731, lon: -7.5898, name: 'Casablanca' },
  tanger: { lat: 35.7595, lon: -5.834, name: 'Tanger' },
  tangermed: { lat: 35.885, lon: -5.505, name: 'Tanger Med Port' },
  agadir: { lat: 30.4278, lon: -9.5981, name: 'Agadir' },
};

export async function calculateLiveTripEta(tripId: number): Promise<EtaResult | null> {
  try {
    const supabase = await createClient();

    // 1. Fetch trip order details
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('id, truck_id, route, route_export, route_import, destination, status')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip || !trip.truck_id) {
      return null;
    }

    // 2. Fetch last recorded GPS position for the truck
    const { data: lastLocation, error: locErr } = await supabase
      .from('truck_locations')
      .select('latitude, longitude, speed, recorded_at')
      .eq('truck_id', trip.truck_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (locErr || !lastLocation || !lastLocation.latitude || !lastLocation.longitude) {
      return null;
    }

    const currentLat = Number(lastLocation.latitude);
    const currentLon = Number(lastLocation.longitude);

    // 3. Resolve destination coordinates from transport_routes or known hubs
    // 3. Resolve origin & destination coordinates
    let startLat: number | null = null;
    let startLon: number | null = null;
    let destLat: number | null = null;
    let destLon: number | null = null;
    let destName = trip.destination || trip.route || '';

    const routeName = trip.route || trip.route_export || trip.route_import;
    if (routeName) {
      const { data: routeData } = await supabase
        .from('transport_routes')
        .select('*')
        .ilike('name', `%${routeName}%`)
        .maybeSingle();

      if (routeData) {
        const rawStartLat = routeData.origin_latitude ?? (routeData as Record<string, unknown>).origin_lat;
        const rawStartLon = routeData.origin_longitude ?? (routeData as Record<string, unknown>).origin_lng;
        const rawDestLat = routeData.destination_latitude ?? (routeData as Record<string, unknown>).destination_lat;
        const rawDestLon = routeData.destination_longitude ?? (routeData as Record<string, unknown>).destination_lng;

        if (rawStartLat && rawStartLon) {
          startLat = Number(rawStartLat);
          startLon = Number(rawStartLon);
        }

        if (rawDestLat && rawDestLon) {
          destLat = Number(rawDestLat);
          destLon = Number(rawDestLon);
          destName = routeData.destination || routeData.name;
        }
      }
    }

    // Fallback: match destination name from city keywords in route
    // Fallback coordinates for origin and destination
    // Fallback coordinates for destination
    if (!destLat || !destLon) {
      const searchStr = `${trip.route || ''} ${trip.route_export || ''} ${trip.destination || ''}`.toLowerCase();
      for (const [key, hub] of Object.entries(LOGISTICS_HUBS)) {
        if (searchStr.includes(key)) {
          destLat = hub.lat;
          destLon = hub.lon;
          destName = hub.name;
          break;
        }
      }
    }

    // Default origin to Tangier Med if not specified
    if (!startLat || !startLon) {
      startLat = LOGISTICS_HUBS.tangermed.lat;
      startLon = LOGISTICS_HUBS.tangermed.lon;
    }

    if (!destLat || !destLon) {
      return null;
    }

    // 4. Calculate direct distance and apply TIR truck road tortuosity factor (1.25)
    // 4. Calculate direct distance and apply TIR truck road factor (1.25)
    const directDistance = calculateHaversineDistance(currentLat, currentLon, destLat, destLon);
    const roadFactor = new Decimal(1.25);
    const remainingDistanceDec = new Decimal(directDistance).times(roadFactor);
    const remainingDistanceKm = Math.round(remainingDistanceDec.toNumber());

    // 5. Compute effective speed (TIR average ~65 km/h for long-distance international, capped at 85 km/h)
    // 5. Compute effective speed
    const rawSpeed = typeof lastLocation.speed === 'number' ? lastLocation.speed : 0;
    const effectiveSpeed = rawSpeed > 20 ? Math.min(rawSpeed, 85) : 65;

    // Use Decimal for financial & telemetry precision
    const hoursRemainingDec = remainingDistanceDec.dividedBy(effectiveSpeed);
    const hoursRemainingNum = hoursRemainingDec.toNumber();
    const roundedHours = Math.round(hoursRemainingNum * 10) / 10;

    const arrivalDate = new Date(Date.now() + hoursRemainingNum * 3600 * 1000).toISOString();

    // 6. Cross-track Route Deviation Analysis (threshold: 35 km corridor tolerance)
    let isOffRoute = false;
    let crossTrackKm = 0;

    if (startLat && startLon && destLat && destLon) {
      crossTrackKm = calculateCrossTrackDistance(
        currentLat,
        currentLon,
        startLat,
        startLon,
        destLat,
        destLon
      );

      // If cross-track deviation exceeds 35 km and the truck is > 15 km away from destination
      if (crossTrackKm > 35 && remainingDistanceKm > 15) {
        isOffRoute = true;
      }
    }

    return {
      remainingDistanceKm,
      estimatedHoursRemaining: roundedHours,
      estimatedArrivalDate: arrivalDate,
      isOffRoute,
      crossTrackDistanceKm: Math.round(crossTrackKm * 10) / 10,
      destinationName: destName,
    };
  } catch (error) {
    console.error('Error in calculateLiveTripEta:', error);
    return null;
  }
}

