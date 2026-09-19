'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { FleetUtilizationReport, TruckUtilization, TrailerUtilization, DriverUtilization } from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function getFleetUtilizationReport(params: {
  periodStart: string;
  periodEnd: string;
}): Promise<{ success: boolean; data?: FleetUtilizationReport; error?: string }> {
  try {
    const supabase = await createClient();

    const [trucksRes, trailersRes, driversRes, tripsRes, idlingRes] = await Promise.all([
      supabase.from('trucks').select('id, plate_number, model, status, current_km'),
      supabase.from('trailers').select('id, plate_number, type, status'),
      supabase.from('drivers').select('id, name, status'),
      supabase
        .from('trip_orders')
        .select('id, truck_id, trailer_id, driver_id, status, price, price_import, goods_description_import, departure_date')
        .gte('departure_date', params.periodStart)
        .lte('departure_date', params.periodEnd),
      supabase
        .from('truck_locations')
        .select('truck_id, speed, recorded_at')
        .gte('recorded_at', params.periodStart)
        .lte('recorded_at', params.periodEnd)
        .order('recorded_at', { ascending: true })
        .limit(2000),
    ]);

    if (trucksRes.error) throw trucksRes.error;
    if (trailersRes.error) throw trailersRes.error;
    if (driversRes.error) throw driversRes.error;
    if (tripsRes.error) throw tripsRes.error;

    const trucks = trucksRes.data || [];
    const trailers = trailersRes.data || [];
    const drivers = driversRes.data || [];
    const trips = tripsRes.data || [];
    const locations = idlingRes.data || [];

    const periodStart = new Date(params.periodStart);
    const periodEnd = new Date(params.periodEnd);
    const periodDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86400000));

    // 1. Analyze Idling Hours per Truck from telemetry readings
    const truckIdlingHoursMap = new Map<number, number>();
    if (locations.length > 1) {
      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        if (prev.truck_id === curr.truck_id) {
          const speed = curr.speed || 0;
          const timeDiffSec = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
          if (speed === 0 && timeDiffSec >= 900 && timeDiffSec <= 14400) {
            const currentHours = truckIdlingHoursMap.get(curr.truck_id) || 0;
            truckIdlingHoursMap.set(curr.truck_id, currentHours + timeDiffSec / 3600);
          }
        }
      }
    }

    type DecimalInstance = InstanceType<typeof Decimal>;

    // 2. Aggregate Trip Stats
    const truckStats = new Map<number, { trips: number; completed: number; revenue: DecimalInstance; emptyTrips: number }>();
    const trailerStats = new Map<number, { trips: number; completed: number }>();
    const driverStats = new Map<number, { trips: number; completed: number; revenue: DecimalInstance }>();

    let totalEmptyTripsCount = 0;

    for (const trip of trips) {
      const tripRevenue = new Decimal(trip.price || 0);

      // Check if return leg is empty (Taux à vide)
      const isReturnEmpty =
        !trip.goods_description_import ||
        trip.goods_description_import.trim() === '' ||
        (Number(trip.price_import || 0) === 0);

      if (isReturnEmpty) {
        totalEmptyTripsCount++;
      }

      if (trip.truck_id) {
        const s = truckStats.get(trip.truck_id) || {
          trips: 0,
          completed: 0,
          revenue: new Decimal(0),
          emptyTrips: 0,
        };
        s.trips++;
        if (isReturnEmpty) s.emptyTrips++;
        if (['completed', 'delivered', 'settled'].includes(trip.status)) {
          s.completed++;
          s.revenue = s.revenue.plus(tripRevenue);
        }
        truckStats.set(trip.truck_id, s);
      }

      if (trip.trailer_id) {
        const s = trailerStats.get(trip.trailer_id) || { trips: 0, completed: 0 };
        s.trips++;
        if (['completed', 'delivered', 'settled'].includes(trip.status)) s.completed++;
        trailerStats.set(trip.trailer_id, s);
      }

      if (trip.driver_id) {
        const s = driverStats.get(trip.driver_id) || { trips: 0, completed: 0, revenue: new Decimal(0) };
        s.trips++;
        if (['completed', 'delivered', 'settled'].includes(trip.status)) {
          s.completed++;
          s.revenue = s.revenue.plus(tripRevenue);
        }
        driverStats.set(trip.driver_id, s);
      }
    }

    let totalFleetIdlingHours = new Decimal(0);

    const truckUtilization: TruckUtilization[] = trucks.map((truck) => {
      const stats = truckStats.get(truck.id) || {
        trips: 0,
        completed: 0,
        revenue: new Decimal(0),
        emptyTrips: 0,
      };

      const rate = Math.min(100, Math.round((stats.completed / periodDays) * 100));
      const truckIdling = truckIdlingHoursMap.get(truck.id) || 0;
      totalFleetIdlingHours = totalFleetIdlingHours.plus(new Decimal(truckIdling));

      const uptime = stats.trips > 0 ? Math.min(100, Math.round((stats.completed / Math.max(1, stats.trips)) * 100)) : 0;

      let recommendation: 'optimal' | 'underused' | 'overused' = 'optimal';
      if (rate < 30) recommendation = 'underused';
      else if (rate > 80) recommendation = 'overused';

      return {
        truckId: truck.id,
        plateNumber: truck.plate_number,
        model: truck.model || undefined,
        status: truck.status || 'active',
        totalTrips: stats.trips,
        completedTrips: stats.completed,
        totalDistanceKm: 0,
        totalRevenue: stats.revenue.toNumber(),
        utilizationRate: rate,
        uptimePercentage: uptime,
        emptyTripsCount: stats.emptyTrips,
        idlingHours: Math.round(truckIdling * 10) / 10,
        idleDays: Math.max(0, periodDays - stats.completed),
        recommendation,
      };
    });

    const trailerUtilization: TrailerUtilization[] = trailers.map((trailer) => {
      const stats = trailerStats.get(trailer.id) || { trips: 0, completed: 0 };
      const rate = Math.min(100, Math.round((stats.completed / periodDays) * 100));
      let recommendation: 'optimal' | 'underused' | 'overused' = 'optimal';
      if (rate < 30) recommendation = 'underused';
      else if (rate > 80) recommendation = 'overused';

      return {
        trailerId: trailer.id,
        plateNumber: trailer.plate_number,
        type: trailer.type || undefined,
        totalTrips: stats.trips,
        completedTrips: stats.completed,
        utilizationRate: rate,
        recommendation,
      };
    });

    const driverUtilization: DriverUtilization[] = drivers.map((driver) => {
      const stats = driverStats.get(driver.id) || { trips: 0, completed: 0, revenue: new Decimal(0) };
      const rate = Math.min(100, Math.round((stats.completed / periodDays) * 100));
      let recommendation: 'optimal' | 'underused' | 'overused' = 'optimal';
      if (rate < 30) recommendation = 'underused';
      else if (rate > 80) recommendation = 'overused';

      return {
        driverId: driver.id,
        driverName: driver.name,
        totalTrips: stats.trips,
        completedTrips: stats.completed,
        totalRevenue: stats.revenue.toNumber(),
        utilizationRate: rate,
        recommendation,
      };
    });

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const truckRates = truckUtilization.map((t) => t.utilizationRate);
    const trailerRates = trailerUtilization.map((t) => t.utilizationRate);
    const driverRates = driverUtilization.map((d) => d.utilizationRate);

    // Fleet Uptime %: active trucks with trips vs total trucks
    const activeTrucksCount = truckUtilization.filter((t) => t.totalTrips > 0).length;
    const fleetUptimePercentage = trucks.length > 0 ? Math.round((activeTrucksCount / trucks.length) * 100) : 0;

    // Empty Mileage Ratio: percentage of trips returning without payload
    const emptyMileageRatio = trips.length > 0 ? Math.round((totalEmptyTripsCount / trips.length) * 100) : 0;

    // Financial Calculation of Idling Waste using Decimal.js
    // TIR Diesel consumption while stationary with engine running: ~2.5 Liters/hour
    // Average diesel cost: ~12.5 MAD/L
    const idlingLitersPerHr = new Decimal(2.5);
    const dieselPricePerLiterMAD = new Decimal(12.5);
    const estimatedIdlingFuelWasteLiters = totalFleetIdlingHours.times(idlingLitersPerHr);
    const estimatedIdlingFuelWasteMAD = estimatedIdlingFuelWasteLiters.times(dieselPricePerLiterMAD);

    const underutilizedCount = [...truckRates, ...trailerRates, ...driverRates].filter((r) => r < 30).length;
    const overutilizedCount = [...truckRates, ...trailerRates, ...driverRates].filter((r) => r > 80).length;

    const report: FleetUtilizationReport = {
      generatedAt: new Date().toISOString(),
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      trucks: truckUtilization,
      trailers: trailerUtilization,
      drivers: driverUtilization,
      summary: {
        totalTrucks: trucks.length,
        totalTrailers: trailers.length,
        totalDrivers: drivers.length,
        avgTruckUtilization: Math.round(avg(truckRates)),
        avgTrailerUtilization: Math.round(avg(trailerRates)),
        avgDriverUtilization: Math.round(avg(driverRates)),
        fleetUptimePercentage,
        emptyMileageRatio,
        totalIdlingHours: Math.round(totalFleetIdlingHours.toNumber() * 10) / 10,
        estimatedIdlingFuelWasteLiters: Math.round(estimatedIdlingFuelWasteLiters.toNumber() * 10) / 10,
        estimatedIdlingFuelWasteMAD: Math.round(estimatedIdlingFuelWasteMAD.toNumber()),
        underutilizedCount,
        overutilizedCount,
      },
    };

    return { success: true, data: report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate fleet utilization report';
    return { success: false, error: message };
  }
}
