'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  computeCorridorPnl,
  type RawPnlTripOrder,
  type RawPnlMaintenanceExpense,
} from './corridor-pnl-calculator.service';
import type {
  CorridorPnlAnalyticsResult,
  CorridorPnlFilter,
} from '../types/corridor-pnl.types';
import type { Truck } from '@/types/database';

const corridorPnlFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  corridor: z.enum(['all', 'european_maritime', 'african_overland']).optional().default('all'),
  truckId: z.number().int().positive().optional(),
  minCpkVariance: z.number().optional(),
});

export async function getCorridorPnlAnalyticsAction(
  rawFilters: CorridorPnlFilter = {}
): Promise<{ success: boolean; data?: CorridorPnlAnalyticsResult; error?: string }> {
  try {
    const parseRes = corridorPnlFilterSchema.safeParse(rawFilters);
    if (!parseRes.success) {
      return { success: false, error: 'معايير الفلترة غير صالحة' };
    }
    const filters = parseRes.data;

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

    const [tripsRes, trucksRes, driversRes, trailersRes, maintenanceRes] = await Promise.all([
      tripsQuery,
      supabase.from('trucks').select('id, plate_number, model, fuel_consumption_rate'),
      supabase.from('drivers').select('id, name, phone'),
      supabase.from('trailers').select('id, plate_number'),
      supabase
        .from('truck_maintenance')
        .select('id, truck_id, trip_order_id, cost, type, liters, created_at')
        .order('created_at', { ascending: false }),
    ]);

    if (tripsRes.error) {
      return { success: false, error: tripsRes.error.message };
    }

    const trucksMap = new Map((trucksRes.data || []).map((t) => [t.id, t]));
    const driversMap = new Map((driversRes.data || []).map((d) => [d.id, d]));
    const trailersMap = new Map((trailersRes.data || []).map((tr) => [tr.id, tr]));

    const enrichedTrips: RawPnlTripOrder[] = (tripsRes.data || []).map((trip) => ({
      ...trip,
      trucks: trip.truck_id ? trucksMap.get(trip.truck_id) || null : null,
      drivers: trip.driver_id ? driversMap.get(trip.driver_id) || null : null,
      trailers: trip.trailer_id ? trailersMap.get(trip.trailer_id) || null : null,
    }));

    // 2. Compute Corridor P&L & CPK Analytics with Decimal.js
    const result = computeCorridorPnl(
      enrichedTrips,
      (maintenanceRes.data || []) as RawPnlMaintenanceExpense[],
      (trucksRes.data || []) as Truck[]
    );

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل غير متوقع في محرك تحليلات الممرات';
    return { success: false, error: message };
  }
}

