'use server';

/**
 * Trans Bodanon TMS — Tachograph & Driver Compliance Server Actions
 * Handles tachograph segment logging, live recalculation of EU Regulation (EC) 561/2006
 * limits, radar snapshot updates, and fleet-wide compliance summaries.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  logDriverActivitySchema,
  tachographRadarFilterSchema,
  LogDriverActivityInput,
  TachographRadarFilterInput,
} from '../schemas/tachograph.schemas';
import {
  TachographComplianceEngine,
  ActivitySegment,
} from './tachograph-compliance.service';
import {
  TachographRestAlertService,
  type RestAlertDispatchResult,
} from './tachograph-rest-alert.service';

import type {

  DriverComplianceStatusResult,
  FleetComplianceRadarSummary,
} from '../types/tachograph.types';

/**
 * 1. Logs a new tachograph activity segment and updates driver compliance snapshot
 */
export async function logDriverActivityAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const input = logDriverActivitySchema.parse(rawInput);

    // Get user company or fallback to driver company for automated telemetry webhooks
    let companyId: number | null = null;
    if (user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      companyId = userProfile?.company_id ?? null;
    }


    // 1. Fetch driver profile
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, name, default_truck_id, company_id')
      .eq('id', input.driver_id)
      .maybeSingle();

    if (!companyId && driver?.company_id) {
      companyId = driver.company_id;
    }

    let truckPlate: string | null = null;
    const effectiveTruckId = input.truck_id ?? driver?.default_truck_id ?? null;
    if (effectiveTruckId) {
      const { data: truck } = await supabase
        .from('trucks')
        .select('plate_number')
        .eq('id', effectiveTruckId)
        .maybeSingle();
      truckPlate = truck?.plate_number ?? null;
    }

    // Calculate duration in minutes if not explicitly provided
    let durationMinutes = input.duration_minutes ?? 0;
    if (durationMinutes === 0 && input.end_time && input.start_time) {
      const diffMs = new Date(input.end_time).getTime() - new Date(input.start_time).getTime();
      durationMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    // 2. Insert activity segment into driver_tachograph_logs
    const { data: logEntry, error: insertError } = await supabase
      .from('driver_tachograph_logs')
      .insert({
        company_id: companyId,
        driver_id: input.driver_id,
        trip_id: input.trip_id ?? null,
        truck_id: effectiveTruckId,
        activity_type: input.activity_type,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        duration_minutes: durationMinutes,
        start_odometer: input.start_odometer ?? null,
        end_odometer: input.end_odometer ?? null,
        start_location: input.start_location ?? null,
        end_location: input.end_location ?? null,
        country_code: input.country_code,
        card_insertion_status: input.card_insertion_status,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting tachograph log:', insertError);
      return { success: false, error: insertError.message || 'فشل حفظ سجل التاكوغراف' };
    }



    // 3. Fetch recent activities for this driver (past 14 days) to evaluate compliance
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from('driver_tachograph_logs')
      .select('activity_type, start_time, end_time, duration_minutes')
      .eq('driver_id', input.driver_id)
      .gte('start_time', fourteenDaysAgo)
      .order('start_time', { ascending: true });

    const activitySegments: ActivitySegment[] = (recentLogs || []).map((l) => ({
      activity_type: l.activity_type as ActivitySegment['activity_type'],
      start_time: l.start_time,
      end_time: l.end_time,
      duration_minutes: l.duration_minutes || 0,
    }));

    // Calculate daily drive minutes (today)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayLogs = activitySegments.filter(
      (s) => new Date(s.start_time) >= startOfToday && s.activity_type === 'drive'
    );
    const dailyDriveMinutes = todayLogs.reduce((acc, s) => acc + s.duration_minutes, 0);

    // Calculate weekly drive minutes (Monday 00:00 to now)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - diffToMonday);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const weekLogs = activitySegments.filter(
      (s) => new Date(s.start_time) >= startOfWeek && s.activity_type === 'drive'
    );
    const weeklyDriveMinutes = weekLogs.reduce((acc, s) => acc + s.duration_minutes, 0);

    // Fortnightly drive minutes (past 14 days)
    const fortnightlyDriveMinutes = activitySegments
      .filter((s) => s.activity_type === 'drive')
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    // 4. Run compliance engine
    const evaluation = TachographComplianceEngine.evaluateDriverCompliance({
      driver_id: input.driver_id,
      driver_name: driver?.name,
      truck_plate: truckPlate,
      current_activity: input.activity_type,

      activities: activitySegments,
      daily_drive_minutes: dailyDriveMinutes,
      weekly_drive_minutes: weeklyDriveMinutes,
      fortnightly_drive_minutes: fortnightlyDriveMinutes,
    });

    // 5. Upsert compliance snapshot
    await supabase.from('driver_compliance_snapshots').upsert(
      {
        company_id: companyId,
        driver_id: input.driver_id,
        snapshot_timestamp: new Date().toISOString(),
        current_activity: input.activity_type,
        continuous_drive_minutes: evaluation.continuous_drive_minutes,
        remaining_continuous_drive_minutes: evaluation.remaining_continuous_drive_minutes,
        accumulated_break_minutes: evaluation.accumulated_break_minutes,
        daily_drive_minutes: evaluation.daily_drive_minutes,
        remaining_daily_drive_minutes: evaluation.remaining_daily_drive_minutes,
        daily_10h_extensions_used_this_week: evaluation.daily_10h_extensions_used_this_week,
        reduced_daily_rests_used_this_week: evaluation.reduced_daily_rests_used_this_week,
        weekly_drive_minutes: evaluation.weekly_drive_minutes,
        fortnightly_drive_minutes: evaluation.fortnightly_drive_minutes,
        radar_status: evaluation.radar_status,
        infringement_severity: evaluation.infringement_severity,
        infringement_details:
          evaluation.active_infringements.map((i) => i.description).join('; ') || null,
        estimated_penalty_eur: evaluation.total_estimated_penalties_eur,
        recommended_action: evaluation.recommended_action,
      },
      { onConflict: 'driver_id' }
    );

    // Traceability audit log
    await recordAuditLog({
      actionType: 'create',
      entityType: 'driver_tachograph_logs',
      entityId: logEntry.id,
      newData: {
        driver_id: input.driver_id,
        activity_type: input.activity_type,
        duration_minutes: durationMinutes,
        radar_status: evaluation.radar_status,
        penalties_eur: evaluation.total_estimated_penalties_eur,
      },
    });


    // 6. Proactive WhatsApp rest alert dispatch if driver reached critical urgency (<=15 min)
    if (
      evaluation.radar_status === 'critical_urgency' ||
      evaluation.remaining_continuous_drive_minutes <= 15
    ) {
      TachographRestAlertService.triggerCriticalRestAlert({
        driverId: input.driver_id,
        remainingMinutes: evaluation.remaining_continuous_drive_minutes,
        radarStatus: evaluation.radar_status,
        truckPlate,
      }).catch((alertErr) => {
        console.warn('Auto Tachograph Rest Alert background dispatch failed:', alertErr);
      });
    }

    try {
      revalidatePath('/fleet');
    } catch {
      // safe fallback if not in request context
    }


    return {
      success: true,
      log: logEntry,
      evaluation,
    };
  } catch (error: any) {
    console.error('Error logging driver tachograph activity:', error);
    return { success: false, error: error.message || 'حدث خطأ أثناء تسجيل نشاط التاكوغراف' };
  }
}

