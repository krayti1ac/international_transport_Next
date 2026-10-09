'use server';

/**
 * Trans Bodanon TMS — Reefer Refrigerant Leak & TXV Predictive Radar Server Actions
 * Standards: EN 12830 / ATP Treaty (FRC) / ISO 14903 Refrigerant Tightness
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { RefrigerantDiagnosticsService } from './refrigerant-diagnostics.service';
import {
  recordCircuitDiagnosticsSchema,
  resolveLeakIncidentSchema,
} from '../types/refrigerant-radar.types';
import type {
  RecordCircuitDiagnosticsInput,
  ReeferCircuitDiagnosticsLog,
  ReeferPredictiveLeakIncident,
  RefrigerantRadarSummary,
  ResolveLeakIncidentInput,
} from '../types/refrigerant-radar.types';

/**
 * 1. Fetch Recent Refrigerant Circuit Diagnostic Logs
 */
export async function getCircuitDiagnosticsLogsAction(
  trailerId?: number
): Promise<{
  success: boolean;
  data?: ReeferCircuitDiagnosticsLog[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('reefer_circuit_diagnostics_logs')
      .select('*, trailer:trailers(id, plate_number), trip:trip_orders(id, trip_number)')
      .order('recorded_at', { ascending: false })
      .limit(50);

    if (trailerId) {
      query = query.eq('trailer_id', trailerId);
    }

    const { data: rows, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const logs: ReeferCircuitDiagnosticsLog[] = (rows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
      tripId: row.trip_id,
      tripNumber: row.trip?.trip_number,
      refrigerantType: row.refrigerant_type,
      suctionPressureBar: Number(row.suction_pressure_bar),
      dischargePressureBar: Number(row.discharge_pressure_bar),
      evaporatorTempC: Number(row.evaporator_temp_c),
      suctionLineTempC: Number(row.suction_line_temp_c),
      condenserTempC: Number(row.condenser_temp_c),
      liquidLineTempC: Number(row.liquid_line_temp_c),
      superheatC: Number(row.superheat_c),
      subcoolingC: Number(row.subcooling_c),
      compressorRpm: row.compressor_rpm,
      compressorDutyCyclePct: row.compressor_duty_cycle_pct ? Number(row.compressor_duty_cycle_pct) : null,
      ambientTempC: row.ambient_temp_c ? Number(row.ambient_temp_c) : null,
      source: row.source,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    }));

    return { success: true, data: logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب سجلات قياسات دائرة التبريد';
    return { success: false, error: msg };
  }
}

/**
 * 2. Record Manifold Gauge / Telematics Circuit Diagnostic Reading
 * Evaluates thermodynamic balance and auto-generates predictive leak/TXV incidents
 */
