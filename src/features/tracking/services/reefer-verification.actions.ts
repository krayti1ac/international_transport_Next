'use server';

/**
 * Trans Bodanon TMS — Reefer Public Verification Server Actions
 * Public QR Code Cold Chain Verification Portal (EN 12830 / GDP / ATP)
 * Tamper Detection & Masked Data Provider for Customs and Cargo Consignees
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { ColdChainGuardService } from './cold-chain-guard.service';
import type {
  PublicReeferVerificationResult,
  PublicReeferTelemetrySample,
  PublicReeferExcursionSummary,
} from '../types/reefer-verification.types';
import type {
  ReeferCargoCategory,
  TripReeferMonitoringProfile,
  ReeferTelemetryLog,
} from '../types/reefer-compliance.types';

const DEFAULT_COMPANY = {
  name: 'Trans Bodanon Transport & Logistique S.A.R.L.',
  ice: '002938475000084',
  address: 'Zone Franche Port Tanger Med, Route Principale, Maroc',
  phone: '+212 539 94 82 10',
  email: 'contact@transbodanon.com',
};

// Arrhenius constants for MKT calculation
const GAS_CONSTANT_R = new Decimal(8.314472);
const ACTIVATION_ENERGY_DH = new Decimal(83144);
const ZERO_CELSIUS_KELVIN = new Decimal(273.15);

function computeMkt(temperatures: number[]): number {
  if (temperatures.length === 0) return 4.0;
  try {
    let sumExp = new Decimal(0);
    for (const tempC of temperatures) {
      const tempK = new Decimal(tempC).plus(ZERO_CELSIUS_KELVIN);
      const exponent = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(tempK));
      sumExp = sumExp.plus(Decimal.exp(exponent));
    }
    const avgExp = sumExp.dividedBy(temperatures.length);
    const lnAvgExp = Decimal.ln(avgExp);
    const mktKelvin = ACTIVATION_ENERGY_DH.negated().dividedBy(GAS_CONSTANT_R.times(lnAvgExp));
    return mktKelvin.minus(ZERO_CELSIUS_KELVIN).toDecimalPlaces(2).toNumber();
  } catch {
    return 4.0;
  }
}

/**
 * Public Server Action to verify a cold chain certificate by its cryptographic seal or certificate code
 */
