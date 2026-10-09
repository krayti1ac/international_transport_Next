'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  getTripReeferAuditSchema,
  generateReeferCertificateSchema,
  logReeferTelemetrySchema,
  upsertTripReeferProfileSchema,
  type GetTripReeferAuditInput,
  type GenerateReeferCertificateInput,
  type LogReeferTelemetryInput,
  type UpsertTripReeferProfileInput,
} from '../schemas/reefer-compliance.schemas';
import { ColdChainGuardService } from './cold-chain-guard.service';
import type {
  ColdChainAuditEvaluation,
  ReeferExcursionIncident,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';
import { REEFER_CARGO_CATALOG } from '../types/reefer-compliance.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TripReeferAuditResponse {
  profile: TripReeferMonitoringProfile;
  logs: ReeferTelemetryLog[];
  incidents: ReeferExcursionIncident[];
  evaluation: ColdChainAuditEvaluation;
}

/**
 * جلب سجلات التبريد ومواصفات الرحلة وتقييم MKT والامتثال الشامل
 */
export async function getTripReeferAuditAction(
  rawInput: GetTripReeferAuditInput
): Promise<{ success: boolean; data?: TripReeferAuditResponse; error?: string }> {
  try {
    const input = getTripReeferAuditSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. جلب مواصفات المراقبة للشحنة المحددة
    const { data: profileRow, error: profileErr } = await supabase
      .from('trip_reefer_monitoring_profiles')
      .select('*')
      .eq('trip_id', input.tripId)
      .maybeSingle();

    if (profileErr) {
      return { success: false, error: profileErr.message };
    }

    // إذا لم يكن هناك بروفايل مسبق، نقوم ببناء بروفايل افتراضي من الكتالوج للبضائع الطازجة
    const defaultPreset = REEFER_CARGO_CATALOG.fresh_produce;
    const profile: TripReeferMonitoringProfile = profileRow
      ? {
          id: profileRow.id,
          companyId: profileRow.company_id,
          tripId: profileRow.trip_id,
          trailerId: profileRow.trailer_id,
          coolingUnitBrand: profileRow.cooling_unit_brand || 'Carrier Transicold Vector 1550',
          atpClass: profileRow.atp_class || 'class_c',
          cargoCategory: profileRow.cargo_category || 'fresh_produce',
          setpointTemp: Number(profileRow.setpoint_temp ?? defaultPreset.targetTemp),
          minTempThreshold: Number(profileRow.min_temp_threshold ?? defaultPreset.minTemp),
          maxTempThreshold: Number(profileRow.max_temp_threshold ?? defaultPreset.maxTemp),
          maxAllowedExcursionMinutes: Number(profileRow.max_allowed_excursion_minutes ?? defaultPreset.maxAllowedExcursionMinutes),
          mktActivationEnergyKj: Number(profileRow.mkt_activation_energy_kj ?? defaultPreset.activationEnergyKj),
          isActive: Boolean(profileRow.is_active ?? true),
          certificateHash: profileRow.certificate_hash,
          createdAt: profileRow.created_at,
          updatedAt: profileRow.updated_at,
        }
      : {
          id: `default-${input.tripId}`,
          companyId: 1,
          tripId: input.tripId,
          trailerId: null,
          coolingUnitBrand: 'Carrier Transicold Vector 1550',
          atpClass: 'class_c',
          cargoCategory: 'fresh_produce',
          setpointTemp: defaultPreset.targetTemp,
          minTempThreshold: defaultPreset.minTemp,
          maxTempThreshold: defaultPreset.maxTemp,
          maxAllowedExcursionMinutes: defaultPreset.maxAllowedExcursionMinutes,
          mktActivationEnergyKj: defaultPreset.activationEnergyKj,
          isActive: true,
          certificateHash: null,
        };

    // 2. جلب قراءات الحساسات وسجلات درجات الحرارة
    const { data: logsRows, error: logsErr } = await supabase
      .from('reefer_temperature_logs')
      .select('*')
      .eq('trip_id', input.tripId)
      .order('recorded_at', { ascending: true });

    if (logsErr) {
      return { success: false, error: logsErr.message };
    }

    const logs: ReeferTelemetryLog[] = (logsRows || []).map((row) => ({
      id: row.id,
      tripId: row.trip_id,
      supplyAirTemp: Number(row.supply_air_temp),
      returnAirTemp: Number(row.return_air_temp),
      ambientTemp: row.ambient_temp != null ? Number(row.ambient_temp) : undefined,
      compressorStatus: row.compressor_status || 'running',
      isDefrostActive: Boolean(row.is_defrost_active),
      doorOpenSensor: Boolean(row.door_open_sensor),
      dieselFuelLevelLiters: row.diesel_fuel_level_liters != null ? Number(row.diesel_fuel_level_liters) : undefined,
      dieselBurnRateLph: row.diesel_burn_rate_lph != null ? Number(row.diesel_burn_rate_lph) : undefined,
      latitude: row.latitude != null ? Number(row.latitude) : undefined,
      longitude: row.longitude != null ? Number(row.longitude) : undefined,
      isGeofenceSafe: Boolean(row.is_geofence_safe ?? true),
      recordedAt: row.recorded_at,
    }));

    // 3. جلب حوادث الانحرافات المسجلة
    const { data: incidentRows, error: incErr } = await supabase
      .from('reefer_excursion_incidents')
      .select('*')
      .eq('trip_id', input.tripId)
      .order('started_at', { ascending: true });

    if (incErr) {
      return { success: false, error: incErr.message };
    }

    const incidents: ReeferExcursionIncident[] = (incidentRows || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      profileId: row.profile_id,
      tripId: row.trip_id,
      incidentType: row.incident_type,
      severity: row.severity,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      peakDeviationTemp: Number(row.peak_deviation_temp),
      durationMinutes: Number(row.duration_minutes || 0),
      mktImpactCelsius: row.mkt_impact_celsius != null ? Number(row.mkt_impact_celsius) : null,
      actionTaken: row.action_taken,
      isCleared: Boolean(row.is_cleared),
      createdAt: row.created_at,
    }));

    // 4. تقييم MKT والامتثال عبر ColdChainGuardService
    const evaluation = ColdChainGuardService.evaluateColdChainTrip(profile, logs);

    // إذا كان للبروفايل ختم موثق مسبقاً، نحافظ عليه
    if (profile.certificateHash) {
      evaluation.certificateHash = profile.certificateHash;
    }

    return {
      success: true,
      data: {
        profile,
        logs,
        incidents,
        evaluation,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب بيانات تدقيق سلسلة التبريد';
    return { success: false, error: message };
  }
}

