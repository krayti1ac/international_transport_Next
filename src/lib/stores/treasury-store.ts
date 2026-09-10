import {create} from 'zustand';
import { useFiscalStore } from './fiscal-store';
import { getPeriodTreasuryBalance } from '@/features/treasury/services/treasury.actions';

export type Currency = 'MAD' | 'EUR';

interface TreasuryState {
  balances: Record<Currency, number>;
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  refreshBalances: () => Promise<void>;
  refreshPeriodBalances: (cashBoxId: number) => Promise<void>;
  periodBalances: Record<Currency, { opening: number; periodNet: number; closing: number }>;
}

export const useTreasuryStore = create<TreasuryState>((set) => ({
  balances: {
    MAD: 0,
    EUR: 0,
  },
  selectedCurrency: 'MAD',
  setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
  periodBalances: {} as Record<string, { opening: number; periodNet: number; closing: number }>,
  refreshBalances: async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    try {
      const [madRes, eurRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/rpc/calculate_treasury_balance?p_currency=MAD`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }),
        fetch(`${baseUrl}/rest/v1/rpc/calculate_treasury_balance?p_currency=EUR`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }),
      ]);

      if (madRes.ok && eurRes.ok) {
        const [madData, eurData] = await Promise.all([madRes.json(), eurRes.json()]);
        set({
          balances: {
            MAD: Number(madData) || 0,
            EUR: Number(eurData) || 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to refresh treasury balances:', error);
    }
  },
  refreshPeriodBalances: async (cashBoxId: number) => {
    const { startDate, endDate } = useFiscalStore.getState();

    try {
      const result = await getPeriodTreasuryBalance(cashBoxId, startDate, endDate);
      if (result.success && result.data) {
        const periodBalances: Record<string, { opening: number; periodNet: number; closing: number }> = {};
        for (const [currency, values] of Object.entries(result.data)) {
          periodBalances[currency] = {
            opening: Number(values.opening_balance) || 0,
            periodNet: Number(values.period_net) || 0,
            closing: Number(values.closing_balance) || 0,
          };
        }
        set({ periodBalances });
      }
    } catch (error) {
      console.error('Failed to refresh period treasury balances:', error);
    }
  },
}));
