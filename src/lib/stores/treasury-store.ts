import {create} from 'zustand';

export type Currency = 'MAD' | 'EUR';

interface TreasuryState {
  balances: Record<Currency, number>;
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  refreshBalances: () => Promise<void>;
}

export const useTreasuryStore = create<TreasuryState>((set) => ({
  balances: {
    MAD: 0,
    EUR: 0,
  },
  selectedCurrency: 'MAD',
  setSelectedCurrency: (currency) => set({ selectedCurrency: currency }),
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
}));
