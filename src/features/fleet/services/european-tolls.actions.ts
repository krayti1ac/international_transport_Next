'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  uploadTollInvoiceBatchSchema,
  manualTollEstimateSchema,
  updateTollExpenseStatusSchema,
  UploadTollInvoiceBatchInput,
  ManualTollEstimateInput,
  UpdateTollExpenseStatusInput,
} from '../schemas/european-tolls.schemas';
import { EuropeanTollsService } from './european-tolls.service';
import type {
  TripMatchCandidate,
  TripTollExpense,
  TollCardInvoiceBatch,
  TollReconciliationSummary,
} from '../types/european-tolls.types';

/**
 * 1. Uploads and reconciles a DKV / Telepass / AS 24 invoice batch against active trips
 */
export async function uploadAndReconcileTollBatchAction(rawInput: unknown): Promise<{
  success: boolean;
  batchId?: number;
  summary?: TollReconciliationSummary;
  expenses?: TripTollExpense[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Non authentifié / Unauthorized' };
    }

    const input: UploadTollInvoiceBatchInput = uploadTollInvoiceBatchSchema.parse(rawInput);

    // Fetch user profile and company
    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle();

    const companyId = userProfile?.company_id ?? null;

    // 1. Parse raw provider file
    const rawTransactions = EuropeanTollsService.parseRawProviderFile(
      input.raw_file_content,
      input.provider
    );

    if (rawTransactions.length === 0) {
      return {
        success: false,
        error: 'Aucune transaction valide détectée dans le fichier / No valid toll transactions detected',
      };
    }

    // 2. Fetch candidate trips from DB to match plates and dates
    let tripsQuery = supabase
      .from('trip_orders')
      .select(`
        id,
        route,
        status,
        truck_id,
        trucks:truck_id (
          plate_number
        ),
        drivers:driver_id (
          name
        )
      `)
      .order('id', { ascending: false })
      .limit(200);

    if (companyId) {
      tripsQuery = tripsQuery.eq('company_id', companyId);
    }

    const { data: dbTrips } = await tripsQuery;

    const tripCandidates: TripMatchCandidate[] = (dbTrips || []).map((t: any) => ({
      id: t.id,
      trip_code: `TRIP-${t.id}`,
      truck_id: t.truck_id,
      truck_plate: t.trucks?.plate_number || '',
      route: t.route,
      driver_name: t.drivers?.name,
      status: t.status,
    }));

    // 3. Reconcile transactions
    const reconciledExpenses = EuropeanTollsService.reconcileTollTransactions(
      rawTransactions,
      tripCandidates,
      { exchangeRateToMad: input.exchange_rate_to_mad }
    );

    // 4. Generate summary
    const summary = EuropeanTollsService.generateReconciliationSummary(
      reconciledExpenses,
      input.exchange_rate_to_mad
    );

    // 5. Insert invoice batch into DB
    const { data: insertedBatch, error: batchErr } = await supabase
      .from('toll_card_invoices')
      .insert({
        company_id: companyId,
        provider: input.provider,
        invoice_number: input.invoice_number,
        invoice_date: input.invoice_date,
        billing_period_start: input.billing_period_start || null,
        billing_period_end: input.billing_period_end || null,
        total_net_eur: Number(summary.totalNetEur),
        total_vat_eur: Number(summary.totalVatEur),
        total_gross_eur: Number(summary.totalGrossEur),
        currency: 'EUR',
        total_transactions_count: summary.totalTransactions,
        matched_transactions_count: summary.matchedTransactions,
        total_vat_recoverable_eur: Number(summary.recoverableVatEur),
        reconciliation_status:
          summary.leakageCount > 0
            ? 'discrepancies_found'
            : summary.matchedTransactions === summary.totalTransactions
            ? 'reconciled'
            : 'partially_reconciled',
        source_file_name: input.file_name || 'toll_invoice_upload.csv',
      })
      .select('id')
      .single();

    const batchId = insertedBatch?.id;

    // 6. Insert individual trip toll expenses
    if (batchId && reconciledExpenses.length > 0) {
      const dbRows = reconciledExpenses.map((exp) => ({
        company_id: companyId,
        trip_id: exp.trip_id,
        truck_id: exp.truck_id,
        invoice_batch_id: batchId,
        toll_system: exp.toll_system,
        country_code: exp.country_code,
        provider: exp.provider,
        card_or_obu_id: exp.card_or_obu_id,
        entry_gate: exp.entry_gate,
        exit_gate: exp.exit_gate,
        highway_code: exp.highway_code,
        entry_time: exp.entry_time,
        exit_time: exp.exit_time,
        distance_km: exp.distance_km,
        vehicle_class: exp.vehicle_class,
        axles_count: exp.axles_count,
        gvw_tonnes: exp.gvw_tonnes,
        net_amount_eur: exp.net_amount_eur,
        vat_rate: exp.vat_rate,
        vat_amount_eur: exp.vat_amount_eur,
        gross_amount_eur: exp.gross_amount_eur,
        exchange_rate_to_mad: exp.exchange_rate_to_mad,
        gross_amount_mad: exp.gross_amount_mad,
        vat_recoverable: exp.vat_recoverable,
        vat_recovery_status: exp.vat_recovery_status,
        reconciliation_status: exp.reconciliation_status,
        reconciliation_notes: exp.reconciliation_notes,
        gps_verified: exp.gps_verified,
      }));

      await supabase.from('trip_toll_expenses').insert(dbRows);
    }

    // 7. Audit log
    await recordAuditLog({
      actionType: 'create',
      entityType: 'toll_card_invoices',
      entityId: String(batchId || 0),
      newData: {
        provider: input.provider,
        invoice_number: input.invoice_number,
        totalGrossEur: summary.totalGrossEur,
        matchRate: summary.matchRatePercentage,
        transactionsCount: summary.totalTransactions,
      },
    });

    revalidatePath('/fleet');
    revalidatePath('/european-tolls');

    return {
      success: true,
      batchId,
      summary,
      expenses: reconciledExpenses,
    };
  } catch (err: any) {
    console.error('[EuropeanTollsAction] Failed to upload/reconcile toll batch:', err);
    return {
      success: false,
      error: err?.message || 'Erreur lors de la réconciliation de la facture de péage',
    };
  }
}

