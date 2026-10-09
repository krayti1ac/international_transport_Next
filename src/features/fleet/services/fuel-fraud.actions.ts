'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { AntiSiphoningDetectorService } from './anti-siphoning-detector.service';
import {
  antiSiphoningDetectionInputSchema,
  confirmIncidentDeductionSchema,
  resolveIncidentJustificationSchema,
  fuelFraudFilterSchema,
} from '../schemas/fuel-fraud.schemas';
import type {
  FuelFraudAuditSummary,
  FuelTheftIncidentRecord,
  FuelFraudKpiStats,
} from '../types/fuel-fraud.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 1. Run Anti-Siphoning & Fuel Fraud Audit on telematics data & receipts
 */
export async function detectTripFuelFraudAction(rawInput: unknown): Promise<{
  success: boolean;
  summary?: FuelFraudAuditSummary;
  savedIncidentsCount?: number;
  error?: string;
}> {
  try {
    const input = antiSiphoningDetectionInputSchema.parse(rawInput);
    const summary = AntiSiphoningDetectorService.analyzeFuelFraud(input);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let companyId = input.companyId;
    if (!companyId && user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      companyId = userProfile?.company_id ?? undefined;
    }

    let savedIncidentsCount = 0;

    // Persist detected anomalies to fuel_theft_incidents table if company context is available
    if (companyId && summary.incidents.length > 0) {
      const rowsToInsert = summary.incidents.map((incident) => ({
        company_id: companyId,
        truck_id: typeof input.truckConfig.truckId === 'number' ? input.truckConfig.truckId : null,
        driver_id: input.driverId || null,
        trip_id: input.tripId || null,
        incident_type: incident.incidentType,
        severity: incident.severity,
        detected_loss_liters: incident.detectedLossLiters,
        financial_loss_mad: incident.financialLossMad,
        fuel_price_per_liter: input.truckConfig.fuelPricePerLiterMad || 14.0,
        confidence_score: incident.confidenceScore,
        status: 'detected',
        gps_latitude: incident.gpsLatitude || null,
        gps_longitude: incident.gpsLongitude || null,
        location_name: incident.locationName || null,
        telematics_snapshot: incident.snapshot,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('fuel_theft_incidents')
        .insert(rowsToInsert)
        .select('id');

      if (!insertErr && inserted) {
        savedIncidentsCount = inserted.length;
      }
    }

    revalidatePath('/fleet/fuel-fraud');
    revalidatePath('/fleet');

    return {
      success: true,
      summary,
      savedIncidentsCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown fraud detection error';
    return { success: false, error: message };
  }
}

/**
 * 2. Fetch Fuel Theft Incidents with Multi-Tenant RLS & Filters
 */
export async function getFuelTheftIncidentsAction(rawFilters?: unknown): Promise<{
  success: boolean;
  incidents: FuelTheftIncidentRecord[];
  error?: string;
}> {
  try {
    const filters = rawFilters ? fuelFraudFilterSchema.parse(rawFilters) : {};
    const supabase = await createClient();

    let query = supabase
      .from('fuel_theft_incidents')
      .select(`
        *,
        truck:trucks(id, plate_number, model, fuel_consumption_rate),
        driver:users!driver_id(id, full_name, name, phone),
        trip:trip_orders(id, trip_number, origin, destination)
      `)
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.severity && filters.severity !== 'all') {
      query = query.eq('severity', filters.severity);
    }
    if (filters.incidentType && filters.incidentType !== 'all') {
      query = query.eq('incident_type', filters.incidentType);
    }
    if (filters.truckId) {
      query = query.eq('truck_id', filters.truckId);
    }
    if (filters.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      // In case table is not populated yet or local mock mode
      return { success: true, incidents: [] };
    }

    return {
      success: true,
      incidents: (data as unknown as FuelTheftIncidentRecord[]) || [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve incidents';
    return { success: false, incidents: [], error: message };
  }
}

/**
 * 3. Confirm Incident as legitimate theft deduction from Driver Account
 */
export async function confirmIncidentDeductionAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const input = confirmIncidentDeductionSchema.parse(rawInput);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: incident, error: fetchErr } = await supabase
      .from('fuel_theft_incidents')
      .select('*')
      .eq('id', input.incidentId)
      .single();

    if (fetchErr || !incident) {
      return { success: false, error: 'Incident record not found' };
    }

    const { error: updateErr } = await supabase
      .from('fuel_theft_incidents')
      .update({
        status: 'confirmed_deduction',
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        justification_notes: input.notes || 'Déduction approuvée par le gestionnaire de flotte',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.incidentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'fuel_theft_incidents',
      entityId: input.incidentId,
      oldData: { status: incident.status },
      newData: { status: 'confirmed_deduction', notes: input.notes },
    });

    revalidatePath('/fleet/fuel-fraud');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to confirm deduction';
    return { success: false, error: message };
  }
}

/**
 * 4. Resolve Incident: Accept Justification or Dismiss
 */
export async function resolveIncidentJustificationAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const input = resolveIncidentJustificationSchema.parse(rawInput);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: updateErr } = await supabase
      .from('fuel_theft_incidents')
      .update({
        status: input.resolution,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        justification_notes: input.justificationNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.incidentId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await recordAuditLog({
      actionType: 'update',
      entityType: 'fuel_theft_incidents',
      entityId: input.incidentId,
      newData: { status: input.resolution, notes: input.justificationNotes },
    });

    revalidatePath('/fleet/fuel-fraud');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve incident';
    return { success: false, error: message };
  }
}

/**
 * 5. Compute Executive Radar KPI Statistics using Decimal.js
 */
export async function getFuelFraudKpiStatsAction(): Promise<{
  success: boolean;
  stats: FuelFraudKpiStats;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: incidents, error } = await supabase
      .from('fuel_theft_incidents')
      .select('status, severity, incident_type, detected_loss_liters, financial_loss_mad');

    if (error || !incidents) {
      return {
        success: true,
        stats: {
          activeIncidentsCount: 0,
          confirmedDeductionsCount: 0,
          totalLossLiters: 0,
          totalFinancialLossMad: 0,
          siphoningCount: 0,
          overflowCount: 0,
          ghostRefuelingCount: 0,
        },
      };
    }

    let totalLossLiters = new Decimal(0);
    let totalLossMad = new Decimal(0);
    let activeCount = 0;
    let confirmedCount = 0;
    let siphoningCount = 0;
    let overflowCount = 0;
    let ghostCount = 0;

    for (const item of incidents) {
      if (item.status === 'detected') activeCount++;
      if (item.status === 'confirmed_deduction') confirmedCount++;

      if (item.status === 'detected' || item.status === 'confirmed_deduction') {
        totalLossLiters = totalLossLiters.plus(item.detected_loss_liters || 0);
        totalLossMad = totalLossMad.plus(item.financial_loss_mad || 0);

        if (item.incident_type === 'rapid_siphoning') siphoningCount++;
        if (item.incident_type === 'tank_overflow') overflowCount++;
        if (item.incident_type === 'ghost_refueling') ghostCount++;
      }
    }

    return {
      success: true,
      stats: {
        activeIncidentsCount: activeCount,
        confirmedDeductionsCount: confirmedCount,
        totalLossLiters: Number(totalLossLiters.toFixed(2)),
        totalFinancialLossMad: Number(totalLossMad.toFixed(2)),
        siphoningCount,
        overflowCount,
        ghostRefuelingCount: ghostCount,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch KPI stats';
    return {
      success: false,
      error: message,
      stats: {
        activeIncidentsCount: 0,
        confirmedDeductionsCount: 0,
        totalLossLiters: 0,
        totalFinancialLossMad: 0,
        siphoningCount: 0,
        overflowCount: 0,
        ghostRefuelingCount: 0,
      },
    };
  }
}
