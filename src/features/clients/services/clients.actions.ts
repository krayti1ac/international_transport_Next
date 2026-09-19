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
