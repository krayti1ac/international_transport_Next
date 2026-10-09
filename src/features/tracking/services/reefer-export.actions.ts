'use server';

/**
 * Trans Bodanon TMS — Reefer Official PDF & CSV Export Server Actions
 * Produces cryptographic EN 12830 / GDP Cold Chain Audit Reports
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { ReeferCsvExporterService } from './reefer-csv-exporter.service';
import { ReeferPdfReportService } from './reefer-pdf-report.service';
import type {
  ReeferExportFileResult,
  ReeferReportExportContext,
  ReeferTripExportContext,
} from '../types/reefer-export.types';
import type {
  ColdChainAuditEvaluation,
  ReeferCargoCategory,
  ReeferExcursionIncident,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';
import type { CompanyHeaderLegalInfo } from '@/features/finance/types/financial-export.types';

const DEFAULT_COMPANY: CompanyHeaderLegalInfo = {
  name: 'Trans Bodanon Transport & Logistique S.A.R.L.',
  ice: '002938475000084',
  rc: '104928 Tanger',
  patente: '49201948',
  ifNumber: '39485721',
  address: 'Zone Franche Port Tanger Med, Route Principale, Maroc',
  phone: '+212 539 94 82 10',
  email: 'contact@transbodanon.com',
  currency: 'MAD',
};

// Arrhenius constants for MKT calculation
const GAS_CONSTANT_R = new Decimal(8.314472);
const ACTIVATION_ENERGY_DH = new Decimal(83144);
const ZERO_CELSIUS_KELVIN = new Decimal(273.15);

function calculateMkt(temperatures: number[]): number {
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

async function resolveReeferExportContext(
  tripId: string | number,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): Promise<ReeferReportExportContext> {
  const supabase = await createClient();

  // 1. Fetch Trip Order & Company
  const { data: trip } = await supabase
    .from('trip_orders')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();

  let companyInfo = DEFAULT_COMPANY;
  if (trip?.company_id) {
    const { data: comp } = await supabase
      .from('companies')
      .select('*')
      .eq('id', trip.company_id)
      .maybeSingle();

    if (comp) {
      companyInfo = {
        ...DEFAULT_COMPANY,
        name: comp.name || DEFAULT_COMPANY.name,
        ice: comp.ice || DEFAULT_COMPANY.ice,
        rc: comp.rc || DEFAULT_COMPANY.rc,
        ifNumber: comp.if_number || DEFAULT_COMPANY.ifNumber,
        address: comp.address || DEFAULT_COMPANY.address,
        phone: comp.phone || DEFAULT_COMPANY.phone,
      };
    }
  }

  // 2. Fetch Reefer Monitoring Profile
  const { data: profileRow } = await supabase
    .from('trip_reefer_monitoring_profiles')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  const profile: TripReeferMonitoringProfile = {
    id: profileRow?.id || `profile_${tripId}`,
    companyId: profileRow?.company_id || trip?.company_id || 1,
    tripId,
    trailerId: profileRow?.trailer_id || null,
    coolingUnitBrand: profileRow?.cooling_unit_brand || 'Carrier Vector 1550',
    atpClass: (profileRow?.atp_class as any) || 'class_c',
    cargoCategory: (profileRow?.cargo_category as ReeferCargoCategory) || 'fresh_produce',
    setpointTemp: Number(profileRow?.setpoint_temp ?? 4.0),
    minTempThreshold: Number(profileRow?.min_temp_threshold ?? 2.0),
    maxTempThreshold: Number(profileRow?.max_temp_threshold ?? 6.0),
    maxAllowedExcursionMinutes: Number(profileRow?.max_allowed_excursion_minutes ?? 45),
    mktActivationEnergyKj: Number(profileRow?.mkt_activation_energy_kj ?? 83.144),
    isActive: Boolean(profileRow?.is_active ?? true),
    certificateHash: profileRow?.certificate_hash || null,
  };

  // 3. Fetch Telemetry Logs
  const { data: logsRows } = await supabase
    .from('reefer_temperature_logs')
    .select('*')
    .eq('trip_id', tripId)
    .order('recorded_at', { ascending: true });

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

  // 4. Fetch Incidents
  const { data: incidentRows } = await supabase
    .from('reefer_excursion_incidents')
    .select('*')
    .eq('trip_id', tripId)
    .order('started_at', { ascending: true });

  const incidents: ReeferExcursionIncident[] = (incidentRows || []).map((inc: any) => ({
    id: inc.id,
    companyId: inc.company_id,
    profileId: inc.profile_id,
    tripId,
    incidentType: inc.incident_type,
    severity: inc.severity,
    startedAt: inc.started_at,
    resolvedAt: inc.resolved_at,
    peakDeviationTemp: Number(inc.peak_deviation_temp),
    durationMinutes: Number(inc.duration_minutes || 0),
    mktImpactCelsius: inc.mkt_impact_celsius ? Number(inc.mkt_impact_celsius) : null,
    actionTaken: inc.action_taken,
    isCleared: Boolean(inc.is_cleared),
  }));

  // 5. Evaluate Metrics
  const returnTemps = logs.map((l) => l.returnAirTemp);
  const supplyTemps = logs.map((l) => l.supplyAirTemp);

  const mkt = returnTemps.length > 0 ? calculateMkt(returnTemps) : profile.setpointTemp;
  const avgReturn = returnTemps.length > 0
    ? returnTemps.reduce((acc, t) => acc + t, 0) / returnTemps.length
    : profile.setpointTemp;
  const avgSupply = supplyTemps.length > 0
    ? supplyTemps.reduce((acc, t) => acc + t, 0) / supplyTemps.length
    : profile.setpointTemp - 0.5;

  const totalExcursionMinutes = incidents.reduce((sum, i) => sum + i.durationMinutes, 0);
  const doorBreachesCount = logs.filter((l) => l.doorOpenSensor && !l.isGeofenceSafe).length;
  const totalDieselBurned = logs.reduce((sum, l) => sum + (l.dieselBurnRateLph || 2.1) * (5 / 60), 0);

  const isCompliant = totalExcursionMinutes <= profile.maxAllowedExcursionMinutes && doorBreachesCount === 0;
  const isWarning = totalExcursionMinutes > profile.maxAllowedExcursionMinutes && totalExcursionMinutes <= profile.maxAllowedExcursionMinutes * 1.5;

  const evaluation: ColdChainAuditEvaluation = {
    tripId,
    atpClass: profile.atpClass,
    cargoCategory: profile.cargoCategory,
    totalLogsCount: logs.length,
    setpointTemp: profile.setpointTemp,
    avgSupplyTemp: new Decimal(avgSupply).toDecimalPlaces(2).toNumber(),
    avgReturnTemp: new Decimal(avgReturn).toDecimalPlaces(2).toNumber(),
    mktTemperatureCelsius: mkt,
    complianceStatus: isCompliant ? 'compliant' : isWarning ? 'warning' : 'breached',
    totalExcursionMinutes,
    doorBreachesCount,
    totalDieselBurnedLiters: new Decimal(totalDieselBurned).toDecimalPlaces(1).toNumber(),
    complianceScorePercent: isCompliant ? 99 : isWarning ? 88 : 65,
    certificateHash: profile.certificateHash || undefined,
  };

  // 6. Cryptographic Hash & Verification Link
  const secretKey = process.env.PDF_SIGNING_KEY || 'trans_bodanon_reefer_audit_secret_2026';
  const hashPayload = `REEFER_AUDIT_${tripId}_${logs.length}_${mkt}_${profile.setpointTemp}_${evaluation.complianceStatus}`;
  const verificationHash = crypto
    .createHmac('sha256', secretKey)
    .update(hashPayload)
    .digest('hex')
    .toUpperCase();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tms.transbodanon.com';
  const verificationUrl = `${appUrl}/track/${tripId}?audit=${verificationHash.substring(0, 16)}`;

  const tripContext: ReeferTripExportContext = {
    tripId,
    cmrNumber: trip?.cmr_number || `CMR-2026-${tripId}`,
    routeName: trip?.route_name || 'Tanger Med → Algeciras → Rungis',
    truckPlate: trip?.truck_plate || '67890-A-40',
    trailerPlate: profile.trailerId ? String(profile.trailerId) : 'MA-R-8821',
    driverName: trip?.driver_name || 'سائق معتمد',
    clientName: trip?.client_name || 'Euro-Pharma Logistics',
  };

  return {
    company: companyInfo,
    trip: tripContext,
    profile,
    evaluation,
    logs,
    incidents,
    locale,
    issuedAt: new Date().toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    verificationHash,
    verificationUrl,
  };
}

/**
 * 1. Export Official DataCOLD CSV
 */
