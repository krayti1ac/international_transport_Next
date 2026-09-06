'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { Invoice, TripOrder, Truck, TruckMaintenance } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ExecutiveKpiSummary {
  periodStart: string;
  periodEnd: string;
  totalRevenueMAD: number;
  totalRevenueEUR: number;
  netProfitMAD: number;
  profitMarginPercent: number;
  totalTripsCount: number;
  completedTripsCount: number;
  activeTripsCount: number;
  fleetUtilizationRate: number;
  activeTrucksCount: number;
  totalTrucksCount: number;
  totalOverdueDebtMAD: number;
  unpaidInvoicesCount: number;
  fleetAverageLitersPer100Km: number;
}

export async function getExecutiveKpis(
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: ExecutiveKpiSummary; error?: string }> {
  try {
    const supabase = await createClient();

    const now = new Date();
    const firstDay = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [invoicesRes, tripsRes, trucksRes, fuelRes, advancesRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('*')
        .gte('issue_date', firstDay)
        .lte('issue_date', lastDay),
      supabase
        .from('trip_orders')
        .select('*')
        .gte('departure_date', firstDay)
        .lte('departure_date', lastDay),
      supabase.from('trucks').select('id, status'),
      supabase
        .from('truck_maintenance')
        .select('*')
        .gte('maintenance_date', firstDay)
        .lte('maintenance_date', lastDay),
      supabase
        .from('advances')
        .select('amount')
        .gte('date', firstDay)
        .lte('date', lastDay),
    ]);

    const invoices = (invoicesRes.data || []) as Invoice[];
    const trips = (tripsRes.data || []) as TripOrder[];
    const trucks = (trucksRes.data || []) as Truck[];
    const fuelRecords = ((fuelRes.data || []) as TruckMaintenance[]).filter(
      (m) => (m.expense_type || m.type || '').toLowerCase() === 'fuel'
    );
    const advances = advancesRes.data || [];

    let revMAD = new Decimal(0);
    let revEUR = new Decimal(0);
    let overdueMAD = new Decimal(0);
    let unpaidCount = 0;

    invoices.forEach((inv) => {
      const total = new Decimal(inv.total_amount || 0);
      const paid = new Decimal(inv.paid_amount || 0);
      const due = total.minus(paid);

      if (inv.currency === 'EUR') {
        revEUR = revEUR.plus(total);
      } else {
        revMAD = revMAD.plus(total);
      }

      if (due.gt(0)) {
        unpaidCount++;
        overdueMAD = overdueMAD.plus(due);
      }
    });

    const totalFuelExpenses = fuelRecords.reduce(
      (sum, f) => sum.plus(new Decimal(f.amount || 0)),
      new Decimal(0)
    );
    const totalAdvances = advances.reduce(
      (sum, a) => sum.plus(new Decimal(a.amount || 0)),
      new Decimal(0)
    );

    const totalOperatingCost = totalFuelExpenses.plus(totalAdvances);
    const netProfit = revMAD.minus(totalOperatingCost);
    const profitMargin = revMAD.gt(0)
      ? netProfit.div(revMAD).times(100).toNumber()
      : 0;

    const totalTrucks = trucks.length || 1;
    const activeTrucks = trucks.filter((t) => t.status === 'active').length;
    const fleetUtilization = Math.round((activeTrucks / totalTrucks) * 100);

    const estimatedKm = trips.length * 1850;
    const estimatedLiters = totalFuelExpenses.gt(0)
      ? totalFuelExpenses.div(12.5).toNumber()
      : 0;
    const avgFuel = estimatedKm > 0
      ? parseFloat(((estimatedLiters / estimatedKm) * 100).toFixed(1))
      : 34.0;

    return {
      success: true,
      data: {
        periodStart: firstDay,
        periodEnd: lastDay,
        totalRevenueMAD: revMAD.toNumber(),
        totalRevenueEUR: revEUR.toNumber(),
        netProfitMAD: netProfit.toNumber(),
        profitMarginPercent: parseFloat(profitMargin.toFixed(1)),
        totalTripsCount: trips.length,
        completedTripsCount: trips.filter((t) => t.status === 'completed' || t.status === 'settled').length,
        activeTripsCount: trips.filter((t) => t.status === 'in_transit' || t.status === 'customs_export').length,
        fleetUtilizationRate: fleetUtilization,
        activeTrucksCount: activeTrucks,
        totalTrucksCount: trucks.length,
        totalOverdueDebtMAD: overdueMAD.toNumber(),
        unpaidInvoicesCount: unpaidCount,
        fleetAverageLitersPer100Km: avgFuel,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل احتساب المؤشرات التنفيذية';
    return { success: false, error: message };
  }
}
