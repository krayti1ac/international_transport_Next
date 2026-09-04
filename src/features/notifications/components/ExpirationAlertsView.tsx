'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, User, Truck, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { DOCUMENT_TYPE_LABELS } from '@/features/fleet/services/fleet-documents.constants';

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
  doc_type?: string;
  document_type?: string;
  document_number?: string;
};

type TruckRow = { id: number; plate_number: string };
type TrailerRow = { id: number; plate_number: string };

function diffLabel(expiryDate?: string | null): { label: string; tone: 'expired' | 'today' | 'soon' | 'safe' } {
  if (!expiryDate) return { label: 'غير معروف', tone: 'safe' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `انتهت منذ ${Math.abs(days)} يوم`, tone: 'expired' };
  if (days === 0) return { label: 'تنتهي اليوم', tone: 'today' };
  if (days <= 30) return { label: `متبقي ${days} يوم`, tone: 'soon' };
  return { label: `متبقي ${days} يوم`, tone: 'safe' };
}

const TONE_STYLES: Record<'expired' | 'today' | 'soon' | 'safe', string> = {
  expired: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
  today: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  soon: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  safe: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
};

const ENTITY_LABEL: Record<'truck' | 'trailer', string> = {
  truck: 'شاحنة',
  trailer: 'مقطورة',
};

export function ExpirationAlertsView() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [truckDocs, setTruckDocs] = useState<FleetDocRow[]>([]);
  const [trailerDocs, setTrailerDocs] = useState<FleetDocRow[]>([]);
  const [truckMap, setTruckMap] = useState<Record<number, string>>({});
  const [trailerMap, setTrailerMap] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'visas' | 'trucks' | 'trailers'>('visas');

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

        if (cancelled) return;

        if (driversRes.error) {
          console.error('Error fetching expiring drivers:', driversRes.error);
        }
        if (docsRes.error) {
          console.error('Error fetching expiring fleet documents:', docsRes.error);
        }
        if (trucksRes.error) {
          console.error('Error fetching trucks:', trucksRes.error);
        }
        if (trailersRes.error) {
          console.error('Error fetching trailers:', trailersRes.error);
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
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(
    () => drivers.length + truckDocs.length + trailerDocs.length,
    [drivers.length, truckDocs.length, trailerDocs.length]
  );

  const tabs: Array<{ key: 'visas' | 'trucks' | 'trailers'; label: string; count: number }> = [
    { key: 'visas', label: 'تأشيرات السائقين', count: drivers.length },
    { key: 'trucks', label: 'وثائق الشاحنات', count: truckDocs.length },
    { key: 'trailers', label: 'وثائق المقطورات', count: trailerDocs.length },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              تنبيهات الانتهاء ({total})
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              التأشيرات والوثائق القريبة من الانتهاء أو المنتهية خلال 30 يوماً
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-1 px-2 pt-2 border-b border-border/60 bg-muted/30">
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors',
                  isActive
                    ? 'text-foreground bg-background border-x border-t border-border/60 -mb-px'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'mr-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold border',
                    isActive
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-2 sm:p-4 min-h-[320px]">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground animate-pulse font-mono text-sm">
              جاري تحميل التنبيهات...
            </div>
          ) : total === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              لا توجد تنبيهات حالياً — جميع التأشيرات والوثائق سارية.
            </div>
          ) : activeTab === 'visas' ? (
            <VisaList drivers={drivers} />
          ) : activeTab === 'trucks' ? (
            <FleetDocList
              docs={truckDocs}
              entityType="truck"
              plateMap={truckMap}
            />
          ) : (
            <FleetDocList
              docs={trailerDocs}
              entityType="trailer"
              plateMap={trailerMap}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VisaList({ drivers }: { drivers: DriverRow[] }) {
  if (drivers.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">لا توجد تأشيرات منتهية أو قريبة الانتهاء.</div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {drivers.map((d) => {
        const { label, tone } = diffLabel(d.visa_expiry_date);
        return (
          <li key={d.id} className="flex items-center gap-3 py-3 px-2 hover:bg-muted/30 rounded-lg">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{d.name || 'بدون اسم'}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {d.visa_expiry_date ? `تاريخ الانتهاء: ${d.visa_expiry_date}` : '—'}
              </div>
            </div>
            <span className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold border', TONE_STYLES[tone])}>
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
}: {
  docs: FleetDocRow[];
  entityType: 'truck' | 'trailer';
  plateMap: Record<number, string>;
}) {
  if (docs.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        لا توجد وثائق منتهية أو قريبة الانتهاء لـ{ENTITY_LABEL[entityType]}ات.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {docs.map((doc) => {
        const { label, tone } = diffLabel(doc.expiry_date);
        const plate = plateMap[doc.entity_id] || 'مركبة غير معروفة';
        const rawType = (doc.doc_type || doc.document_type || '').trim();
        const categoryName =
          (rawType && DOCUMENT_TYPE_LABELS[rawType]?.label_ar) ||
          rawType ||
          'وثيقة';
        const Icon = entityType === 'truck' ? Truck : Share2;
        return (
          <li key={doc.id} className="flex items-center gap-3 py-3 px-2 hover:bg-muted/30 rounded-lg">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5 flex-wrap">
                <span>{plate} - {categoryName}</span>
                {doc.document_number && (
                  <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                    رقم: {doc.document_number}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {doc.expiry_date ? `تاريخ الانتهاء: ${doc.expiry_date}` : '—'}
              </div>
            </div>
            <span className={cn('px-2.5 py-1 rounded-md text-[11px] font-semibold border', TONE_STYLES[tone])}>
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}