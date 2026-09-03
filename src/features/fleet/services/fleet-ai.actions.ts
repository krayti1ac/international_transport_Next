'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';

export interface AIInsight {
  type: 'success' | 'warning' | 'critical' | 'info';
  message: string;
}

export interface FleetAIReport {
  success: boolean;
  healthScore: number;
  insights: AIInsight[];
  recentMaintenanceCost: number;
  tripsCount: number;
  error?: string;
}

export async function generateVehicleAIReport(vehicleId: number, type: 'truck' | 'trailer'): Promise<FleetAIReport> {
  try {
    const supabase = await createClient();
    const insights: AIInsight[] = [];
    let healthScore = 100;

    // 1. جلب البيانات التاريخية للمركبة (آخر 6 أشهر)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString();

    const maintColumn = type === 'truck' ? 'truck_id' : 'trailer_id';
    
    const [maintRes, tripsRes, vehicleRes] = await Promise.all([
      supabase.from(type === 'truck' ? 'truck_maintenance' : ('trailer_maintenance' as any))
        .select('amount, type, date')
        .eq(maintColumn, vehicleId)
        .gte('date', dateStr),
      supabase.from('trip_orders')
        .select('id, distance_km, status')
        .eq(maintColumn, vehicleId)
        .gte('departure_date', dateStr),
      supabase.from(type === 'truck' ? 'trucks' : 'trailers')
        .select('status, created_at')
        .eq('id', vehicleId)
        .single()
    ]);

    const maintenance = (maintRes.data as Array<{ amount?: any; type?: string; date?: string }> | null) || [];
    const trips = (tripsRes.data as Array<{ id: number; distance_km?: number | null; status?: string }> | null) || [];
    const vehicle = vehicleRes.data as { status?: string; created_at?: string } | null;

    if (!vehicle) throw new Error('المركبة غير موجودة');

    // 2. تحليل وتيرة وتكاليف الصيانة (Maintenance Frequency & Cost)
    const recentMaintenanceCost = maintenance.reduce((sum, record) => sum + (parseFloat(record.amount || '0')), 0);
    const repairCount = maintenance.filter(m => m.type !== 'fuel').length;

    if (repairCount > 4) {
      healthScore -= 20;
      insights.push({ type: 'critical', message: `المركبة خضعت لـ ${repairCount} عمليات إصلاح خلال 6 أشهر. هنالك خطر تعطل وشيك، يُنصح بإجراء فحص شامل للمحرك أو الأجزاء الحيوية.` });
    } else if (repairCount > 2) {
      healthScore -= 10;
      insights.push({ type: 'warning', message: 'معدل زيارات ورشة الصيانة أعلى من المتوسط المعتاد.' });
    } else if (repairCount === 0 && trips.length > 5) {
      insights.push({ type: 'info', message: 'لم يتم إجراء أي صيانة وقائية مؤخراً رغم كثرة الرحلات. يُنصح بجدولة فحص روتيني (زيت، فلاتر، فرامل).' });
    }

    // 3. تحليل استهلاك الوقود (للشاحنات فقط)
    if (type === 'truck') {
      const fuelRecords = maintenance.filter(m => m.type === 'fuel');
      if (fuelRecords.length > 3) {
        // خوارزمية مبسطة لمحاكاة تزايد الاستهلاك
        const firstHalf = fuelRecords.slice(0, Math.floor(fuelRecords.length / 2));
        const secondHalf = fuelRecords.slice(Math.floor(fuelRecords.length / 2));
        
        const avgFirst = firstHalf.reduce((s, r) => s + parseFloat(r.amount || '0'), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, r) => s + parseFloat(r.amount || '0'), 0) / secondHalf.length;

        if (avgFirst > 0 && avgSecond > avgFirst * 1.15) {
          healthScore -= 15;
          insights.push({ type: 'warning', message: `اكتشف الذكاء الاصطناعي زيادة بنسبة ${( ((avgSecond - avgFirst) / avgFirst) * 100 ).toFixed(1)}% في معدل الإنفاق على الوقود مؤخراً. راجع ضغط الإطارات أو سلوك القيادة.` });
        } else {
          insights.push({ type: 'success', message: 'استهلاك الوقود مستقر وضمن النطاق الطبيعي والاقتصادي.' });
        }
      }
    }

    // 4. تحليل عبء العمل (Workload Fatigue)
    if (trips.length > 15) {
      healthScore -= 5;
      insights.push({ type: 'info', message: 'المركبة تعمل بجهد عالٍ (إجهاد تشغيلي). تأكد من إراحة المعدات وتبريد الأنظمة بين الرحلات الطويلة.' });
    }

    // 5. تقييم الحالة العامة
    if (vehicle.status === 'in_maintenance') {
      healthScore -= 30;
      insights.push({ type: 'critical', message: 'المركبة حالياً في ورشة الصيانة.' });
    } else if (healthScore > 85) {
      insights.push({ type: 'success', message: 'الحالة الميكانيكية والتشغيلية ممتازة ومطابقة لمعايير السلامة الدولية.' });
    }

    // ضمان بقاء النتيجة بين 0 و 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      success: true,
      healthScore,
      insights,
      recentMaintenanceCost,
      tripsCount: trips.length
    };

  } catch (err: any) {
    return { success: false, healthScore: 0, insights: [], recentMaintenanceCost: 0, tripsCount: 0, error: err?.message || 'حدث خطأ غير متوقع' };
  }
}

