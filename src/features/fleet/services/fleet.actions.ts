'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import type { FleetDocumentRenewal, TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function renewFleetDocument(input: {
  documentId: number;
  newExpiryDate?: string;
  cost: number;
  currency: string;
  cashBoxId: number;
}): Promise<{ success: boolean; error?: string; renewal?: FleetDocumentRenewal }> {
  try {
    const supabase = await createClient();
    const { documentId, newExpiryDate, cost, currency, cashBoxId } = input;

    const { data: document, error: fetchError } = await supabase
      .from('fleet_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return { success: false, error: 'Document not found' };
    }

    const previousExpiryDate = document.expiry_date;
    const resolvedNewExpiryDate = newExpiryDate || (() => {
      const d = new Date(previousExpiryDate || Date.now());
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    })();

    await supabase
      .from('fleet_documents')
      .update({ expiry_date: resolvedNewExpiryDate })
      .eq('id', documentId);

    const { data: renewal, error: renewalError } = await supabase
      .from('fleet_document_renewals')
      .insert({
        fleet_document_id: documentId,
        previous_expiry_date: previousExpiryDate,
        new_expiry_date: resolvedNewExpiryDate,
        renewal_cost: cost,
        currency,
        document_type: document.document_type,
      })
      .select()
      .single();

    if (renewalError) {
      return { success: false, error: renewalError.message };
    }

    const costDecimal = new Decimal(cost);
    if (costDecimal.greaterThan(0)) {
      let vehiclePlate = 'Unknown';

      if (document.entity_type === 'truck') {
        const { data: truck } = await supabase
          .from('trucks')
          .select('plate_number')
          .eq('id', document.entity_id)
          .single();
        vehiclePlate = truck?.plate_number || `Truck #${document.entity_id}`;
      } else if (document.entity_type === 'trailer') {
        const { data: trailer } = await supabase
          .from('trailers')
          .select('plate_number')
          .eq('id', document.entity_id)
          .single();
        vehiclePlate = trailer?.plate_number || `Trailer #${document.entity_id}`;
      } else if (document.entity_type === 'driver') {
        const { data: driver } = await supabase
          .from('drivers')
          .select('name')
          .eq('id', document.entity_id)
          .single();
        vehiclePlate = driver?.name || `Driver #${document.entity_id}`;
      }

      await supabase
        .from('cash_boxes')
        .select('currency')
        .eq('id', cashBoxId)
        .single();

      const treasuryPayload: Partial<TreasuryTransaction> = {
        type: 'office_expense',
        amount: parseFloat(costDecimal.toFixed(2)),
        currency,
        cash_box_id: cashBoxId,
        description: `Renewal: ${document.document_type} - ${vehiclePlate}`,
        reference: `RENEWAL-${documentId}-${Date.now()}`,
        reconciliation_status: 'pending',
      };

      const { error: treasuryError } = await supabase
        .from('treasury_transactions')
        .insert(treasuryPayload);

      if (treasuryError) {
        console.error('Treasury transaction failed:', treasuryError);
      }
    }

    revalidatePath('/documents');
    revalidatePath('/fleet');

    return { success: true, renewal };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
    return { success: false, error: message };
  }
}
