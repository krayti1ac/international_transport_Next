'use server';

import { createClient } from '@/lib/supabase/server';
import type { TripOrder } from '@/types/database';

export async function createTripOrder(data: Partial<TripOrder>) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase
      .from('trip_orders')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: result as TripOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create trip order';
    return { success: false, error: message };
  }
}

export async function updateTripStatus(tripId: number, status: string) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase
      .from('trip_orders')
      .update({ status })
      .eq('id', tripId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: result as TripOrder };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update trip status';
    return { success: false, error: message };
  }
}
