'use server';

/**
 * Trans Bodanon TMS — Reefer Sensor Calibration & ATP Recertification Server Actions
 * Standards: EN 12830 / ATP Treaty (FRC / FRA / FNA)
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { ReeferCalibrationService } from './reefer-calibration.service';
import {
  recordAtpCertificationSchema,
  recordSensorCalibrationSchema,
} from '../types/reefer-calibration.types';
import type {
  AtpClassType,
  PreTripReeferComplianceCheck,
  RecordAtpCertificationInput,
  RecordSensorCalibrationInput,
  ReeferAtpCertification,
  ReeferCalibrationRadarSummary,
  ReeferSensorCalibrationLog,
  ReeferSensorType,
} from '../types/reefer-calibration.types';

/**
 * 1. Fetch All ATP Certifications with Trailer Plates
 */
export async function getAtpCertificationsAction(): Promise<{
  success: boolean;
  data?: ReeferAtpCertification[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: rows, error } = await supabase
      .from('reefer_atp_certifications')
      .select('*, trailer:trailers(id, plate_number)')
      .order('expiry_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const certs: ReeferAtpCertification[] = (rows || []).map((row: any) => {
      const evalRes = ReeferCalibrationService.evaluateExpiry(row.expiry_date);
      return {
        id: row.id,
        companyId: row.company_id,
        trailerId: row.trailer_id,
        trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
        certificateNumber: row.certificate_number,
        atpType: row.atp_type as AtpClassType,
        issueDate: row.issue_date,
        expiryDate: row.expiry_date,
        kValue: Number(row.k_value || 0.38),
        testingStation: row.testing_station,
        status: evalRes.status,
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        renewalCycleYears: Number(row.renewal_cycle_years || 3),
        documentUrl: row.document_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return { success: true, data: certs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب شهادات ATP';
    return { success: false, error: msg };
  }
}

/**
 * 2. Record or Renew ATP Certification
 */
export async function recordAtpCertificationAction(
  rawInput: RecordAtpCertificationInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const input = recordAtpCertificationSchema.parse(rawInput);
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

    const expiryEval = ReeferCalibrationService.evaluateExpiry(input.expiryDate);

    const { data, error } = await supabase
      .from('reefer_atp_certifications')
      .upsert(
        {
          company_id: companyId,
          trailer_id: input.trailerId,
          certificate_number: input.certificateNumber,
          atp_type: input.atpType,
          issue_date: input.issueDate,
          expiry_date: input.expiryDate,
          k_value: input.kValue,
          testing_station: input.testingStation,
          renewal_cycle_years: input.renewalCycleYears,
          document_url: input.documentUrl || null,
          status: expiryEval.status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id, trailer_id, certificate_number' }
      )
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'create',
      reason: 'RECORD_REEFER_ATP_CERTIFICATION',
      entityType: 'reefer_atp_certification',
      entityId: data?.id || String(input.trailerId),
      newData: { ...input, status: expiryEval.status },
    });

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تسجيل شهادة ATP';
    return { success: false, error: msg };
  }
}

/**
 * 3. Fetch Sensor Calibration Logs
 */
