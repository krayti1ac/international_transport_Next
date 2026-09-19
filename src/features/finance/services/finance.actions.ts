'use server';

import { revalidatePath } from 'next/cache';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { processFIFOPayment, type FIFOPaymentResult } from '@/lib/fifo-payment';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DEPOSIT_TYPES = ['capital_injection', 'trip_revenue'] as const;
const WITHDRAWAL_TYPES = ['owner_withdrawal', 'office_expense', 'salary', 'trip_expense'] as const;

export async function getDynamicTreasuryBalance(cash_box_code: string): Promise<string> {
  const supabase = await createClient();

  const { data: cashBox, error: cashBoxError } = await supabase
    .from('cash_boxes')
    .select('id')
    .eq('code', cash_box_code)
    .single();

  if (cashBoxError || !cashBox) {
    throw new Error(`Cash box not found: ${cash_box_code}`);
  }

  const { data: transactions, error: txError } = await supabase
    .from('treasury_transactions')
    .select('type, amount')
    .eq('cash_box_id', cashBox.id);

  if (txError) {
    throw new Error(`Failed to fetch treasury transactions: ${txError.message}`);
  }

  let balance = new Decimal(0);

  for (const tx of transactions || []) {
    const amount = new Decimal(tx.amount);
    if (DEPOSIT_TYPES.includes(tx.type as typeof DEPOSIT_TYPES[number])) {
      balance = balance.plus(amount);
    } else if (WITHDRAWAL_TYPES.includes(tx.type as typeof WITHDRAWAL_TYPES[number])) {
      balance = balance.minus(amount);
    }
  }

  return balance.toFixed(2);
}

export async function recordBulkClientPayment(input: {
  clientId: number;
  totalAmountPaid: number;
  paymentMethod: string;
  cashBoxCode?: string;
  cashBoxId?: number;
  bankAccountId?: number;
  currency?: string;
  settlementRate?: number;
  reference?: string;
  notes?: string;
}): Promise<FIFOPaymentResult> {
  const supabase = await createClient();
  let cashBoxId: number | undefined = input.cashBoxId;
  let currency = input.currency || 'MAD';

  if (!cashBoxId && input.cashBoxCode) {
    const { data: cashBox } = await supabase
      .from('cash_boxes')
      .select('id, currency')
      .eq('code', input.cashBoxCode)
      .maybeSingle();

    if (cashBox) {
      cashBoxId = cashBox.id;
      if (!input.currency) currency = cashBox.currency;
    }
  }

  const res = await processFIFOPayment(supabase, {
    clientId: input.clientId,
    amount: input.totalAmountPaid,
    currency,
    paymentMethod: input.paymentMethod,
    cashBoxId,
    bankAccountId: input.bankAccountId,
    reference: input.reference,
    notes: input.notes,
    settlementRate: input.settlementRate,
  });

  revalidatePath('/finance');
  revalidatePath('/treasury');
  revalidatePath('/clients');
  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath('/invoices');

  return res;
}
