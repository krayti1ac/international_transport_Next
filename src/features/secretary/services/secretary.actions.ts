'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { mapKanbanStageToDbStatus } from '@/lib/utils/trip-status';
import type { TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RecordPettyCashExpenseInput {
  amount: number;
  description: string;
  category?: 'office_expense' | 'trip_expense';
  reference?: string;
}

/**
 * Record a petty cash expense directly out of the Secretary Cash Box ('secretary_cash')
 * Enforces Decimal.js precision for financial values.
 */
export async function recordSecretaryPettyCashExpense(
  input: RecordPettyCashExpenseInput
): Promise<{ success: boolean; data?: TreasuryTransaction; error?: string }> {
  try {
    const supabase = await createClient();

    const amountDec = new Decimal(input.amount || 0);
    if (amountDec.lessThanOrEqualTo(0)) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من الصفر' };
    }

    if (!input.description?.trim()) {
      return { success: false, error: 'يرجى توضيح سبب المصروف' };
    }

    // Locate secretary cash box
    const { data: cashBox, error: cashBoxError } = await supabase
      .from('cash_boxes')
      .select('id, currency')
      .eq('code', 'secretary_cash')
      .maybeSingle();

    if (cashBoxError || !cashBox) {
      return { success: false, error: 'صندوق السكرتيرة غير معرف في النظام' };
    }

    const expenseType = input.category || 'office_expense';

    const { data: transaction, error: insertError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: expenseType,
        amount: parseFloat(amountDec.toFixed(2)),
        currency: cashBox.currency || 'MAD',
        cash_box_id: cashBox.id,
        description: input.description.trim(),
        reference: input.reference?.trim() || null,
        reconciliation_status: 'cleared',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting secretary petty cash expense:', insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/treasury');

    return { success: true, data: transaction as TreasuryTransaction };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل المصروف';
    return { success: false, error: message };
  }
}

/**
 * Quick stage advance for trip orders in the secretary operations pipeline
 */
export async function advanceTripStageAction(
  tripId: number,
  nextStage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const dbStatus = mapKanbanStageToDbStatus(nextStage);
    if (!dbStatus) {
      return { success: false, error: `مرحلة غير صالحة: ${nextStage}` };
    }

    const { error } = await supabase
      .from('trip_orders')
      .update({ status: dbStatus })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/trips');

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث مرحلة الرحلة';
    return { success: false, error: message };
  }
}

