'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Truck } from '@/components/icons/vehicle-icons';
import { AlertTriangle, User, Share2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';
import { useLanguage } from '@/components/language-provider';
import { checkDocumentExpiry, calculateRemainingDays } from '@/lib/utils/document-radar';
import { QuickRenewDialog } from '@/features/fleet/components/QuickRenewDialog';
import type { FleetDocument } from '@/types/database';

type DriverRow = {
  id: number;
  name: string;
  visa_expiry_date: string | null;
};

type FleetDocRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  expiry_date: string | null;
  previous_expiry_date?: string | null;
  doc_type?: string;
  document_type?: string;
  document_number?: string;
  cost?: number;
  currency?: string;
  file_url?: string;
  notes?: string;
  is_archived?: boolean;
};

type TruckRow = { id: number; plate_number: string };
type TrailerRow = { id: number; plate_number: string };
type ExpiryFilterType = 'all' | 'expired' | '15days' | '30days';

export function ExpirationAlertsView() {
  const { t, dir, locale } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [truckDocs, setTruckDocs] = useState<FleetDocRow[]>([]);
  const [trailerDocs, setTrailerDocs] = useState<FleetDocRow[]>([]);
  const [truckMap, setTruckMap] = useState<Record<number, string>>({});
  const [trailerMap, setTrailerMap] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'visas' | 'trucks' | 'trailers'>('visas');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilterType>('all');
  const [renewingDoc, setRenewingDoc] = useState<{ doc: FleetDocument; vehiclePlate: string } | null>(null);

  const diffLabel = (expiryDate?: string | null) => {
    const radar = checkDocumentExpiry(expiryDate);
    const label = locale === 'es' ? radar.labelEs : locale === 'fr' ? radar.labelFr : radar.labelAr;
    return { label, badgeClass: radar.badgeClass };
  };

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const threshold = new Date(today);
      threshold.setDate(threshold.getDate() + 30);
      const thresholdStr = threshold.toISOString().split('T')[0];

      const [driversRes, docsRes, trucksRes, trailersRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, name, visa_expiry_date')
          .not('visa_expiry_date', 'is', null)
          .lte('visa_expiry_date', thresholdStr)
          .order('visa_expiry_date', { ascending: true }),
        supabase
          .from('fleet_documents')
          .select('*')
          .or('is_archived.is.null,is_archived.eq.false')
          .lte('expiry_date', thresholdStr)
          .order('expiry_date', { ascending: true }),
        supabase.from('trucks').select('id, plate_number'),
        supabase.from('trailers').select('id, plate_number'),
      ]);

      if (driversRes.error) {
        console.error('Error fetching expiring drivers:', driversRes.error);
      }
      if (docsRes.error) {
        console.error('Error fetching expiring fleet documents:', docsRes.error);
      }

      const expiringDrivers = (driversRes.data || []).filter((d) => {
        if (!d.visa_expiry_date) return false;
        const exp = new Date(d.visa_expiry_date);
        return exp.getTime() <= threshold.getTime();
      });

      const rawDocs = (docsRes.data || []) as FleetDocRow[];
      const expiringDocs = rawDocs.filter((d) => {
        if (!d.expiry_date) return false;
        const exp = new Date(d.expiry_date);
        return exp.getTime() <= threshold.getTime();
      });

      const tMap: Record<number, string> = {};
      (trucksRes.data || []).forEach((t: TruckRow) => {
        tMap[t.id] = t.plate_number;
      });
      const trMap: Record<number, string> = {};
      (trailersRes.data || []).forEach((t: TrailerRow) => {
        trMap[t.id] = t.plate_number;
      });

      setDrivers(expiringDrivers);
      setTruckDocs(
        expiringDocs.filter(
          (d) => (d.entity_type || '').toLowerCase().trim() === 'truck'
        )
      );
      setTrailerDocs(
        expiringDocs.filter(
          (d) => (d.entity_type || '').toLowerCase().trim() === 'trailer'
        )
      );
      setTruckMap(tMap);
      setTrailerMap(trMap);
    } catch (err) {
      console.error('Unexpected error loading expiration alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Apply Quick Filter (All, Expired, <=15 days, <=30 days)
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (!d.visa_expiry_date) return false;
      const days = calculateRemainingDays(d.visa_expiry_date);
      if (expiryFilter === 'expired') return days < 0;
      if (expiryFilter === '15days') return days >= 0 && days <= 15;
      if (expiryFilter === '30days') return days >= 0 && days <= 30;
      return true;
    });
  }, [drivers, expiryFilter]);

  const filteredTruckDocs = useMemo(() => {
    return truckDocs.filter((d) => {
      if (!d.expiry_date) return false;
      const days = calculateRemainingDays(d.expiry_date);
      if (expiryFilter === 'expired') return days < 0;
      if (expiryFilter === '15days') return days >= 0 && days <= 15;
      if (expiryFilter === '30days') return days >= 0 && days <= 30;
      return true;
    });
  }, [truckDocs, expiryFilter]);

  const filteredTrailerDocs = useMemo(() => {
    return trailerDocs.filter((d) => {
      if (!d.expiry_date) return false;
      const days = calculateRemainingDays(d.expiry_date);
      if (expiryFilter === 'expired') return days < 0;
      if (expiryFilter === '15days') return days >= 0 && days <= 15;
      if (expiryFilter === '30days') return days >= 0 && days <= 30;
      return true;
    });
  }, [trailerDocs, expiryFilter]);

  // Counts for the active tab's filter buttons
  const counts = useMemo(() => {
    const list =
      activeTab === 'visas'
        ? drivers.map((d) => d.visa_expiry_date)
        : activeTab === 'trucks'
        ? truckDocs.map((d) => d.expiry_date)
        : trailerDocs.map((d) => d.expiry_date);

    let expired = 0;
    let within15 = 0;
    let within30 = 0;

    list.forEach((exp) => {
      if (!exp) return;
      const days = calculateRemainingDays(exp);
      if (days < 0) expired++;
      if (days >= 0 && days <= 15) within15++;
      if (days >= 0 && days <= 30) within30++;
    });

    return { all: list.length, expired, within15, within30 };
  }, [activeTab, drivers, truckDocs, trailerDocs]);

  const total = useMemo(
    () => drivers.length + truckDocs.length + trailerDocs.length,
    [drivers.length, truckDocs.length, trailerDocs.length]
  );

  const tabs: Array<{ key: 'visas' | 'trucks' | 'trailers'; label: string; count: number }> = [
    { key: 'visas', label: t('تأشيرات السائقين', 'Visas des chauffeurs'), count: drivers.length },
    { key: 'trucks', label: t('وثائق الشاحنات', 'Documents camions'), count: truckDocs.length },
    { key: 'trailers', label: t('وثائق المقطورات', 'Documents remorques'), count: trailerDocs.length },
  ];

  const handleOpenRenew = (docRow: FleetDocRow, vehiclePlate: string) => {
    const fleetDoc: FleetDocument = {
      id: docRow.id,
      entity_type: docRow.entity_type,
      entity_id: docRow.entity_id,
      document_type: docRow.document_type || docRow.doc_type || 'other',
      document_number: docRow.document_number,
      expiry_date: docRow.expiry_date || undefined,
      previous_expiry_date: docRow.previous_expiry_date || undefined,
      cost: docRow.cost,
      currency: docRow.currency || 'MAD',
      file_url: docRow.file_url,
      notes: docRow.notes,
      is_archived: docRow.is_archived || false,
    };
    setRenewingDoc({ doc: fleetDoc, vehiclePlate });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir={dir}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className={`w-5 h-5 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              {t('تنبيهات الانتهاء', "Alertes d'expiration")} ({total})
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('التأشيرات والوثائق القريبة من الانتهاء أو المنتهية مع إمكانية التجديد السريع والربط المالي بالخزينة.', 'Visas et documents arrivant à expiration avec renouvellement rapide lié à la trésorerie.')}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAlerts()}
          className="rounded-xl h-9 px-3 text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث', 'Actualiser')}</span>
        </Button>
      </div>

      {/* Main Container */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
        {/* Entity Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 pt-2.5 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'relative px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 shrink-0',
                    isActive
                      ? 'text-foreground bg-background border-x border-t border-border/60 -mb-px'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold border',
                      isActive
                        ? 'bg-primary/15 border-primary/30 text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Filters (All, Expired, <=15d, <=30d) */}
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/60 text-xs mb-2 sm:mb-1 self-start sm:self-auto">
            <button
              onClick={() => setExpiryFilter('all')}
              className={cn(
                'px-2.5 py-1 font-semibold rounded-lg transition-all',
                expiryFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('الكل', 'Tous')} ({counts.all})
            </button>
            <button
              onClick={() => setExpiryFilter('expired')}
              className={cn(
                'px-2.5 py-1 font-semibold rounded-lg transition-all flex items-center gap-1',
                expiryFilter === 'expired'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {t('منتهية', 'Expirés')} ({counts.expired})
            </button>
            <button
              onClick={() => setExpiryFilter('15days')}
              className={cn(
                'px-2.5 py-1 font-semibold rounded-lg transition-all flex items-center gap-1',
                expiryFilter === '15days'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {t('خلال 15 يوماً', 'Dans 15j')} ({counts.within15})
            </button>
            <button
              onClick={() => setExpiryFilter('30days')}
              className={cn(
                'px-2.5 py-1 font-semibold rounded-lg transition-all flex items-center gap-1',
                expiryFilter === '30days'
                  ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              {t('خلال 30 يوماً', 'Dans 30j')} ({counts.within30})
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="p-2 sm:p-4 min-h-[320px]">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground animate-pulse font-mono text-sm">
              {t('جاري تحميل التنبيهات...', 'Chargement des alertes...')}
            </div>
          ) : total === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              {t('لا توجد تنبيهات حالياً — جميع التأشيرات والوثائق سارية.', 'Aucune alerte — tous les visas et documents sont valides.')}
            </div>
          ) : activeTab === 'visas' ? (
            <VisaList drivers={filteredDrivers} diffLabel={diffLabel} t={t} />
          ) : activeTab === 'trucks' ? (
            <FleetDocList
              docs={filteredTruckDocs}
              entityType="truck"
              plateMap={truckMap}
              diffLabel={diffLabel}
              onRenew={handleOpenRenew}
              t={t}
              locale={locale}
            />
          ) : (
            <FleetDocList
              docs={filteredTrailerDocs}
              entityType="trailer"
              plateMap={trailerMap}
              diffLabel={diffLabel}
              onRenew={handleOpenRenew}
              t={t}
              locale={locale}
            />
          )}
        </div>
      </div>

      {/* Quick Renewal Modal */}
      {renewingDoc && (
        <QuickRenewDialog
          document={renewingDoc.doc}
          vehicleName={renewingDoc.vehiclePlate}
          isOpen={!!renewingDoc}
          onClose={() => setRenewingDoc(null)}
          onSuccess={fetchAlerts}
        />
      )}
    </div>
  );
}

function VisaList({
  drivers,
  diffLabel,
  t,
}: {
  drivers: DriverRow[];
  diffLabel: (d?: string | null) => { label: string; badgeClass: string };
  t: (ar: string, fr: string) => string;
}) {
  if (drivers.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {t('لا توجد تأشيرات مطابقة لشروط الفلترة.', 'Aucun visa correspondant aux filtres.')}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {drivers.map((d) => {
        const { label, badgeClass } = diffLabel(d.visa_expiry_date);
        return (
          <li key={d.id} className="flex items-center gap-3 py-3 px-2 hover:bg-muted/30 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{d.name || t('بدون اسم', 'Sans nom')}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {d.visa_expiry_date ? `${t('تاريخ الانتهاء: ', 'Date d’expiration : ')}${d.visa_expiry_date}` : '—'}
              </div>
            </div>
            <span className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold border', badgeClass)}>
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function FleetDocList({
  docs,
  entityType,
  plateMap,
  diffLabel,
  onRenew,
  t,
  locale,
}: {
  docs: FleetDocRow[];
  entityType: 'truck' | 'trailer';
  plateMap: Record<number, string>;
  diffLabel: (d?: string | null) => { label: string; badgeClass: string };
  onRenew: (doc: FleetDocRow, plate: string) => void;
  t: (ar: string, fr: string) => string;
  locale: string;
}) {
  const entityLabel = entityType === 'truck' ? t('الشاحنات', 'camions') : t('المقطورات', 'remorques');

  if (docs.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {t(`لا توجد وثائق مطابقة لـ${entityLabel}.`, `Aucun document correspondant pour les ${entityLabel}.`)}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {docs.map((doc) => {
        const { label, badgeClass } = diffLabel(doc.expiry_date);
        const plate = plateMap[doc.entity_id] || t('مركبة غير معروفة', 'Véhicule inconnu');
        const rawType = (doc.doc_type || doc.document_type || '').trim();
        const categoryName =
          (rawType && (locale === 'fr' ? DOCUMENT_TYPE_LABELS[rawType]?.label_fr : DOCUMENT_TYPE_LABELS[rawType]?.label_ar)) ||
          rawType ||
          t('وثيقة', 'Document');
        const Icon = entityType === 'truck' ? Truck : Share2;
        return (
          <li key={doc.id} className="flex items-center justify-between gap-3 py-3 px-2 hover:bg-muted/30 rounded-lg transition-colors">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5 flex-wrap">
                  <span>{plate} - {categoryName}</span>
                  {doc.document_number && (
                    <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                      {t('رقم: ', 'N° : ')}{doc.document_number}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {doc.expiry_date ? `${t('تاريخ الانتهاء: ', 'Date d’expiration : ')}${doc.expiry_date}` : '—'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold border', badgeClass)}>
                {label}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRenew(doc, plate)}
                className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('تجديد سريع', 'Renouveler')}</span>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}