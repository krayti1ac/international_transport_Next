'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  recordTireInspectionSchema,
  rotateTireSchema,
  mountTireSchema,
  filterFleetTiresSchema,
  type RecordTireInspectionInput,
  type RotateTireInput,
  type MountTireInput,
  type FilterFleetTiresInput,
} from '../schemas/tire-management.schemas';
import {
  calculateTireWearMetrics,
  evaluateTpmsReading,
  evaluateDualTirePair,
  buildFleetTireSummary,
} from './tire-lifecycle.service';
import type {
  FleetTire,
  FleetTireSummary,
  DualTirePairEvaluation,
  TireSensorTelematicsLog,
  TireAxlePosition,
} from '../types/tire-fleet.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FleetTireDataResponse {
  tires: FleetTire[];
  summary: FleetTireSummary;
  trucks: Array<{ id: number; plate_number: string; model?: string | null }>;
  trailers: Array<{ id: number; plate_number: string }>;
  dualPairs: DualTirePairEvaluation[];
}

/**
 * جلب بيانات وإحصائيات أسطول الإطارات والقياسات التليماتية
 */
export async function getFleetTireDataAction(
  rawFilter?: FilterFleetTiresInput
): Promise<{ success: boolean; data?: FleetTireDataResponse; error?: string }> {
  try {
    const filter = filterFleetTiresSchema.parse(rawFilter || {});
    const supabase = await createClient();

    // 1. استعلام الإطارات والشاحنات والمقطورات
    const [tiresRes, trucksRes, trailersRes, logsRes] = await Promise.all([
      supabase.from('fleet_tires').select('*').order('created_at', { ascending: false }),
      supabase.from('trucks').select('id, plate_number, model').order('plate_number'),
      supabase.from('trailers').select('id, plate_number').order('plate_number'),
      supabase.from('tire_sensor_telematics_logs').select('*').order('recorded_at', { ascending: false }).limit(200),
    ]);

    if (tiresRes.error) {
      return { success: false, error: tiresRes.error.message };
    }

    const trucks = trucksRes.data || [];
    const trailers = trailersRes.data || [];
    const rawLogs = (logsRes.data || []) as unknown as TireSensorTelematicsLog[];
    const rawTires = (tiresRes.data || []) as unknown as FleetTire[];

    const truckMap = new Map(trucks.map((t) => [t.id, t]));
    const trailerMap = new Map(trailers.map((tr) => [tr.id, tr]));

    // Map latest log by tire_id
    const latestLogMap = new Map<string, TireSensorTelematicsLog>();
    for (const log of rawLogs) {
      if (!latestLogMap.has(log.tire_id)) {
        latestLogMap.set(log.tire_id, log);
      }
    }

    // Enrich tires with relations & calculated wear metrics
    const enrichedTires: FleetTire[] = rawTires.map((tire) => {
      const truck = tire.truck_id ? truckMap.get(tire.truck_id) : undefined;
      const trailer = tire.trailer_id ? trailerMap.get(tire.trailer_id) : undefined;
      const latestTelematics = latestLogMap.get(tire.id);

      const metrics = calculateTireWearMetrics(
        tire.initial_tread_depth_mm,
        tire.current_tread_depth_mm,
        tire.installed_km || 0,
        tire.current_km || tire.installed_km || 0,
        tire.purchase_cost_mad,
        'DOMESTIC'
      );

      return {
        ...tire,
        truck,
        trailer,
        latest_telematics: latestTelematics,
        metrics,
      };
    });

    // Generate Fleet Tire Summary
    const summary = buildFleetTireSummary(enrichedTires);

    // Evaluate dual tire pairs for mounted truck drive axles
    const dualPairs: DualTirePairEvaluation[] = [];
    for (const truck of trucks) {
      const truckTires = enrichedTires.filter(
        (t) => t.vehicle_type === 'truck' && t.truck_id === truck.id && t.status === 'mounted'
      );

      const tireByPos = new Map<TireAxlePosition, FleetTire>();
      for (const t of truckTires) {
        tireByPos.set(t.axle_position, t);
      }

      // Drive Axle 1 Left Pair: 2LO & 2LI
      if (tireByPos.has('2LO') || tireByPos.has('2LI')) {
        dualPairs.push(
          evaluateDualTirePair(
            `${truck.plate_number} (Drive Left)`,
            '2LO',
            '2LI',
            tireByPos.get('2LO'),
            tireByPos.get('2LI')
          )
        );
      }

      // Drive Axle 1 Right Pair: 2RO & 2RI
      if (tireByPos.has('2RO') || tireByPos.has('2RI')) {
        dualPairs.push(
          evaluateDualTirePair(
            `${truck.plate_number} (Drive Right)`,
            '2RO',
            '2RI',
            tireByPos.get('2RO'),
            tireByPos.get('2RI')
          )
        );
      }
    }

    // Apply Filters
    let filteredTires = enrichedTires;
    if (filter.vehicle_type !== 'all') {
      filteredTires = filteredTires.filter((t) => t.vehicle_type === filter.vehicle_type);
    }
    if (filter.truck_id) {
      filteredTires = filteredTires.filter((t) => t.truck_id === filter.truck_id);
    }
    if (filter.trailer_id) {
      filteredTires = filteredTires.filter((t) => t.trailer_id === filter.trailer_id);
    }
    if (filter.status !== 'all') {
      filteredTires = filteredTires.filter((t) => t.status === filter.status);
    }
    if (filter.condition !== 'all') {
      filteredTires = filteredTires.filter((t) => t.metrics?.health_condition === filter.condition);
    }

    return {
      success: true,
      data: {
        tires: filteredTires,
        summary,
        trucks,
        trailers,
        dualPairs,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب بيانات إدارة الإطارات';
    return { success: false, error: message };
  }
}

/**
 * تسجيل فحص دوري أو قراءة حساس TPMS للإطار وتحديث عمق المداس
 */
export async function recordTireInspectionAction(
  rawInput: RecordTireInspectionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = recordTireInspectionSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. استعلام الإطار المستهدف
    const { data: tire, error: tireErr } = await supabase
      .from('fleet_tires')
      .select('*')
      .eq('id', input.tire_id)
      .single();

    if (tireErr || !tire) {
      return { success: false, error: 'تعذر العثور على الإطار المحدد' };
    }

    // 2. تقييم قراءة الحساس
    const alertFlags = evaluateTpmsReading(input.pressure_bar, input.temperature_c);

    // 3. إدراج سجل القراءة التليماتية
    const { error: logErr } = await supabase
      .from('tire_sensor_telematics_logs')
      .insert({
        company_id: tire.company_id,
        tire_id: tire.id,
        truck_id: tire.truck_id,
        trailer_id: tire.trailer_id,
        pressure_bar: new Decimal(input.pressure_bar).toFixed(2),
        temperature_c: new Decimal(input.temperature_c).toFixed(2),
        tread_depth_mm: new Decimal(input.tread_depth_mm).toFixed(2),
        alert_flags: alertFlags,
      });

    if (logErr) {
      return { success: false, error: logErr.message };
    }

    // 4. تحديث الأصل
    const { error: updateErr } = await supabase
      .from('fleet_tires')
      .update({
        current_tread_depth_mm: new Decimal(input.tread_depth_mm).toFixed(2),
        current_km: input.current_km,
        last_inspected_at: new Date().toISOString(),
        notes: input.notes ? `${tire.notes || ''} | ${input.notes}`.trim() : tire.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tire.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 5. إذا كان عمق المداس عند أو دون الحد القانوني (1.6 مم)، ننشئ تنبيهاً في الصيانة
    if (new Decimal(input.tread_depth_mm).lessThanOrEqualTo('1.60') && tire.truck_id) {
      await supabase.from('maintenance_schedules').insert({
        vehicle_type: 'truck',
        vehicle_id: tire.truck_id,
        maintenance_type: `استبدال فوري لإطار متآكل (${tire.axle_position}) - عمق ${input.tread_depth_mm} مم`,
        scheduled_date: new Date().toISOString().split('T')[0],
        amount_estimate: 4600,
        currency: 'MAD',
        notes: `تنبيه أمان: الإطار رقم ${tire.serial_number} وصل للحد الأدنى القانوني 1.6 مم`,
        is_active: true,
      });
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'fleet_tires',
      entityId: tire.id,
      reason: `تسجيل فحص إطار: عمق ${input.tread_depth_mm} مم، ضغط ${input.pressure_bar} بار`,
      newData: {
        tread_depth_mm: input.tread_depth_mm,
        pressure_bar: input.pressure_bar,
        temperature_c: input.temperature_c,
        alert_flags: alertFlags,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تسجيل فحص الإطار';
    return { success: false, error: message };
  }
}

/**
 * تركيب إطار جديد على شاحنة أو مقطورة
 */
export async function mountTireAction(
  rawInput: MountTireInput
): Promise<{ success: boolean; tire?: FleetTire; error?: string }> {
  try {
    const input = mountTireSchema.parse(rawInput);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let companyId: number = 1;
    if (user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();
      if (userProfile?.company_id) {
        companyId = Number(userProfile.company_id);
      }
    }

    const { data: tire, error: insertErr } = await supabase
      .from('fleet_tires')
      .insert({
        company_id: companyId,
        serial_number: input.serial_number.trim().toUpperCase(),
        brand: input.brand.trim(),
        model: input.model?.trim() || null,
        size: input.size.trim(),
        vehicle_type: input.vehicle_type,
        truck_id: input.truck_id || null,
        trailer_id: input.trailer_id || null,
        axle_position: input.axle_position,
        initial_tread_depth_mm: new Decimal(input.initial_tread_depth_mm).toFixed(2),
        current_tread_depth_mm: new Decimal(input.initial_tread_depth_mm).toFixed(2),
        purchase_cost_mad: new Decimal(input.purchase_cost_mad).toFixed(2),
        installed_km: input.installed_km,
        current_km: input.installed_km,
        status: 'mounted',
        installed_at: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (insertErr) {
      return { success: false, error: insertErr.message };
    }

    await recordAuditLog({
      actionType: 'create',
      entityType: 'fleet_tires',
      entityId: tire.id,
      reason: `تركيب إطار جديد رقم ${tire.serial_number} على الموضع ${tire.axle_position}`,
      newData: {
        serial_number: tire.serial_number,
        brand: tire.brand,
        axle_position: tire.axle_position,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return { success: true, tire: tire as unknown as FleetTire };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تركيب الإطار';
    return { success: false, error: message };
  }
}

/**
 * تدوير موضعي لإطارين (Rotation Reversal) لموازنة التآكل
 */
export async function rotateTiresAction(
  rawInput: RotateTireInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = rotateTireSchema.parse(rawInput);
    const supabase = await createClient();

    const [tire1Res, tire2Res] = await Promise.all([
      supabase.from('fleet_tires').select('*').eq('id', input.tire_id_1).single(),
      supabase.from('fleet_tires').select('*').eq('id', input.tire_id_2).single(),
    ]);

    if (tire1Res.error || !tire1Res.data || tire2Res.error || !tire2Res.data) {
      return { success: false, error: 'تعذر العثور على الإطارين المحددين للتدوير' };
    }

    const tire1 = tire1Res.data;
    const tire2 = tire2Res.data;

    // Swap axle positions
    const pos1 = tire1.axle_position;
    const pos2 = tire2.axle_position;

    await Promise.all([
      supabase
        .from('fleet_tires')
        .update({
          axle_position: pos2,
          notes: `${tire1.notes || ''} | تدوير من ${pos1} إلى ${pos2}: ${input.reason}`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tire1.id),
      supabase
        .from('fleet_tires')
        .update({
          axle_position: pos1,
          notes: `${tire2.notes || ''} | تدوير من ${pos2} إلى ${pos1}: ${input.reason}`.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tire2.id),
    ]);

    await recordAuditLog({
      actionType: 'update',
      entityType: 'fleet_tires',
      entityId: tire1.id,
      reason: `تدوير الإطارات: تبديل ${tire1.serial_number} (${pos1}) مع ${tire2.serial_number} (${pos2})`,
      newData: {
        tire_1: { id: tire1.id, new_position: pos2 },
        tire_2: { id: tire2.id, new_position: pos1 },
        reason: input.reason,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تدوير الإطارات';
    return { success: false, error: message };
  }
}

