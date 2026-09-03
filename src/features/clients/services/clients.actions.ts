'use server';

import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import type { Client } from '@/types/database';

export async function createClient(data: Partial<Client>) {
  try {
    const supabase = await createSupabaseClient();
    const { data: result, error } = await supabase
      .from('clients')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

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

    return { success: true, data: result as Client };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update client';
    return { success: false, error: message };
  }
}