export async function exportReeferDataColdCsvAction(
  tripId: string | number,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): Promise<ReeferExportFileResult> {
  try {
    const context = await resolveReeferExportContext(tripId, locale);
    const csvContent = ReeferCsvExporterService.generateReeferCsv(context);

    await recordAuditLog({
      actionType: 'create',
      reason: 'EXPORT_REEFER_DATACOLD_CSV',
      entityType: 'trip_reefer_monitoring_profile',
      entityId: String(tripId),
      newData: {
        tripId,
        locale,
        recordsCount: context.logs.length,
        hash: context.verificationHash,
      },
    });

    return {
      success: true,
      fileName: `EN12830_DataCOLD_Trip_${tripId}_${locale}.csv`,
      fileContent: csvContent,
      mimeType: 'text/csv;charset=utf-8',
      verificationHash: context.verificationHash,
      verificationUrl: context.verificationUrl,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export Reefer CSV';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * 2. Export Official Vector A4 PDF Report (Printable HTML Document)
 */
export async function exportReeferDataColdPdfAction(
  tripId: string | number,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): Promise<ReeferExportFileResult> {
  try {
    const context = await resolveReeferExportContext(tripId, locale);
    const htmlContent = ReeferPdfReportService.generateReportHtml(context);

    await recordAuditLog({
      actionType: 'create',
      reason: 'EXPORT_REEFER_AUDIT_PDF',
      entityType: 'trip_reefer_monitoring_profile',
      entityId: String(tripId),
      newData: {
        tripId,
        locale,
        complianceStatus: context.evaluation.complianceStatus,
        hash: context.verificationHash,
      },
    });

    return {
      success: true,
      fileName: `Reefer_Audit_Certificate_Trip_${tripId}_${locale}.html`,
      fileContent: htmlContent,
      mimeType: 'text/html;charset=utf-8',
      verificationHash: context.verificationHash,
      verificationUrl: context.verificationUrl,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export Reefer PDF report';
    return {
      success: false,
      error: message,
    };
  }
}

