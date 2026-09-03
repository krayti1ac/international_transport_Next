import {create} from 'zustand';
import type { TripOrder, Advance } from '@/types/database';

interface DriverState {
  assignedTrips: TripOrder[];
  currentTrip: TripOrder | null;
  advances: Advance[];
  isOnline: boolean;
  pendingSync: boolean;
  setAssignedTrips: (trips: TripOrder[]) => void;
  setCurrentTrip: (trip: TripOrder | null) => void;
  setAdvances: (advances: Advance[]) => void;
  setIsOnline: (online: boolean) => void;
  setPendingSync: (pending: boolean) => void;
  addAdvance: (advance: Advance) => void;
  updateAdvance: (id: number, data: Partial<Advance>) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  assignedTrips: [],
  currentTrip: null,
  advances: [],
  isOnline: navigator.onLine,
  pendingSync: false,
  setAssignedTrips: (trips) => set({ assignedTrips: trips }),
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  setAdvances: (advances) => set({ advances }),
  setIsOnline: (online) => set({ isOnline: online }),
  setPendingSync: (pending) => set({ pendingSync: pending }),
  addAdvance: (advance) => set((state) => ({ advances: [...state.advances, advance] })),
  updateAdvance: (id, data) => set((state) => ({
    advances: state.advances.map((adv) => (adv.id === id ? { ...adv, ...data } : adv)),
  })),
}));