export interface RecordTachographActivityInput {
  driverId: string | number;
  vehicleId?: string | number;
  activityType: import('../types/tachograph.types').TachographActivityType;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  source?: string;
  notes?: string;
}

/**
 * Helper Server Action to record tachograph activity from automated FMS / CAN-Bus telemetry webhooks
 */
export async function recordTachographActivityAction(input: RecordTachographActivityInput) {
  try {
    const supabase = await createClient();
    let numericDriverId =
      typeof input.driverId === 'number' ? input.driverId : parseInt(String(input.driverId), 10);

    if (isNaN(numericDriverId)) {
      const { data: driverByCard } = await supabase
        .from('drivers')
        .select('id')
        .or(`license.eq.${input.driverId},cin.eq.${input.driverId}`)
        .maybeSingle();
      if (driverByCard) {
        numericDriverId = driverByCard.id;
      } else {
        return { success: false, error: `لم يتم العثور على السائق بالمعرف: ${input.driverId}` };
      }
    }

    let resolvedTruckId: number | null = null;
    if (input.vehicleId) {
      if (typeof input.vehicleId === 'number') {
        resolvedTruckId = input.vehicleId;
      } else {
        const parsedNum = parseInt(String(input.vehicleId), 10);
        if (!isNaN(parsedNum) && String(parsedNum) === String(input.vehicleId)) {
          resolvedTruckId = parsedNum;
        } else {
          const { data: truckByPlate } = await supabase
            .from('trucks')
            .select('id')
            .ilike('plate_number', `%${input.vehicleId}%`)
            .maybeSingle();
          if (truckByPlate) {
            resolvedTruckId = truckByPlate.id;
          }
        }
      }
    }

    return await logDriverActivityAction({
      driver_id: numericDriverId,
      truck_id: resolvedTruckId,
      activity_type: input.activityType,
      start_time: input.startedAt,
      end_time: input.endedAt || undefined,
      duration_minutes: input.durationMinutes || 0,
      metadata: {
        source: input.source || 'auto_sync',
        notes: input.notes,
      },
    });
  } catch (error: any) {
    console.error('Error in recordTachographActivityAction:', error);
    return { success: false, error: error.message || 'فشل تسجيل نشاط التاكوغراف الآلي' };
  }
}

