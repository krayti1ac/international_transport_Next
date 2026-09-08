'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';

export interface CompanyBranding {
  companyName: string;
  logoUrl: string | null;
  ice?: string | null;
  currency?: string;
  companyId?: number | null;
}

const DEFAULTS: CompanyBranding = {
  companyName: 'ترانس بودانون',
  logoUrl: null,
  ice: null,
  currency: 'MAD',
  companyId: 1,
};

export function useCompanyBranding(): CompanyBranding {
  const { company, companyId, refreshCompany } = useAuth();
  const [liveOverride, setLiveOverride] = useState<CompanyBranding | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const loadFallback = async () => {
      if (company) return;
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('company_name, logo_url')
          .eq('id', 1)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data) {
          setLiveOverride({
            companyName: data?.company_name?.trim() || DEFAULTS.companyName,
            logoUrl: data?.logo_url || DEFAULTS.logoUrl,
            ice: DEFAULTS.ice,
            currency: DEFAULTS.currency,
            companyId: 1,
          });
        }
      } catch (err) {
        console.warn('Fallback branding fetch failed:', err);
      }
    };

    if (!company) {
      loadFallback();
    }

    // Subscribe to realtime updates on current company row
    const targetCompanyId = companyId || 1;
    const channel = supabase
      .channel(`company_branding_${targetCompanyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies', filter: `id=eq.${targetCompanyId}` },
        (payload) => {
          const next = (payload.new as Record<string, unknown>) || {};
          setLiveOverride({
            companyName: (typeof next.name === 'string' && next.name.trim()) ? next.name.trim() : DEFAULTS.companyName,
            logoUrl: typeof next.logo_url === 'string' ? next.logo_url : null,
            ice: typeof next.ice === 'string' ? next.ice : null,
            currency: typeof next.currency === 'string' ? next.currency : 'MAD',
            companyId: typeof next.id === 'number' ? next.id : targetCompanyId,
          });
          refreshCompany();
        }
      )
      .subscribe();

    // React to in-tab updates from the settings page
    const onLocalUpdate = () => {
      refreshCompany();
    };
    window.addEventListener('company-settings-updated', onLocalUpdate);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener('company-settings-updated', onLocalUpdate);
    };
  }, [company, companyId, refreshCompany]);

  if (liveOverride && liveOverride.companyId === (companyId || 1)) {
    return liveOverride;
  }

  if (company) {
    return {
      companyName: company.name?.trim() || DEFAULTS.companyName,
      logoUrl: company.logo_url || null,
      ice: company.ice || null,
      currency: company.currency || 'MAD',
      companyId: company.id,
    };
  }

  return liveOverride || DEFAULTS;
}