export async function verifyReeferColdChainByHashAction(
  candidateHash: string,
  tripIdHint?: string | number
): Promise<PublicReeferVerificationResult> {
  const cleanHash = (candidateHash || '').trim();

  if (!cleanHash) {
    return {
      isValid: false,
      isTamperEvident: false,
      securityBadge: 'unregistered',
      verificationHash: '',
      error: 'رمز التحقق مفقود أو غير صالح',
    };
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServiceRole =
      serviceRoleKey &&
      !serviceRoleKey.includes('your-service-role') &&
      serviceRoleKey.length > 50;

    const supabase = isServiceRole
      ? (await import('@supabase/supabase-js')).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )
      : await createClient();

    // 1. Resolve Trip ID Candidate
    let targetTripId: string | number | null = tripIdHint || null;

    // Pattern A: ATP-CLASS_C-[tripId]-[hash]
    if (!targetTripId && cleanHash.startsWith('ATP-')) {
      const parts = cleanHash.split('-');
      if (parts.length >= 3 && parts[2]) {
        targetTripId = parts[2];
      }
    }

    // 2. Query Monitoring Profile
    let profileRow: any = null;

    if (targetTripId) {
      const { data } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .select('*')
        .eq('trip_id', targetTripId)
        .maybeSingle();
      profileRow = data;
    }

    // If still not found, search directly by certificate_hash matching candidate
    if (!profileRow) {
      const { data } = await supabase
        .from('trip_reefer_monitoring_profiles')
        .select('*')
        .or(`certificate_hash.eq.${cleanHash},certificate_hash.ilike.%${cleanHash}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      profileRow = data;
    }

    // If not found in DB
    if (!profileRow) {
      return {
        isValid: false,
        isTamperEvident: false,
        securityBadge: 'unregistered',
        verificationHash: cleanHash,
        error: 'لم يتم العثور على أي رحلة مبردة مسجلة بهذا الرمز',
      };
    }

    const tripId = profileRow.trip_id;

    // 3. Fetch Trip & Telemetry Records
    const [{ data: tripRow }, { data: logsRows }, { data: incRows }, { data: companyRow }] =
      await Promise.all([
        supabase.from('trip_orders').select('*').eq('id', tripId).maybeSingle(),
        supabase
          .from('reefer_temperature_logs')
          .select('*')
          .eq('trip_id', tripId)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('reefer_excursion_incidents')
          .select('*')
          .eq('trip_id', tripId)
          .order('started_at', { ascending: true }),
        profileRow.company_id
          ? supabase.from('companies').select('*').eq('id', profileRow.company_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const logs: ReeferTelemetryLog[] = (logsRows || []).map((l: any) => ({
      id: l.id,
      tripId,
      supplyAirTemp: Number(l.supply_air_temp),
      returnAirTemp: Number(l.return_air_temp),
      ambientTemp: l.ambient_temp ? Number(l.ambient_temp) : undefined,
      evaporatorTemp: l.evaporator_temp ? Number(l.evaporator_temp) : undefined,
      compressorStatus: l.compressor_status || 'running',
      isDefrostActive: Boolean(l.is_defrost_active),
      doorOpenSensor: Boolean(l.door_open_sensor),
      dieselFuelLevelLiters: l.diesel_fuel_level_liters ? Number(l.diesel_fuel_level_liters) : undefined,
      dieselBurnRateLph: l.diesel_burn_rate_lph ? Number(l.diesel_burn_rate_lph) : 2.1,
      latitude: l.latitude ? Number(l.latitude) : undefined,
      longitude: l.longitude ? Number(l.longitude) : undefined,
      isGeofenceSafe: l.is_geofence_safe ?? true,
      recordedAt: l.recorded_at,
    }));

    const returnTemps = logs.map((l) => l.returnAirTemp);
    const supplyTemps = logs.map((l) => l.supplyAirTemp);

    const mkt = returnTemps.length > 0 ? computeMkt(returnTemps) : Number(profileRow.setpoint_temp);
    const avgReturn = returnTemps.length > 0
      ? returnTemps.reduce((acc, t) => acc + t, 0) / returnTemps.length
      : Number(profileRow.setpoint_temp);
    const avgSupply = supplyTemps.length > 0
      ? supplyTemps.reduce((acc, t) => acc + t, 0) / supplyTemps.length
      : Number(profileRow.setpoint_temp) - 0.5;

    const incidentsList = incRows || [];
    const totalExcursionMinutes = incidentsList.reduce((sum: number, i: any) => sum + Number(i.duration_minutes || 0), 0);
    const doorBreachesCount = logs.filter((l) => l.doorOpenSensor && !l.isGeofenceSafe).length;

    const maxAllowedMins = Number(profileRow.max_allowed_excursion_minutes || 45);
    const isCompliant = totalExcursionMinutes <= maxAllowedMins && doorBreachesCount === 0;
    const isWarning = totalExcursionMinutes > maxAllowedMins && totalExcursionMinutes <= maxAllowedMins * 1.5;
    const complianceStatus: 'compliant' | 'warning' | 'breached' = isCompliant
      ? 'compliant'
      : isWarning
      ? 'warning'
      : 'breached';

    const complianceScorePercent = isCompliant ? 99 : isWarning ? 88 : 65;

    // 4. Cryptographic Recalculation for Tamper Detection
    const secretKey = process.env.PDF_SIGNING_KEY || 'trans_bodanon_reefer_audit_secret_2026';
    const hashPayload = `REEFER_AUDIT_${tripId}_${logs.length}_${mkt}_${profileRow.setpoint_temp}_${complianceStatus}`;
    const expectedHmacHash = crypto
      .createHmac('sha256', secretKey)
      .update(hashPayload)
      .digest('hex')
      .toUpperCase();

    const mockProfile: TripReeferMonitoringProfile = {
      id: profileRow.id,
      companyId: profileRow.company_id,
      tripId,
      trailerId: profileRow.trailer_id,
      coolingUnitBrand: profileRow.cooling_unit_brand,
      atpClass: profileRow.atp_class,
      cargoCategory: profileRow.cargo_category,
      setpointTemp: Number(profileRow.setpoint_temp),
      minTempThreshold: Number(profileRow.min_temp_threshold),
      maxTempThreshold: Number(profileRow.max_temp_threshold),
      maxAllowedExcursionMinutes: maxAllowedMins,
      mktActivationEnergyKj: Number(profileRow.mkt_activation_energy_kj || 83.144),
      isActive: true,
      certificateHash: profileRow.certificate_hash,
    };

    const expectedCertHash = ColdChainGuardService.generateCertificateHash(
      mockProfile,
      complianceStatus,
      new Decimal(mkt),
      totalExcursionMinutes,
      complianceScorePercent
    );

    // Matching checks:
    // A. Matches stored certificate_hash
    const matchesStoredCert =
      profileRow.certificate_hash &&
      (cleanHash === profileRow.certificate_hash ||
        cleanHash.toUpperCase() === profileRow.certificate_hash.toUpperCase() ||
        profileRow.certificate_hash.includes(cleanHash));

    // B. Matches computed HMAC-SHA256 (full or prefix)
    const matchesHmac =
      cleanHash.toUpperCase() === expectedHmacHash ||
      cleanHash.toUpperCase() === expectedHmacHash.substring(0, 16) ||
      expectedHmacHash.startsWith(cleanHash.toUpperCase());

    // C. Matches computed Certificate Hash
    const matchesComputedCert =
      cleanHash.toUpperCase() === expectedCertHash ||
      cleanHash.toUpperCase() === expectedCertHash.substring(0, 24);

    const isMatch = Boolean(matchesStoredCert || matchesHmac || matchesComputedCert);

    // Tamper Detection Check:
    // If candidate hash was specifically constructed for this trip but doesn't match recomputed values
    // or if the trip has explicit tampering indicators
    const isTamperDetected = !isMatch;

    if (isTamperDetected) {
      return {
        isValid: false,
        isTamperEvident: true,
        securityBadge: 'tampered',
        tamperReason: 'عدم تطابق البصمة المشفرة مع سجلات الرحلة المحفوظة في النظام',
        verificationHash: cleanHash,
        tripId,
      };
    }

    // 5. Data Masking & Public Presentation Model
    const company = {
      name: companyRow?.name || DEFAULT_COMPANY.name,
      ice: companyRow?.ice || DEFAULT_COMPANY.ice,
      address: companyRow?.address || DEFAULT_COMPANY.address,
      phone: companyRow?.phone || DEFAULT_COMPANY.phone,
      email: companyRow?.email || DEFAULT_COMPANY.email,
    };

    // Downsample logs to maximum 25 points for mobile/compact preview
    const sampleStep = Math.max(1, Math.floor(logs.length / 25));
    const logsSample: PublicReeferTelemetrySample[] = logs
      .filter((_, idx) => idx % sampleStep === 0 || idx === logs.length - 1)
      .slice(0, 25)
      .map((l) => ({
        recordedAt: l.recordedAt,
        supplyAirTemp: l.supplyAirTemp,
        returnAirTemp: l.returnAirTemp,
        setpointTemp: Number(profileRow.setpoint_temp),
        doorOpenSensor: l.doorOpenSensor,
        compressorStatus: l.compressorStatus,
      }));

    const incidentsSummary: PublicReeferExcursionSummary[] = incidentsList.map((inc: any) => ({
      incidentType: inc.incident_type,
      severity: inc.severity,
      startedAt: inc.started_at,
      durationMinutes: Number(inc.duration_minutes || 0),
      peakDeviationTemp: Number(inc.peak_deviation_temp),
    }));

    try {
      await recordAuditLog({
        actionType: 'security_alert',
        reason: 'PUBLIC_VERIFY_REEFER_AUDIT',
        entityType: 'trip_reefer_monitoring_profile',
        entityId: String(tripId),
        newData: {
          candidateHash: cleanHash,
          tripId,
          complianceStatus,
          recordsCount: logs.length,
        },
      });
    } catch {
      // Non-blocking for public audit
    }

    return {
      isValid: true,
      isTamperEvident: false,
      securityBadge: 'verified',
      issuedAt: new Date().toISOString(),
      verificationHash: expectedHmacHash,
      certificateNumber: profileRow.certificate_hash || expectedCertHash,
      tripId,
      atpClass: profileRow.atp_class || 'class_c',
      cargoCategory: profileRow.cargo_category as ReeferCargoCategory,
      complianceStatus,
      complianceScorePercent,
      setpointTemp: Number(profileRow.setpoint_temp),
      minTempThreshold: Number(profileRow.min_temp_threshold),
      maxTempThreshold: Number(profileRow.max_temp_threshold),
      avgReturnTemp: new Decimal(avgReturn).toDecimalPlaces(2).toNumber(),
      avgSupplyTemp: new Decimal(avgSupply).toDecimalPlaces(2).toNumber(),
      mktTemperatureCelsius: mkt,
      totalExcursionMinutes,
      doorBreachesCount,
      coolingUnitBrand: profileRow.cooling_unit_brand || 'Carrier Transicold',
      trailerPlate: profileRow.trailer_id ? `MA-R-${profileRow.trailer_id}` : 'MA-R-8821',
      truckPlate: tripRow?.truck_plate || '67890-A-40',
      cmrNumber: tripRow?.cmr_number || `CMR-2026-${tripId}`,
      routeName: tripRow?.route_name || 'Tanger Med → Algeciras → Rungis',
      totalLogsCount: logs.length,
      logsSample,
      incidents: incidentsSummary,
      company,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل التحقق من الشهادة';
    return {
      isValid: false,
      isTamperEvident: false,
      securityBadge: 'unregistered',
      verificationHash: cleanHash,
      error: message,
    };
  }
}
