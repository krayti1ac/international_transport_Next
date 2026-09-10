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

export interface ExecutiveMetrics {
  totalRevenueMAD: number;
  totalRevenueEUR: number;
  outstandingDebtMAD: number;
  outstandingDebtEUR: number;
  fleetStatus: { active: number; in_transit: number; maintenance: number; inactive: number };
  monthlyTrend: { name: string; revenue: number; expenses: number }[];
}

export async function getExecutiveMetrics(
  startDate?: string,
  endDate?: string
): Promise<ExecutiveMetrics> {
  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    name: new Date(currentYear, i).toLocaleString('ar-MA', { month: 'short' }),
    revenue: 0,
    expenses: 0,
  }));

  let totalRevenueMAD = new Decimal(0);
  let totalRevenueEUR = new Decimal(0);
  let outstandingDebtMAD = new Decimal(0);
  let outstandingDebtEUR = new Decimal(0);

  // 1. تحليل الفواتير (الإيرادات والديون)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total_amount, paid_amount, currency, status, issue_date');

  if (invoices) {
    invoices.forEach((inv) => {
      if (startDate && endDate) {
        const d = inv.issue_date || (inv as any).created_at;
        if (!d || d < startDate || d > endDate) return;
      }

      const total = new Decimal(inv.total_amount || 0);
      const paid = new Decimal(inv.paid_amount || 0);
      const debt = total.minus(paid);
      const isEUR = inv.currency === 'EUR';

      if (inv.status !== 'cancelled') {
        if (isEUR) totalRevenueEUR = totalRevenueEUR.plus(total);
        else totalRevenueMAD = totalRevenueMAD.plus(total);

        if (inv.issue_date) {
          const date = new Date(inv.issue_date);
          if (date.getFullYear() === currentYear) {
            monthlyData[date.getMonth()].revenue += isEUR ? total.times(10.8).toNumber() : total.toNumber();
          }
        }
      }

      if (['unpaid', 'partially_paid', 'overdue'].includes(inv.status || '')) {
        if (isEUR) outstandingDebtEUR = outstandingDebtEUR.plus(debt);
        else outstandingDebtMAD = outstandingDebtMAD.plus(debt);
      }
    });
  }

  // 2. تحليل المصروفات التشغيلية
  const { data: expenses } = await supabase
    .from('treasury_transactions')
    .select('amount, currency, created_at')
    .eq('type', 'expense');

  if (expenses) {
    expenses.forEach((exp) => {
      if (startDate && endDate) {
        const d = exp.created_at;
        if (!d || d < startDate || d > endDate) return;
      }

      const date = new Date(exp.created_at);
      if (date.getFullYear() === currentYear) {
        const amount = new Decimal(exp.amount || 0).abs();
        const amountInMAD = exp.currency === 'EUR' ? amount.times(10.8).toNumber() : amount.toNumber();
        monthlyData[date.getMonth()].expenses += amountInMAD;
      }
    });
  }

  // 3. حالة الأسطول الحية
  const { data: trucks } = await supabase.from('trucks').select('status');
  const fleetStatus = { active: 0, in_transit: 0, maintenance: 0, inactive: 0 };

  if (trucks) {
    trucks.forEach((t) => {
      const status = t.status as keyof typeof fleetStatus;
      if (fleetStatus[status] !== undefined) fleetStatus[status]++;
    });
  }

  return {
    totalRevenueMAD: totalRevenueMAD.toNumber(),
    totalRevenueEUR: totalRevenueEUR.toNumber(),
    outstandingDebtMAD: outstandingDebtMAD.toNumber(),
    outstandingDebtEUR: outstandingDebtEUR.toNumber(),
    fleetStatus,
    monthlyTrend: monthlyData.map((d) => ({
      ...d,
      revenue: Math.round(d.revenue),
      expenses: Math.round(d.expenses),
    })),
  };
}

