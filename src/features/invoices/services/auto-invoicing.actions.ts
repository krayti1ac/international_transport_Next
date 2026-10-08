'use server';

import { createClient } from '@/lib/supabase/server';
import {
  autoGenerateInvoiceForTrip,
  calculateTripInvoiceBreakdown,
  type AutoInvoiceOptions,
  type AutoInvoiceResult,
} from './auto-invoicing.service';
import type { TripOrder, Client } from '@/types/database';

export async function triggerManualTripInvoiceGenerationAction(
  tripId: number,
  options?: AutoInvoiceOptions
): Promise<AutoInvoiceResult> {
  return autoGenerateInvoiceForTrip(tripId, {
    ...options,
    triggerEvent: options?.triggerEvent || 'manual',
  });
}

export async function previewTripInvoiceBreakdownAction(tripId: number) {
  try {
    const supabase = await createClient();

    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: 'الرحلة غير موجودة' };
    }

    const clientId = trip.client_id || trip.client_import_id;
    const [clientRes, customsRes] = await Promise.all([
      clientId
        ? supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('customs_submissions')
        .select('mrn, seal_numbers, portal_type, status')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const breakdown = calculateTripInvoiceBreakdown(
      trip as TripOrder,
      (clientRes.data as Client) || null,
      customsRes.data || null
    );

    return {
      success: true,
      data: breakdown,
      trip: trip as TripOrder,
      client: clientRes.data as Client | null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل معاينة بيانات الفاتورة';
    return { success: false, error: message };
  }
}
