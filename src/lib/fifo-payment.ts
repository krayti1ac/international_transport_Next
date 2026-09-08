import { SupabaseClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FIFOPaymentResult {
  success: boolean;
  paymentId?: number;
  totalAllocated: number;
  unallocatedCredit: number;
  affectedInvoicesCount: number;
  allocations: {
    invoiceId: number;
    invoiceNumber: string;
    allocatedAmount: number;
    newPaidAmount: number;
    newStatus: 'paid' | 'partially_paid';
  }[];
  error?: string;
}

export interface ProcessPaymentInput {
  clientId: number;
  amount: number;
  currency: string;
  paymentMethod: string; // 'cash' | 'check' | 'bank_transfer'
  bankAccountId?: number;
  cashBoxId?: number;
  reference?: string;
  notes?: string;
}

/**
 * Execute FIFO Payment Allocation:
 * Calls atomic PostgreSQL Stored Procedure (RPC) `process_fifo_payment` inside a database transaction.
 * Ensures ACID atomicity, zero partial updates, and strict decimal precision.
 */
export async function processFIFOPayment(
  supabase: SupabaseClient,
  input: ProcessPaymentInput
): Promise<FIFOPaymentResult> {
  try {
    const amountDec = new Decimal(input.amount || 0);

    if (amountDec.lessThanOrEqualTo(0)) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: 'مبلغ الدفعة يجب أن يكون أكبر من الصفر',
      };
    }

    const { data, error } = await supabase.rpc('process_fifo_payment', {
      p_client_id: input.clientId,
      p_amount: amountDec.toNumber(),
      p_currency: input.currency || 'MAD',
      p_payment_method: input.paymentMethod || 'bank_transfer',
      p_bank_account_id: input.bankAccountId || null,
      p_cash_box_id: input.cashBoxId || null,
      p_reference: input.reference || null,
      p_notes: input.notes || `دفعة FIFO للعميل #${input.clientId}`,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as FIFOPaymentResult;
  } catch (err: any) {
    return {
      success: false,
      totalAllocated: 0,
      unallocatedCredit: 0,
      affectedInvoicesCount: 0,
      allocations: [],
      error: err.message || 'فشل معالجة دفعة FIFO',
    };
  }
}
