import { create } from 'zustand';
import type { User, Company } from '@/types/database';

interface AuthState {
  user: User | null;
  company: Company | null;
  companyId: number | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  companyId: null,
  isLoading: true,
  setUser: (user) => set({
    user,
    company: user?.company || null,
    companyId: user?.company_id ?? null,
  }),
  setCompany: (company) => set({
    company,
    companyId: company?.id ?? null,
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, company: null, companyId: null }),
}));

