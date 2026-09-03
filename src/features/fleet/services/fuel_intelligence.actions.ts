'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { calculateDistance } from '@/lib/geofence';
import type { TruckMaintenance, TruckLocationHistory } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM = 35;

export interface TruckFuelStats {
  truckId: number;
  truckName: string;
  totalLiters: number;
  totalDistanceKm: number;
  lPer100km: number;
  receiptsCount: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface FuelAnomaly {
  id: number;
  truckId: number;
  truckName: string;
  date: string;
  liters: number;
  distanceKm: number;
  lPer100km: number;
  location: string;
  notes: string;
  severity: 'high' | 'medium' | 'low';
}

export async function calculateFuelAnalytics(): Promise<{
  success: boolean;
  trucks?: TruckFuelStats[];
  anomalies?: FuelAnomaly[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: trucks, error: trucksError } = await supabase
      .from('trucks')
      .select('id, plate_number, model')
      .order('plate_number');

    if (trucksError) throw trucksError;

    const { data: fuelReceipts, error: fuelError } = await supabase
      .from('truck_maintenance')
      .select('*')
      .eq('type', 'fuel')
      .order('truck_id')
      .order('date');

    if (fuelError) throw fuelError;

    const { data: locations, error: locError } = await supabase
      .from('truck_location_history')
      .select('*')
      .order('truck_id')
      .order('timestamp');

    if (locError) throw locError;

    const locationsByTruck: Record<number, TruckLocationHistory[]> = {};
    for (const loc of locations || []) {
      if (!locationsByTruck[loc.truck_id]) {
        locationsByTruck[loc.truck_id] = [];
      }
      locationsByTruck[loc.truck_id].push(loc);
    }

    const receiptsByTruck: Record<number, TruckMaintenance[]> = {};
    for (const receipt of fuelReceipts || []) {
      if (!receiptsByTruck[receipt.truck_id]) {
        receiptsByTruck[receipt.truck_id] = [];
      }
      receiptsByTruck[receipt.truck_id].push(receipt);
    }

    const truckStats: TruckFuelStats[] = [];
    const anomalies: FuelAnomaly[] = [];

    for (const truck of trucks || []) {
      const receipts = receiptsByTruck[truck.id] || [];
      if (receipts.length === 0) continue;

      let totalLiters = new Decimal(0);
      let totalDistance = new Decimal(0);

      const truckLocations = locationsByTruck[truck.id] || [];

      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        const liters = new Decimal(receipt.amount || 0);
        totalLiters = totalLiters.plus(liters);

        const receiptDate = new Date(receipt.date);
        const relevantLocations = truckLocations.filter(loc => {
          const locDate = new Date(loc.timestamp);
          const diffDays = (receiptDate.getTime() - locDate.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= -1 && diffDays <= 1;
        });

        if (relevantLocations.length >= 2) {
          let tripDistance = new Decimal(0);
          for (let j = 1; j < relevantLocations.length; j++) {
            const prev = relevantLocations[j - 1];
            const curr = relevantLocations[j];
            const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            tripDistance = tripDistance.plus(dist);
          }
          totalDistance = totalDistance.plus(tripDistance);
        }
      }

      const distanceNum = totalDistance.toNumber();
      const lPer100km = distanceNum > 0 ? (totalLiters.toNumber() / distanceNum) * 100 : 0;

      let status: TruckFuelStats['status'] = 'normal';
      if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 1.5) {
        status = 'critical';
      } else if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
        status = 'warning';
      }

      truckStats.push({
        truckId: truck.id,
        truckName: `${truck.plate_number} (${truck.model})`,
        totalLiters: parseFloat(totalLiters.toFixed(2)),
        totalDistanceKm: parseFloat(totalDistance.toFixed(2)),
        lPer100km: parseFloat(new Decimal(lPer100km).toFixed(2)),
        receiptsCount: receipts.length,
        status,
      });

