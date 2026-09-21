'use server';

import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { getAuthenticatedCompanyId } from '@/lib/rbac.server';
import { revalidatePath } from 'next/cache';
import type { Client } from '@/types/database';
import { FifoPaymentSchema, type FifoPaymentInput } from '../schemas/client-fifo.schema';
import { processFIFOPayment, type FIFOPaymentResult } from '@/lib/fifo-payment';
import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function createClient(data: Partial<Client>) {
  try {
    const companyId = await getAuthenticatedCompanyId(data.company_id);
    const supabase = await createSupabaseClient();
    const payload = {
      ...data,
      company_id: companyId,
    };
    const { data: result, error } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/clients');
    return { success: true, data: result as Client };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create client';
    return { success: false, error: message };
  }
}

export async function updateClient(id: number, data: Partial<Client>) {
  try {
    const supabase = await createSupabaseClient();
    const { data: result, error } = await supabase
      .from('clients')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { success: true, data: result as Client };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update client';
    return { success: false, error: message };
  }
}

export async function processClientFifoPaymentAction(
  rawInput: FifoPaymentInput
): Promise<{ success: boolean; data?: FIFOPaymentResult; error?: string }> {
  try {
    const parseResult = FifoPaymentSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'بيانات الدفعة غير صحيحة';
      return { success: false, error: firstError };
    }

    const input = parseResult.data;
    const supabase = await createSupabaseClient();

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, currency')
      .eq('id', input.clientId)
      .single();

    if (clientError || !client) {
      return { success: false, error: 'العميل المحدد غير موجود في النظام' };
    }

    // Call atomic FIFO stored procedure
    const result = await processFIFOPayment(supabase, {
      clientId: input.clientId,
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethod,
      bankAccountId: input.destinationType === 'bank' ? input.destinationId : undefined,
      cashBoxId: input.destinationType === 'cashbox' ? input.destinationId : undefined,
      reference: input.reference || undefined,
      notes: input.notes || `دفعة بنظام FIFO للعميل: ${client.name}`,
      settlementRate: input.settlementRate || undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'فشلت معالجة دفعة FIFO' };
    }

    // Invalidate next caches
    revalidatePath('/clients');
    revalidatePath(`/clients/${input.clientId}`);
    revalidatePath('/invoices');
    revalidatePath('/treasury');
    revalidatePath('/accounting');

    return { success: true, data: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء معالجة دفعة FIFO';
    return { success: false, error: message };
  }
}

export async function getClientCreditBalanceAction(clientId: number) {
  try {
    const supabase = await createSupabaseClient();
    const { data: credits, error } = await supabase
      .from('client_credit_balances')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['active', 'partially_used']);

    if (error) throw error;

    let totalRemaining = new Decimal(0);
    const validCredits = credits || [];
    for (const c of validCredits) {
      totalRemaining = totalRemaining.plus(new Decimal(c.remaining_amount || 0));
    }

    return {
      success: true,
      totalCredit: parseFloat(totalRemaining.toFixed(2)),
      creditRecords: validCredits,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب الرصيد الدائن للعميل';
    return { success: false, totalCredit: 0, error: message };
  }
}

export async function applyClientCreditBalanceAction(clientId: number, amountToUse?: number) {
  try {
    const supabase = await createSupabaseClient();

    // 1. Fetch available credit
    const { data: credits, error: creditError } = await supabase
      .from('client_credit_balances')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['active', 'partially_used'])
      .order('created_at', { ascending: true });

    if (creditError) throw creditError;
    if (!credits || credits.length === 0) {
      return { success: false, error: 'لا يوجد رصيد دائن متاح لهذا العميل' };
    }

    let totalAvailable = new Decimal(0);
    for (const c of credits) {
      totalAvailable = totalAvailable.plus(new Decimal(c.remaining_amount || 0));
    }

    if (totalAvailable.isZero()) {
      return { success: false, error: 'الرصيد الدائن المتاح يساوي صفراً' };
    }

    const requestedAmount = amountToUse ? new Decimal(amountToUse) : totalAvailable;
    const effectiveAmount = Decimal.min(requestedAmount, totalAvailable);

    if (effectiveAmount.lessThanOrEqualTo(0)) {
      return { success: false, error: 'المبلغ المطلوب استهلاكه غير صالح' };
    }

    // 2. Run FIFO payment using internal credit
    const fifoResult = await processFIFOPayment(supabase, {
      clientId,
      amount: effectiveAmount.toNumber(),
      currency: credits[0]?.currency || 'MAD',
      paymentMethod: 'internal_credit',
      reference: `CREDIT-CONSUMPTION-${Date.now()}`,
      notes: `سداد فواتير عبر استهلاك الرصيد الدائن للعميل #${clientId}`,
    });

    if (!fifoResult.success) {
      return { success: false, error: fifoResult.error || 'فشل سداد الفواتير بالرصيد الدائن' };
    }

    // 3. Deduct consumed amount from credit records
    let toDeduct = new Decimal(fifoResult.totalAllocated);
    for (const c of credits) {
      if (toDeduct.isZero()) break;
      const currentRemaining = new Decimal(c.remaining_amount || 0);
      if (currentRemaining.isZero()) continue;

      if (toDeduct.greaterThanOrEqualTo(currentRemaining)) {
        toDeduct = toDeduct.minus(currentRemaining);
        await supabase
          .from('client_credit_balances')
          .update({
            remaining_amount: 0,
            status: 'exhausted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id);
      } else {
        const updatedRemaining = currentRemaining.minus(toDeduct);
        toDeduct = new Decimal(0);
        await supabase
          .from('client_credit_balances')
          .update({
            remaining_amount: updatedRemaining.toNumber(),
            status: 'partially_used',
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.id);
      }
    }

    revalidatePath('/clients');
    revalidatePath(`/clients/${clientId}`);
    revalidatePath('/invoices');
    revalidatePath('/treasury');

    return {
      success: true,
      totalConsumed: fifoResult.totalAllocated,
      remainingUnusedCredit: effectiveAmount.minus(new Decimal(fifoResult.totalAllocated)).toNumber(),
      fifoResult,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تطبيق الرصيد الدائن للعميل';
    return { success: false, error: message };
  }
}
