import { SupabaseClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import {
  calculateFIFOAllocation,
  type FIFOInvoiceInput,
  type FIFOAllocationItem,
} from '@/lib/utils/decimal';
import { recordForexGainLossEntry } from '@/lib/forex';
import { recordAuditLog } from '@/lib/audit.server';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

import type { FIFOPaymentResult } from '@/lib/utils/decimal';
export type { FIFOPaymentResult };
export { previewFIFOAllocation } from '@/lib/utils/decimal';

export interface ProcessPaymentInput {
  clientId: number;
  amount: number;
  currency?: string;
  paymentMethod: string; // 'cash' | 'check' | 'bank_transfer'
  bankAccountId?: number;
  cashBoxId?: number;
  reference?: string;
  notes?: string;
  settlementRate?: number; // سعر الصرف الفعلي عند التحصيل للعملات الأجنبية
}

/**
 * Execute FIFO Payment Allocation Engine:
 * - Allocates payment to oldest unpaid/partially paid invoices (issue_date ASC, id ASC)
 * - Uses Decimal.js for exact financial precision without JavaScript floating-point errors
 * - Updates invoice statuses ('paid' or 'partially_paid') and paid_amount
 * - Records individual allocations in `payment_invoice_allocations`
 * - Records deposit in `treasury_transactions` with type 'client_payment'
 * - Automates realized Forex Gain/Loss entry creation in `forex_gain_loss_entries` for foreign currency
 * - Records audit trail in `audit_logs`
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

    // 1. Fetch client unpaid or partially paid invoices ordered by oldest issue_date, id
    const { data: rawInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, status, issue_date, currency, exchange_rate, trip_id')
      .or(`client_id.eq.${input.clientId},client_id.eq.${String(input.clientId)}`)
      .in('status', ['unpaid', 'partially_paid', 'overdue'])
      .order('issue_date', { ascending: true })
      .order('id', { ascending: true });

    if (invoicesError) {
      throw new Error(`فشل استرجاع فواتير العميل: ${invoicesError.message}`);
    }

    const invoices: FIFOInvoiceInput[] = (rawInvoices || []).map((inv: {
      id: number;
      invoice_number?: string;
      total_amount: number;
      paid_amount?: number;
      status: string;
      issue_date?: string;
      currency?: string;
      exchange_rate?: number;
      trip_id?: number;
    }) => ({
      id: inv.id,
      invoice_number: inv.invoice_number || `#${inv.id}`,
      total_amount: inv.total_amount,
      paid_amount: inv.paid_amount || 0,
      status: inv.status,
      issue_date: inv.issue_date,
      currency: inv.currency || input.currency || 'MAD',
      exchange_rate: inv.exchange_rate,
      trip_id: inv.trip_id,
    }));

    // 2. Compute allocations via Decimal.js
    const allocationResult = calculateFIFOAllocation(
      invoices,
      amountDec,
      input.settlementRate
    );

    // 3. Create payment record in payments table
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        client_id: input.clientId,
        amount: amountDec.toNumber(),
        unallocated_amount: allocationResult.unallocatedCredit,
        currency: input.currency || 'MAD',
        method: input.paymentMethod || 'bank_transfer',
        bank_account_id: input.bankAccountId ? String(input.bankAccountId) : null,
        reference: input.reference || null,
        notes: input.notes || `دفعة بنظام FIFO للعميل #${input.clientId}`,
        status: 'completed',
        notify_client: false,
      })
      .select('id')
      .single();

    if (paymentError || !paymentRecord) {
      throw new Error(`فشل إنشاء سجل الدفعة: ${paymentError?.message}`);
    }

    const paymentId = paymentRecord.id;

    // 3.1 Handle Overpayment: create client_credit_balances record if unallocatedCredit > 0
    let creditBalanceId: number | undefined;
    if (allocationResult.unallocatedCredit > 0) {
      const { data: creditBalance, error: creditError } = await supabase
        .from('client_credit_balances')
        .insert({
          client_id: input.clientId,
          payment_id: paymentId,
          amount: allocationResult.unallocatedCredit,
          remaining_amount: allocationResult.unallocatedCredit,
          currency: input.currency || 'MAD',
          status: 'active',
          notes: `رصيد دائن فائض ناتج عن دفعة العميل #${input.clientId} (مرجع: ${input.reference || `PAY-${paymentId}`})`,
        })
        .select('id')
        .maybeSingle();

      if (!creditError && creditBalance) {
        creditBalanceId = creditBalance.id;
      }
    }

    // 4. Record allocations in payment_invoice_allocations table
    if (allocationResult.allocations.length > 0) {
      const allocationsToInsert = allocationResult.allocations.map((a) => ({
        payment_id: paymentId,
        invoice_id: a.invoiceId,
        allocated_amount: a.allocatedAmount,
      }));

      const { error: allocError } = await supabase
        .from('payment_invoice_allocations')
        .insert(allocationsToInsert);

      if (allocError) {
        console.error('Failed to insert allocations:', allocError);
      }
    }

    // 5. Update invoice paid amounts and statuses
    for (const alloc of allocationResult.allocations) {
      const { error: updateInvError } = await supabase
        .from('invoices')
        .update({
          paid_amount: alloc.newPaidAmount,
          status: alloc.newStatus,
        })
        .eq('id', alloc.invoiceId);

      if (updateInvError) {
        console.error(`Failed to update invoice #${alloc.invoiceId}:`, updateInvError);
      }
    }

    // 6. Realized Forex Gain/Loss entries
    const recordedForexEntries: Array<{
      invoiceId: number;
      amount: number;
      type: 'gain' | 'loss' | 'neutral';
      id?: number;
      treasuryTransactionId?: number;
    }> = [];

    if (input.settlementRate) {
      for (const alloc of allocationResult.allocations) {
        if (alloc.forexGainLoss && alloc.forexGainLoss.type !== 'neutral') {
          const matchedInv = invoices.find((i) => i.id === alloc.invoiceId);
          const initialRate = matchedInv?.exchange_rate || 10.85;

          const forexRes = await recordForexGainLossEntry(supabase, {
            tripId: matchedInv?.trip_id || null,
            invoiceId: alloc.invoiceId,
            originalAmount: alloc.allocatedAmount,
            originalCurrency: matchedInv?.currency || 'EUR',
            originalRate: initialRate,
            settlementRate: input.settlementRate,
            notes: `فرق صرف محقق عند سداد الفاتورة #${alloc.invoiceNumber} بنظام FIFO`,
          });

          if (forexRes.recorded) {
            // Dual Entry into treasury_transactions for realized forex gain or loss
            let fxTreasuryTxId: number | undefined;
            const fxType = forexRes.type === 'gain' ? 'forex_gain' : 'forex_loss';
            const { data: fxTx } = await supabase
              .from('treasury_transactions')
              .insert({
                type: fxType,
                amount: forexRes.amount,
                currency: 'MAD',
                cash_box_id: input.cashBoxId || null,
                bank_account_id: input.bankAccountId || null,
                description: `قيد فروق صرف محققة (${forexRes.type === 'gain' ? 'أرباح صرف' : 'خسائر صرف'}) لسداد الفاتورة #${alloc.invoiceNumber} (${alloc.allocatedAmount} EUR بسعر ${input.settlementRate} MAD/EUR)`,
                reference: `FX-${forexRes.type.toUpperCase()}-${alloc.invoiceId}-${paymentId}`,
                reconciliation_status: 'cleared',
              })
              .select('id')
              .maybeSingle();

            if (fxTx) {
              fxTreasuryTxId = fxTx.id;
            }

            recordedForexEntries.push({
              invoiceId: alloc.invoiceId,
              amount: forexRes.amount,
              type: forexRes.type,
              id: forexRes.id,
              treasuryTransactionId: fxTreasuryTxId,
            });
            alloc.forexEntry = {
              id: forexRes.id,
              amount: forexRes.amount,
              type: forexRes.type,
            };
          }
        }
      }
    }

    // 7. Record Treasury Transaction (client_payment)
    let treasuryTxId: number | undefined;
    const { data: treasuryTx, error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'client_payment',
        amount: amountDec.toNumber(),
        currency: input.currency || 'MAD',
        cash_box_id: input.cashBoxId || null,
        bank_account_id: input.bankAccountId || null,
        description: `تحصيل دفعة عميل #${input.clientId} (FIFO) - مرجع: ${input.reference || 'بدون'}`,
        reference: input.reference || `PAY-${paymentId}`,
        reconciliation_status: 'cleared',
      })
      .select('id')
      .maybeSingle();

    if (!treasuryError && treasuryTx) {
      treasuryTxId = treasuryTx.id;
    }

    // 8. Update Bank Account or Cash Box balance
    if (input.bankAccountId) {
      try {
        const { data: bank } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', input.bankAccountId)
          .single();

        if (bank) {
          const newBal = new Decimal(bank.current_balance || 0).plus(amountDec).toNumber();
          await supabase
            .from('bank_accounts')
            .update({ current_balance: newBal })
            .eq('id', input.bankAccountId);
        }
      } catch (err) {
        console.warn('Bank balance update error:', err);
      }
    } else if (input.cashBoxId) {
      try {
        const { data: box } = await supabase
          .from('cash_boxes')
          .select('current_balance')
          .eq('id', input.cashBoxId)
          .single();

        if (box) {
          const newBal = new Decimal(box.current_balance || 0).plus(amountDec).toNumber();
          await supabase
            .from('cash_boxes')
            .update({ current_balance: newBal })
            .eq('id', input.cashBoxId);
        }
      } catch (err) {
        console.warn('Cashbox balance update error:', err);
      }
    }

    // 9. Record Security Audit Log
    try {
      await recordAuditLog({
        entityType: 'payments',
        entityId: paymentId,
        actionType: 'fifo_payment',
        reason: `تحصيل دفعة FIFO للعميل #${input.clientId} بقيمة ${amountDec.toFixed(2)} ${input.currency || 'MAD'}`,
        newData: {
          paymentId,
          clientId: input.clientId,
          totalAmount: amountDec.toNumber(),
          totalAllocated: allocationResult.totalAllocated,
          unallocatedCredit: allocationResult.unallocatedCredit,
          affectedInvoicesCount: allocationResult.affectedInvoicesCount,
          creditBalanceId,
          creditNotePayload: allocationResult.creditNotePayload,
          allocations: allocationResult.allocations,
          forexEntries: recordedForexEntries,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log recording non-blocking warning:', auditErr);
    }

    return {
      success: true,
      paymentId,
      totalAllocated: allocationResult.totalAllocated,
      unallocatedCredit: allocationResult.unallocatedCredit,
      affectedInvoicesCount: allocationResult.affectedInvoicesCount,
      creditBalanceId,
      creditNotePayload: allocationResult.creditNotePayload,
      allocations: allocationResult.allocations,
      forexEntries: recordedForexEntries,
      treasuryTransactionId: treasuryTxId,
    };
  } catch (err: unknown) {
    console.error('Error in processFIFOPayment:', err);
    const message = err instanceof Error ? err.message : 'فشل معالجة دفعة FIFO';
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
