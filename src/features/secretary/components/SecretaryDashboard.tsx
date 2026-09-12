'use client';

import React from 'react';
import { useLanguage } from '@/components/language-provider';
import { useQueryClient } from '@tanstack/react-query';
import { QuickDataEntryBar } from './QuickDataEntryBar';
import { SecretaryCashCard } from './SecretaryCashCard';
import { CriticalDatesTracker } from './CriticalDatesTracker';
import { TripStagesPipeline } from './TripStagesPipeline';
import { SecretaryEmailInbox } from './SecretaryEmailInbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

export default function SecretaryDashboard() {
  const { t, dir, locale } = useLanguage();
  const queryClient = useQueryClient();

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['secretary-cash-data'] });
    queryClient.invalidateQueries({ queryKey: ['secretary-critical-dates'] });
    queryClient.invalidateQueries({ queryKey: ['secretary-trip-stages'] });
    queryClient.invalidateQueries({ queryKey: ['trips'] });
    queryClient.invalidateQueries({ queryKey: ['treasuryBalances'] });
    queryClient.invalidateQueries({ queryKey: ['email_messages'] });
  };

  const currentDateFormatted = new Date().toLocaleDateString(
    locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentDateFormatted}</span>
            <span className="text-border">|</span>
            <span className="text-primary font-bold">Trans Bodanon TMS</span>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary ms-1">
              {t('بوابة السكرتارية والعمليات', 'Portail Secrétariat & Opérations')}
            </Badge>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground flex items-center gap-2">
            <span>{t('لوحة مهام السكرتارية والعمليات اليومية', 'Tableau de Bord Secrétariat & Opérations')}</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t(
              'مركز إدخال البيانات اللوجستية، متابعة مراحل الرحلات، تتبع تواريخ الوثائق، وصندوق النقدية المالي.',
              'Centre de saisie opérationnelle, suivi des étapes des trajets, échéances des documents et caisse de bureau.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="rounded-xl h-9 text-xs border-border bg-card hover:bg-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
            {t('تحديث البيانات', 'Actualiser')}
          </Button>
        </div>
      </div>

      {/* 1. Quick Data Entry Hub */}
      <QuickDataEntryBar onRefresh={handleRefreshAll} />

      {/* 2. Primary Operational Grid (Secretary Cash + Dates Tracker) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Secretary Cash Box */}
        <SecretaryCashCard />

        {/* Critical Dates & Document Expiry Radar */}
        <CriticalDatesTracker />
      </div>

      {/* 3. Operational Trip Stages & Tracking Pipeline */}
      <TripStagesPipeline />

      {/* 4. Independent Smart Email Inbox */}
      <SecretaryEmailInbox />
    </div>
  );
}