/**
 * 2. Fetches recent toll reconciliation data, invoices and expenses
 */
export async function getTollReconciliationDataAction(): Promise<{
  batches: TollCardInvoiceBatch[];
  expenses: TripTollExpense[];
  summary: TollReconciliationSummary;
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

    let batchesQuery = supabase
      .from('toll_card_invoices')
      .select('*')
      .order('invoice_date', { ascending: false })
      .limit(20);

    let expensesQuery = supabase
      .from('trip_toll_expenses')
      .select(`
        *,
        trip_orders:trip_id (
          route
        ),
        trucks:truck_id (
          plate_number
        )
      `)
      .order('exit_time', { ascending: false })
      .limit(100);

    if (companyId) {
      batchesQuery = batchesQuery.eq('company_id', companyId);
      expensesQuery = expensesQuery.eq('company_id', companyId);
    }

    const [{ data: batches }, { data: dbExpenses }] = await Promise.all([
      batchesQuery,
      expensesQuery,
    ]);

    const formattedExpenses: TripTollExpense[] = (dbExpenses || []).map((exp: any) => ({
      id: exp.id,
      company_id: exp.company_id,
      trip_id: exp.trip_id,
      truck_id: exp.truck_id,
      invoice_batch_id: exp.invoice_batch_id,
      toll_system: exp.toll_system,
      country_code: exp.country_code,
      provider: exp.provider,
      card_or_obu_id: exp.card_or_obu_id,
      entry_gate: exp.entry_gate,
      exit_gate: exp.exit_gate,
      highway_code: exp.highway_code,
      entry_time: exp.entry_time,
      exit_time: exp.exit_time,
      distance_km: exp.distance_km,
      vehicle_class: exp.vehicle_class,
      axles_count: exp.axles_count,
      gvw_tonnes: exp.gvw_tonnes,
      net_amount_eur: Number(exp.net_amount_eur),
      vat_rate: Number(exp.vat_rate),
      vat_amount_eur: Number(exp.vat_amount_eur),
      gross_amount_eur: Number(exp.gross_amount_eur),
      exchange_rate_to_mad: Number(exp.exchange_rate_to_mad),
      gross_amount_mad: Number(exp.gross_amount_mad),
      vat_recoverable: exp.vat_recoverable,
      vat_recovery_status: exp.vat_recovery_status,
      reconciliation_status: exp.reconciliation_status,
      reconciliation_notes: exp.reconciliation_notes,
      gps_verified: exp.gps_verified,
      metadata: exp.metadata,
      created_at: exp.created_at,
      updated_at: exp.updated_at,
      trip_code: exp.trip_id ? `TRIP-${exp.trip_id}` : undefined,
      truck_plate: exp.trucks?.plate_number,
    }));

    const summary = EuropeanTollsService.generateReconciliationSummary(formattedExpenses);

    return {
      batches: (batches as TollCardInvoiceBatch[]) || [],
      expenses: formattedExpenses,
      summary,
    };
  } catch (err) {
    console.error('[EuropeanTollsAction] Failed to fetch toll reconciliation data:', err);
    return {
      batches: [],
      expenses: [],
      summary: EuropeanTollsService.generateReconciliationSummary([]),
    };
  }
}

/**
 * 3. Updates the reconciliation status, VAT recovery status, or assigned trip for an expense
 */
export async function updateTollExpenseStatusAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const input: UpdateTollExpenseStatusInput = updateTollExpenseStatusSchema.parse(rawInput);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.reconciliation_status) updatePayload.reconciliation_status = input.reconciliation_status;
    if (input.vat_recovery_status) updatePayload.vat_recovery_status = input.vat_recovery_status;
    if (input.trip_id !== undefined) updatePayload.trip_id = input.trip_id;
    if (input.reconciliation_notes !== undefined) updatePayload.reconciliation_notes = input.reconciliation_notes;

    const { error } = await supabase
      .from('trip_toll_expenses')
      .update(updatePayload)
      .eq('id', input.id);

    if (error) throw error;

    await recordAuditLog({
      actionType: 'update',
      entityType: 'trip_toll_expenses',
      entityId: String(input.id),
      newData: updatePayload,
    });

    revalidatePath('/fleet');
    revalidatePath('/european-tolls');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour' };
  }
}

/**
 * 4. Calculates a manual toll fee or Eurovignette estimate with exact Decimal.js precision
 */
export async function calculateManualTollEstimateAction(rawInput: unknown) {
  try {
    const input: ManualTollEstimateInput = manualTollEstimateSchema.parse(rawInput);
    const result = EuropeanTollsService.calculateTollAmount({
      countryCode: input.country_code,
      highwayCode: input.highway_code,
      distanceKm: input.distance_km,
      netAmountEur: input.net_amount_eur,
      vatRate: input.vat_rate,
      exchangeRateToMad: input.exchange_rate_to_mad,
      isEurovignette: input.is_eurovignette,
    });
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur de calcul' };
  }
}

