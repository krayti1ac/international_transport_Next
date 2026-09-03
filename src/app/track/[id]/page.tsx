'use client';

import { useState, useEffect, useMemo, use } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, Truck, TruckLocation, Client } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Truck as TruckIcon, Navigation, Calendar, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

const TrackingMap = dynamic(
  () => import('@/app/(app)/truck-tracking/tracking-map').then((mod) => ({ default: mod.TrackingMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl">
        <p className="text-muted-foreground text-sm font-medium">جاري تحميل خريطة المسار...</p>
      </div>
    ),
  }
);

export default function PublicClientTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tripId = parseInt(resolvedParams.id, 10);

  const [trip, setTrip] = useState<TripOrder | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [locations, setLocations] = useState<Map<number, TruckLocation[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadTrackingData() {
      try {
        setLoading(true);
        const { data: tripData, error: tripErr } = await supabase
          .from('trip_orders')
          .select('*')
          .eq('id', tripId)
          .single();

        if (tripErr || !tripData) {
          setNotFound(true);
          return;
        }

        setTrip(tripData);

        const [truckRes, clientRes, locsRes] = await Promise.all([
          tripData.truck_id
            ? supabase.from('trucks').select('*').eq('id', tripData.truck_id).single()
            : Promise.resolve({ data: null }),
          tripData.client_id
            ? supabase.from('clients').select('*').eq('id', tripData.client_id).single()
            : Promise.resolve({ data: null }),
          tripData.truck_id
            ? supabase.from('truck_locations').select('*').eq('truck_id', tripData.truck_id).order('timestamp', { ascending: false }).limit(20)
            : Promise.resolve({ data: [] }),
        ]);

        if (truckRes.data) setTruck(truckRes.data);
        if (clientRes.data) setClient(clientRes.data);

        if (tripData.truck_id && locsRes.data) {
          const locMap = new Map<number, TruckLocation[]>();
          locMap.set(tripData.truck_id, locsRes.data);
          setLocations(locMap);
        }
      } catch (err) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    if (tripId) {
      loadTrackingData();
    }
  }, [tripId, supabase]);

  useEffect(() => {
    if (!trip?.truck_id) return;

    const channel = supabase
      .channel(`public-truck-${trip.truck_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'truck_locations',
          filter: `truck_id=eq.${trip.truck_id}`,
        },
        (payload) => {
          const newLoc = payload.new as TruckLocation;
          setLocations((prev) => {
            const updated = new Map(prev);
            const current = updated.get(trip.truck_id!) || [];
            updated.set(trip.truck_id!, [newLoc, ...current]);
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trip?.truck_id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-foreground font-amiri text-lg">جاري تحديد موقع الشحنة مباشرة...</p>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center p-6 shadow-xl border-border">
          <MapPin className="w-12 h-12 mx-auto text-rose-500 mb-3" />
          <CardTitle className="text-xl font-bold font-amiri mb-2">الشحنة غير موجودة</CardTitle>
          <CardDescription>لم يتم العثور على رحلة مسجلة بهذا المعرّف، يرجى مراجعة الرابط والتأكد من رقمه.</CardDescription>
        </Card>
      </div>
    );
  }

  const latestLoc = truck?.id ? locations.get(truck.id)?.[0] : null;

  const statusLabel = trip.status === 'completed'
    ? 'تم التسليم بنجاح'
    : trip.status === 'in_transit'
      ? 'الشحنة في الطريق'
      : 'قيد التجهيز';

  const statusClass = trip.status === 'completed'
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
    : trip.status === 'in_transit'
      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 animate-pulse'
      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#070a12] dark:to-[#090d16] p-4 md:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
              <TruckIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black font-amiri text-foreground">{trip.route}</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                وثيقة الشحن: <span className="font-mono font-bold text-foreground">{trip.cmr_number || `CMR-${trip.id}`}</span>
              </p>
            </div>
          </div>
          <div className="text-left">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
              <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">تاريخ الانطلاق</p>
                  <p className="font-bold text-sm text-foreground mt-0.5">{trip.departure_date}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <Navigation className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">المعبر / العبّارة</p>
                  <p className="font-bold text-sm text-foreground mt-0.5">{trip.ferry_company || 'طنجة المتوسط - الجزيرة الخضراء'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <Clock className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">آخر تحديث للموقع</p>
                  <p className="font-bold text-sm text-foreground mt-0.5">
                    {latestLoc
                      ? new Date(latestLoc.timestamp).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })
                      : 'الآن'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border overflow-hidden shadow-lg">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-amiri flex items-center gap-2 text-foreground">
              <MapPin className="w-5 h-5 text-primary" />
              الموقع الجغرافي الحي للشاحنة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[450px]">
            <TrackingMap
              locations={locations}
              selectedTruck={truck}
              isSatellite={false}
              geofenceZones={[]}
            />
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>نظام النقل الدولي اللوجستي • التتبع المباشر مشفر ومؤمن</span>
        </div>

      </div>
    </div>
  );
}
