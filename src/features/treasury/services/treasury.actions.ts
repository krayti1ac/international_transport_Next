'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DEPOSIT_TYPES = ['capital_injection', 'trip_revenue', 'payment', 'deposit'];
const WITHDRAWAL_TYPES = ['expense', 'salary', 'withdrawal'];

function classifyType(type: string): 'deposit' | 'withdrawal' | 'neutral' {
  if (DEPOSIT_TYPES.includes(type)) return 'deposit';
  if (WITHDRAWAL_TYPES.includes(type)) return 'withdrawal';
  return 'neutral';
}

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

export async function getPeriodTreasuryBalance(cashBoxId: number, startDate: string, endDate: string) {
  try {
    const supabase = await createClient();

    const { data: priorTransactions, error: priorError } = await supabase
      .from('treasury_transactions')
      .select('amount, type, currency')
      .eq('cash_box_id', cashBoxId)
      .lt('created_at', startDate);

    if (priorError) throw priorError;

    const { data: periodTransactions, error: periodError } = await supabase
      .from('treasury_transactions')
      .select('amount, type, currency')
      .eq('cash_box_id', cashBoxId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (periodError) throw periodError;

    const openingBalances: Record<string, any> = {};
    for (const tx of priorTransactions || []) {
      const currency = tx.currency || 'MAD';
      if (!openingBalances[currency]) {
        openingBalances[currency] = new Decimal(0);
      }
      const amount = new Decimal(tx.amount || 0);
      const classification = classifyType(tx.type);
      if (classification === 'deposit') {
        openingBalances[currency] = openingBalances[currency].plus(amount);
      } else if (classification === 'withdrawal') {
        openingBalances[currency] = openingBalances[currency].minus(amount);
      }
    }

    const periodBalances: Record<string, any> = {};
    for (const tx of periodTransactions || []) {
      const currency = tx.currency || 'MAD';
      if (!periodBalances[currency]) {
        periodBalances[currency] = new Decimal(0);
      }
      const amount = new Decimal(tx.amount || 0);
      const classification = classifyType(tx.type);
      if (classification === 'deposit') {
        periodBalances[currency] = periodBalances[currency].plus(amount);
      } else if (classification === 'withdrawal') {
        periodBalances[currency] = periodBalances[currency].minus(amount);
      }
    }

    const allCurrencies = new Set([
      ...Object.keys(openingBalances),
      ...Object.keys(periodBalances),
    ]);

    const result: Record<string, { opening_balance: string; period_net: string; closing_balance: string }> = {};
    for (const currency of allCurrencies) {
      const opening = openingBalances[currency] || new Decimal(0);
      const periodNet = periodBalances[currency] || new Decimal(0);
      const closing = opening.plus(periodNet);
      result[currency] = {
        opening_balance: opening.toFixed(2),
        period_net: periodNet.toFixed(2),
        closing_balance: closing.toFixed(2),
      };
    }

    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate period treasury balance';
    return { success: false, error: message };
  }
}
