import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CompanyBranch } from '@/types/database';

interface BranchState {
  selectedBranchId: number | 'all';
  availableBranches: CompanyBranch[];
  setSelectedBranchId: (id: number | 'all') => void;
  setAvailableBranches: (branches: CompanyBranch[]) => void;
  getSelectedBranch: () => CompanyBranch | undefined;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      selectedBranchId: 'all',
      availableBranches: [],
      setSelectedBranchId: (id) => set({ selectedBranchId: id }),
      setAvailableBranches: (branches) => set({ availableBranches: branches }),
      getSelectedBranch: () => {
        const { selectedBranchId, availableBranches } = get();
        if (selectedBranchId === 'all') return undefined;
        return availableBranches.find((b) => b.id === selectedBranchId);
      },
    }),
    {
      name: 'transbodanon_branch_context',
    }
  )
);

