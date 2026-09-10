'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TreasuryTransaction } from '@/types/database';
import { useFiscalStore } from '@/lib/stores/fiscal-store';

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

export function useTreasuryTransactionsByPeriod(filters?: { cash_box_id?: number; type?: string }) {
  const { startDate, endDate } = useFiscalStore();

  return useQuery({
    queryKey: ['treasuryTransactions', 'period', startDate, endDate, filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('treasury_transactions')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
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

export function useTreasuryOpeningBalance(cashBoxId?: number) {
  const { startDate } = useFiscalStore();

  return useQuery({
    queryKey: ['treasuryOpeningBalance', startDate, cashBoxId],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('treasury_transactions')
        .select('amount, type, currency')
        .lt('created_at', startDate);

      if (cashBoxId) {
        query = query.eq('cash_box_id', cashBoxId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const balances: Record<string, { deposits: number; withdrawals: number }> = {};

      for (const tx of data || []) {
        const currency = tx.currency || 'MAD';
        if (!balances[currency]) {
          balances[currency] = { deposits: 0, withdrawals: 0 };
        }
        const amount = Number(tx.amount || 0);
        if (tx.type === 'capital_injection' || tx.type === 'trip_revenue' || tx.type === 'payment' || tx.type === 'deposit') {
          balances[currency].deposits += amount;
        } else if (tx.type === 'expense' || tx.type === 'salary' || tx.type === 'withdrawal') {
          balances[currency].withdrawals += amount;
        }
      }

      return balances;
    },
    staleTime: 5 * 60 * 1000,
  });
}
