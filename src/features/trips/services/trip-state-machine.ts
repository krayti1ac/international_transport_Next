import { z } from 'zod';
import { evaluateAfricanDriverVisa } from '@/lib/african-corridor';
import type { TripOrder, Driver, Truck, Trailer, DeliverySignature } from '@/types/database';

/**
 * الحالات التشغيلية المعتمدة للرحلات الدولية
 */
export const TRIP_STAGES = [
  'draft',
  'assigned',
  'loading',
  'in_transit',
  'customs_export',
  'delivered',
  'settled',
  'closed',
  'cancelled',
] as const;

export type TripStage = (typeof TRIP_STAGES)[number];

export const tripStageSchema = z.enum(TRIP_STAGES);

/**
 * تطبيع الحالات المرجعية في النظام لضمان التوافق مع السجلات القديمة
 */
export function normalizeTripStage(stage?: string | null): TripStage {
  if (!stage) return 'draft';
  const s = stage.toLowerCase().trim();
  if (s === 'pending' || s === 'planned' || s === 'pendingassignment') return 'draft';
  if (s === 'completed') return 'delivered';
  if (TRIP_STAGES.includes(s as TripStage)) return s as TripStage;
  return 'draft';
}

/**
 * خريطة الانتقالات المسموح بها جبرياً
 */
export const ALLOWED_STAGE_TRANSITIONS: Record<TripStage, readonly TripStage[]> = {
  draft: ['assigned', 'cancelled'],
  assigned: ['loading', 'draft', 'cancelled'],
  loading: ['in_transit', 'assigned', 'cancelled'],
  in_transit: ['customs_export', 'delivered'],
  customs_export: ['in_transit', 'delivered'],
  delivered: ['settled'],
  settled: ['closed'],
  closed: [], // حالة نهائية مقفلة
  cancelled: [], // حالة نهائية ملغاة
};

export interface TransitionContext {
  trip: TripOrder;
  driver?: Driver | null;
  truck?: Truck | null;
  trailer?: Trailer | null;
  deliveryProof?: DeliverySignature | null;
  hasSettlementClosed?: boolean;
  userRole?: string;
  truckTwiPercentage?: number;
}

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * فحص شروط الانتقال بين مراحل الرحلة الدولية (Transition Guards)
 */
export function validateTripTransition(
  currentStage: string,
  targetStage: string,
  context: TransitionContext
): TransitionValidationResult {
  const current = normalizeTripStage(currentStage);
  const target = targetStage as TripStage;

  if (!TRIP_STAGES.includes(target)) {
    return {
      valid: false,
      code: 'INVALID_TARGET_STAGE',
      error: `الحالة المطلوبة (${targetStage}) غير معتمدة بنظام المنظومة.`,
    };
  }

  // 1. التحقق من إلغاء الرحلة (Cancellation Guard)
  if (target === 'cancelled') {
    if (['in_transit', 'customs_export', 'delivered', 'settled', 'closed'].includes(current)) {
      return {
        valid: false,
        code: 'CANNOT_CANCEL_ACTIVE_TRIP',
        error: 'لا يمكن إلغاء الرحلة بعد خروج الشاحنة على الطريق أو إتمام التسليم.',
      };
    }
  }

  // 2. التحقق من مسار الانتقال في الـ State Machine
  const allowedNext = ALLOWED_STAGE_TRANSITIONS[current] || [];
  if (!allowedNext.includes(target)) {
    return {
      valid: false,
      code: 'ILLEGAL_STAGE_JUMP',
      error: `لا يمكن نقل الرحلة مباشرة من حالة [${currentStage}] إلى [${targetStage}].`,
    };
  }

  // 2. فحص الانتقال إلى: assigned
  if (target === 'assigned') {
    if (!context.driver) {
      return { valid: false, code: 'MISSING_DRIVER', error: 'يلزم تعيين سائق معتمد للرحلة.' };
    }
    if (!context.truck) {
      return { valid: false, code: 'MISSING_TRUCK', error: 'يلزم تعيين رأس الشاحنة للرحلة.' };
    }

    // فحص مؤشر تآكل الإطارات التنبؤي (TWI Engine)
    if (context.truckTwiPercentage !== undefined && context.truckTwiPercentage >= 90) {
      return {
        valid: false,
        code: 'TRUCK_TIRE_WEAR_CRITICAL',
        error: `حظر فوري لإسناد الشاحنة [${context.truck.plate_number || 'المحددة'}]: تجاوز مؤشر تآكل الإطارات (TWI) العتبة الحرجة (${context.truckTwiPercentage}% ≥ 90%). يلزم استبدال الإطارات في الورشة قبل أي رحلة دولية.`,
      };
    }

    // فحص تأشيرة السائق حسب الممر
    const corridor = context.trip.corridor_type || 'european_maritime';
    if (corridor === 'african_overland') {
      const visaEval = evaluateAfricanDriverVisa(
        context.driver.african_visa_expiry_date || context.driver.visa_expiry_date,
        context.driver.african_visa_number || context.driver.visa_number
      );
      if (!visaEval.isEligibleForAfricanTransit) {
        return {
          valid: false,
          code: 'AFRICAN_VISA_INVALID',
          error: `تأشيرة السائق الإفريقية غير صالحة أو منتهية: (${visaEval.badgeLabelAr}).`,
        };
      }
    } else if (corridor === 'european_maritime') {
      if (!context.driver.has_valid_visa) {
        return {
          valid: false,
          code: 'SCHENGEN_VISA_REQUIRED',
          error: 'السائق المحدد لا يمتلك تأشيرة شنغن سارية للعبور الأوروبي.',
        };
      }
    }
  }

  // 3. فحص الانتقال إلى: in_transit (بدء الطريق)
  if (target === 'in_transit') {
    if (!context.trip.goods_description_export && !context.trip.route) {
      return { valid: false, code: 'MISSING_CARGO_DATA', error: 'يلزم تسجيل طبيعة البضاعة المشحونة.' };
    }
    if (!context.trip.weight_export || context.trip.weight_export <= 0) {
      return { valid: false, code: 'INVALID_WEIGHT', error: 'يلزم تسجيل الوزن الإجمالي الفعلي للشحنة.' };
    }
  }

  // 4. فحص الانتقال إلى: delivered (اكتمال التسليم)
  if (target === 'delivered') {
    if (!context.deliveryProof) {
      return {
        valid: false,
        code: 'MISSING_EPOD',
        error: 'لا يمكن إتمام التسليم بدون تسجيل توقيع e-POD الرقمي وإحداثيات التفريغ.',
      };
    }
  }

  // 5. فحص الانتقال إلى: settled (اعتماد التسوية)
  if (target === 'settled') {
    if (!context.hasSettlementClosed) {
      return {
        valid: false,
        code: 'SETTLEMENT_UNCLOSED',
        error: 'يلزم تصفية مصاريف وسلف ووقود السائق في شاشة التسويات قبل تحويل الرحلة لمسواة.',
      };
    }
  }

  return { valid: true };
}