export async function recordCircuitDiagnosticsAction(
  rawInput: RecordCircuitDiagnosticsInput
): Promise<{
  success: boolean;
  logId?: string;
  incidentCreated?: boolean;
  incidentId?: string;
  error?: string;
}> {
  try {
    const input = recordCircuitDiagnosticsSchema.parse(rawInput);
    const supabase = await createClient();

    // Fetch user company
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let companyId = 1;
    let actorEmail = 'system';
    if (user) {
      const { data: u } = await supabase.from('users').select('company_id, email').eq('id', user.id).maybeSingle();
      if (u?.company_id) companyId = u.company_id;
      if (u?.email) actorEmail = u.email;
    }

    // Evaluate circuit health
    const evaluation = RefrigerantDiagnosticsService.evaluateCircuitHealth({
      refrigerantType: input.refrigerantType,
      suctionPressureBar: input.suctionPressureBar,
      dischargePressureBar: input.dischargePressureBar,
      evaporatorTempC: input.evaporatorTempC,
      suctionLineTempC: input.suctionLineTempC,
      condenserTempC: input.condenserTempC,
      liquidLineTempC: input.liquidLineTempC,
      ambientTempC: input.ambientTempC,
    });

    // Insert log
    const { data: logData, error: logError } = await supabase
      .from('reefer_circuit_diagnostics_logs')
      .insert({
        company_id: companyId,
        trailer_id: input.trailerId,
        trip_id: input.tripId || null,
        refrigerant_type: input.refrigerantType,
        suction_pressure_bar: input.suctionPressureBar,
        discharge_pressure_bar: input.dischargePressureBar,
        evaporator_temp_c: input.evaporatorTempC,
        suction_line_temp_c: input.suctionLineTempC,
        condenser_temp_c: input.condenserTempC,
        liquid_line_temp_c: input.liquidLineTempC,
        superheat_c: evaluation.superheatC,
        subcooling_c: evaluation.subcoolingC,
        compressor_rpm: input.compressorRpm || null,
        compressor_duty_cycle_pct: input.compressorDutyCyclePct || null,
        ambient_temp_c: input.ambientTempC || null,
        source: input.source,
      })
      .select('id')
      .single();

    if (logError) {
      return { success: false, error: logError.message };
    }

    let incidentCreated = false;
    let incidentId: string | undefined = undefined;

    // If an anomaly is detected, create predictive incident
    if (evaluation.isAnomaly) {
      const { data: incData, error: incError } = await supabase
        .from('reefer_predictive_leak_incidents')
        .insert({
          company_id: companyId,
          trailer_id: input.trailerId,
          trip_id: input.tripId || null,
          refrigerant_type: input.refrigerantType,
          incident_type: evaluation.incidentType,
          severity: evaluation.severity,
          risk_score: evaluation.riskScore,
          estimated_refrigerant_loss_pct: evaluation.estimatedRefrigerantLossPct,
          suction_pressure_bar: input.suctionPressureBar,
          discharge_pressure_bar: input.dischargePressureBar,
          superheat_c: evaluation.superheatC,
          subcooling_c: evaluation.subcoolingC,
          description: evaluation.description,
          recommended_action: evaluation.recommendedAction,
        })
        .select('id')
        .single();

      if (!incError && incData) {
        incidentCreated = true;
        incidentId = incData.id;

        await recordAuditLog({
          actionType: 'security_alert',
          entityType: 'reefer_predictive_leak_incidents',
          entityId: incData.id,
          reason: 'reefer_predictive_leak_detected',
          newData: {
            trailerId: input.trailerId,
            incidentType: evaluation.incidentType,
            riskScore: evaluation.riskScore,
            estimatedLoss: evaluation.estimatedRefrigerantLossPct,
            severity: evaluation.severity,
          },
        });
      }
    }

    return {
      success: true,
      logId: logData.id,
      incidentCreated,
      incidentId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تسجيل قياسات دائرة التبريد';
    return { success: false, error: msg };
  }
}

/**
 * 3. Fetch Predictive Leak & TXV Incidents
 */
export async function getPredictiveLeakIncidentsAction(
  trailerId?: number
): Promise<{
  success: boolean;
  data?: ReeferPredictiveLeakIncident[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('reefer_predictive_leak_incidents')
      .select('*, trailer:trailers(id, plate_number), trip:trip_orders(id, trip_number)')
      .order('is_resolved', { ascending: true })
      .order('risk_score', { ascending: false })
      .limit(50);

    if (trailerId) {
      query = query.eq('trailer_id', trailerId);
    }

    const { data: rows, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const incidents: ReeferPredictiveLeakIncident[] = (rows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
      tripId: row.trip_id,
      tripNumber: row.trip?.trip_number,
      refrigerantType: row.refrigerant_type,
      incidentType: row.incident_type,
      severity: row.severity,
      riskScore: row.risk_score,
      estimatedRefrigerantLossPct: Number(row.estimated_refrigerant_loss_pct || 0),
      suctionPressureBar: row.suction_pressure_bar ? Number(row.suction_pressure_bar) : null,
      dischargePressureBar: row.discharge_pressure_bar ? Number(row.discharge_pressure_bar) : null,
      superheatC: row.superheat_c ? Number(row.superheat_c) : null,
      subcoolingC: row.subcooling_c ? Number(row.subcooling_c) : null,
      description: row.description,
      recommendedAction: row.recommended_action,
      maintenanceTicketId: row.maintenance_ticket_id,
      isResolved: row.is_resolved,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, data: incidents };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب إنذارات تسريب الفريون';
    return { success: false, error: msg };
  }
}

/**
 * 4. Resolve Leak Incident
 */
export async function resolveLeakIncidentAction(
  rawInput: ResolveLeakIncidentInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = resolveLeakIncidentSchema.parse(rawInput);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('reefer_predictive_leak_incidents')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email || 'Dispatcher',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.incidentId);

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'reefer_predictive_leak_incidents',
      entityId: input.incidentId,
      reason: 'reefer_leak_incident_resolved',
      newData: { resolvedBy: user?.email, notes: input.notes },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل إغلاق إنذار التسريب';
    return { success: false, error: msg };
  }
}

/**
 * 5. Link Incident to Maintenance Ticket
 */
export async function linkIncidentToMaintenanceTicketAction(
  incidentId: string,
  maintenanceTicketId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('reefer_predictive_leak_incidents')
      .update({
        maintenance_ticket_id: maintenanceTicketId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', incidentId);

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'reefer_predictive_leak_incidents',
      entityId: incidentId,
      reason: 'reefer_leak_linked_maintenance',
      newData: { maintenanceTicketId },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل ربط الإنذار بتذكرة الصيانة';
    return { success: false, error: msg };
  }
}

/**
 * 6. Fetch Fleet Refrigerant Radar Summary KPIs
 */
export async function getRefrigerantRadarSummaryAction(): Promise<{
  success: boolean;
  data?: RefrigerantRadarSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Trailers count
    const { count: trailersCount } = await supabase
      .from('trailers')
      .select('id', { count: 'exact', head: true });

    // 2. Recent logs
    const { data: logsRows } = await supabase
      .from('reefer_circuit_diagnostics_logs')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100);

    // 3. Incidents
    const { data: incidentsRows } = await supabase
      .from('reefer_predictive_leak_incidents')
      .select('*')
      .eq('is_resolved', false);

    const mappedLogs: ReeferCircuitDiagnosticsLog[] = (logsRows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      refrigerantType: row.refrigerant_type,
      suctionPressureBar: Number(row.suction_pressure_bar),
      dischargePressureBar: Number(row.discharge_pressure_bar),
      evaporatorTempC: Number(row.evaporator_temp_c),
      suctionLineTempC: Number(row.suction_line_temp_c),
      condenserTempC: Number(row.condenser_temp_c),
      liquidLineTempC: Number(row.liquid_line_temp_c),
      superheatC: Number(row.superheat_c),
      subcoolingC: Number(row.subcooling_c),
      source: row.source,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    }));

    const mappedIncidents: ReeferPredictiveLeakIncident[] = (incidentsRows || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      trailerId: row.trailer_id,
      refrigerantType: row.refrigerant_type,
      incidentType: row.incident_type,
      severity: row.severity,
      riskScore: row.risk_score,
      estimatedRefrigerantLossPct: Number(row.estimated_refrigerant_loss_pct || 0),
      description: row.description,
      recommendedAction: row.recommended_action,
      isResolved: row.is_resolved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const summary = RefrigerantDiagnosticsService.calculateFleetSummary(
      trailersCount || 0,
      mappedLogs,
      mappedIncidents
    );

    return { success: true, data: summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل حساب ملخص رادار غاز التبريد';
    return { success: false, error: msg };
  }
}