/**
 * إصدار وتوثيق شهادة الامتثال الرقمية الرسمية وتخزين ختم SHA-256
 */
export async function generateReeferCertificateAction(
  rawInput: GenerateReeferCertificateInput
): Promise<{ success: boolean; certificateHash?: string; evaluation?: ColdChainAuditEvaluation; error?: string }> {
  try {
    const input = generateReeferCertificateSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. استخراج بيانات التدقيق
    const auditRes = await getTripReeferAuditAction({ tripId: input.tripId });
    if (!auditRes.success || !auditRes.data) {
      return { success: false, error: auditRes.error || 'تعذر تقييم بيانات الشحنة المبردة' };
    }

    const { profile, logs, evaluation } = auditRes.data;

    if (evaluation.complianceStatus === 'breached' && !input.forceReissue) {
      return {
        success: false,
        error: 'لا يمكن إصدار شهادة مطابقة لشحنة تم خرق سلسلة التبريد الخاصة بها وتجاوز مهلة الانحراف القصوى',
      };
    }

    const certificateHash = evaluation.certificateHash || ColdChainGuardService.generateCertificateHash(
      profile,
      evaluation.complianceStatus,
      new Decimal(evaluation.mktTemperatureCelsius),
      evaluation.totalExcursionMinutes,
      evaluation.complianceScorePercent
    );

    // 2. تحديث بروفايل الرحلة بختم الشهادة
    if (!profile.id.startsWith('default-')) {
      await supabase
        .from('trip_reefer_monitoring_profiles')
        .update({
          certificate_hash: certificateHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
    } else {
      // إدراج البروفايل إن لم يكن موجوداً
      await supabase.from('trip_reefer_monitoring_profiles').insert({
        company_id: profile.companyId,
        trip_id: input.tripId,
        cooling_unit_brand: profile.coolingUnitBrand,
        atpClass: profile.atpClass,
        cargo_category: profile.cargoCategory,
        setpoint_temp: profile.setpointTemp,
        min_temp_threshold: profile.minTempThreshold,
        max_temp_threshold: profile.maxTempThreshold,
        max_allowed_excursion_minutes: profile.maxAllowedExcursionMinutes,
        certificate_hash: certificateHash,
      });
    }

    // 3. توثيق سجل التدقيق الأمني
    await recordAuditLog({
      entityType: 'reefer_compliance',
      entityId: input.tripId,
      actionType: 'update',
      reason: `تم اعتماد وإصدار شهادة الامتثال الرقمية لسلسلة التبريد (كود: ${certificateHash})`,
      newData: { certificateHash, score: evaluation.complianceScorePercent, mkt: evaluation.mktTemperatureCelsius },
    });

    revalidatePath(`/trips/${input.tripId}`);
    revalidatePath('/mission-control');

    return {
      success: true,
      certificateHash,
      evaluation,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إصدار شهادة الامتثال الرقمية';
    return { success: false, error: message };
  }
}

/**
 * تسجيل قراءة لحظية جديدة من حساسات DataCOLD / TracKing وفحص الانحرافات
 */
export async function logReeferTelemetryAction(
  rawInput: LogReeferTelemetryInput
): Promise<{ success: boolean; logId?: string; incidentDetected?: boolean; error?: string }> {
  try {
    const input = logReeferTelemetrySchema.parse(rawInput);
    const supabase = await createClient();

    // جلب أو إنشاء بروفايل المراقبة للرحلة
    let { data: profile } = await supabase
      .from('trip_reefer_monitoring_profiles')
      .select('*')
      .eq('trip_id', input.tripId)
      .maybeSingle();

    if (!profile) {
      const defaultPreset = REEFER_CARGO_CATALOG.fresh_produce;
      const { data: insertedProfile, error: createErr } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .insert({
          company_id: 1,
          trip_id: input.tripId,
          setpoint_temp: defaultPreset.targetTemp,
          min_temp_threshold: defaultPreset.minTemp,
          max_temp_threshold: defaultPreset.maxTemp,
          max_allowed_excursion_minutes: defaultPreset.maxAllowedExcursionMinutes,
        })
        .select()
        .single();

      if (createErr) {
        return { success: false, error: createErr.message };
      }
      profile = insertedProfile;
    }

    // إدراج سجل القراءة
    const { data: newLog, error: logErr } = await supabase
      .from('reefer_temperature_logs')
      .insert({
        company_id: profile.company_id,
        profile_id: profile.id,
        trip_id: input.tripId,
        supply_air_temp: new Decimal(input.supplyAirTemp).toFixed(2),
        return_air_temp: new Decimal(input.returnAirTemp).toFixed(2),
        ambient_temp: input.ambientTemp != null ? new Decimal(input.ambientTemp).toFixed(2) : null,
        evaporator_temp: input.evaporatorTemp != null ? new Decimal(input.evaporatorTemp).toFixed(2) : null,
        compressor_status: input.compressorStatus,
        is_defrost_active: input.isDefrostActive,
        door_open_sensor: input.doorOpenSensor,
        diesel_fuel_level_liters: input.dieselFuelLevelLiters != null ? new Decimal(input.dieselFuelLevelLiters).toFixed(2) : null,
        diesel_burn_rate_lph: input.dieselBurnRateLph != null ? new Decimal(input.dieselBurnRateLph).toFixed(2) : null,
        latitude: input.latitude,
        longitude: input.longitude,
        is_geofence_safe: input.isGeofenceSafe,
      })
      .select()
      .single();

    if (logErr) {
      return { success: false, error: logErr.message };
    }

    // فحص ما إذا كانت القراءة تشكل واقعة انحراف حراري أو خرق أمني
    const singleLog: ReeferTelemetryLog = {
      id: newLog.id,
      tripId: input.tripId,
      supplyAirTemp: input.supplyAirTemp,
      returnAirTemp: input.returnAirTemp,
      ambientTemp: input.ambientTemp,
      compressorStatus: input.compressorStatus,
      isDefrostActive: input.isDefrostActive,
      doorOpenSensor: input.doorOpenSensor,
      dieselBurnRateLph: input.dieselBurnRateLph,
      isGeofenceSafe: input.isGeofenceSafe,
      recordedAt: newLog.recorded_at,
    };

    const monitoringProfile: TripReeferMonitoringProfile = {
      id: profile.id,
      companyId: profile.company_id,
      tripId: profile.trip_id,
      trailerId: profile.trailer_id,
      coolingUnitBrand: profile.cooling_unit_brand,
      atpClass: profile.atp_class,
      cargoCategory: profile.cargo_category,
      setpointTemp: Number(profile.setpoint_temp),
      minTempThreshold: Number(profile.min_temp_threshold),
      maxTempThreshold: Number(profile.max_temp_threshold),
      maxAllowedExcursionMinutes: Number(profile.max_allowed_excursion_minutes),
      mktActivationEnergyKj: Number(profile.mkt_activation_energy_kj),
      isActive: profile.is_active,
    };

    const incidents = ColdChainGuardService.detectExcursionIncidents(monitoringProfile, [singleLog]);
    let incidentDetected = false;

    if (incidents.length > 0) {
      incidentDetected = true;
      for (const inc of incidents) {
        await supabase.from('reefer_excursion_incidents').insert({
          company_id: inc.companyId,
          profile_id: inc.profileId,
          trip_id: inc.tripId,
          incident_type: inc.incidentType,
          severity: inc.severity,
          peak_deviation_temp: inc.peakDeviationTemp,
          duration_minutes: inc.durationMinutes,
          action_taken: inc.actionTaken,
        });
      }
    }

    return {
      success: true,
      logId: newLog.id,
      incidentDetected,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تسجيل بيانات تليماتيكس التبريد';
    return { success: false, error: message };
  }
}

/**
 * تحديث أو حفظ بروفايل تبريد الرحلة
 */
export async function upsertTripReeferProfileAction(
  rawInput: UpsertTripReeferProfileInput
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  try {
    const input = upsertTripReeferProfileSchema.parse(rawInput);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('trip_reefer_monitoring_profiles')
      .upsert(
        {
          company_id: 1,
          trip_id: input.tripId,
          trailer_id: input.trailerId,
          cooling_unit_brand: input.coolingUnitBrand,
          atp_class: input.atpClass,
          cargo_category: input.cargoCategory,
          setpoint_temp: new Decimal(input.setpointTemp).toFixed(2),
          min_temp_threshold: new Decimal(input.minTempThreshold).toFixed(2),
          max_temp_threshold: new Decimal(input.maxTempThreshold).toFixed(2),
          max_allowed_excursion_minutes: input.maxAllowedExcursionMinutes,
          mkt_activation_energy_kj: new Decimal(input.mktActivationEnergyKj).toFixed(3),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'trip_id' }
      )
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/trips/${input.tripId}`);
    return { success: true, profileId: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل حفظ مواصفات مراقبة التبريد';
    return { success: false, error: message };
  }
}

