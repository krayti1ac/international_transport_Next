'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import type { PaymentInvoiceAllocation } from '@/types/database';

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
  reference?: string;
  cashBoxCode: string;
}): Promise<{
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
}> {
  try {
    const supabase = await createClient();
    const { clientId, totalAmountPaid, paymentMethod, reference, cashBoxCode } = input;

    if (totalAmountPaid <= 0) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: 'المبلغ يجب أن يكون أكبر من الصفر',
      };
    }

    const { data: cashBox, error: cashBoxError } = await supabase
      .from('cash_boxes')
      .select('id, currency')
      .eq('code', cashBoxCode)
      .single();

    if (cashBoxError || !cashBox) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: `الصندوق النقدي غير موجود: ${cashBoxCode}`,
      };
    }

    let remainingPayment = new Decimal(totalAmountPaid);

    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        amount: totalAmountPaid,
        method: paymentMethod,
        status: 'completed',
        currency: cashBox.currency,
        reference: reference || null,
        notify_client: false,
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: `فشل إنشاء سجل الدفعة: ${paymentError?.message}`,
      };
    }

    const paymentId = paymentRecord.id;

    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, status, issue_date')
      .eq('client_id', clientId.toString())
      .neq('status', 'paid')
      .order('issue_date', { ascending: true })
      .order('id', { ascending: true });

    if (invoicesError) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: `فشل استرجاع الفواتير: ${invoicesError.message}`,
      };
    }

    const allocationsToInsert: Partial<PaymentInvoiceAllocation>[] = [];
    const resultAllocations: {
      invoiceId: number;
      invoiceNumber: string;
      allocatedAmount: number;
      newPaidAmount: number;
      newStatus: 'paid' | 'partially_paid';
    }[] = [];

    for (const invoice of invoices || []) {
      if (remainingPayment.isZero()) break;

      const total = new Decimal(invoice.total_amount || '0');
      const paid = new Decimal(invoice.paid_amount || '0');
      const outstanding = total.minus(paid);

      if (outstanding.isZero() || outstanding.isNegative()) continue;

      let allocated: any;
      let newStatus: 'paid' | 'partially_paid';
      let newPaidAmount: any;

      if (remainingPayment.greaterThanOrEqualTo(outstanding)) {
        allocated = outstanding;
        newPaidAmount = total;
        newStatus = 'paid';
        remainingPayment = remainingPayment.minus(allocated);
      } else {
        allocated = remainingPayment;
        newPaidAmount = paid.plus(allocated);
        newStatus = 'partially_paid';
        remainingPayment = new Decimal(0);
      }

      allocationsToInsert.push({
        payment_id: paymentId,
        invoice_id: invoice.id,
        allocated_amount: parseFloat(allocated.toFixed(2)),
      });

      resultAllocations.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number || `#${invoice.id}`,
        allocatedAmount: parseFloat(allocated.toFixed(2)),
        newPaidAmount: parseFloat(newPaidAmount.toFixed(2)),
        newStatus,
      });

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount.toFixed(2),
          status: newStatus,
        })
        .eq('id', invoice.id);

      if (updateError) {
        console.error(`Failed to update invoice ${invoice.id}:`, updateError);
      }
    }

    if (allocationsToInsert.length > 0) {
      const { error: allocError } = await supabase
        .from('payment_invoice_allocations')
        .insert(allocationsToInsert);

      if (allocError) {
        console.error('Failed to insert allocations:', allocError);
      }
    }

    const { error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'trip_revenue',
        amount: totalAmountPaid,
        currency: cashBox.currency,
        cash_box_id: cashBox.id,
        description: `Client payment #${clientId} - Ref: ${reference || 'N/A'}`,
        reference: reference || null,
        reconciliation_status: 'cleared',
      });

    if (treasuryError) {
      console.error('Failed to insert treasury transaction:', treasuryError);
    }

    return {
      success: true,
      paymentId,
      totalAllocated: parseFloat(new Decimal(totalAmountPaid).minus(remainingPayment).toFixed(2)),
      unallocatedCredit: parseFloat(remainingPayment.toFixed(2)),
      affectedInvoicesCount: resultAllocations.length,
      allocations: resultAllocations,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة الدفعة';
    return {
      success: false,
      totalAllocated: 0,
      unallocatedCredit: 0,
      affectedInvoicesCount: 0,
      allocations: [],
      error: message,
    };
  }
}
