'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TreasuryTransaction } from '@/types/database';

export function useTreasuryTransactions(filters?: { cash_box_id?: number; type?: string }) {
  return useQuery({
    queryKey: ['treasuryTransactions', filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('treasury_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.cash_box_id) {
        query = query.eq('cash_box_id', filters.cash_box_id);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TreasuryTransaction[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
