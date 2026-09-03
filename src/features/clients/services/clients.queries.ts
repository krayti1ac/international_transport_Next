'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, BankAccount } from '@/types/database';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientDetails(id: number) {
  return useQuery({
    queryKey: ['clientDetails', id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('clients')
        .select('*, bank_accounts(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as (Client & { bank_accounts: BankAccount | null });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
