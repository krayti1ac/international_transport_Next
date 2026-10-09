'use server';

/**
 * Trans Bodanon TMS — Multi-Temp & Multi-Compartment Reefer Server Actions
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / USP <1151> MKT
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { MultiTempGuardService } from './multi-temp-guard.service';
import {
  createCompartmentProfileSchema,
  recordCompartmentTelemetrySchema,
  resolveBulkheadAlertSchema,
} from '../types/multi-temp.types';
import type {
  CreateCompartmentProfileInput,
  MultiTempTrailerMatrixSummary,
  RecordCompartmentTelemetryInput,
  ReeferCompartmentProfile,
  ReeferCompartmentTelemetryLog,
  ReeferCrossBulkheadAlert,
  ResolveBulkheadAlertInput,
} from '../types/multi-temp.types';

/**
 * 1. Fetch Compartment Profiles for a Trailer
 */
export async function getTrailerCompartmentsAction(
  trailerId: number
): Promise<{
  success: boolean;
  data?: ReeferCompartmentProfile[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('reefer_compartment_profiles')
      .select('*, trailer:trailers(id, plate_number), trip:trip_orders(id, trip_number)')
      .eq('trailer_id', trailerId)
      .eq('is_active', true)
      .order('compartment_code', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const profiles: ReeferCompartmentProfile[] = (rows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
      tripId: row.trip_id,
      tripNumber: row.trip?.trip_number,
      configurationType: row.configuration_type,
      compartmentCode: row.compartment_code,
      compartmentName: row.compartment_name,
      cargoCategory: row.cargo_category,
      setpointTempC: Number(row.setpoint_temp_c),
      minTempLimitC: Number(row.min_temp_limit_c),
      maxTempLimitC: Number(row.max_temp_limit_c),
      evaporatorModel: row.evaporator_model,
      hasSideDoor: Boolean(row.has_side_door),
      hasRearDoor: Boolean(row.has_rear_door),
      bulkheadPositionPct: Number(row.bulkhead_position_pct || 50),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: profiles };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب حجرات المقطورة المبردة';
    return { success: false, error: msg };
  }
}

/**
 * 2. Create or Update Compartment Profile
 */
export async function createCompartmentProfileAction(
  rawInput: CreateCompartmentProfileInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const input = createCompartmentProfileSchema.parse(rawInput);
    const supabase = await createClient();

    // Fetch user company
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let companyId = 1;
    if (user) {
      const { data: u } = await supabase.from('users').select('company_id').eq('id', user.id).maybeSingle();
      if (u?.company_id) companyId = u.company_id;
    }

    const { data, error } = await supabase
      .from('reefer_compartment_profiles')
      .insert({
        company_id: companyId,
        trailer_id: input.trailerId,
        trip_id: input.tripId || null,
        configuration_type: input.configurationType,
        compartment_code: input.compartmentCode,
        compartment_name: input.compartmentName,
        cargo_category: input.cargoCategory,
        setpoint_temp_c: input.setpointTempC,
        min_temp_limit_c: input.minTempLimitC,
        max_temp_limit_c: input.maxTempLimitC,
        evaporator_model: input.evaporatorModel || null,
        has_side_door: input.hasSideDoor,
        has_rear_door: input.hasRearDoor,
        bulkhead_position_pct: input.bulkheadPositionPct,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'create',
      entityType: 'reefer_compartment_profiles',
      entityId: data.id,
      reason: 'create_reefer_compartment_profile',
      newData: {
        trailerId: input.trailerId,
        compartmentCode: input.compartmentCode,
        setpointTempC: input.setpointTempC,
      },
    });

    return { success: true, id: data.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل إنشاء حجرة التبريد';
    return { success: false, error: msg };
  }
}

/**
 * 3. Record Telemetry Log for a Compartment & Evaluate Bulkhead Integrity
 */
export async function recordCompartmentTelemetryAction(
  rawInput: RecordCompartmentTelemetryInput
): Promise<{
  success: boolean;
  logId?: string;
  bulkheadAlertCreated?: boolean;
  alertId?: string;
  error?: string;
}> {
  try {
    const input = recordCompartmentTelemetrySchema.parse(rawInput);
    const supabase = await createClient();

    // Fetch user company
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let companyId = 1;
    if (user) {
      const { data: u } = await supabase.from('users').select('company_id').eq('id', user.id).maybeSingle();
      if (u?.company_id) companyId = u.company_id;
    }

    // Fetch compartment profile to check bounds
    const { data: profile } = await supabase
      .from('reefer_compartment_profiles')
      .select('*')
      .eq('id', input.compartmentId)
      .single();

    const isExcursion = profile
      ? input.returnAirTempC < Number(profile.min_temp_limit_c) ||
        input.returnAirTempC > Number(profile.max_temp_limit_c)
      : false;

    // Insert log
    const { data: logData, error: logError } = await supabase
      .from('reefer_compartment_telemetry_logs')
      .insert({
        company_id: companyId,
        compartment_id: input.compartmentId,
        trailer_id: input.trailerId,
        trip_id: input.tripId || null,
        supply_air_temp_c: input.supplyAirTempC,
        return_air_temp_c: input.returnAirTempC,
        cargo_probe_temp_c: input.cargoProbeTempC,
        evaporator_mode: input.evaporatorMode,
        door_open: input.doorOpen,
        door_type: input.doorType,
        is_excursion: isExcursion,
        recorded_at: input.recordedAt || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (logError) {
      return { success: false, error: logError.message };
    }

    let bulkheadAlertCreated = false;
    let alertId: string | undefined = undefined;

    // Check cross-bulkhead leakage with adjacent compartments
    if (profile) {
      const { data: adjacentProfiles } = await supabase
        .from('reefer_compartment_profiles')
        .select('*')
        .eq('trailer_id', input.trailerId)
        .neq('id', input.compartmentId)
        .eq('is_active', true);

      if (adjacentProfiles && adjacentProfiles.length > 0) {
        for (const adj of adjacentProfiles) {
          // Fetch recent logs of both compartments
          const [{ data: sourceLogs }, { data: adjLogs }] = await Promise.all([
            supabase
              .from('reefer_compartment_telemetry_logs')
              .select('*')
              .eq('compartment_id', input.compartmentId)
              .order('recorded_at', { ascending: false })
              .limit(5),
            supabase
              .from('reefer_compartment_telemetry_logs')
              .select('*')
              .eq('compartment_id', adj.id)
              .order('recorded_at', { ascending: false })
              .limit(5),
          ]);

          if (sourceLogs && adjLogs && sourceLogs.length >= 2 && adjLogs.length >= 1) {
            const mappedSource = sourceLogs.map((l: any) => ({
              ...l,
              supplyAirTempC: Number(l.supply_air_temp_c),
              returnAirTempC: Number(l.return_air_temp_c),
              cargoProbeTempC: Number(l.cargo_probe_temp_c),
              recordedAt: l.recorded_at,
              doorOpen: Boolean(l.door_open),
            }));

            const mappedAdj = adjLogs.map((l: any) => ({
              ...l,
              supplyAirTempC: Number(l.supply_air_temp_c),
              returnAirTempC: Number(l.return_air_temp_c),
              cargoProbeTempC: Number(l.cargo_probe_temp_c),
              recordedAt: l.recorded_at,
              doorOpen: Boolean(l.door_open),
            }));

            const alertEval = MultiTempGuardService.evaluateCrossBulkheadIntegrity({
              sourceProfile: {
                ...profile,
                companyId: profile.company_id,
                trailerId: profile.trailer_id,
                compartmentCode: profile.compartment_code,
                setpointTempC: Number(profile.setpoint_temp_c),
                minTempLimitC: Number(profile.min_temp_limit_c),
                maxTempLimitC: Number(profile.max_temp_limit_c),
              },
              adjacentProfile: {
                ...adj,
                companyId: adj.company_id,
                trailerId: adj.trailer_id,
                compartmentCode: adj.compartment_code,
                setpointTempC: Number(adj.setpoint_temp_c),
                minTempLimitC: Number(adj.min_temp_limit_c),
                maxTempLimitC: Number(adj.max_temp_limit_c),
              },
              sourceLogs: mappedSource,
              adjacentLogs: mappedAdj,
            });

            if (alertEval) {
              const { data: newAlert, error: alertError } = await supabase
                .from('reefer_cross_bulkhead_alerts')
                .insert({
                  company_id: companyId,
                  trailer_id: input.trailerId,
                  trip_id: input.tripId || null,
                  source_compartment_code: alertEval.sourceCompartmentCode,
                  adjacent_compartment_code: alertEval.adjacentCompartmentCode,
                  delta_t_c: alertEval.deltaTC,
                  leakage_rate_c_per_hr: alertEval.leakageRateCPerHr,
                  severity: alertEval.severity,
                  description: alertEval.description,
                  recommended_action: alertEval.recommendedAction,
                })
                .select('id')
                .single();

              if (!alertError && newAlert) {
                bulkheadAlertCreated = true;
                alertId = newAlert.id;

                await recordAuditLog({
                  actionType: 'security_alert',
                  entityType: 'reefer_cross_bulkhead_alerts',
                  entityId: newAlert.id,
                  reason: 'reefer_cross_bulkhead_leakage_detected',
                  newData: {
                    trailerId: input.trailerId,
                    sourceCompartment: alertEval.sourceCompartmentCode,
                    adjacentCompartment: alertEval.adjacentCompartmentCode,
                    deltaT: alertEval.deltaTC,
                    leakageRate: alertEval.leakageRateCPerHr,
                  },
                });
              }
              break;
            }
          }
        }
      }
    }

    return {
      success: true,
      logId: logData.id,
      bulkheadAlertCreated,
      alertId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تسجيل بيانات تليماتيكس الحجرة';
    return { success: false, error: msg };
  }
}

/**
 * 4. Fetch Compartment Telemetry Logs
 */
export async function getCompartmentTelemetryLogsAction(
  compartmentId: string
): Promise<{
  success: boolean;
  data?: ReeferCompartmentTelemetryLog[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('reefer_compartment_telemetry_logs')
      .select('*, compartment:reefer_compartment_profiles(compartment_code, compartment_name)')
      .eq('compartment_id', compartmentId)
      .order('recorded_at', { ascending: false })
      .limit(60);

    if (error) {
      return { success: false, error: error.message };
    }

    const logs: ReeferCompartmentTelemetryLog[] = (rows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      compartmentId: row.compartment_id,
      compartmentCode: row.compartment?.compartment_code,
      compartmentName: row.compartment?.compartment_name,
      trailerId: row.trailer_id,
      tripId: row.trip_id,
      supplyAirTempC: Number(row.supply_air_temp_c),
      returnAirTempC: Number(row.return_air_temp_c),
      cargoProbeTempC: Number(row.cargo_probe_temp_c),
      evaporatorMode: row.evaporator_mode,
      doorOpen: Boolean(row.door_open),
      doorType: row.door_type,
      isExcursion: Boolean(row.is_excursion),
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    }));

    return { success: true, data: logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب سجلات الحجرة';
    return { success: false, error: msg };
  }
}

/**
 * 5. Fetch Cross-Bulkhead Alerts
 */
export async function getCrossBulkheadAlertsAction(
  trailerId?: number
): Promise<{
  success: boolean;
  data?: ReeferCrossBulkheadAlert[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('reefer_cross_bulkhead_alerts')
      .select('*, trailer:trailers(id, plate_number), trip:trip_orders(id, trip_number)')
      .order('is_resolved', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50);

    if (trailerId) {
      query = query.eq('trailer_id', trailerId);
    }

    const { data: rows, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const alerts: ReeferCrossBulkheadAlert[] = (rows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
      tripId: row.trip_id,
      tripNumber: row.trip?.trip_number,
      sourceCompartmentCode: row.source_compartment_code,
      adjacentCompartmentCode: row.adjacent_compartment_code,
      deltaTC: Number(row.delta_t_c),
      leakageRateCPerHr: Number(row.leakage_rate_c_per_hr),
      severity: row.severity,
      description: row.description,
      recommendedAction: row.recommended_action,
      isResolved: Boolean(row.is_resolved),
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at,
    }));

    return { success: true, data: alerts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب إنذارات الحواجز العازلة';
    return { success: false, error: msg };
  }
}

/**
 * 6. Resolve Bulkhead Alert
 */
export async function resolveBulkheadAlertAction(
  rawInput: ResolveBulkheadAlertInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = resolveBulkheadAlertSchema.parse(rawInput);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('reefer_cross_bulkhead_alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || 'Dispatcher',
      })
      .eq('id', input.alertId);

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'reefer_cross_bulkhead_alerts',
      entityId: input.alertId,
      reason: 'reefer_cross_bulkhead_alert_resolved',
      newData: { resolvedBy: user?.email, notes: input.notes },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل حل إنذار الحاجز العازل';
    return { success: false, error: msg };
  }
}

/**
 * 7. Fetch Trailer Multi-Temp Matrix Summary
 */
export async function getMultiTempMatrixSummaryAction(
  trailerId: number
): Promise<{
  success: boolean;
  data?: MultiTempTrailerMatrixSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Trailer info
    const { data: trailer } = await supabase
      .from('trailers')
      .select('id, plate_number')
      .eq('id', trailerId)
      .maybeSingle();

    const trailerPlate = trailer?.plate_number || `REM-${trailerId}`;

    // 2. Compartment profiles
    const { data: profilesRows } = await supabase
      .from('reefer_compartment_profiles')
      .select('*')
      .eq('trailer_id', trailerId)
      .eq('is_active', true)
      .order('compartment_code', { ascending: true });

    const profiles: ReeferCompartmentProfile[] = (profilesRows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate,
      tripId: row.trip_id,
      configurationType: row.configuration_type,
      compartmentCode: row.compartment_code,
      compartmentName: row.compartment_name,
      cargoCategory: row.cargo_category,
      setpointTempC: Number(row.setpoint_temp_c),
      minTempLimitC: Number(row.min_temp_limit_c),
      maxTempLimitC: Number(row.max_temp_limit_c),
      evaporatorModel: row.evaporator_model,
      hasSideDoor: Boolean(row.has_side_door),
      hasRearDoor: Boolean(row.has_rear_door),
      bulkheadPositionPct: Number(row.bulkhead_position_pct || 50),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // 3. Fetch logs for each compartment
    const logsByCompartment: Record<string, ReeferCompartmentTelemetryLog[]> = {};
    for (const p of profiles) {
      const { data: logsRows } = await supabase
        .from('reefer_compartment_telemetry_logs')
        .select('*')
        .eq('compartment_id', p.id)
        .order('recorded_at', { ascending: false })
        .limit(30);

      logsByCompartment[p.id] = (logsRows || []).map((row: any) => ({
        id: row.id,
        companyId: row.company_id,
        compartmentId: row.compartment_id,
        trailerId: row.trailer_id,
        tripId: row.trip_id,
        supplyAirTempC: Number(row.supply_air_temp_c),
        returnAirTempC: Number(row.return_air_temp_c),
        cargoProbeTempC: Number(row.cargo_probe_temp_c),
        evaporatorMode: row.evaporator_mode,
        doorOpen: Boolean(row.door_open),
        doorType: row.door_type,
        isExcursion: Boolean(row.is_excursion),
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
      }));
    }

    // 4. Fetch alerts
    const { data: alertsRows } = await supabase
      .from('reefer_cross_bulkhead_alerts')
      .select('*')
      .eq('trailer_id', trailerId);

    const alerts: ReeferCrossBulkheadAlert[] = (alertsRows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate,
      tripId: row.trip_id,
      sourceCompartmentCode: row.source_compartment_code,
      adjacentCompartmentCode: row.adjacent_compartment_code,
      deltaTC: Number(row.delta_t_c),
      leakageRateCPerHr: Number(row.leakage_rate_c_per_hr),
      severity: row.severity,
      description: row.description,
      recommendedAction: row.recommended_action,
      isResolved: Boolean(row.is_resolved),
      createdAt: row.created_at,
    }));

    const summary = MultiTempGuardService.aggregateTrailerMatrix({
      trailerId,
      trailerPlate,
      profiles,
      logsByCompartment,
      alerts,
    });

    return { success: true, data: summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تجميع مصفوفة الحجرات المتعددة';
    return { success: false, error: msg };
  }
}

