'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, Driver, Truck, Client } from '@/types/database';
import { useFiscalStore } from '@/lib/stores/fiscal-store';

type TripWithRelations = TripOrder & {
  driver?: Driver;
  truck?: Truck;
  client?: Client;
};

export function useTrips(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['trips', filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('trip_orders')
        .select('*')
        .order('departure_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const [tripsRes, driversRes, trucksRes, clientsRes] = await Promise.all([
        query,
        supabase.from('drivers').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('clients').select('*'),
      ]);

      if (tripsRes.error) throw tripsRes.error;

      const driverMap = new Map((driversRes.data || []).map((d: any) => [d.id, d]));
      const truckMap = new Map((trucksRes.data || []).map((t: any) => [t.id, t]));
      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));

      return (tripsRes.data || []).map((trip: any) => ({
        ...trip,
        driver: trip.driver_id ? driverMap.get(trip.driver_id) : undefined,
        truck: trip.truck_id ? truckMap.get(trip.truck_id) : undefined,
        client: trip.client_id ? clientMap.get(trip.client_id) : undefined,
      })) as TripWithRelations[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTripsByPeriod(filters?: { status?: string }) {
  const { startDate, endDate } = useFiscalStore();

  return useQuery({
    queryKey: ['trips', 'period', startDate, endDate, filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('trip_orders')
        .select('*')
        .gte('departure_date', startDate)
        .lte('departure_date', endDate)
        .order('departure_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const [tripsRes, driversRes, trucksRes, clientsRes] = await Promise.all([
        query,
        supabase.from('drivers').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('clients').select('*'),
      ]);

      if (tripsRes.error) throw tripsRes.error;

      const driverMap = new Map((driversRes.data || []).map((d: any) => [d.id, d]));
      const truckMap = new Map((trucksRes.data || []).map((t: any) => [t.id, t]));
      const clientMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c]));

      return (tripsRes.data || []).map((trip: any) => ({
        ...trip,
        driver: trip.driver_id ? driverMap.get(trip.driver_id) : undefined,
        truck: trip.truck_id ? truckMap.get(trip.truck_id) : undefined,
        client: trip.client_id ? clientMap.get(trip.client_id) : undefined,
      })) as TripWithRelations[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