/**
 * Triggers an immediate WhatsApp rest alert to the driver with nearest certified safe parking
 */
export async function triggerDriverRestAlertAction(
  driverId: number,
  options?: { forceSend?: boolean; language?: 'ar' | 'fr' | 'es'; latitude?: number; longitude?: number }
): Promise<RestAlertDispatchResult> {

  try {
    const supabase = await createClient();
    const { data: snapshot } = await supabase
      .from('driver_compliance_snapshots')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();

    const remainingMinutes = snapshot?.remaining_continuous_drive_minutes ?? 15;
    const radarStatus = snapshot?.radar_status ?? 'critical_urgency';

    const result = await TachographRestAlertService.triggerCriticalRestAlert({
      driverId,
      remainingMinutes,
      radarStatus,
      latitude: options?.latitude,
      longitude: options?.longitude,
      forceSend: options?.forceSend ?? true,
      language: options?.language ?? 'ar',
    });

    return result;
  } catch (error: any) {
    console.error('Error in triggerDriverRestAlertAction:', error);
    return {
      success: false,
      alertSent: false,
      error: error.message || 'فشل إرسال تنبيه الاستراحة للواتساب',
    };
  }
}

/**
 * 2. Retrieves live compliance radar snapshot for a specific driver
 */


export async function getDriverComplianceRadarAction(driverId: number) {
  try {
    const supabase = await createClient();

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, name, default_truck_id')
      .eq('id', driverId)
      .maybeSingle();

    if (!driver) {
      return { success: false, error: 'السائق غير موجود' };
    }

    let truckPlate: string | null = null;
    if (driver.default_truck_id) {
      const { data: truck } = await supabase
        .from('trucks')
        .select('plate_number')
        .eq('id', driver.default_truck_id)
        .maybeSingle();
      truckPlate = truck?.plate_number ?? null;
    }

    const { data: snapshot } = await supabase
      .from('driver_compliance_snapshots')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle();

    if (!snapshot) {
      // Default initial snapshot
      const defaultEval = TachographComplianceEngine.evaluateDriverCompliance({
        driver_id: driver.id,
        driver_name: driver.name,
        truck_plate: truckPlate,
        current_activity: 'rest',
        activities: [],
        daily_drive_minutes: 0,
        weekly_drive_minutes: 0,
        fortnightly_drive_minutes: 0,
      });
      return { success: true, result: defaultEval };
    }

    // Build DriverComplianceStatusResult from snapshot
    const result: DriverComplianceStatusResult = {
      driver_id: driver.id,
      driver_name: driver.name,
      truck_plate: truckPlate,
      current_activity: snapshot.current_activity,

      snapshot_timestamp: snapshot.snapshot_timestamp,
      continuous_drive_minutes: snapshot.continuous_drive_minutes,
      remaining_continuous_drive_minutes: snapshot.remaining_continuous_drive_minutes,
      accumulated_break_minutes: snapshot.accumulated_break_minutes,
      is_split_break_pending: false,
      daily_drive_minutes: snapshot.daily_drive_minutes,
      remaining_daily_drive_minutes: snapshot.remaining_daily_drive_minutes,
      daily_drive_ceiling_minutes: snapshot.daily_drive_minutes > 540 ? 600 : 540,
      daily_10h_extensions_used_this_week: snapshot.daily_10h_extensions_used_this_week,
      extensions_remaining_this_week: Math.max(0, 2 - snapshot.daily_10h_extensions_used_this_week),
      reduced_daily_rests_used_this_week: snapshot.reduced_daily_rests_used_this_week,
      weekly_drive_minutes: snapshot.weekly_drive_minutes,
      remaining_weekly_drive_minutes: Math.max(0, 3360 - snapshot.weekly_drive_minutes),
      fortnightly_drive_minutes: snapshot.fortnightly_drive_minutes,
      remaining_fortnightly_drive_minutes: Math.max(0, 5400 - snapshot.fortnightly_drive_minutes),
      radar_status: snapshot.radar_status,
      infringement_severity: snapshot.infringement_severity,
      active_infringements: snapshot.infringement_details
        ? [
            {
              type: 'continuous_drive',
              severity: snapshot.infringement_severity,
              description: snapshot.infringement_details,
              excess_minutes: 0,
              estimated_fine_eur: String(snapshot.estimated_penalty_eur || '0.00'),
            },
          ]
        : [],
      total_estimated_penalties_eur: String(snapshot.estimated_penalty_eur || '0.00'),
      recommended_action: snapshot.recommended_action || 'القيادة ضمن الحدود المسموحة نظامياً',
      urgency_level:
        snapshot.radar_status === 'violation'
          ? 'critical_breach'
          : snapshot.radar_status === 'critical_urgency'
          ? 'red'
          : snapshot.radar_status === 'warning'
          ? 'yellow'
          : 'green',
    };

    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message || 'فشل جلب رادار السائق' };
  }
}

