'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export type ExpirationCounts = {
  visas: number;
  trucks: number;
  trailers: number;
  total: number;
  loading: boolean;
};

const EMPTY: ExpirationCounts = { visas: 0, trucks: 0, trailers: 0, total: 0, loading: false };

/**
 * Fetches the count of expiring visas (drivers) and expiring fleet documents
 * (trucks + trailers) within a 30-day window, cached with React Query.
 */
export function useExpirationCounts(): ExpirationCounts {
  const { data, isLoading } = useQuery({
    queryKey: ['expiration-counts'],
    queryFn: async (): Promise<ExpirationCounts> => {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threshold = new Date(today);
      threshold.setDate(threshold.getDate() + 30);
      const thresholdStr = threshold.toISOString().split('T')[0];

      const [driversRes, docsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, visa_expiry_date')
          .not('visa_expiry_date', 'is', null),
        supabase
          .from('fleet_documents')
          .select('id, entity_type, expiry_date')
          .or('is_archived.is.null,is_archived.eq.false')
          .lte('expiry_date', thresholdStr),
      ]);

      const visas = (driversRes.data || []).filter((d: { visa_expiry_date?: string | null }) => {
        if (!d.visa_expiry_date) return false;
        const exp = new Date(d.visa_expiry_date);
        return exp.getTime() <= threshold.getTime();
      }).length;

      let trucks = 0;
      let trailers = 0;
      (docsRes.data || []).forEach((d: { entity_type?: string; expiry_date?: string | null }) => {
        if (!d.expiry_date) return;
        const exp = new Date(d.expiry_date);
        if (exp.getTime() > threshold.getTime()) return;
        const et = (d.entity_type || '').toLowerCase().trim();
        if (et === 'truck') trucks += 1;
        else if (et === 'trailer') trailers += 1;
      });

      return {
        visas,
        trucks,
        trailers,
        total: visas + trucks + trailers,
        loading: false,
      };
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  if (isLoading && !data) {
    return { ...EMPTY, loading: true };
  }

  return data || EMPTY;
}