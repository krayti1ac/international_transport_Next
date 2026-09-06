'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { calculateDistance } from '@/lib/geofence';
import type { TruckMaintenance, TripOrder, TruckLocationHistory } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TcoBreakdown {
  truckId: number;
  truckName: string;
  totalDistanceKm: number;
  fuelCost: number;
  fuelLiters: number;
  fuelCostPerKm: number;
  maintenanceCost: number;
  maintenanceCostPerKm: number;
  tripCost: number;
  tripCostPerKm: number;
  totalCost: number;
  totalCostPerKm: number;
  tripsCount: number;
  maintenanceCount: number;
  fuelReceiptsCount: number;
}

export interface TcoResponse {
  success: boolean;
  data?: TcoBreakdown[];
  error?: string;
}

function isFuelExpense(record: any): boolean {
  const raw = (record.expense_type || record.type || '').toString().toLowerCase();
  return raw === 'fuel' || raw === 'carburant' || raw === 'gasoil';
}

export async function calculateTcoPerKm(truckId?: number): Promise<TcoResponse> {
  try {
    const supabase = await createClient();

    const trucksQuery = supabase.from('trucks').select('id, plate_number, model');
    if (truckId) trucksQuery.eq('id', truckId);
    const { data: trucks, error: trucksError } = await trucksQuery;
    if (trucksError) throw trucksError;

    const { data: maintenanceRows, error: maintError } = await supabase
      .from('truck_maintenance')
      .select('*')
      .or(truckId ? `truck_id.eq.${truckId}` : 'truck_id.neq.0');
    if (maintError) throw maintError;

    const { data: trips, error: tripsError } = await supabase
      .from('trip_orders')
      .select('*')
      .or(truckId ? `truck_id.eq.${truckId}` : 'truck_id.neq.0')
      .neq('status', 'cancelled');
    if (tripsError) throw tripsError;

    const { data: locations, error: locError } = await supabase
      .from('truck_locations')
      .select('*')
      .order('truck_id')
      .order('recorded_at');
    if (locError) throw locError;

    const locationsByTruck: Record<number, TruckLocationHistory[]> = {};
    for (const loc of locations || []) {
      if (!locationsByTruck[loc.truck_id]) locationsByTruck[loc.truck_id] = [];
      locationsByTruck[loc.truck_id].push({
        ...loc,
        timestamp: loc.timestamp || loc.recorded_at,
        recorded_at: loc.recorded_at || loc.timestamp,
      });
    }

    const maintenanceByTruck: Record<number, TruckMaintenance[]> = {};
    for (const row of maintenanceRows || []) {
      if (!maintenanceByTruck[row.truck_id]) maintenanceByTruck[row.truck_id] = [];
      maintenanceByTruck[row.truck_id].push(row);
    }

    const tripsByTruck: Record<number, TripOrder[]> = {};
    for (const trip of trips || []) {
      if (!trip.truck_id) continue;
      if (!tripsByTruck[trip.truck_id]) tripsByTruck[trip.truck_id] = [];
      tripsByTruck[trip.truck_id].push(trip);
    }

    const breakdowns: TcoBreakdown[] = [];

    for (const truck of trucks || []) {
      const maintRecords = maintenanceByTruck[truck.id] || [];
      const truckTrips = tripsByTruck[truck.id] || [];
      const truckLocations = locationsByTruck[truck.id] || [];

      const fuelRecords = maintRecords.filter(isFuelExpense);
      const nonFuelMaintenance = maintRecords.filter((r) => !isFuelExpense(r));

      const fuelCost = fuelRecords.reduce((sum, r) => sum.plus(new Decimal(r.amount || 0)), new Decimal(0)).toNumber();
      const fuelLiters = fuelRecords.reduce((sum, r) => sum.plus(new Decimal(r.amount || 0)), new Decimal(0)).toNumber();
      const maintenanceCost = nonFuelMaintenance.reduce((sum, r) => sum.plus(new Decimal(r.amount || 0)), new Decimal(0)).toNumber();

      let tripCost = new Decimal(0);
      for (const trip of truckTrips) {
        const priceExport = new Decimal(trip.price_export || 0);
        const priceImport = new Decimal(trip.price_import || 0);
        const basePrice = new Decimal(trip.price || 0);
        tripCost = tripCost.plus(priceExport).plus(priceImport);
        if (tripCost.equals(new Decimal(0))) tripCost = tripCost.plus(basePrice);
      }
      const tripCostNumber = tripCost.toNumber();

      let totalDistance = new Decimal(0);
      for (let i = 1; i < truckLocations.length; i++) {
        const prev = truckLocations[i - 1];
        const curr = truckLocations[i];
        if (
          typeof prev.latitude === 'number' &&
          typeof prev.longitude === 'number' &&
          typeof curr.latitude === 'number' &&
          typeof curr.longitude === 'number'
        ) {
          const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
          if (!isNaN(dist) && isFinite(dist)) totalDistance = totalDistance.plus(new Decimal(dist));
        }
      }

      const totalDistanceNumber = parseFloat(totalDistance.toFixed(2));
      const safeDistance = totalDistance.greaterThan(0) ? totalDistance : new Decimal(1);

      const totalCost = fuelCost + maintenanceCost + tripCostNumber;
      const fuelCostPerKm = new Decimal(fuelCost).dividedBy(safeDistance).toNumber();
      const maintenanceCostPerKm = new Decimal(maintenanceCost).dividedBy(safeDistance).toNumber();
      const tripCostPerKm = new Decimal(tripCostNumber).dividedBy(safeDistance).toNumber();
      const totalCostPerKm = new Decimal(totalCost).dividedBy(safeDistance).toNumber();

      breakdowns.push({
        truckId: truck.id,
        truckName: `${truck.plate_number}${truck.model ? ` (${truck.model})` : ''}`,
        totalDistanceKm: totalDistanceNumber,
        fuelCost: parseFloat(new Decimal(fuelCost).toFixed(2)),
        fuelLiters: parseFloat(new Decimal(fuelLiters).toFixed(2)),
        fuelCostPerKm: parseFloat(new Decimal(fuelCostPerKm).toFixed(4)),
        maintenanceCost: parseFloat(new Decimal(maintenanceCost).toFixed(2)),
        maintenanceCostPerKm: parseFloat(new Decimal(maintenanceCostPerKm).toFixed(4)),
        tripCost: parseFloat(new Decimal(tripCostNumber).toFixed(2)),
        tripCostPerKm: parseFloat(new Decimal(tripCostPerKm).toFixed(4)),
        totalCost: parseFloat(new Decimal(totalCost).toFixed(2)),
        totalCostPerKm: parseFloat(new Decimal(totalCostPerKm).toFixed(4)),
        tripsCount: truckTrips.length,
        maintenanceCount: maintRecords.length,
        fuelReceiptsCount: fuelRecords.length,
      });
    }

    return { success: true, data: breakdowns };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في حساب تكلفة الكيلومتر';
    return { success: false, error: message };
  }
}
