'use server';

/**
 * Trans Bodanon TMS — Multi-Compartment Independent GDP Certificate Server Actions
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP 2013/C 343/01
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { MultiTempGuardService } from './multi-temp-guard.service';
import { MultiTempPdfGeneratorService } from './multi-temp-pdf-generator.service';
import {
  exportBatchCompartmentCertificatesSchema,
  generateCompartmentCertificateSchema,
} from '../types/multi-temp-certificate.types';
import type {
  BatchCompartmentExportResult,
  CompartmentCertificateExportResult,
  CompartmentCertificatePayload,
  ExportBatchCompartmentCertificatesInput,
  GenerateCompartmentCertificateInput,
} from '../types/multi-temp-certificate.types';
import type {
  ReeferCompartmentProfile,
  ReeferCompartmentTelemetryLog,
} from '../types/multi-temp.types';

const HMAC_SECRET = process.env.PDF_SIGNING_KEY || 'trans-bodanon-reefer-cert-secure-key-2026';
const APP_PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tms.transbodanon.com';

/**
 * 1. Generate & Build Compartment GDP Certificate Payload
 */
export async function generateCompartmentGdpCertificateAction(
  rawInput: GenerateCompartmentCertificateInput
): Promise<{
  success: boolean;
  payload?: CompartmentCertificatePayload;
  error?: string;
}> {
  try {
    const input = generateCompartmentCertificateSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. Fetch compartment profile
    const { data: profileRow, error: profileErr } = await supabase
      .from('reefer_compartment_profiles')
      .select('*, trailer:trailers(id, plate_number), trip:trip_orders(id, trip_number, cmr_number, driver_name, client_name, origin_city, destination_city)')
      .eq('id', input.compartmentId)
      .single();

    if (profileErr || !profileRow) {
      return { success: false, error: 'لم يتم العثور على مواصفات الحجرة المحددة' };
    }

    // 2. Fetch compartment telemetry logs
    const { data: logsRows } = await supabase
      .from('reefer_compartment_telemetry_logs')
      .select('*')
      .eq('compartment_id', input.compartmentId)
      .order('recorded_at', { ascending: false })
      .limit(60);

    const logs: ReeferCompartmentTelemetryLog[] = (logsRows || []).map((l: any) => ({
      id: l.id,
      companyId: l.company_id,
      compartmentId: l.compartment_id,
      trailerId: l.trailer_id,
      tripId: l.trip_id,
      supplyAirTempC: Number(l.supply_air_temp_c),
      returnAirTempC: Number(l.return_air_temp_c),
      cargoProbeTempC: Number(l.cargo_probe_temp_c),
      evaporatorMode: l.evaporator_mode,
      doorOpen: Boolean(l.door_open),
      doorType: l.door_type,
      isExcursion: Boolean(l.is_excursion),
      recordedAt: l.recorded_at,
      createdAt: l.created_at,
    }));

    const mappedProfile: ReeferCompartmentProfile = {
      id: profileRow.id,
      companyId: profileRow.company_id,
      trailerId: profileRow.trailer_id,
      trailerPlate: profileRow.trailer?.plate_number || `REM-${profileRow.trailer_id}`,
      tripId: profileRow.trip_id,
      tripNumber: profileRow.trip?.trip_number,
      configurationType: profileRow.configuration_type,
      compartmentCode: profileRow.compartment_code,
      compartmentName: profileRow.compartment_name,
      cargoCategory: profileRow.cargo_category,
      setpointTempC: Number(profileRow.setpoint_temp_c),
      minTempLimitC: Number(profileRow.min_temp_limit_c),
      maxTempLimitC: Number(profileRow.max_temp_limit_c),
      evaporatorModel: profileRow.evaporator_model,
      hasSideDoor: Boolean(profileRow.has_side_door),
      hasRearDoor: Boolean(profileRow.has_rear_door),
      bulkheadPositionPct: Number(profileRow.bulkhead_position_pct || 50),
      isActive: Boolean(profileRow.is_active),
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    };

    // 3. Perform MKT & thermal audit
    const mktAudit = MultiTempGuardService.auditCompartment(mappedProfile, logs);

    // 4. Calculate compliance score
    let score = new Decimal(100);
    if (mktAudit.status === 'breached') score = score.minus(40);
    else if (mktAudit.status === 'warning') score = score.minus(15);

    const excursionPenalty = new Decimal(mktAudit.excursionMinutes).times('0.2');
    score = score.minus(excursionPenalty);
    if (score.isNegative()) score = new Decimal(0);
    const complianceScore = Number(score.toFixed(0));

    // 5. Generate certificate number & verification hash
    const now = new Date();
    const datePrefix = now.toISOString().substring(0, 10).replace(/-/g, '');
    const certNum = `GDP-${mappedProfile.compartmentCode}-${datePrefix}-${profileRow.id.substring(0, 6).toUpperCase()}`;

    const dataToSign = `${certNum}:${mappedProfile.compartmentCode}:${mappedProfile.trailerPlate}:${mktAudit.mktTempC}:${complianceScore}:${now.toISOString()}`;
    const verificationHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(dataToSign)
      .digest('hex');

    const verificationUrl = `${APP_PUBLIC_URL}/verify/cold-chain/${verificationHash.substring(0, 16)}`;

    // 6. Map sample logs
    const logsSample = logs.slice(0, 15).map((l) => ({
      time: l.recordedAt,
      supply: l.supplyAirTempC,
      return: l.returnAirTempC,
      cargo: l.cargoProbeTempC,
      mode: l.evaporatorMode,
      door: l.doorOpen,
    }));

    const tripObj = profileRow.trip;
    const route =
      tripObj?.origin_city && tripObj?.destination_city
        ? `${tripObj.origin_city} ➔ ${tripObj.destination_city}`
        : 'Tanger Med ➔ Algeciras / Perpignan';

    const payload: CompartmentCertificatePayload = {
      certificateNumber: certNum,
      compartmentCode: mappedProfile.compartmentCode,
      compartmentName: mappedProfile.compartmentName,
      cargoCategory: mappedProfile.cargoCategory,
      trailerId: mappedProfile.trailerId,
      trailerPlate: mappedProfile.trailerPlate || `REM-${mappedProfile.trailerId}`,
      tripId: mappedProfile.tripId,
      tripNumber: mappedProfile.tripNumber,
      cmrNumber: tripObj?.cmr_number || 'CMR-MA-ES-94820',
      clientName: tripObj?.client_name || 'Exportateur Fruits & Légumes',
      driverName: tripObj?.driver_name || 'Chauffeur TIR International',
      route,
      setpointTempC: mappedProfile.setpointTempC,
      minTempLimitC: mappedProfile.minTempLimitC,
      maxTempLimitC: mappedProfile.maxTempLimitC,
      mktTempC: mktAudit.mktTempC,
      avgSupplyAirTempC: mktAudit.avgSupplyAirTempC,
      avgReturnAirTempC: mktAudit.avgReturnAirTempC,
      excursionMinutes: mktAudit.excursionMinutes,
      doorOpenCount: mktAudit.doorOpenCount,
      evaporatorModel: mappedProfile.evaporatorModel,
      bulkheadPositionPct: mappedProfile.bulkheadPositionPct,
      status: mktAudit.status,
      complianceScore,
      issuedAt: now.toISOString(),
      verificationHash,
      verificationUrl,
      logsSample,
      locale: input.locale,
    };

    await recordAuditLog({
      actionType: 'create',
      entityType: 'reefer_compartment_certificates',
      entityId: certNum,
      reason: 'generate_compartment_gdp_certificate',
      newData: {
        compartmentCode: mappedProfile.compartmentCode,
        complianceScore,
        mktTempC: mktAudit.mktTempC,
      },
    });

    return { success: true, payload };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل إصدار شهادة الحجرة المستقلة';
    return { success: false, error: msg };
  }
}

