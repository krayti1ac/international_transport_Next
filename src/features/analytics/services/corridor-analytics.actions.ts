'use server';

import { createClient } from '@/lib/supabase/server';
import {
  computeCorridorAnalytics,
  type RawTripOrderWithRelations,
  type RawFuelExpense,
} from './corridor-comparison.service';
import type { CorridorAnalyticsResult } from '../types/corridor.types';
import type { Truck } from '@/types/database';

export interface CorridorAnalyticsFilter {
  startDate?: string;
  endDate?: string;
  corridor?: 'all' | 'european_maritime' | 'african_overland';
  truckId?: number;
}

export async function getCorridorAnalyticsAction(
  filters: CorridorAnalyticsFilter = {}
): Promise<{ success: boolean; data?: CorridorAnalyticsResult; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Fetch Trip Orders
    let tripsQuery = supabase
      .from('trip_orders')
      .select('*')
      .order('departure_date', { ascending: false });

    if (filters.startDate) {
      tripsQuery = tripsQuery.gte('departure_date', filters.startDate);
    }
    if (filters.endDate) {
      tripsQuery = tripsQuery.lte('departure_date', filters.endDate);
    }
    if (filters.truckId) {
      tripsQuery = tripsQuery.eq('truck_id', filters.truckId);
    }
    if (filters.corridor && filters.corridor !== 'all') {
      tripsQuery = tripsQuery.eq('corridor_type', filters.corridor);
    }

    const [tripsRes, trucksRes, driversRes, trailersRes, fuelRes] = await Promise.all([
      tripsQuery,
      supabase.from('trucks').select('id, plate_number, model, fuel_consumption_rate'),
      supabase.from('drivers').select('id, name, phone'),
      supabase.from('trailers').select('id, plate_number'),
      supabase.from('truck_maintenance').select('id, truck_id, cost, liters, created_at').in('type', ['fuel', 'carburant', 'gasoil']).order('created_at', { ascending: false }),
    ]);

    if (tripsRes.error) {
      return { success: false, error: tripsRes.error.message };
    }

    const trucksMap = new Map((trucksRes.data || []).map((t) => [t.id, t]));
    const driversMap = new Map((driversRes.data || []).map((d) => [d.id, d]));
    const trailersMap = new Map((trailersRes.data || []).map((tr) => [tr.id, tr]));

    const enrichedTrips: RawTripOrderWithRelations[] = (tripsRes.data || []).map((trip) => ({
      ...trip,
      trucks: trip.truck_id ? trucksMap.get(trip.truck_id) || null : null,
      drivers: trip.driver_id ? driversMap.get(trip.driver_id) || null : null,
      trailers: trip.trailer_id ? trailersMap.get(trip.trailer_id) || null : null,
    }));

    // 4. Compute analytics
    const result = computeCorridorAnalytics(
      enrichedTrips,
      (fuelRes.data || []) as RawFuelExpense[],
      (trucksRes.data || []) as Truck[]
    );

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown corridor analytics error';
    return { success: false, error: message };
  }
}

