'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface CompanyBranding {
  companyName: string;
  logoUrl: string | null;
}

const DEFAULTS: CompanyBranding = {
  companyName: 'ترانس بودانون',
  logoUrl: null,
};

export function useCompanyBranding(): CompanyBranding {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULTS);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('company_name, logo_url')
          .eq('id', 1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn('Could not load company branding:', error.message);
          return;
        }
        setBranding({
          companyName: data?.company_name?.trim() || DEFAULTS.companyName,
          logoUrl: data?.logo_url || null,
        });
      } catch (err) {
        console.warn('Company branding fetch failed:', err);
      }
    };

    load();

    // React to live changes on the system_settings row
    const channel = supabase
      .channel('system_settings_branding')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings', filter: 'id=eq.1' },
        (payload) => {
          const next = (payload.new as any) || {};
          setBranding({
            companyName: next.company_name?.trim() || DEFAULTS.companyName,
            logoUrl: next.logo_url || null,
          });
        }
      )
      .subscribe();

    // React to in-tab updates from the settings page
    const onLocalUpdate = () => {
      load();
    };
    window.addEventListener('company-settings-updated', onLocalUpdate);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener('company-settings-updated', onLocalUpdate);
    };
  }, []);

  return branding;
}