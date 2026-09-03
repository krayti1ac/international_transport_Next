'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { mapKanbanStageToDbStatus } from '@/lib/utils/trip-status';

export async function moveTripStage(tripId: number, newStage: string) {
  const supabase = await createClient();

  const dbStatus = mapKanbanStageToDbStatus(newStage);
  if (!dbStatus) {
    return { success: false, error: `Invalid stage: ${newStage}` };
  }

  const { error } = await supabase
    .from('trip_orders')
    .update({ status: dbStatus })
    .eq('id', tripId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/trips');
  revalidatePath('/dashboard');

  return { success: true, stage: newStage };
}