/**
 * 3. Retrieves fleet-wide compliance radar summary
 */
export async function getFleetComplianceRadarAction(rawFilter?: unknown) {
  try {
    const supabase = await createClient();
    const filter = tachographRadarFilterSchema.parse(rawFilter || {});

    // Fetch drivers
    let driversQuery = supabase
      .from('drivers')
      .select('id, name, default_truck_id, status')
      .eq('status', 'active');

    if (filter.search) {
      driversQuery = driversQuery.ilike('name', `%${filter.search}%`);
    }

    const { data: drivers, error: driversErr } = await driversQuery;
    if (driversErr) throw driversErr;

    const driverList = drivers || [];
    if (driverList.length === 0) {
      return {
        success: true,
        summary: TachographComplianceEngine.summarizeFleetCompliance([]),
      };
    }

    const driverIds = driverList.map((d) => d.id);
    const truckIds = driverList
      .map((d) => d.default_truck_id)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    let truckMap = new Map<number, string>();
    if (truckIds.length > 0) {
      const { data: trucks } = await supabase
        .from('trucks')
        .select('id, plate_number')
        .in('id', truckIds);
      if (trucks) {
        truckMap = new Map(trucks.map((t) => [t.id, t.plate_number]));
      }
    }

    // Fetch snapshots for all active drivers
    const { data: snapshots } = await supabase
      .from('driver_compliance_snapshots')
      .select('*')
      .in('driver_id', driverIds);

    const snapshotMap = new Map((snapshots || []).map((s) => [s.driver_id, s]));

    const evaluatedDrivers: DriverComplianceStatusResult[] = driverList.map((d) => {
      const snap = snapshotMap.get(d.id);
      const plate = d.default_truck_id ? truckMap.get(d.default_truck_id) || null : null;

      if (!snap) {
        return {
          driver_id: d.id,
          driver_name: d.name,
          truck_plate: plate,
          current_activity: 'rest',
          snapshot_timestamp: new Date().toISOString(),
          continuous_drive_minutes: 0,
          remaining_continuous_drive_minutes: 270,
          accumulated_break_minutes: 0,
          is_split_break_pending: false,
          daily_drive_minutes: 0,
          remaining_daily_drive_minutes: 540,
          daily_drive_ceiling_minutes: 540,
          daily_10h_extensions_used_this_week: 0,
          extensions_remaining_this_week: 2,
          reduced_daily_rests_used_this_week: 0,
          weekly_drive_minutes: 0,
          remaining_weekly_drive_minutes: 3360,
          fortnightly_drive_minutes: 0,
          remaining_fortnightly_drive_minutes: 5400,
          radar_status: 'compliant',
          infringement_severity: 'none',
          active_infringements: [],
          total_estimated_penalties_eur: '0.00',
          recommended_action: 'القيادة ضمن الحدود المسموحة نظامياً (EC 561/2006)',
          urgency_level: 'green',
        };
      }

      return {
        driver_id: d.id,
        driver_name: d.name,
        truck_plate: plate,
        current_activity: snap.current_activity,

        snapshot_timestamp: snap.snapshot_timestamp,
        continuous_drive_minutes: snap.continuous_drive_minutes,
        remaining_continuous_drive_minutes: snap.remaining_continuous_drive_minutes,
        accumulated_break_minutes: snap.accumulated_break_minutes,
        is_split_break_pending: false,
        daily_drive_minutes: snap.daily_drive_minutes,
        remaining_daily_drive_minutes: snap.remaining_daily_drive_minutes,
        daily_drive_ceiling_minutes: snap.daily_drive_minutes > 540 ? 600 : 540,
        daily_10h_extensions_used_this_week: snap.daily_10h_extensions_used_this_week,
        extensions_remaining_this_week: Math.max(0, 2 - snap.daily_10h_extensions_used_this_week),
        reduced_daily_rests_used_this_week: snap.reduced_daily_rests_used_this_week,
        weekly_drive_minutes: snap.weekly_drive_minutes,
        remaining_weekly_drive_minutes: Math.max(0, 3360 - snap.weekly_drive_minutes),
        fortnightly_drive_minutes: snap.fortnightly_drive_minutes,
        remaining_fortnightly_drive_minutes: Math.max(0, 5400 - snap.fortnightly_drive_minutes),
        radar_status: snap.radar_status,
        infringement_severity: snap.infringement_severity,
        active_infringements: snap.infringement_details
          ? [
              {
                type: 'continuous_drive',
                severity: snap.infringement_severity,
                description: snap.infringement_details,
                excess_minutes: 0,
                estimated_fine_eur: String(snap.estimated_penalty_eur || '0.00'),
              },
            ]
          : [],
        total_estimated_penalties_eur: String(snap.estimated_penalty_eur || '0.00'),
        recommended_action: snap.recommended_action || 'القيادة ضمن الحدود المسموحة نظامياً',
        urgency_level:
          snap.radar_status === 'violation'
            ? 'critical_breach'
            : snap.radar_status === 'critical_urgency'
            ? 'red'
            : snap.radar_status === 'warning'
            ? 'yellow'
            : 'green',
      };
    });

    // Apply status filter if specified
    const filteredDrivers =
      filter.radar_status && filter.radar_status !== 'all'
        ? evaluatedDrivers.filter((d) => d.radar_status === filter.radar_status)
        : evaluatedDrivers;

    const summary = TachographComplianceEngine.summarizeFleetCompliance(filteredDrivers);

    return { success: true, summary };
  } catch (error: any) {
    console.error('Error getting fleet compliance radar:', error);
    return { success: false, error: error.message || 'فشل جلب رادار امتثال الأسطول' };
  }
}

