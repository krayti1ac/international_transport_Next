'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getDynamicTreasuryBalance, recordBulkClientPayment } from '../services/finance.actions';

export const CASH_BOXES = [
  { code: 'owner_cash', label: 'Owner Cash', labelAr: 'نقدية المالك', currency: 'MAD' as const },
  { code: 'bank_morocco', label: 'Bank Morocco (MAD)', labelAr: 'بنك المغرب', currency: 'MAD' as const },
  { code: 'bank_europe', label: 'Bank Europe (EUR)', labelAr: 'بنك أوروبا', currency: 'EUR' as const },
  { code: 'secretary_cash', label: 'Secretary Cash', labelAr: 'نقدية المكتب', currency: 'MAD' as const },
] as const;

export function useTreasuryBalance(cashBoxCode: string) {
  return useQuery({
    queryKey: ['treasuryBalance', cashBoxCode],
    queryFn: () => getDynamicTreasuryBalance(cashBoxCode),
    staleTime: 30_000,
  });
}

export function useAllTreasuryBalances() {
  return useQuery({
    queryKey: ['treasuryBalances', 'all'],
    queryFn: async () => {
      const entries = await Promise.all(
        CASH_BOXES.map((box) =>
          getDynamicTreasuryBalance(box.code).then((balance) => ({ code: box.code, balance }))
        )
      );
      return entries.reduce((acc, { code, balance }) => {
        acc[code] = balance;
        return acc;
      }, {} as Record<string, string>);
    },
    staleTime: 30_000,
  });
}

export function useRecordBulkClientPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordBulkClientPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasuryBalances'] });
      queryClient.invalidateQueries({ queryKey: ['treasuryBalance'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
