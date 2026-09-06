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

export interface FuelAnalyticsResponse {
  success: boolean;
  trucks?: TruckFuelStats[];
  anomalies?: FuelAnomaly[];
  totalTrucks?: number;
  error?: string;
}

export async function calculateFuelAnalytics(): Promise<FuelAnalyticsResponse> {
  try {
    const supabase = await createClient();

    const { data: trucks, error: trucksError } = await supabase
      .from('trucks')
      .select('id, plate_number, model')
      .order('plate_number');

    if (trucksError) throw trucksError;

    // Resiliently fetch truck maintenance records without relying on 'type' or 'date' columns
    const { data: maintenanceRows, error: fuelError } = await supabase
      .from('truck_maintenance')
      .select('*');

    if (fuelError) throw fuelError;

    // Filter fuel receipts in memory (supports expense_type, type, carburant, gasoil, etc.)
    const fuelReceipts = (maintenanceRows || []).filter((receipt: any) => {
      const expType = (receipt.expense_type || receipt.type || '').toString().toLowerCase();
      return expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
    });

    // Sort receipts by truck_id, then by maintenance date
    fuelReceipts.sort((a: any, b: any) => {
      const truckDiff = (a.truck_id || 0) - (b.truck_id || 0);
      if (truckDiff !== 0) return truckDiff;
      const dateA = new Date(a.maintenance_date || a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.maintenance_date || b.date || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    const { data: locations, error: locError } = await supabase
      .from('truck_locations')
      .select('*')
      .order('truck_id')
      .order('recorded_at');

    if (locError) throw locError;

    const locationsByTruck: Record<number, TruckLocationHistory[]> = {};
    for (const loc of locations || []) {
      if (!locationsByTruck[loc.truck_id]) {
        locationsByTruck[loc.truck_id] = [];
      }
      locationsByTruck[loc.truck_id].push({
        ...loc,
        timestamp: loc.timestamp || loc.recorded_at,
        recorded_at: loc.recorded_at || loc.timestamp,
      });
    }

    const receiptsByTruck: Record<number, TruckMaintenance[]> = {};
    for (const receipt of fuelReceipts) {
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

        const receiptDateStr = receipt.maintenance_date || receipt.date || receipt.created_at || '';
        const receiptDate = new Date(receiptDateStr);
        const receiptTime = receiptDate.getTime();
        const hasValidDate = !isNaN(receiptTime);

        const relevantLocations = hasValidDate
          ? truckLocations.filter((loc) => {
              const locDate = new Date(loc.timestamp || loc.recorded_at || 0);
              const locTime = locDate.getTime();
              if (isNaN(locTime)) return false;
              const diffDays = Math.abs(receiptTime - locTime) / (1000 * 60 * 60 * 24);
              return diffDays <= 1;
            })
          : [];

        let distanceForReceipt = new Decimal(0);
        if (relevantLocations.length >= 2) {
          for (let j = 1; j < relevantLocations.length; j++) {
            const prev = relevantLocations[j - 1];
            const curr = relevantLocations[j];
            if (
              typeof prev.latitude === 'number' &&
              typeof prev.longitude === 'number' &&
              typeof curr.latitude === 'number' &&
              typeof curr.longitude === 'number'
            ) {
              const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
              if (!isNaN(dist) && isFinite(dist)) {
                distanceForReceipt = distanceForReceipt.plus(new Decimal(dist));
              }
            }
          }
          totalDistance = totalDistance.plus(distanceForReceipt);
        }

        // Decimal.js calculation for receipt fuel consumption
        const receiptLPer100km = distanceForReceipt.greaterThan(0)
          ? liters.dividedBy(distanceForReceipt).times(100).toNumber()
          : 0;

        if (distanceForReceipt.greaterThan(0) && receiptLPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
          let severity: FuelAnomaly['severity'] = 'low';
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
            truckName: `${truck.plate_number}${truck.model ? ` (${truck.model})` : ''}`,
            date: receiptDateStr,
            liters: parseFloat(liters.toFixed(2)),
            distanceKm: parseFloat(distanceForReceipt.toFixed(2)),
            lPer100km: parseFloat(new Decimal(receiptLPer100km).toFixed(2)),
            location: receipt.description || receipt.notes || 'غير محدد',
            notes: `استهلاك مرتفع غير معتاد: ${new Decimal(receiptLPer100km).toFixed(2)} لتر/100كم`,
            severity,
          });
        }
      }

      // Decimal.js calculation for overall truck fuel consumption
      const lPer100km = totalDistance.greaterThan(0)
        ? totalLiters.dividedBy(totalDistance).times(100).toNumber()
        : 0;

      let status: TruckFuelStats['status'] = 'normal';
      if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 1.5) {
        status = 'critical';
      } else if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
        status = 'warning';
      }

      truckStats.push({
        truckId: truck.id,
        truckName: `${truck.plate_number}${truck.model ? ` (${truck.model})` : ''}`,
        totalLiters: parseFloat(totalLiters.toFixed(2)),
        totalDistanceKm: parseFloat(totalDistance.toFixed(2)),
        lPer100km: parseFloat(new Decimal(lPer100km).toFixed(2)),
        receiptsCount: receipts.length,
        status,
      });
    }

    return {
      success: true,
      trucks: truckStats,
      anomalies,
      totalTrucks: (trucks || []).length,
    };
  } catch (err: unknown) {
    console.error('Fuel intelligence error:', err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'فشل في حساب تحليلات الوقود';
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

    let query = supabase.from('truck_maintenance').select('*');
    if (truckId) {
      query = query.eq('truck_id', truckId);
    }

    const { data: maintenanceRows, error } = await query;
    if (error) throw error;

    const receipts = (maintenanceRows || []).filter((receipt: any) => {
      const expType = (receipt.expense_type || receipt.type || '').toString().toLowerCase();
      return expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
    });

    receipts.sort((a: any, b: any) => {
      const truckDiff = (a.truck_id || 0) - (b.truck_id || 0);
      if (truckDiff !== 0) return truckDiff;
      const dateA = new Date(a.maintenance_date || a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.maintenance_date || b.date || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    // Also fetch trucks to map real truck names
    const { data: trucksData } = await supabase.from('trucks').select('id, plate_number, model');
    const truckNameMap = new Map<number, string>();
    for (const t of trucksData || []) {
      truckNameMap.set(t.id, `${t.plate_number}${t.model ? ` (${t.model})` : ''}`);
    }

    const { data: locations } = await supabase
      .from('truck_locations')
      .select('*')
      .order('truck_id')
      .order('recorded_at');

    const locationsByTruck: Record<number, TruckLocationHistory[]> = {};
    for (const loc of locations || []) {
      if (!locationsByTruck[loc.truck_id]) locationsByTruck[loc.truck_id] = [];
      locationsByTruck[loc.truck_id].push({
        ...loc,
        timestamp: loc.timestamp || loc.recorded_at,
        recorded_at: loc.recorded_at || loc.timestamp,
      });
    }

    const anomalies: FuelAnomaly[] = [];

    for (const receipt of receipts) {
      const liters = new Decimal(receipt.amount || 0);
      const receiptDateStr = receipt.maintenance_date || receipt.date || receipt.created_at || '';
      const receiptDate = new Date(receiptDateStr);
      const receiptTime = receiptDate.getTime();
      const hasValidDate = !isNaN(receiptTime);

      const relevantLocations = hasValidDate
        ? (locationsByTruck[receipt.truck_id] || []).filter((loc) => {
            const locDate = new Date(loc.timestamp || loc.recorded_at || '');
            const locTime = locDate.getTime();
            if (isNaN(locTime)) return false;
            const diffDays = Math.abs(receiptTime - locTime) / (1000 * 60 * 60 * 24);
            return diffDays <= 1;
          })
        : [];

      let distance = new Decimal(0);
      if (relevantLocations.length >= 2) {
        for (let j = 1; j < relevantLocations.length; j++) {
          const prev = relevantLocations[j - 1];
          const curr = relevantLocations[j];
          if (
            typeof prev.latitude === 'number' &&
            typeof prev.longitude === 'number' &&
            typeof curr.latitude === 'number' &&
            typeof curr.longitude === 'number'
          ) {
            const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            if (!isNaN(dist) && isFinite(dist)) {
              distance = distance.plus(new Decimal(dist));
            }
          }
        }
      }

      // Only evaluate anomalies if distance > 0 to avoid false positives on receipts without GPS data
      if (distance.greaterThan(0)) {
        const lPer100km = liters.dividedBy(distance).times(100).toNumber();

        if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM) {
          let severity: FuelAnomaly['severity'] = 'medium';
          if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 2) severity = 'high';
          else if (lPer100km > HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM * 1.5) severity = 'high';

          anomalies.push({
            id: receipt.id,
            truckId: receipt.truck_id,
            truckName: truckNameMap.get(receipt.truck_id) || `شاحنة #${receipt.truck_id}`,
            date: receiptDateStr,
            liters: parseFloat(liters.toFixed(2)),
            distanceKm: parseFloat(distance.toFixed(2)),
            lPer100km: parseFloat(new Decimal(lPer100km).toFixed(2)),
            location: receipt.description || receipt.notes || 'غير محدد',
            notes: `شبهة تسريب أو استهلاك مفرط: ${new Decimal(lPer100km).toFixed(2)} لتر/100كم (الحد الأقصى: ${HIGH_CONSUMPTION_THRESHOLD_L_PER_100KM})`,
            severity,
          });
        }
      }
    }

    return { success: true, anomalies };
  } catch (err: unknown) {
    console.error('Detect fuel anomalies error:', err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'فشل في كشف الشذوذ في الوقود';
    return { success: false, error: message };
  }
}
