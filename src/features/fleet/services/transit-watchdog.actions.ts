'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppText } from '@/features/whatsapp/services/whatsapp-meta-client';
import {
  auditTripDispatchSchema,
  sendDriverExpiryAlertSchema,
  updateDriverTransitCredentialsSchema,
  AuditTripDispatchInput,
  SendDriverExpiryAlertInput,
  UpdateDriverTransitCredentialsInput,
} from '../schemas/transit-watchdog.schemas';
import { TransitWatchdogService } from './transit-watchdog.service';
import type {
  TransitAuditResult,
  TransitWatchdogSummary,
  TransitExpiryAlertItem,
} from '../types/transit-watchdog.types';
import type { Driver, Truck, Trailer } from '@/types/database';

/**
 * 1. Pre-Dispatch Transit Compliance Audit for a Driver, Truck, and Trailer on a given corridor
 */
export async function auditTripDispatchAction(rawInput: unknown): Promise<{
  success: boolean;
  auditResult?: TransitAuditResult;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const input: AuditTripDispatchInput = auditTripDispatchSchema.parse(rawInput);

    let companyId: number | null = null;
    if (user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      companyId = userProfile?.company_id ?? null;
    }

    // 1. Fetch Driver
    const { data: driverData, error: driverErr } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', input.driver_id)
      .single();

    if (driverErr || !driverData) {
      return { success: false, error: 'Chauffeur introuvable / Driver not found' };
    }

    // 2. Fetch Truck if specified
    let truckData: Truck | null = null;
    if (input.truck_id) {
      const { data: t } = await supabase
        .from('trucks')
        .select('*')
        .eq('id', input.truck_id)
        .maybeSingle();
      truckData = t;
    }

    // 3. Fetch Trailer if specified
    let trailerData: Trailer | null = null;
    if (input.trailer_id) {
      const { data: tr } = await supabase
        .from('trailers')
        .select('*')
        .eq('id', input.trailer_id)
        .maybeSingle();
      trailerData = tr;
    }

    // 4. Fetch Fleet Documents for Truck & Trailer
    let fleetDocs: any[] = [];
    const vehicleIds: number[] = [];
    if (input.truck_id) vehicleIds.push(input.truck_id);
    if (input.trailer_id) vehicleIds.push(input.trailer_id);

    if (vehicleIds.length > 0) {
      const { data: docs } = await supabase
        .from('fleet_documents')
        .select('*')
        .in('entity_id', vehicleIds)
        .eq('is_archived', false);
      fleetDocs = docs || [];
    }

    // 5. Run Compliance Audit
    const auditResult = TransitWatchdogService.auditTransitCompliance({
      driver: driverData as Driver,
      truck: truckData,
      trailer: trailerData,
      fleetDocs,
      corridorType: input.corridor_type,
      tripId: input.trip_id,
      tripDate: input.trip_date,
    });

    // 6. Persist Audit Record in Database
    try {
      const { data: insertedAudit } = await supabase
        .from('transit_compliance_audits')
        .insert({
          company_id: companyId,
          trip_id: input.trip_id || null,
          driver_id: input.driver_id,
          truck_id: input.truck_id || null,
          trailer_id: input.trailer_id || null,
          corridor_type: input.corridor_type,
          compliance_status: auditResult.overall_status,
          is_dispatch_allowed: auditResult.is_dispatch_allowed,
          block_reasons: auditResult.block_reasons,
          warnings: auditResult.warnings,
          evaluated_documents: auditResult.evaluated_documents,
        })
        .select('id')
        .single();

      if (insertedAudit?.id) {
        auditResult.id = insertedAudit.id;
      }
    } catch (dbErr) {
      console.warn('[TransitWatchdogAction] Non-blocking audit DB log error:', dbErr);
    }

    // 7. Audit log
    await recordAuditLog({
      actionType: 'create',
      entityType: 'transit_compliance_audits',
      entityId: String(auditResult.id || input.driver_id),
      newData: {
        driverName: driverData.name,
        corridorType: input.corridor_type,
        status: auditResult.overall_status,
        dispatchAllowed: auditResult.is_dispatch_allowed,
        blockReasonsCount: auditResult.block_reasons.length,
      },
    });

    return {
      success: true,
      auditResult,
    };
  } catch (err: any) {
    console.error('[TransitWatchdogAction] Audit error:', err);
    return {
      success: false,
      error: err?.message || 'Erreur lors de l’audit de conformité transit',
    };
  }
}

