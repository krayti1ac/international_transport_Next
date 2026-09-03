'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, Driver, Truck, Client } from '@/types/database';

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
        .select('*, drivers(name), trucks(plate_number), clients(name)')
        .order('departure_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TripWithRelations[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