      for (const receipt of receipts) {
        const liters = new Decimal(receipt.amount || 0);
        const receiptDate = new Date(receipt.date);
        const relevantLocations = truckLocations.filter(loc => {
          const locDate = new Date(loc.timestamp);
          const diffDays = (receiptDate.getTime() - locDate.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= -1 && diffDays <= 1;
        });

        let distanceForReceipt = new Decimal(0);
        if (relevantLocations.length >= 2) {
          for (let j = 1; j < relevantLocations.length; j++) {
            const prev = relevantLocations[j - 1];
            const curr = relevantLocations[j];
            const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            distanceForReceipt = distanceForReceipt.plus(dist);
          }
        }

        const distNum = distanceForReceipt.toNumber();
        const receiptLPer100km = distNum > 0 ? (liters.toNumber() / distNum) * 100 : liters.toNumber();

        if (receiptLPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
          let severity: FuelAnomaly['severity'] = 'medium';
          if (receiptLPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 2) {
            severity = 'high';
          } else if (receiptLPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 1.5) {
            severity = 'high';
          } else {
            severity = 'medium';
          }

          anomalies.push({
            id: receipt.id,
            truckId: truck.id,
            truckName: `${truck.plate_number} (${truck.model})`,
            date: receipt.date,
            liters: parseFloat(liters.toFixed(2)),
            distanceKm: parseFloat(distanceForReceipt.toFixed(2)),
            lPer100km: parseFloat(new Decimal(receiptLPer100km).toFixed(2)),
            location: receipt.notes || 'Unknown',
            notes: ` consommation élevée détectée: ${new Decimal(receiptLPer100km).toFixed(2)} L/100km`,
            severity,
          });
        }
      }
    }

    return {
      success: true,
      trucks: truckStats,
      anomalies,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate fuel analytics';
    return { success: false, error: message };
  }
}

export async function detectFuelAnomalies(truckId?: number): Promise<{
  success: boolean;
  anomalies?: FuelAnomaly[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('truck_maintenance')
      .select('*')
      .eq('type', 'fuel')
      .order('truck_id')
      .order('date');

    if (truckId) {
      query = query.eq('truck_id', truckId);
    }

    const { data: receipts, error } = await query;

    if (error) throw error;

    const { data: locations } = await supabase
      .from('truck_location_history')
      .select('*')
      .order('truck_id')
      .order('timestamp');

    const locationsByTruck: Record<number, TruckLocationHistory[]> = {};
    for (const loc of locations || []) {
      if (!locationsByTruck[loc.truck_id]) locationsByTruck[loc.truck_id] = [];
      locationsByTruck[loc.truck_id].push(loc);
    }

    const anomalies: FuelAnomaly[] = [];

    for (const receipt of receipts || []) {
      const liters = new Decimal(receipt.amount || 0);
      const receiptDate = new Date(receipt.date);
      const relevantLocations = (locationsByTruck[receipt.truck_id] || []).filter(loc => {
        const locDate = new Date(loc.timestamp);
        const diffDays = (receiptDate.getTime() - locDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= -1 && diffDays <= 1;
      });

      let distance = new Decimal(0);
      if (relevantLocations.length >= 2) {
        for (let j = 1; j < relevantLocations.length; j++) {
          const prev = relevantLocations[j - 1];
          const curr = relevantLocations[j];
          const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
          distance = distance.plus(dist);
        }
      }

      const distKm = distance.toNumber();
      const lPer100km = distKm > 0 ? (liters.toNumber() / distKm) * 100 : liters.toNumber();

      if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
        let severity: FuelAnomaly['severity'] = 'medium';
        if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 2) severity = 'high';
        else if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 1.5) severity = 'high';

        anomalies.push({
          id: receipt.id,
          truckId: receipt.truck_id,
          truckName: `Truck #${receipt.truck_id}`,
          date: receipt.date,
          liters: parseFloat(liters.toFixed(2)),
          distanceKm: parseFloat(distance.toFixed(2)),
          lPer100km: parseFloat(new Decimal(lPer100km).toFixed(2)),
          location: receipt.notes || 'Unknown',
          notes: `Potential leak or anomaly: ${new Decimal(lPer100km).toFixed(2)} L/100km exceeds threshold of ${HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM}`,
          severity,
        });
      }
    }

    return { success: true, anomalies };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to detect fuel anomalies';
    return { success: false, error: message };
  }
}
