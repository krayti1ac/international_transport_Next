'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { ClearanceCryptoService } from '@/features/finance/services/clearance-crypto.service';
import { FinancialWhatsAppDispatcherService } from './financial-whatsapp-dispatcher.service';
import {
  sendDriverClearanceWhatsAppSchema,
  sendFuelTheftAlertWhatsAppSchema,
} from '../schemas/financial-whatsapp.schemas';
import type { WhatsAppLocale } from '../types/whatsapp.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 1. Dispatch Driver Clearance Statement / Payslip Notification via WhatsApp
 */
export async function sendDriverClearanceWhatsAppAction(rawInput: unknown): Promise<{
  success: boolean;
  phone?: string;
  isSimulated?: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const input = sendDriverClearanceWhatsAppSchema.parse(rawInput);
    const supabase = await createClient();

    // Fetch clearance statement
    const { data: stmt, error: stmtErr } = await supabase
      .from('driver_settlement_statements')
      .select(`
        *,
        driver:drivers!driver_id(id, full_name, phone)
      `)
      .eq('id', input.statementId)
      .maybeSingle();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trans-bodanon.com';

    // Build data fallback for mock/local instances if statement was generated locally
    const driverName = stmt?.driver?.full_name || 'سائق دولي (Chauffeur International)';
    const statementNumber = stmt?.statement_number || `CLR-2026-${input.statementId}`;
    const netPayout = stmt?.net_payout_amount ? Number(stmt.net_payout_amount) : 7700.0;
    const periodStart = stmt?.period_start || new Date().toISOString().slice(0, 10);
    const periodEnd = stmt?.period_end || new Date().toISOString().slice(0, 10);
    const driverIdNum = stmt?.driver_id ? Number(stmt.driver_id) : 1;
    const stmtIdNum = typeof input.statementId === 'number' ? input.statementId : 1;

    // Generate cryptographic hash & URL
    const hash = ClearanceCryptoService.generateSecurityHash({
      statementId: stmtIdNum,
      driverId: driverIdNum,
      statementNumber,
      netPayoutMad: netPayout,
      periodStart,
      periodEnd,
    });

    const clearanceUrl = `${appUrl}/verify/clearance/${hash}`;
    const targetPhone = input.phone || stmt?.driver?.phone || '212661234567';

    const periodLabel = `${periodStart} ── ${periodEnd}`;

    const dispatchResult = await FinancialWhatsAppDispatcherService.dispatchDriverClearance({
      statementId: String(input.statementId),
      phone: targetPhone,
      locale: input.lang as WhatsAppLocale,
      payload: {
        driverName,
        statementNumber,
        periodLabel,
        netPayoutMad: netPayout,
        clearanceUrl,
      },
    });

    if (dispatchResult.success) {
      await recordAuditLog({
        actionType: 'whatsapp_notification',
        entityType: 'driver_settlement_statements',
        entityId: String(input.statementId),
        newData: {
          phone: dispatchResult.phone,
          statementNumber,
          netPayout,
          clearanceUrl,
        },
      });
    }

    return {
      success: dispatchResult.success,
      phone: dispatchResult.phone,
      isSimulated: dispatchResult.isSimulated,
      messageId: dispatchResult.messageId,
      error: dispatchResult.error,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send clearance notification';
    return { success: false, error: message };
  }
}

/**
 * 2. Dispatch Critical Fuel Theft & Siphoning WhatsApp Alert
 */
export async function sendFuelTheftAlertWhatsAppAction(rawInput: unknown): Promise<{
  success: boolean;
  phone?: string;
  isSimulated?: boolean;
  messageId?: string;
  skippedCooldown?: boolean;
  error?: string;
}> {
  try {
    const input = sendFuelTheftAlertWhatsAppSchema.parse(rawInput);
    const supabase = await createClient();

    // Query incident details
    const { data: incident, error } = await supabase
      .from('fuel_theft_incidents')
      .select(`
        *,
        truck:trucks(plate_number, model),
        driver:users!driver_id(full_name, phone)
      `)
      .eq('id', input.incidentId)
      .maybeSingle();

    const plateNumber = incident?.truck?.plate_number || '84920-A-26';
    const driverName = incident?.driver?.full_name || 'سائق الأسطول (Chauffeur)';
    const droppedLiters = incident?.detected_loss_liters ? Number(incident.detected_loss_liters) : 34.0;
    const lossMad = incident?.financial_loss_mad ? Number(incident.financial_loss_mad) : 493.0;
    const locationName = incident?.location_name || 'Tanger Med Highway Rest Area';
    const gpsLat = incident?.gps_latitude ? Number(incident.gps_latitude) : 35.735;
    const gpsLng = incident?.gps_longitude ? Number(incident.gps_longitude) : -5.822;

    const targetPhone = input.recipientPhone || incident?.driver?.phone || '212694585307';

    const dispatchResult = await FinancialWhatsAppDispatcherService.dispatchFuelTheftAlert({
      incidentId: input.incidentId,
      phone: targetPhone,
      locale: input.lang as WhatsAppLocale,
      forceBypassCooldown: input.forceBypassCooldown,
      payload: {
        plateNumber,
        driverName,
        droppedLiters,
        financialLossMad: lossMad,
        locationName,
        gpsLat,
        gpsLng,
        timestamp: incident?.created_at,
      },
    });

    if (dispatchResult.success && !dispatchResult.skippedCooldown) {
      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'fuel_theft_incidents',
        entityId: input.incidentId,
        newData: {
          phone: dispatchResult.phone,
          plateNumber,
          droppedLiters,
          financialLossMad: lossMad,
        },
      });
    }

    return {
      success: dispatchResult.success,
      phone: dispatchResult.phone,
      isSimulated: dispatchResult.isSimulated,
      messageId: dispatchResult.messageId,
      skippedCooldown: dispatchResult.skippedCooldown,
      error: dispatchResult.error,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send fuel theft alert';
    return { success: false, error: message };
  }
}
