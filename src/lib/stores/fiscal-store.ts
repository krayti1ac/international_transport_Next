import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FiscalState {
  filterMode: 'custom_range' | 'year_month';
  startDate: string;
  endDate: string;
  selectedYear: number;
  selectedMonth: number | 'all';
  setCustomRange: (start: string, end: string) => void;
  setYearMonth: (year: number, month: number | 'all') => void;
  setFilterMode: (mode: 'custom_range' | 'year_month') => void;
}

export const useFiscalStore = create<FiscalState>()(
  persist(
    (set) => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const defaultStart = `${currentYear}-01-01`;
      const defaultEnd = `${currentYear}-12-31`;

      return {
        filterMode: 'year_month',
        startDate: defaultStart,
        endDate: defaultEnd,
        selectedYear: currentYear,
        selectedMonth: 'all',

        setCustomRange: (start, end) =>
          set({ startDate: start, endDate: end, filterMode: 'custom_range' }),

        setYearMonth: (year, month) => {
          let start = `${year}-01-01`;
          let end = `${year}-12-31`;

          if (month !== 'all') {
            const m = String(month).padStart(2, '0');
            const lastDay = new Date(year, Number(month), 0).getDate();
            start = `${year}-${m}-01`;
            end = `${year}-${m}-${lastDay}`;
          }

          set({
            selectedYear: year,
            selectedMonth: month,
            startDate: start,
            endDate: end,
            filterMode: 'year_month',
          });
        },

        setFilterMode: (mode) => set({ filterMode: mode }),
      };
    },
    { name: 'transbodanon_fiscal_period' }
  )
);
