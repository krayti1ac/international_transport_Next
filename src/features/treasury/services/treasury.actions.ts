'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DEPOSIT_TYPES = ['capital_injection', 'trip_revenue', 'payment', 'deposit'];
const WITHDRAWAL_TYPES = ['expense', 'salary', 'withdrawal'];

export async function addTreasuryTransaction(data: Partial<TreasuryTransaction>) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase
      .from('treasury_transactions')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: result as TreasuryTransaction };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add treasury transaction';
    return { success: false, error: message };
  }
}

export async function getDynamicTreasuryBalance(cashBoxId: number) {
  try {
    const supabase = await createClient();
    const { data: transactions, error } = await supabase
      .from('treasury_transactions')
      .select('type, amount, currency')
      .eq('cash_box_id', cashBoxId);

    if (error) throw error;

    const balances: Record<string, any> = {};

    for (const tx of transactions || []) {
      const amount = new Decimal(tx.amount || 0);
      const currency = tx.currency || 'MAD';

      if (!balances[currency]) {
        balances[currency] = new Decimal(0);
      }

      if (DEPOSIT_TYPES.includes(tx.type)) {
        balances[currency] = balances[currency].plus(amount);
      } else if (WITHDRAWAL_TYPES.includes(tx.type)) {
        balances[currency] = balances[currency].minus(amount);
      }
    }

    const stringBalances: Record<string, string> = {};
    for (const [currency, balance] of Object.entries(balances)) {
      stringBalances[currency] = balance.toFixed(2);
    }

    return { success: true, data: stringBalances };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate treasury balance';
    return { success: false, error: message };
  }
}
