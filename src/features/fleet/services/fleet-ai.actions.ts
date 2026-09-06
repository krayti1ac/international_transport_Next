'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import type { TruckMaintenance, TrailerMaintenance, TripOrder, Truck, Trailer } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface AIInsight {
  type: 'success' | 'warning' | 'critical' | 'info';
  category: 'fuel' | 'engine' | 'maintenance' | 'usage';
  message: string;
}

export interface FleetAIReport {
  success: boolean;
  healthScore: number;
  fuelEfficiencyStatus: 'efficient' | 'normal' | 'high' | 'unknown';
  averageLitersPer100Km?: number;
  consumptionVariancePercent?: number;
  insights: AIInsight[];
  recentMaintenanceCost: number;
  tripsCount: number;
  lastServiceDate?: string;
  error?: string;
}

export async function generateVehicleAIReport(
  vehicleId: number,
  type: 'truck' | 'trailer' = 'truck'
): Promise<FleetAIReport> {
  try {
    const supabase = await createClient();
    const insights: AIInsight[] = [];
    let healthScore = 100;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateLimit = sixMonthsAgo.toISOString().split('T')[0];

    const foreignKey = type === 'truck' ? 'truck_id' : 'trailer_id';
    const maintenanceTable = type === 'truck' ? 'truck_maintenance' : 'trailer_maintenance';
    const vehicleTable = type === 'truck' ? 'trucks' : 'trailers';

    const [vehicleRes, maintRes, tripsRes] = await Promise.all([
      supabase.from(vehicleTable).select('*').eq('id', vehicleId).single(),
      supabase
        .from(maintenanceTable)
        .select('*')
        .eq(foreignKey, vehicleId)
        .gte(type === 'truck' ? 'maintenance_date' : 'date', dateLimit)
        .order(type === 'truck' ? 'maintenance_date' : 'date', { ascending: false }),
      supabase
        .from('trip_orders')
        .select('*')
        .eq(foreignKey, vehicleId)
        .gte('departure_date', dateLimit)
        .order('departure_date', { ascending: false }),
    ]);

    if (vehicleRes.error || !vehicleRes.data) {
      return {
        success: false,
        healthScore: 0,
        fuelEfficiencyStatus: 'unknown',
        insights: [],
        recentMaintenanceCost: 0,
        tripsCount: 0,
        error: 'تعذر العثور على بيانات المركبة',
      };
    }

    const vehicle = vehicleRes.data as Truck | Trailer;
    const typedMaintenanceRecords = type === 'truck'
      ? (maintRes.data || []) as TruckMaintenance[]
      : (maintRes.data || []) as TrailerMaintenance[];
    const maintenanceRecords = typedMaintenanceRecords;
    const trips = (tripsRes.data || []) as TripOrder[];

    const recentMaintenanceCost = maintenanceRecords.reduce(
      (sum, r) => sum.plus(new Decimal(r.amount || 0)),
      new Decimal(0)
    );
    const recentMaintenanceCostNum = parseFloat(recentMaintenanceCost.toFixed(2));

    const getExpenseType = (r: TruckMaintenance | TrailerMaintenance): string => {
      if ('expense_type' in r && r.expense_type) return r.expense_type;
      return r.type || '';
    };

    const repairRecords = maintenanceRecords.filter((r) => {
      const expType = getExpenseType(r).toLowerCase();
      return expType !== 'fuel' && expType !== 'carburant' && expType !== 'gasoil';
    });

    if (repairRecords.length >= 4) {
      healthScore -= 25;
      insights.push({
        type: 'critical',
        category: 'maintenance',
        message: `خضعت الشاحنة لـ ${repairRecords.length} إصلاحات خلال 6 أشهر، مما يشير إلى تكرار الأعطال الميكانيكية واقتراب عمر بعض القطع الحيوية.`,
      });
    } else if (repairRecords.length >= 2) {
      healthScore -= 10;
      insights.push({
        type: 'warning',
        category: 'maintenance',
        message: 'معدل زيارات الورشة أعلى من المتوسط السنوي المعتاد.',
      });
    } else if (repairRecords.length === 0 && trips.length >= 5) {
      healthScore -= 5;
      insights.push({
        type: 'info',
        category: 'maintenance',
        message: 'أكملت المركبة أكثر من 5 رحلات دولية دون أي فحص وقائي دوري. يُنصح بجدولة تغيير الزيت وفحص دورة التبريد.',
      });
    }

    let fuelEfficiencyStatus: 'efficient' | 'normal' | 'high' | 'unknown' = 'unknown';
    let averageLitersPer100Km: number | undefined;
    let consumptionVariancePercent: number | undefined;

    if (type === 'truck') {
      const fuelEntries = maintenanceRecords.filter((r) => {
        const expType = getExpenseType(r).toLowerCase();
        return expType === 'fuel' || expType === 'carburant' || expType === 'gasoil';
      });

      const totalFuelAmount = fuelEntries.reduce(
        (sum, f) => sum.plus(new Decimal(f.amount || 0)),
        new Decimal(0)
      );

      const estimatedTotalDistance = trips.length > 0 ? trips.length * 1800 : 0;
      const estimatedLiters = totalFuelAmount.greaterThan(0) ? totalFuelAmount.dividedBy(12.5) : new Decimal(0);

      if (estimatedTotalDistance > 0 && estimatedLiters.greaterThan(0)) {
        averageLitersPer100Km = parseFloat(estimatedLiters.dividedBy(estimatedTotalDistance).times(100).toFixed(1));

        if (averageLitersPer100Km < 31) {
          fuelEfficiencyStatus = 'efficient';
          insights.push({
            type: 'success',
            category: 'fuel',
            message: `معدل استهلاك ممتاز (${averageLitersPer100Km} L/100 km) يعكس كفاءة المحرك وسلاسة أسلوب القيادة.`,
          });
        } else if (averageLitersPer100Km <= 35) {
          fuelEfficiencyStatus = 'normal';
          insights.push({
            type: 'success',
            category: 'fuel',
            message: `معدل الاستهلاك طبيعي (${averageLitersPer100Km} L/100 km) وضمن الحدود القياسية المعتمدة.`,
          });
        } else {
          fuelEfficiencyStatus = 'high';
          healthScore -= 20;
          insights.push({
            type: 'critical',
            category: 'fuel',
            message: `ارتفاع ملحوظ في استهلاك الوقود (${averageLitersPer100Km} L/100 km). يُحتمل وجود انسداد في فلاتر الهواء أو خلل بنظام البخاخات (Injecteurs).`,
          });
        }
      }

      if (fuelEntries.length >= 4) {
        const midPoint = Math.floor(fuelEntries.length / 2);
        const olderEntries = fuelEntries.slice(midPoint);
        const recentEntries = fuelEntries.slice(0, midPoint);

        const olderAvg = olderEntries.reduce((s, e) => s.plus(new Decimal(e.amount || 0)), new Decimal(0)).dividedBy(olderEntries.length);
        const recentAvg = recentEntries.reduce((s, e) => s.plus(new Decimal(e.amount || 0)), new Decimal(0)).dividedBy(recentEntries.length);

        if (olderAvg.greaterThan(0)) {
          consumptionVariancePercent = parseFloat(recentAvg.minus(olderAvg).dividedBy(olderAvg).times(100).toFixed(1));
          if (consumptionVariancePercent > 15) {
            healthScore -= 15;
            insights.push({
              type: 'warning',
              category: 'fuel',
              message: `اكتشف النظام قفزة بنسبة ${consumptionVariancePercent}% في الإنفاق على الديزل مؤخراً. تأكد من ضغط الإطارات أو ضبط مسارات التزود.`,
            });
          }
        }
      }
    }

    if (trips.length >= 12) {
      healthScore -= 5;
      insights.push({
        type: 'info',
        category: 'usage',
        message: `ضغط تشغيلي مرتفع (${trips.length} رحلة خلال نصف سنة). يرجى إخضاع نظام التعليق والفرامل لفحص وقائي.`,
      });
    }

    if (vehicle.status === 'maintenance' || vehicle.status === 'inactive') {
      healthScore -= 30;
      insights.push({
        type: 'critical',
        category: 'engine',
        message: 'المركبة متوقفة حالياً في الورشة أو معطلة عن الخدمة.',
      });
    }

    healthScore = Math.max(10, Math.min(100, healthScore));

    return {
      success: true,
      healthScore,
      fuelEfficiencyStatus,
      averageLitersPer100Km,
      consumptionVariancePercent,
      insights,
      recentMaintenanceCost: recentMaintenanceCostNum,
      tripsCount: trips.length,
      lastServiceDate: type === 'truck'
        ? (maintenanceRecords[0] as TruckMaintenance | undefined)?.maintenance_date
        : (maintenanceRecords[0] as TrailerMaintenance | undefined)?.date,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل توليد التحليل التنبؤي';
    return {
      success: false,
      healthScore: 0,
      fuelEfficiencyStatus: 'unknown',
      insights: [],
      recentMaintenanceCost: 0,
      tripsCount: 0,
      error: message,
    };
  }
}
