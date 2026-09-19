'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { calculateHaversineDistance } from '@/lib/geofence';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TruckCpkMetric {
  truckId: number;
  truckPlate: string;
  truckModel: string;
  totalDistanceKm: number;
  fuelCostMad: number;
  fuelCostEur: number;
  maintenanceCostMad: number;
  maintenanceCostEur: number;
  tollsAndFerryCostMad: number;
  tollsAndFerryCostEur: number;
  totalOperatingCostMad: number;
  totalOperatingCostEur: number;
  cpkMad: number;
  cpkEur: number;
  fuelCpkMad: number;
  maintenanceCpkMad: number;
  efficiencyRating: 'excellent' | 'normal' | 'high_cost';
}

export interface FleetCpkSummary {
  success: boolean;
  currency: 'MAD' | 'EUR';
  totalFleetKm: number;
  totalOperatingCostMad: number;
  totalOperatingCostEur: number;
  averageFleetCpkMad: number;
  averageFleetCpkEur: number;
  trucks: TruckCpkMetric[];
  error?: string;
}

const DEFAULT_EUR_RATE = new Decimal(10.85);

/**
 * Calculates net Cost Per Kilometer (CPK) for each truck and across the entire fleet
 * Enforces Decimal.js precision for all monetary arithmetic
 */
