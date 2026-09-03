import { SupabaseClient } from '@supabase/supabase-js';
import type { Invoice, Payment, PaymentInvoiceAllocation } from '@/types/database';

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
 * Allocates customer payment against the oldest unpaid or partially paid invoices first.
 */
export async function processFIFOPayment(
  supabase: SupabaseClient,
  input: ProcessPaymentInput
): Promise<FIFOPaymentResult> {
  try {
    const {
      clientId,
      amount,
      currency,
      paymentMethod,
      bankAccountId,
      cashBoxId,
      reference,
      notes,
    } = input;

    if (amount <= 0) {
      return {
        success: false,
        totalAllocated: 0,
        unallocatedCredit: 0,
        affectedInvoicesCount: 0,
        allocations: [],
        error: 'مبلغ الدفعة يجب أن يكون أكبر من الصفر',
      };
    }

    // 1. Fetch unpaid or partially paid invoices for the client, ordered by oldest issue date
    const { data: rawInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('client_id', clientId.toString())
      .in('status', ['unpaid', 'partially_paid', 'overdue'])
      .order('issue_date', { ascending: true })
      .order('id', { ascending: true });

    if (invoicesError) {
      throw new Error(`فشل استرجاع الفواتير: ${invoicesError.message}`);
    }

    const invoices = (rawInvoices || []) as Invoice[];

    // 2. Insert Payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        amount,
        currency,
        method: paymentMethod,
        bank_account_id: bankAccountId ? bankAccountId.toString() : null,
        reference: reference || null,
        notes: notes || `دفعة بنظام FIFO للعميل #${clientId}`,
        status: 'completed',
        notify_client: false,
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      throw new Error(`فشل إنشاء سجل الدفعة: ${paymentError?.message}`);
    }

    const paymentId = (paymentRecord as Payment).id;

    // 3. FIFO Allocation Loop
    let remainingPayment = amount;
    const allocationsToInsert: Partial<PaymentInvoiceAllocation>[] = [];
    const plannedAllocations: FIFOPaymentResult['allocations'] = [];

    for (const invoice of invoices) {
      if (remainingPayment <= 0.00001) break;

      const total = parseFloat(invoice.total_amount || '0');
      const paid = parseFloat(invoice.paid_amount || '0');
      const dueOnInvoice = Math.max(0, total - paid);

      if (dueOnInvoice <= 0.00001) continue;

      let allocated = 0;
      let newPaid = 0;
      let newStatus: 'paid' | 'partially_paid' = 'partially_paid';

      if (remainingPayment >= dueOnInvoice) {
        allocated = dueOnInvoice;
        newPaid = total;
        newStatus = 'paid';
        remainingPayment -= allocated;
      } else {
        allocated = remainingPayment;
        newPaid = paid + allocated;
        newStatus = 'partially_paid';
        remainingPayment = 0;
      }

      allocationsToInsert.push({
        payment_id: paymentId,
        invoice_id: invoice.id,
        allocated_amount: allocated,
      });

      plannedAllocations.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number || `#${invoice.id}`,
        allocatedAmount: allocated,
        newPaidAmount: newPaid,
        newStatus,
      });

      // Update invoice in Supabase
      const { error: updateInvError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaid.toFixed(2),
          status: newStatus,
        })
        .eq('id', invoice.id);

      if (updateInvError) {
        console.error(`خطأ أثناء تحديث الفاتورة ${invoice.id}:`, updateInvError);
      }
    }

    // 4. Batch insert allocations
    if (allocationsToInsert.length > 0) {
      const { error: allocInsertError } = await supabase
        .from('payment_invoice_allocations')
        .insert(allocationsToInsert);

      if (allocInsertError) {
        console.warn('تنبيه: جدول payment_invoice_allocations قد يتطلب إنشاءه في Supabase:', allocInsertError);
      }
    }

    // 5. Record Treasury Transaction (Income)
    const { error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'income',
        amount,
        currency,
        cash_box_id: cashBoxId || null,
        bank_account_id: bankAccountId || null,
        description: `تحصيل دفعة عميل #${clientId} (FIFO) - مرجع: ${reference || 'بدون'}`,
        reference: reference || `PAY-${paymentId}`,
        reconciliation_status: 'cleared',
      });

    if (treasuryError) {
      console.warn('تنبيه أثناء إضافة حركة الخزينة:', treasuryError);
    }

    // 6. Update Bank or CashBox balance if applicable
    if (bankAccountId) {
      const { data: bank } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bankAccountId)
        .single();

      if (bank) {
        await supabase
          .from('bank_accounts')
          .update({
            current_balance: (bank.current_balance || 0) + amount,
          })
          .eq('id', bankAccountId);
      }
    }

    return {
      success: true,
      paymentId,
      totalAllocated: amount - remainingPayment,
      unallocatedCredit: remainingPayment > 0 ? remainingPayment : 0,
      affectedInvoicesCount: plannedAllocations.length,
      allocations: plannedAllocations,
    };
  } catch (err: any) {
    return {
      success: false,
      totalAllocated: 0,
      unallocatedCredit: 0,
      affectedInvoicesCount: 0,
      allocations: [],
      error: err.message || 'حدث خطأ غير متوقع أثناء معالجة الدفعة بنظام FIFO',
    };
  }
}

