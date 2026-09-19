'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface DriverSafetyBreakdown {
  driverId: number;
  driverName: string;
  totalScore: number; // 10 - 100
  rating: 'excellent' | 'good' | 'warning' | 'critical';
  safetyBonusMAD: number;
  isEligibleForBonus: boolean;
  metrics: {
    overspeedingEvents: number;       // تجاوز سرعة 90 كم/س
    harshBrakingEvents: number;       // فرملة قوية
    harshAccelerationEvents: number;  // تسارع مفاجئ
    excessiveIdlingHours: number;     // تشغيل المحرك أثناء التوقف
    trafficFinesCount: number;        // مخالفات قانونية مسجلة
  };
  penaltiesApplied: {
    speedingDeduction: number;
    harshDrivingDeduction: number;
    idlingDeduction: number;
    finesDeduction: number;
  };
  recommendations: string[];
  periodDays: number;
}

export async function calculateDriverSafetyScore(
  driverId: number,
  periodDays: number = 30
): Promise<DriverSafetyBreakdown | null> {
  try {
    const supabase = await createClient();

    // 1. جلب بيانات السائق والشاحنة
    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('id, name, default_truck_id')
      .eq('id', driverId)
      .maybeSingle();

    if (driverErr || !driver) {
      return null;
    }

    let effectiveTruckId = driver.default_truck_id || null;

    // إذا لم تكن هناك شاحنة افتراضية مسجلة، نفحص آخر رحلة مسندة للسائق
    if (!effectiveTruckId) {
      const { data: lastTrip } = await supabase
        .from('trip_orders')
        .select('truck_id')
        .eq('driver_id', driverId)
        .not('truck_id', 'is', null)
        .order('departure_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastTrip?.truck_id) {
        effectiveTruckId = lastTrip.truck_id;
      }
    }

    const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    // 2. فحص المخالفات المرورية والتشغيلية المسجلة في fine_penalties
    const { data: fines } = await supabase
      .from('fine_penalties')
      .select('id, fine_type, amount')
      .eq('driver_id', driverId)
      .gte('created_at', sinceDate);

    const trafficFinesCount = fines?.length || 0;

    // 3. تحليل بيانات التيليماتكس وسرعة الشاحنة من truck_locations
    let overspeedingEvents = 0;
    let harshBrakingEvents = 0;
    let harshAccelerationEvents = 0;
    let excessiveIdlingHours = 0;

    if (effectiveTruckId) {
      const { data: locations } = await supabase
        .from('truck_locations')
        .select('speed, recorded_at')
        .eq('truck_id', effectiveTruckId)
        .gte('recorded_at', sinceDate)
        .order('recorded_at', { ascending: true });

      if (locations && locations.length > 1) {
        for (let i = 1; i < locations.length; i++) {
          const prev = locations[i - 1];
          const curr = locations[i];
          const speed = curr.speed || 0;

          // تجاوز سرعة TIR المعتمدة للشاحنات الثقيلة (90 كم/ساعة + 2 كم هامش تسامح)
          if (speed > 92) {
            overspeedingEvents++;
          }

          // حساب فارق السرعة والزمن لرصد الفرملة والتسارع الحاد
          const prevTime = new Date(prev.recorded_at).getTime();
          const currTime = new Date(curr.recorded_at).getTime();
          const timeDiffSec = (currTime - prevTime) / 1000;

          if (timeDiffSec > 0 && timeDiffSec <= 30) {
            const speedDiff = speed - (prev.speed || 0); // كم/س
            const accelKmHPerSec = speedDiff / timeDiffSec;

            if (accelKmHPerSec < -12) harshBrakingEvents++;      // كبح حاد خطير
            if (accelKmHPerSec > 10) harshAccelerationEvents++;   // تسارع مفاجئ غير اقتصادي
          }

          // رصد دوران المحرك أثناء التوقف (Idling) لأكثر من 15 دقيقة
          if (speed === 0 && timeDiffSec >= 900) {
            excessiveIdlingHours += timeDiffSec / 3600;
          }
        }
      }
    }

    // 4. احتساب الخصومات باستخدام Decimal.js بدقة تامة لمنع أخطاء الحساب العشري
    // النقاط الأساسية: 100 نقطة
    let score = new Decimal(100);

    // خصم نقطتين عن كل حادثة تجاوز سرعة (حد أقصى 25 نقطة)
    const speedDeduction = Decimal.min(new Decimal(overspeedingEvents).times(2), new Decimal(25));
    
    // خصم 1.5 نقطة عن كل كبح حاد أو تسارع مفرط (حد أقصى 20 نقطة)
    const harshDeduction = Decimal.min(
      new Decimal(harshBrakingEvents + harshAccelerationEvents).times(1.5),
      new Decimal(20)
    );
    
    // خصم 1 نقطة لكل ساعة idling تفوق 3 ساعات خلال الفترة (حد أقصى 15 نقطة)
    const idlingHoursExcess = Math.max(0, excessiveIdlingHours - 3);
    const idlingDeduction = Decimal.min(new Decimal(idlingHoursExcess).times(1), new Decimal(15));
    
    // خصم 10 نقاط عن كل غرامة رسمية مسجلة (حد أقصى 40 نقطة)
    const finesDeduction = Decimal.min(new Decimal(trafficFinesCount).times(10), new Decimal(40));

    score = score
      .minus(speedDeduction)
      .minus(harshDeduction)
      .minus(idlingDeduction)
      .minus(finesDeduction);

    const finalScore = Math.max(10, Math.min(100, Math.round(score.toNumber())));

    // تقييم النتيجة
    let rating: DriverSafetyBreakdown['rating'] = 'good';
    if (finalScore >= 90) rating = 'excellent';
    else if (finalScore >= 75) rating = 'good';
    else if (finalScore >= 60) rating = 'warning';
    else rating = 'critical';

    // مكافأة السلامة: 500 درهم عند تحقيق 90 نقطة أو أكثر
    const isEligibleForBonus = finalScore >= 90;
    const safetyBonusMAD = isEligibleForBonus ? 500 : 0;

    // توليد التوصيات الإرشادية الذكية
    const recommendations: string[] = [];
    if (overspeedingEvents > 5) {
      recommendations.push('تجنب تجاوز سرعة 90 كم/س لتفادي غرامات الرادار الأوروبية وخفض استهلاك الديزل.');
    }
    if (harshBrakingEvents > 8) {
      recommendations.push('الحفاظ على مسافة أمان أكبر مع المركبات الأمامية لتقليل تآكل صفائح الفرامل والإطارات.');
    }
    if (idlingHoursExcess > 5) {
      recommendations.push('إطفاء المحرك أثناء فترات التوقف والانتظار في البواخر والمعابر الجمركية.');
    }
    if (trafficFinesCount > 0) {
      recommendations.push('الالتزام التام بقوانين التاكوغراف وأوقات الراحة الإلزامية (EC 561/2006).');
    }
    if (recommendations.length === 0) {
      recommendations.push('سلوك القيادة ممتاز وملتزم بأعلى معايير السلامة المهنية والنقل الدولي.');
    }

    return {
      driverId: driver.id,
      driverName: driver.name,
      totalScore: finalScore,
      rating,
      safetyBonusMAD,
      isEligibleForBonus,
      metrics: {
        overspeedingEvents,
        harshBrakingEvents,
        harshAccelerationEvents,
        excessiveIdlingHours: Math.round(excessiveIdlingHours * 10) / 10,
        trafficFinesCount,
      },
      penaltiesApplied: {
        speedingDeduction: speedDeduction.toNumber(),
        harshDrivingDeduction: harshDeduction.toNumber(),
        idlingDeduction: idlingDeduction.toNumber(),
        finesDeduction: finesDeduction.toNumber(),
      },
      recommendations,
      periodDays,
    };
  } catch (err: unknown) {
    console.error('Driver safety score calculation error:', err);
    return null;
  }
}