/**
 * 2. Fetches full fleet transit watchdog data and alerts summary
 */
export async function getTransitWatchdogRadarDataAction(): Promise<{
  drivers: Driver[];
  trucks: Truck[];
  summary: TransitWatchdogSummary;
  recentAudits: TransitAuditResult[];
  alerts: TransitExpiryAlertItem[];
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let companyId: number | null = null;
    if (user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      companyId = userProfile?.company_id ?? null;
    }

    // Fetch Drivers
    let driversQuery = supabase.from('drivers').select('*').order('name');
    if (companyId) driversQuery = driversQuery.eq('company_id', companyId);

    // Fetch Trucks
    let trucksQuery = supabase.from('trucks').select('*').order('plate_number');
    if (companyId) trucksQuery = trucksQuery.eq('company_id', companyId);

    // Fetch Fleet Documents
    let docsQuery = supabase.from('fleet_documents').select('*').eq('is_archived', false);

    // Fetch Recent Audits
    let auditsQuery = supabase
      .from('transit_compliance_audits')
      .select(`
        *,
        drivers:driver_id ( name, phone ),
        trucks:truck_id ( plate_number )
      `)
      .order('created_at', { ascending: false })
      .limit(30);
    if (companyId) auditsQuery = auditsQuery.eq('company_id', companyId);

    const [{ data: dbDrivers }, { data: dbTrucks }, { data: dbDocs }, { data: dbAudits }] =
      await Promise.all([driversQuery, trucksQuery, docsQuery, auditsQuery]);

    const drivers = (dbDrivers as Driver[]) || [];
    const trucks = (dbTrucks as Truck[]) || [];
    const docs = dbDocs || [];

    // Calculate Summary
    const summary = TransitWatchdogService.generateWatchdogSummary(drivers, trucks, docs);

    // Map Recent Audits
    const recentAudits: TransitAuditResult[] = (dbAudits || []).map((a: any) => ({
      id: a.id,
      company_id: a.company_id,
      trip_id: a.trip_id,
      trip_code: a.trip_id ? `TRIP-${a.trip_id}` : undefined,
      driver_id: a.driver_id,
      driver_name: a.drivers?.name || `Chauffeur #${a.driver_id}`,
      driver_phone: a.drivers?.phone,
      truck_id: a.truck_id,
      truck_plate: a.trucks?.plate_number,
      corridor_type: a.corridor_type,
      overall_status: a.compliance_status,
      is_dispatch_allowed: a.is_dispatch_allowed,
      block_reasons: a.block_reasons || [],
      warnings: a.warnings || [],
      evaluated_documents: a.evaluated_documents || [],
      created_at: a.created_at,
    }));

    // Map Alerts List (Drivers with expiring documents <= 30 days)
    const alerts: TransitExpiryAlertItem[] = [];
    const now = new Date();

    drivers.forEach((d) => {
      // Schengen visa alert
      if (d.visa_expiry_date) {
        const days = Math.round((new Date(d.visa_expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) {
          alerts.push({
            id: Number(`100${d.id}`),
            entity_type: 'driver',
            entity_id: d.id,
            entity_name: d.name,
            document_name: 'تأشيرة شنغن (Schengen Visa)',
            document_category: 'driver_visa',
            corridor_type: 'european_maritime',
            expiry_date: d.visa_expiry_date,
            days_remaining: days,
            alert_severity: days < 0 ? 'expired' : days <= 15 ? 'critical' : 'warning',
            driver_phone: d.phone,
            notification_sent_whatsapp: false,
            notification_sent_in_app: true,
          });
        }
      }

      // African visa alert
      if (d.african_visa_expiry_date) {
        const days = Math.round((new Date(d.african_visa_expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 30) {
          alerts.push({
            id: Number(`200${d.id}`),
            entity_type: 'driver',
            entity_id: d.id,
            entity_name: d.name,
            document_name: 'تأشيرة الممر الإفريقي (موريتانيا/السنغال)',
            document_category: 'driver_visa',
            corridor_type: 'african_overland',
            expiry_date: d.african_visa_expiry_date,
            days_remaining: days,
            alert_severity: days < 0 ? 'expired' : days <= 10 ? 'critical' : 'warning',
            driver_phone: d.phone,
            notification_sent_whatsapp: false,
            notification_sent_in_app: true,
          });
        }
      }
    });

    return {
      drivers,
      trucks,
      summary,
      recentAudits,
      alerts,
    };
  } catch (err) {
    console.error('[TransitWatchdogAction] Failed to fetch radar data:', err);
    return {
      drivers: [],
      trucks: [],
      summary: TransitWatchdogService.generateWatchdogSummary([], []),
      recentAudits: [],
      alerts: [],
    };
  }
}

/**
 * 3. Sends proactive WhatsApp notification to the driver regarding document expiry
 */
export async function sendDriverExpiryWhatsAppAlertAction(rawInput: unknown): Promise<{
  success: boolean;
  messagePreview?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const input: SendDriverExpiryAlertInput = sendDriverExpiryAlertSchema.parse(rawInput);

    // Fetch driver
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, name, phone, company_id')
      .eq('id', input.driver_id)
      .single();

    if (!driver || !driver.phone) {
      return { success: false, error: 'Numéro de téléphone du chauffeur manquant / Phone missing' };
    }

    const messageText = TransitWatchdogService.buildDriverWhatsAppAlertText({
      driverName: driver.name,
      documentNameAr: input.document_name_ar,
      documentNameFr: input.document_name_fr,
      documentNameEs: input.document_name_es,
      daysRemaining: input.days_remaining,
      expiryDate: input.expiry_date,
      locale: input.locale,
    });

    // Dispatch via WhatsApp Meta Client
    await sendWhatsAppText({
      to: driver.phone,
      message: messageText,
      auditEntity: {
        type: 'driver_transit_expiry',
        id: driver.id,
      },
    });

    // Record in alerts table
    await supabase.from('transit_expiry_alerts').insert({
      company_id: driver.company_id,
      driver_id: driver.id,
      document_name: input.document_name_ar,
      document_category: 'driver_visa',
      corridor_type: 'all',
      expiry_date: input.expiry_date,
      days_remaining: input.days_remaining,
      alert_severity: input.days_remaining <= 15 ? 'critical' : 'warning',
      notification_sent_whatsapp: true,
      last_alerted_at: new Date().toISOString(),
    });

    revalidatePath('/fleet');
    revalidatePath('/notifications/expiration');

    return {
      success: true,
      messagePreview: messageText,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de l’envoi WhatsApp' };
  }
}

/**
 * 4. Updates driver passport, visa, and cross-border credentials
 */
export async function updateDriverTransitCredentialsAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const input: UpdateDriverTransitCredentialsInput = updateDriverTransitCredentialsSchema.parse(rawInput);

    const updatePayload: Record<string, unknown> = {};
    if (input.passport_number !== undefined) updatePayload.passport_number = input.passport_number;
    if (input.passport_expiry_date !== undefined) updatePayload.passport_expiry_date = input.passport_expiry_date;
    if (input.visa_number !== undefined) updatePayload.visa_number = input.visa_number;
    if (input.visa_expiry_date !== undefined) {
      updatePayload.visa_expiry_date = input.visa_expiry_date;
      updatePayload.has_valid_visa = !!(input.visa_expiry_date && new Date(input.visa_expiry_date) >= new Date());
    }
    if (input.african_visa_number !== undefined) updatePayload.african_visa_number = input.african_visa_number;
    if (input.african_visa_expiry_date !== undefined) updatePayload.african_visa_expiry_date = input.african_visa_expiry_date;
    if (input.yellow_fever_vaccine_date !== undefined) updatePayload.yellow_fever_vaccine_date = input.yellow_fever_vaccine_date;
    if (input.driver_card_qualification_expiry !== undefined) updatePayload.driver_card_qualification_expiry = input.driver_card_qualification_expiry;

    const { error } = await supabase
      .from('drivers')
      .update(updatePayload)
      .eq('id', input.driver_id);

    if (error) throw error;

    await recordAuditLog({
      actionType: 'update',
      entityType: 'drivers',
      entityId: String(input.driver_id),
      newData: updatePayload,
    });

    revalidatePath('/fleet');
    revalidatePath('/drivers');
    revalidatePath('/notifications/expiration');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour des documents' };
  }
}

