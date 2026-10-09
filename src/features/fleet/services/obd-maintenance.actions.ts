'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  ingestDtcFaultSchema,
  filterObdRadarSchema,
  resolveDtcFaultSchema,
  scheduleFromRecommendationSchema,
  type IngestDtcFaultInput,
  type FilterObdRadarInput,
  type ResolveDtcFaultInput,
  type ScheduleFromRecommendationInput,
} from '../schemas/obd-maintenance.schemas';
import {
  lookupDtcProfile,
  calculateHealthIndex,
  calculateBreakdownRisk,
  calculateFinancialImpact,
  buildFleetHealthSummary,
} from './predictive-maintenance-radar.service';
import type {
  FleetObdDiagnosticEvent,
  PredictiveMaintenanceRecommendation,
  FleetHealthSummary,
} from '../types/obd-diagnostic.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FleetObdRadarDataResponse {
  summary: FleetHealthSummary;
  events: FleetObdDiagnosticEvent[];
  recommendations: PredictiveMaintenanceRecommendation[];
  trucks: Array<{ id: number; plate_number: string; model?: string | null }>;
}

/**
 * جلب بيانات رادار تشخيص الأعطال والتنبؤ بالصيانة للأسطول
 */
export async function getFleetObdRadarDataAction(
  rawFilter?: FilterObdRadarInput
): Promise<{ success: boolean; data?: FleetObdRadarDataResponse; error?: string }> {
  try {
    const filter = filterObdRadarSchema.parse(rawFilter || {});
    const supabase = await createClient();

    // 1. استعلام الشاحنات والأعطال والتوصيات
    const [trucksRes, eventsRes, recsRes] = await Promise.all([
      supabase.from('trucks').select('id, plate_number, model').order('plate_number'),
      supabase.from('fleet_obd_diagnostic_events').select('*').order('created_at', { ascending: false }),
      supabase.from('predictive_maintenance_recommendations').select('*').order('created_at', { ascending: false }),
    ]);

    if (trucksRes.error) {
      return { success: false, error: trucksRes.error.message };
    }

    const trucks = trucksRes.data || [];
    let rawEvents: FleetObdDiagnosticEvent[] = (eventsRes.data as unknown as FleetObdDiagnosticEvent[]) || [];
    let rawRecs: PredictiveMaintenanceRecommendation[] = (recsRes.data as unknown as PredictiveMaintenanceRecommendation[]) || [];

    // Map truck data onto events and recommendations
    const truckMap = new Map(trucks.map((t) => [t.id, t]));

    rawEvents = rawEvents.map((evt) => ({
      ...evt,
      truck: truckMap.get(evt.truck_id),
    }));

    rawRecs = rawRecs.map((rec) => ({
      ...rec,
      truck: truckMap.get(rec.truck_id),
    }));

    // Generate Fleet Health Summary before applying UI filters
    const summary = buildFleetHealthSummary(trucks, rawEvents, rawRecs);

    // Apply UI Filters to events
    let filteredEvents = rawEvents;
    if (filter.truck_id) {
      filteredEvents = filteredEvents.filter((e) => e.truck_id === filter.truck_id);
    }
    if (filter.severity && filter.severity !== 'all') {
      filteredEvents = filteredEvents.filter((e) => e.severity === filter.severity);
    }
    if (filter.status && filter.status !== 'all') {
      filteredEvents = filteredEvents.filter((e) => e.status === filter.status);
    }

    return {
      success: true,
      data: {
        summary,
        events: filteredEvents,
        recommendations: rawRecs,
        trucks,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب بيانات رادار الأعطال التشخيصية';
    return { success: false, error: message };
  }
}

/**
 * تسجيل واقعة عطل تشخيصي جديدة (OBD-II / J1939 Ingestion) وتوليد التوصيات التنبؤية فورياً
 */
export async function ingestDtcFaultAction(
  rawInput: IngestDtcFaultInput
): Promise<{
  success: boolean;
  event?: FleetObdDiagnosticEvent;
  recommendation?: PredictiveMaintenanceRecommendation;
  error?: string;
}> {
  try {
    const input = ingestDtcFaultSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. تحديد هوية الشركة والمستخدم
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

    // 2. تحليل الكود التشخيصي وفق الكتالوج القياسي
    const profile = lookupDtcProfile(input.dtc_code);

    // 3. احتساب مؤشر الصحة التنبؤي، ومخاطر العطل على الطريق، والتكلفة
    const health = calculateHealthIndex(
      [{ severity: profile.severity, dtc_code: profile.code }],
      input.freeze_frame
    );

    const isImmediate = profile.urgency === 'immediate_stop';
    const breakdownRisk = calculateBreakdownRisk(health, isImmediate, input.target_corridor);

    const financials = calculateFinancialImpact(
      profile.estimated_parts_cost_mad,
      profile.estimated_labor_hours,
      profile.estimated_breakdown_cost_mad,
      input.target_corridor
    );

    // 4. إدراج واقعة التشخيص في جدول fleet_obd_diagnostic_events
    const { data: event, error: eventErr } = await supabase
      .from('fleet_obd_diagnostic_events')
      .insert({
        company_id: companyId,
        truck_id: input.truck_id,
        driver_id: input.driver_id || null,
        trip_id: input.trip_id || null,
        dtc_code: profile.code,
        dtc_standard: input.dtc_standard || profile.standard,
        category: profile.category,
        severity: profile.severity,
        description: profile.description_ar,
        mil_status: input.mil_status || profile.severity === 'critical',
        freeze_frame_data: input.freeze_frame || {},
        gps_latitude: input.gps_latitude || null,
        gps_longitude: input.gps_longitude || null,
        location_name: input.location_name || null,
        status: 'active',
      })
      .select()
      .single();

    if (eventErr) {
      return { success: false, error: eventErr.message };
    }

    // 5. إدراج التوصية التنبؤية المعتمدة
    const { data: rec, error: recErr } = await supabase
      .from('predictive_maintenance_recommendations')
      .insert({
        company_id: companyId,
        truck_id: input.truck_id,
        diagnostic_event_id: event.id,
        urgency: profile.urgency,
        health_index_score: health,
        breakdown_risk_probability: breakdownRisk,
        recommended_action: profile.action_ar,
        required_spare_parts: profile.required_spare_parts,
        estimated_labor_hours: profile.estimated_labor_hours.toString(),
        estimated_cost_mad: financials.estimated_proactive_cost_mad,
        estimated_breakdown_cost_mad: financials.estimated_breakdown_cost_mad,
        estimated_savings_mad: financials.estimated_savings_mad,
        target_corridor: input.target_corridor,
        status: 'pending',
      })
      .select()
      .single();

    if (recErr) {
      return { success: false, error: recErr.message };
    }

    // 6. تسجيل العملية في سجل التدقيق الأمني
    await recordAuditLog({
      actionType: 'create',
      entityType: 'fleet_obd_diagnostic_events',
      entityId: event.id,
      reason: `تسجيل عطل تشخيصي OBD-II: ${profile.code}`,
      newData: {
        truck_id: input.truck_id,
        dtc_code: profile.code,
        severity: profile.severity,
        health_index: health,
        risk_pct: breakdownRisk,
        estimated_savings_mad: financials.estimated_savings_mad,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return {
      success: true,
      event: event as unknown as FleetObdDiagnosticEvent,
      recommendation: rec as unknown as PredictiveMaintenanceRecommendation,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تسجيل واقعة التشخيص';
    return { success: false, error: message };
  }
}

/**
 * معالجة وإغلاق واقعة العطل التشخيصي
 */
export async function resolveDtcFaultAction(
  rawInput: ResolveDtcFaultInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = resolveDtcFaultSchema.parse(rawInput);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: event, error: fetchErr } = await supabase
      .from('fleet_obd_diagnostic_events')
      .select('*')
      .eq('id', input.event_id)
      .single();

    if (fetchErr || !event) {
      return { success: false, error: 'تعذر العثور على واقعة العطل المحددة' };
    }

    const { error: updateErr } = await supabase
      .from('fleet_obd_diagnostic_events')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
        description: `${event.description} | تم الإصلاح: ${input.resolution_notes}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.event_id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // If requested to schedule maintenance
    if (input.create_maintenance_schedule) {
      await supabase.from('maintenance_schedules').insert({
        vehicle_type: 'truck',
        vehicle_id: event.truck_id,
        maintenance_type: `صيانة عطل ${event.dtc_code}: ${input.resolution_notes}`,
        scheduled_date: new Date().toISOString().split('T')[0],
        amount_estimate: 0,
        currency: 'MAD',
        notes: `إغلاق عطل تشخيصي OBD: ${event.dtc_code}`,
        is_active: true,
      });
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'fleet_obd_diagnostic_events',
      entityId: input.event_id,
      reason: `إغلاق عطل تشخيصي: ${input.resolution_notes}`,
      newData: {
        status: 'resolved',
        notes: input.resolution_notes,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل إغلاق واقعة العطل';
    return { success: false, error: message };
  }
}

/**
 * تحويل التوصية التنبؤية إلى موعد صيانة مجدول رسمي
 */
export async function scheduleFromRecommendationAction(
  rawInput: ScheduleFromRecommendationInput
): Promise<{ success: boolean; scheduleId?: number; error?: string }> {
  try {
    const input = scheduleFromRecommendationSchema.parse(rawInput);
    const supabase = await createClient();

    const { data: rec, error: recErr } = await supabase
      .from('predictive_maintenance_recommendations')
      .select('*')
      .eq('id', input.recommendation_id)
      .single();

    if (recErr || !rec) {
      return { success: false, error: 'تعذر العثور على التوصية التنبؤية المحددة' };
    }

    const amountEstimate = new Decimal(rec.estimated_cost_mad || '0').toNumber();

    // 1. إدراج الموعد في جدول الصيانة الوقائية
    const { data: schedule, error: schErr } = await supabase
      .from('maintenance_schedules')
      .insert({
        vehicle_type: 'truck',
        vehicle_id: rec.truck_id,
        maintenance_type: rec.recommended_action,
        scheduled_date: input.scheduled_date,
        amount_estimate: amountEstimate,
        currency: 'MAD',
        notes: `توصية صيانة استباقية (OBD-II). وفر متوقع: ${rec.estimated_savings_mad} MAD`,
        is_active: true,
      })
      .select()
      .single();

    if (schErr) {
      return { success: false, error: schErr.message };
    }

    // 2. تحديث حالة التوصية إلى scheduled
    const { error: updErr } = await supabase
      .from('predictive_maintenance_recommendations')
      .update({
        status: 'scheduled',
        maintenance_schedule_id: schedule.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.recommendation_id);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    await recordAuditLog({
      actionType: 'create',
      entityType: 'predictive_maintenance_recommendations',
      entityId: input.recommendation_id,
      reason: `جدولة صيانة تنبؤية لشاحنة #${rec.truck_id}`,
      newData: {
        truck_id: rec.truck_id,
        schedule_id: schedule.id,
        scheduled_date: input.scheduled_date,
        estimated_cost_mad: rec.estimated_cost_mad,
      },
    });

    revalidatePath('/maintenance');
    revalidatePath('/fleet');

    return { success: true, scheduleId: schedule.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جدولة الصيانة التنبؤية';
    return { success: false, error: message };
  }
}
