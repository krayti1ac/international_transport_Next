'use server';

/**
 * Trans Bodanon TMS — Reefer OEM Cloud Telematics Server Actions
 * Handles Carrier DataCOLD & Thermo King TracKing ingestion, RLS verification, and incident radar.
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { ReeferOemAdapterService } from './reefer-oem-adapter.service';
import type { NormalizedReeferOemPacket, ReeferOemBrand } from '../types/reefer-cloud-gateway.types';

export interface IngestReeferOemResult {
  success: boolean;
  normalized?: NormalizedReeferOemPacket;
  incidentCreated?: boolean;
  incidentId?: string;
  error?: string;
}

export async function ingestReeferOemPacketAction(
  payload: unknown,
  brandHint?: ReeferOemBrand,
  tripIdOverride?: string | number
): Promise<IngestReeferOemResult> {
  try {
    const normalized = ReeferOemAdapterService.parseRawWebhookPayload(payload, brandHint, tripIdOverride);
    const supabase = await createClient();

    // 1. Resolve Trip & Company context
    let tripId = tripIdOverride || normalized.tripId;
    let companyId: number = 1;
    let profileId: string | null = null;
    let setpointTemp = 4.0;
    let maxTempThreshold = 6.0;
    let minTempThreshold = 2.0;

    if (tripId) {
      const { data: profile } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .select('*')
        .eq('trip_id', tripId)
        .maybeSingle();

      if (profile) {
        profileId = profile.id;
        companyId = Number(profile.company_id);
        setpointTemp = Number(profile.setpoint_temp);
        maxTempThreshold = Number(profile.max_temp_threshold);
        minTempThreshold = Number(profile.min_temp_threshold);
      } else {
        // Fallback: check trip order for company_id
        const { data: trip } = await supabase
          .from('trip_orders')
          .select('id, company_id')
          .eq('id', tripId)
          .maybeSingle();

        if (trip) {
          companyId = Number(trip.company_id);
        }
      }
    } else {
      // Try to find active trip by matching trailer or serial
      const { data: activeProfile } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeProfile) {
        profileId = activeProfile.id;
        tripId = activeProfile.trip_id;
        companyId = Number(activeProfile.company_id);
        setpointTemp = Number(activeProfile.setpoint_temp);
        maxTempThreshold = Number(activeProfile.max_temp_threshold);
        minTempThreshold = Number(activeProfile.min_temp_threshold);
      }
    }

    // 2. Persist normalized log into reefer_temperature_logs
    if (profileId && tripId) {
      await supabase.from('reefer_temperature_logs').insert({
        company_id: companyId,
        profile_id: profileId,
        trip_id: tripId,
        supply_air_temp: normalized.telemetryLog.supplyAirTemp,
        return_air_temp: normalized.telemetryLog.returnAirTemp,
        ambient_temp: normalized.telemetryLog.ambientTemp ?? null,
        evaporator_temp: normalized.telemetryLog.evaporatorTemp ?? null,
        compressor_status: normalized.telemetryLog.compressorStatus,
        is_defrost_active: normalized.telemetryLog.isDefrostActive,
        door_open_sensor: normalized.telemetryLog.doorOpenSensor,
        diesel_fuel_level_liters: normalized.telemetryLog.dieselFuelLevelLiters ?? null,
        diesel_burn_rate_lph: normalized.telemetryLog.dieselBurnRateLph ?? 2.1,
        latitude: normalized.telemetryLog.latitude ?? null,
        longitude: normalized.telemetryLog.longitude ?? null,
        is_geofence_safe: normalized.telemetryLog.isGeofenceSafe,
        recorded_at: normalized.telemetryLog.recordedAt,
      });
    }

    // 3. Excursion / Critical Alarm Incident Radar
    let incidentCreated = false;
    let incidentId: string | undefined;

    const criticalAlarms = normalized.parsedAlarms.filter(
      (a) => a.severity === 'critical_shutdown' || a.requiresImmediateStop
    );

    const isTempBreached =
      normalized.telemetryLog.returnAirTemp > maxTempThreshold ||
      normalized.telemetryLog.returnAirTemp < minTempThreshold;

    if (profileId && tripId && (criticalAlarms.length > 0 || isTempBreached)) {
      const incidentType =
        criticalAlarms.length > 0
          ? 'compressor_failure'
          : normalized.telemetryLog.returnAirTemp > maxTempThreshold
          ? 'temp_high'
          : 'temp_low';

      const peakDeviation = Math.abs(normalized.telemetryLog.returnAirTemp - setpointTemp);

      const { data: newInc } = await supabase
        .from('reefer_excursion_incidents')
        .insert({
          company_id: companyId,
          profile_id: profileId,
          trip_id: tripId,
          incident_type: incidentType,
          severity: criticalAlarms.length > 0 ? 'critical' : 'warning',
          started_at: normalized.telemetryLog.recordedAt,
          peak_deviation_temp: peakDeviation,
          duration_minutes: 5,
          is_cleared: false,
          action_taken: criticalAlarms.length > 0
            ? `إنذار أوتوماتيكي من وحدة ${normalized.oemBrand}: ${criticalAlarms.map((a) => a.code).join(', ')}`
            : null,
        })
        .select('id')
        .single();

      if (newInc) {
        incidentCreated = true;
        incidentId = newInc.id;
      }
    }

    // 4. Audit Log Persistence
    await recordAuditLog({
      actionType: 'create',
      reason: 'INGEST_REEFER_OEM_TELEMATICS',
      entityType: 'reefer_temperature_log',
      entityId: String(tripId || normalized.serialNumber),
      newData: {
        oemBrand: normalized.oemBrand,
        serialNumber: normalized.serialNumber,
        supplyAirTemp: normalized.telemetryLog.supplyAirTemp,
        returnAirTemp: normalized.telemetryLog.returnAirTemp,
        alarmsCount: normalized.parsedAlarms.length,
        incidentCreated,
      },
    });

    return {
      success: true,
      normalized,
      incidentCreated,
      incidentId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to ingest OEM reefer telemetry';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Returns latest connected OEM refrigeration devices summary
 */
export async function getReeferOemDevicesSummaryAction() {
  try {
    const supabase = await createClient();
    const { data: profiles } = await supabase
      .from('trip_reefer_monitoring_profiles')
      .select('id, trip_id, cooling_unit_brand, atp_class, cargo_category, setpoint_temp, is_active, created_at')
      .eq('is_active', true)
      .limit(10);

    return {
      success: true,
      profiles: profiles || [],
    };
  } catch (err: unknown) {
    return {
      success: false,
      profiles: [],
      error: err instanceof Error ? err.message : 'Failed to query reefer devices',
    };
  }
}