export async function calculateFleetCpk(startDate?: string, endDate?: string): Promise<FleetCpkSummary> {
  try {
    const supabase = await createClient();

    // 1. Query active trucks
    const { data: trucks, error: truckErr } = await supabase
      .from('trucks')
      .select('id, plate_number, model, status')
      .neq('status', 'out_of_service');

    if (truckErr) throw truckErr;
    if (!trucks || trucks.length === 0) {
      return {
        success: true,
        currency: 'MAD',
        totalFleetKm: 0,
        totalOperatingCostMad: 0,
        totalOperatingCostEur: 0,
        averageFleetCpkMad: 0,
        averageFleetCpkEur: 0,
        trucks: [],
      };
    }

    const truckMetrics: TruckCpkMetric[] = [];
    let fleetTotalDistanceDec = new Decimal(0);
    let fleetTotalCostMadDec = new Decimal(0);

    for (const truck of trucks) {
      // A. Calculate distance from GPS points
      let locsQuery = supabase
        .from('truck_locations')
        .select('latitude, longitude, recorded_at')
        .eq('truck_id', truck.id)
        .order('recorded_at', { ascending: true });

      if (startDate) locsQuery = locsQuery.gte('recorded_at', startDate);
      if (endDate) locsQuery = locsQuery.lte('recorded_at', endDate);

      const { data: locs } = await locsQuery;

      let distanceDec = new Decimal(0);
      if (locs && locs.length > 1) {
        for (let i = 0; i < locs.length - 1; i++) {
          const lat1 = Number(locs[i].latitude);
          const lon1 = Number(locs[i].longitude);
          const lat2 = Number(locs[i + 1].latitude);
          const lon2 = Number(locs[i + 1].longitude);

          if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
            const dist = calculateHaversineDistance(lat1, lon1, lat2, lon2);
            if (dist > 0.05 && dist < 120) {
              distanceDec = distanceDec.plus(new Decimal(dist).times(1.25));
            }
          }
        }
      }

      // Default minimal operational threshold to prevent divide-by-zero
      const totalKmNum = Math.max(1, Math.round(distanceDec.toNumber()));
      const totalKmDec = new Decimal(totalKmNum);
      fleetTotalDistanceDec = fleetTotalDistanceDec.plus(totalKmDec);

      // B. Calculate Maintenance Costs
      let maintQuery = supabase
        .from('truck_maintenance')
        .select('cost, currency, maintenance_date')
        .eq('truck_id', truck.id);

      if (startDate) maintQuery = maintQuery.gte('maintenance_date', startDate);
      if (endDate) maintQuery = maintQuery.lte('maintenance_date', endDate);

      const { data: maintenanceRecords } = await maintQuery;

      let maintenanceCostMadDec = new Decimal(0);
      for (const m of maintenanceRecords || []) {
        const rawCost = new Decimal(m.cost || 0);
        if (m.currency?.toUpperCase() === 'EUR') {
          maintenanceCostMadDec = maintenanceCostMadDec.plus(rawCost.times(DEFAULT_EUR_RATE));
        } else {
          maintenanceCostMadDec = maintenanceCostMadDec.plus(rawCost);
        }
      }

      // C. Calculate Trip Costs (Ferry + Highway Tolls from trip_orders)
      let tripQuery = supabase
        .from('trip_orders')
        .select('price, ferry_cost, created_at')
        .eq('truck_id', truck.id)
        .neq('status', 'cancelled');

      if (startDate) tripQuery = tripQuery.gte('created_at', startDate);
      if (endDate) tripQuery = tripQuery.lte('created_at', endDate);

      const { data: trips } = await tripQuery;

      let tollsAndFerryCostMadDec = new Decimal(0);
      for (const t of trips || []) {
        const ferryCost = new Decimal((t as Record<string, unknown>).ferry_cost as number || 4500);
        tollsAndFerryCostMadDec = tollsAndFerryCostMadDec.plus(ferryCost);
      }

      // D. Fuel Cost Calculation (Standard heavy truck consumption rate ~33L/100km at 13.5 MAD/L)
      const nominalConsumptionRate = new Decimal(33); // 33 L / 100 km
      const fuelPricePerLiter = new Decimal(13.50); // MAD/L
      const fuelLitersDec = totalKmDec.times(nominalConsumptionRate).dividedBy(100);
      const fuelCostMadDec = fuelLitersDec.times(fuelPricePerLiter);

      // E. Aggregate Total Operating Cost
      const totalOperatingCostMadDec = fuelCostMadDec
        .plus(maintenanceCostMadDec)
        .plus(tollsAndFerryCostMadDec);

      fleetTotalCostMadDec = fleetTotalCostMadDec.plus(totalOperatingCostMadDec);

      const totalOperatingCostEurDec = totalOperatingCostMadDec.dividedBy(DEFAULT_EUR_RATE);
      const fuelCostEurDec = fuelCostMadDec.dividedBy(DEFAULT_EUR_RATE);
      const maintenanceCostEurDec = maintenanceCostMadDec.dividedBy(DEFAULT_EUR_RATE);
      const tollsAndFerryCostEurDec = tollsAndFerryCostMadDec.dividedBy(DEFAULT_EUR_RATE);

      // F. Calculate unit CPK (MAD and EUR)
      const cpkMadDec = totalOperatingCostMadDec.dividedBy(totalKmDec);
      const cpkEurDec = cpkMadDec.dividedBy(DEFAULT_EUR_RATE);
      const fuelCpkMadDec = fuelCostMadDec.dividedBy(totalKmDec);
      const maintenanceCpkMadDec = maintenanceCostMadDec.dividedBy(totalKmDec);

      // Benchmark efficiency (Standard international TIR: ~5.5 - 7.5 MAD/km)
      let efficiencyRating: 'excellent' | 'normal' | 'high_cost' = 'normal';
      if (cpkMadDec.lessThan(6.0)) {
        efficiencyRating = 'excellent';
      } else if (cpkMadDec.greaterThan(8.5)) {
        efficiencyRating = 'high_cost';
      }

      truckMetrics.push({
        truckId: truck.id,
        truckPlate: truck.plate_number,
        truckModel: truck.model || 'TIR Truck',
        totalDistanceKm: totalKmNum,
        fuelCostMad: Math.round(fuelCostMadDec.toNumber() * 100) / 100,
        fuelCostEur: Math.round(fuelCostEurDec.toNumber() * 100) / 100,
        maintenanceCostMad: Math.round(maintenanceCostMadDec.toNumber() * 100) / 100,
        maintenanceCostEur: Math.round(maintenanceCostEurDec.toNumber() * 100) / 100,
        tollsAndFerryCostMad: Math.round(tollsAndFerryCostMadDec.toNumber() * 100) / 100,
        tollsAndFerryCostEur: Math.round(tollsAndFerryCostEurDec.toNumber() * 100) / 100,
        totalOperatingCostMad: Math.round(totalOperatingCostMadDec.toNumber() * 100) / 100,
        totalOperatingCostEur: Math.round(totalOperatingCostEurDec.toNumber() * 100) / 100,
        cpkMad: Math.round(cpkMadDec.toNumber() * 100) / 100,
        cpkEur: Math.round(cpkEurDec.toNumber() * 100) / 100,
        fuelCpkMad: Math.round(fuelCpkMadDec.toNumber() * 100) / 100,
        maintenanceCpkMad: Math.round(maintenanceCpkMadDec.toNumber() * 100) / 100,
        efficiencyRating,
      });
    }

    const fleetDistanceNum = fleetTotalDistanceDec.toNumber();
    const averageFleetCpkMad = fleetDistanceNum > 0
      ? fleetTotalCostMadDec.dividedBy(fleetTotalDistanceDec).toNumber()
      : 0;

    const averageFleetCpkEur = averageFleetCpkMad > 0
      ? new Decimal(averageFleetCpkMad).dividedBy(DEFAULT_EUR_RATE).toNumber()
      : 0;

    return {
      success: true,
      currency: 'MAD',
      totalFleetKm: Math.round(fleetDistanceNum),
      totalOperatingCostMad: Math.round(fleetTotalCostMadDec.toNumber() * 100) / 100,
      totalOperatingCostEur: Math.round(fleetTotalCostMadDec.dividedBy(DEFAULT_EUR_RATE).toNumber() * 100) / 100,
      averageFleetCpkMad: Math.round(averageFleetCpkMad * 100) / 100,
      averageFleetCpkEur: Math.round(averageFleetCpkEur * 100) / 100,
      trucks: truckMetrics,
    };
  } catch (error) {
    console.error('Error in calculateFleetCpk:', error);
    return {
      success: false,
      currency: 'MAD',
      totalFleetKm: 0,
      totalOperatingCostMad: 0,
      totalOperatingCostEur: 0,
      averageFleetCpkMad: 0,
      averageFleetCpkEur: 0,
      trucks: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

