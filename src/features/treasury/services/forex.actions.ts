'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import type { ForexGainLossEntry } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface LiveForexResult {
  success: boolean;
  eurToMad: number;
  madToEur: number;
  rateDate: string;
  source: string;
  error?: string;
}

export async function syncDailyForexRate(): Promise<LiveForexResult> {
  const today = new Date().toISOString().split('T')[0];
  let eurToMad = 10.85;
  let source = 'Bank Al-Maghrib (Fallback)';

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.MAD) {
        eurToMad = parseFloat(new Decimal(data.rates.MAD).toFixed(4));
        source = 'Open Exchange Feed';
      }
    }
  } catch (apiErr) {
    console.warn('Forex API fallback to BAM baseline:', apiErr);
  }

  const madToEur = parseFloat(new Decimal(1).div(new Decimal(eurToMad)).toFixed(6));

  try {
    const supabase = await createClient();

    const payload = {
      rate_date: today,
      eur_to_mad: eurToMad,
      mad_to_eur: madToEur,
      source,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('forex_rates')
      .upsert(payload, { onConflict: 'rate_date' });

    if (error) throw error;

    return {
      success: true,
      eurToMad,
      madToEur,
      rateDate: today,
      source,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل حفظ سعر الصرف';
    return {
      success: false,
      eurToMad,
      madToEur,
      rateDate: today,
      source,
      error: message,
    };
  }
}

export async function recordRealizedForexGainLoss(input: {
  tripId?: number | null;
  invoiceId?: number | null;
  originalAmount: number;
  originalCurrency: string;
  originalRate: number;
  settlementRate: number;
  notes?: string;
}): Promise<{ success: boolean; entry?: ForexGainLossEntry; error?: string }> {
  try {
    const supabase = await createClient();

    const origMAD = new Decimal(input.originalAmount).times(new Decimal(input.originalRate));
    const settledMAD = new Decimal(input.originalAmount).times(new Decimal(input.settlementRate));
    const diff = settledMAD.minus(origMAD);

    if (diff.abs().lessThan(0.01)) {
      return { success: true };
    }

    const isGain = diff.gt(0);
    const realizedGainLoss = diff.abs().toNumber();
    const entryType: 'gain' | 'loss' = isGain ? 'gain' : 'loss';

    const payload = {
      trip_id: input.tripId || null,
      invoice_id: input.invoiceId || null,
      original_amount: input.originalAmount,
      original_currency: input.originalCurrency,
      original_rate: input.originalRate,
      settlement_rate: input.settlementRate,
      realized_gain_loss: realizedGainLoss,
      entry_type: entryType,
      notes: input.notes || `فارق صرف محقق (${entryType === 'gain' ? 'ربح' : 'خسارة'})`,
      created_at: new Date().toISOString(),
    };

    const { data: insertedEntry, error } = await supabase
      .from('forex_gain_loss_entries')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('treasury_transactions').insert({
      type: isGain ? 'income' : 'expense',
      amount: realizedGainLoss,
      currency: 'MAD',
      description: `تسوية فارق صرف عملة (${entryType === 'gain' ? 'أرباح صرف' : 'خسائر صرف'}) - مرجع: ${input.notes || 'تسوية بنكية'}`,
      reference: `FX-${insertedEntry.id}`,
      reconciliation_status: 'cleared',
    });

    await recordAuditLog({
      entityType: 'forex_gain_loss',
      entityId: insertedEntry.id,
      actionType: 'create',
      reason: `تسجيل قيد فارق صرف: ${realizedGainLoss} MAD (${entryType})`,
      newData: payload,
    });

    return { success: true, entry: insertedEntry as ForexGainLossEntry };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تسجيل قيد فارق العملة';
    return { success: false, error: message };
  }
}