/**
 * 2. Export Compartment GDP Certificate HTML / Printable Vector Report
 */
export async function exportCompartmentPdfReportAction(
  rawInput: GenerateCompartmentCertificateInput
): Promise<CompartmentCertificateExportResult> {
  try {
    const genRes = await generateCompartmentGdpCertificateAction(rawInput);
    if (!genRes.success || !genRes.payload) {
      return { success: false, error: genRes.error || 'فشل توليد بيانات الشهادة' };
    }

    const htmlContent = MultiTempPdfGeneratorService.generateCertificateHtml(genRes.payload);

    return {
      success: true,
      certificateNumber: genRes.payload.certificateNumber,
      compartmentCode: genRes.payload.compartmentCode,
      htmlContent,
      verificationHash: genRes.payload.verificationHash,
      verificationUrl: genRes.payload.verificationUrl,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تصدير وثيقة الشهادة';
    return { success: false, error: msg };
  }
}

/**
 * 3. Batch Export Certificates for All Active Compartments of a Trailer
 */
export async function exportBatchCompartmentCertificatesAction(
  rawInput: ExportBatchCompartmentCertificatesInput
): Promise<BatchCompartmentExportResult> {
  try {
    const input = exportBatchCompartmentCertificatesSchema.parse(rawInput);
    const supabase = await createClient();

    // Fetch all active compartments
    const { data: profiles, error: pErr } = await supabase
      .from('reefer_compartment_profiles')
      .select('id, compartment_code, trailer:trailers(plate_number)')
      .eq('trailer_id', input.trailerId)
      .eq('is_active', true)
      .order('compartment_code', { ascending: true });

    if (pErr || !profiles || profiles.length === 0) {
      return { success: false, error: 'لا توجد حجرات نشطة لهذه المقطورة' };
    }

    const firstComp = profiles[0] as any;
    const trailerPlate =
      (Array.isArray(firstComp.trailer)
        ? firstComp.trailer[0]?.plate_number
        : firstComp.trailer?.plate_number) || `REM-${input.trailerId}`;
    const certResults: CompartmentCertificateExportResult[] = [];

    for (const comp of profiles) {
      const res = await exportCompartmentPdfReportAction({
        compartmentId: comp.id,
        trailerId: input.trailerId,
        tripId: input.tripId,
        locale: input.locale,
      });
      certResults.push(res);
    }

    return {
      success: true,
      trailerPlate,
      certificates: certResults,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تصدير حزمة شهادات الحجرات';
    return { success: false, error: msg };
  }
}