export async function getSensorCalibrationLogsAction(
  trailerId?: number
): Promise<{ success: boolean; data?: ReeferSensorCalibrationLog[]; error?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('reefer_sensor_calibration_logs')
      .select('*, trailer:trailers(id, plate_number)')
      .order('calibrated_at', { ascending: false });

    if (trailerId) {
      query = query.eq('trailer_id', trailerId);
    }

    const { data: rows, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    const logs: ReeferSensorCalibrationLog[] = (rows || []).map((row: any) => {
      const evalRes = ReeferCalibrationService.evaluateExpiry(row.next_due_date);
      return {
        id: row.id,
        companyId: row.company_id,
        trailerId: row.trailer_id,
        trailerPlate: row.trailer?.plate_number || `REM-${row.trailer_id}`,
        sensorType: row.sensor_type as ReeferSensorType,
        deviceSerialNumber: row.device_serial_number,
        calibratedAt: row.calibrated_at,
        nextDueDate: row.next_due_date,
        referenceTemp: Number(row.reference_temp),
        measuredTemp: Number(row.measured_temp),
        driftDelta: Number(row.drift_delta),
        isPassed: Boolean(row.is_passed),
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        calibratedBy: row.calibrated_by,
        certificateReference: row.certificate_reference,
        notes: row.notes,
        createdAt: row.created_at,
      };
    });

    return { success: true, data: logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب سجلات المعايرة';
    return { success: false, error: msg };
  }
}

/**
 * 4. Record New Sensor Calibration Log (EN 12830)
 */
export async function recordSensorCalibrationAction(
  rawInput: RecordSensorCalibrationInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const input = recordSensorCalibrationSchema.parse(rawInput);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let companyId = 1;
    if (user) {
      const { data: u } = await supabase.from('users').select('company_id').eq('id', user.id).maybeSingle();
      if (u?.company_id) companyId = u.company_id;
    }

    const { driftDelta, isPassed } = ReeferCalibrationService.calculateDriftDelta(
      input.measuredTemp,
      input.referenceTemp
    );

    const { data, error } = await supabase
      .from('reefer_sensor_calibration_logs')
      .insert({
        company_id: companyId,
        trailer_id: input.trailerId,
        sensor_type: input.sensorType,
        device_serial_number: input.deviceSerialNumber || null,
        calibrated_at: input.calibratedAt,
        next_due_date: input.nextDueDate,
        reference_temp: input.referenceTemp,
        measured_temp: input.measuredTemp,
        drift_delta: driftDelta,
        is_passed: isPassed,
        calibrated_by: input.calibratedBy,
        certificate_reference: input.certificateReference || null,
        notes: input.notes || null,
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await recordAuditLog({
      actionType: 'create',
      reason: 'RECORD_SENSOR_CALIBRATION_EN12830',
      entityType: 'reefer_sensor_calibration_log',
      entityId: data?.id || String(input.trailerId),
      newData: { ...input, driftDelta, isPassed },
    });

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تسجيل معايرة الحساس';
    return { success: false, error: msg };
  }
}

/**
 * 5. Pre-Trip Gatekeeper: Check trailer clearance before trip assignment
 */
export async function checkTrailerPreTripComplianceAction(
  trailerId: number | string
): Promise<{ success: boolean; gatekeeper?: PreTripReeferComplianceCheck; error?: string }> {
  try {
    const parsedId = Number(trailerId);
    if (!parsedId || isNaN(parsedId)) {
      return { success: false, error: 'معرف المقطورة غير صالح' };
    }

    const supabase = await createClient();

    const [{ data: trRow }, { data: atpRow }, { data: calibRows }] = await Promise.all([
      supabase.from('trailers').select('id, plate_number').eq('id', parsedId).maybeSingle(),
      supabase
        .from('reefer_atp_certifications')
        .select('*')
        .eq('trailer_id', parsedId)
        .order('expiry_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('reefer_sensor_calibration_logs')
        .select('*')
        .eq('trailer_id', parsedId)
        .order('calibrated_at', { ascending: false }),
    ]);

    const trailerPlate = trRow?.plate_number || `REM-${parsedId}`;

    let atpCert: ReeferAtpCertification | null = null;
    if (atpRow) {
      const evalRes = ReeferCalibrationService.evaluateExpiry(atpRow.expiry_date);
      atpCert = {
        id: atpRow.id,
        companyId: atpRow.company_id,
        trailerId: atpRow.trailer_id,
        trailerPlate,
        certificateNumber: atpRow.certificate_number,
        atpType: atpRow.atp_type,
        issueDate: atpRow.issue_date,
        expiryDate: atpRow.expiry_date,
        kValue: Number(atpRow.k_value || 0.38),
        testingStation: atpRow.testing_station,
        status: evalRes.status,
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        renewalCycleYears: Number(atpRow.renewal_cycle_years || 3),
        createdAt: atpRow.created_at,
      };
    }

    const calibs: ReeferSensorCalibrationLog[] = (calibRows || []).map((c: any) => {
      const evalRes = ReeferCalibrationService.evaluateExpiry(c.next_due_date);
      return {
        id: c.id,
        companyId: c.company_id,
        trailerId: c.trailer_id,
        sensorType: c.sensor_type,
        calibratedAt: c.calibrated_at,
        nextDueDate: c.next_due_date,
        referenceTemp: Number(c.reference_temp),
        measuredTemp: Number(c.measured_temp),
        driftDelta: Number(c.drift_delta),
        isPassed: Boolean(c.is_passed),
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        calibratedBy: c.calibrated_by,
        createdAt: c.created_at,
      };
    });

    const gatekeeper = ReeferCalibrationService.evaluatePreTripCompliance(
      parsedId,
      trailerPlate,
      atpCert,
      calibs
    );

    return { success: true, gatekeeper };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تقييم جاهزية المقطورة';
    return { success: false, error: msg };
  }
}

/**
 * 6. Get Fleet Calibration Radar Summary
 */
export async function getReeferCalibrationRadarSummaryAction(): Promise<{
  success: boolean;
  summary?: ReeferCalibrationRadarSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const [{ data: trailers }, { data: atpRows }, { data: calibRows }] = await Promise.all([
      supabase.from('trailers').select('id, plate_number'),
      supabase.from('reefer_atp_certifications').select('*'),
      supabase.from('reefer_sensor_calibration_logs').select('*'),
    ]);

    const trailerList = (trailers || []).map((t: any) => ({
      id: t.id,
      plateNumber: t.plate_number || `REM-${t.id}`,
    }));

    const certList: ReeferAtpCertification[] = (atpRows || []).map((row: any) => {
      const evalRes = ReeferCalibrationService.evaluateExpiry(row.expiry_date);
      return {
        id: row.id,
        companyId: row.company_id,
        trailerId: row.trailer_id,
        certificateNumber: row.certificate_number,
        atpType: row.atp_type,
        issueDate: row.issue_date,
        expiryDate: row.expiry_date,
        kValue: Number(row.k_value || 0.38),
        testingStation: row.testing_station,
        status: evalRes.status,
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        renewalCycleYears: Number(row.renewal_cycle_years || 3),
        createdAt: row.created_at,
      };
    });

    const calibList: ReeferSensorCalibrationLog[] = (calibRows || []).map((c: any) => {
      const evalRes = ReeferCalibrationService.evaluateExpiry(c.next_due_date);
      return {
        id: c.id,
        companyId: c.company_id,
        trailerId: c.trailer_id,
        sensorType: c.sensor_type,
        calibratedAt: c.calibrated_at,
        nextDueDate: c.next_due_date,
        referenceTemp: Number(c.reference_temp),
        measuredTemp: Number(c.measured_temp),
        driftDelta: Number(c.drift_delta),
        isPassed: Boolean(c.is_passed),
        warningLevel: evalRes.warningLevel,
        daysRemaining: evalRes.daysRemaining,
        calibratedBy: c.calibrated_by,
        createdAt: c.created_at,
      };
    });

    const summary = ReeferCalibrationService.calculateRadarSummary(trailerList, certList, calibList);

    return { success: true, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل حساب مؤشرات رادار المعايرة';
    return { success: false, error: msg };
  }
}

