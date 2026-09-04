'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ExpirationCounts = {
  visas: number;
  trucks: number;
  trailers: number;
  total: number;
  loading: boolean;
};

const EMPTY: ExpirationCounts = { visas: 0, trucks: 0, trailers: 0, total: 0, loading: true };

/**
 * Fetches the count of expiring visas (drivers) and expiring fleet documents
 * (trucks + trailers) within a 30-day window, mirroring the Flutter
 * `_loadExpiringVisasCount` + `_loadExpiringFleetDocsCount` logic so the
 * notifications bell badge matches the alerts page totals.
 */
export function useExpirationCounts(): ExpirationCounts {
  const [state, setState] = useState<ExpirationCounts>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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

        if (cancelled) return;

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

        setState({
          visas,
          trucks,
          trailers,
          total: visas + trucks + trailers,
          loading: false,
        });
      } catch {
        if (!cancelled) setState({ visas: 0, trucks: 0, trailers: 0, total: 0, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}