'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface SettleDriverAdvanceInput {
  advanceId: number;
  extraAdvances: number;
  driverAllowance: number;
  receiptExpenses: number;
  amountGiven: number;
  cashBoxId: number;
  description?: string;
}

export async function settleDriverAdvance(input: SettleDriverAdvanceInput) {
  const supabase = await createClient();

  const totalGiven = input.amountGiven + input.extraAdvances;
  const totalExpenses = input.driverAllowance + input.receiptExpenses;
  const amountReturned = totalGiven - totalExpenses;

  const { data: advance, error: advanceError } = await supabase
    .from('advances')
    .select('*')
    .eq('id', input.advanceId)
    .single();

  if (advanceError || !advance) {
    return { success: false, error: 'Advance not found' };
  }

  const { error: updateError } = await supabase
    .from('advances')
    .update({
      extra_advances: input.extraAdvances,
      driver_allowance: input.driverAllowance,
      receipt_expenses: input.receiptExpenses,
      status: 'settled',
    })
    .eq('id', input.advanceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (amountReturned > 0) {
    const { error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'expense',
        amount: amountReturned,
        currency: advance.currency,
        cash_box_id: input.cashBoxId,
        description: input.description || `Driver advance settlement #${input.advanceId}`,
        reference: `ADV-SETTLE-${input.advanceId}`,
        reconciliation_status: 'reconciled',
      });

    if (treasuryError) {
      return { success: false, error: treasuryError.message };
    }
  }

  const { error: salaryError } = await supabase
    .from('driver_salaries')
    .insert({
      driver_id: advance.driver_id,
      amount: totalGiven,
      currency: advance.currency,
      period_start: advance.date,
      period_end: advance.date,
      status: 'pending',
      advance_id: input.advanceId,
    });

  if (salaryError) {
    return { success: false, error: salaryError.message };
  }

  revalidatePath('/driver-settlements');
  revalidatePath('/treasury');
  revalidatePath('/driver-advances');

  return {
    success: true,
    amountReturned,
    totalGiven,
    totalExpenses,
  };
}
