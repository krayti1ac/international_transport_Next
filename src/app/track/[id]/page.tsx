'use client';

import { useState, useEffect, useMemo, use } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import type { TripOrder, Truck, TruckLocation, Client, DeliverySignature } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Truck as TruckLucide,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Package,
  Ship,
  Navigation,
  ExternalLink,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { PublicTripShareBar } from '@/features/tracking/components/PublicTripShareBar';
import { PublicTripTimeline } from '@/features/tracking/components/PublicTripTimeline';
import { PublicTripPodCard } from '@/features/tracking/components/PublicTripPodCard';
import { ClientReeferBadge } from '@/features/tracking/components/ClientReeferBadge';
import { calculateLiveTripEta, type EtaResult } from '@/features/tracking/services/eta-calculator.actions';

const TrackingMap = dynamic(
  () => import('@/features/tracking/components/TrackingMap').then((mod) => ({ default: mod.TrackingMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2" />
        <p className="text-muted-foreground text-xs font-medium">Loading interactive map...</p>
      </div>
    ),
  }
);

export default function PublicClientTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, dir } = useLanguage();
  const resolvedParams = use(params);
  const tripId = parseInt(resolvedParams.id, 10);

  const [trip, setTrip] = useState<TripOrder | null>(null);
  const [truck, setTruck] = useState<Truck | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [deliverySignature, setDeliverySignature] = useState<DeliverySignature | null>(null);
  const [locations, setLocations] = useState<Map<number, TruckLocation[]>>(new Map());
  const [etaInfo, setEtaInfo] = useState<EtaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPod, setLoadingPod] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // 1. Initial Load of Trip & Related Public Tracking Data
  useEffect(() => {
    async function loadTrackingData() {
      if (!tripId || isNaN(tripId)) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Query trip order
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

        // Concurrently fetch truck, client, historical locations, and POD signature
        const [truckRes, clientRes, locsRes, podRes] = await Promise.all([
          tripData.truck_id
            ? supabase.from('trucks').select('*').eq('id', tripData.truck_id).single()
            : Promise.resolve({ data: null }),
          tripData.client_id
            ? supabase.from('clients').select('id, name, city, client_type').eq('id', tripData.client_id).single()
            : Promise.resolve({ data: null }),
          tripData.truck_id
            ? supabase
                .from('truck_locations')
                .select('*')
                .eq('truck_id', tripData.truck_id)
                .order('recorded_at', { ascending: false })
                .limit(25)
            : Promise.resolve({ data: [] }),
          supabase
            .from('delivery_signatures')
            .select('*')
            .eq('trip_order_id', tripId)
            .maybeSingle(),
        ]);

        if (truckRes.data) setTruck(truckRes.data as Truck);
        if (clientRes.data) setClient(clientRes.data as unknown as Client);
        if (podRes.data) setDeliverySignature(podRes.data as DeliverySignature);

        if (tripData.truck_id && locsRes.data) {
          const locMap = new Map<number, TruckLocation[]>();
          const normalized: TruckLocation[] = (locsRes.data as Array<Record<string, unknown>>).map((l) => ({
            ...(l as unknown as TruckLocation),
            speed: typeof l.speed === 'number' ? l.speed : 0,
            latitude: Number(l.latitude),
            longitude: Number(l.longitude),
            timestamp: (l.recorded_at as string) || (l.timestamp as string),
            recorded_at: (l.recorded_at as string) || (l.timestamp as string),
            frigo_temperature: typeof l.frigo_temperature === 'number' ? l.frigo_temperature : null,
          }));
          locMap.set(tripData.truck_id, normalized);
          setLocations(locMap);
        }

        // 3. Compute live ETA in background
        calculateLiveTripEta(tripId)
          .then((res) => {
            if (res) setEtaInfo(res);
          })
          .catch((err) => console.warn('Live ETA calculation error:', err));
      } catch (e) {
        console.error('Failed to load public tracking data', e);
        setNotFound(true);
      } finally {
        setLoading(false);
        setLoadingPod(false);
      }
    }

    loadTrackingData();
  }, [tripId, supabase]);

  // 2. Real-time Subscriptions for live updates
  useEffect(() => {
    if (!tripId) return;

    // A) Trip Status Updates
    const tripChannel = supabase
      .channel(`public-trip-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trip_orders',
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.new) {
            setTrip((prev) => (prev ? { ...prev, ...(payload.new as TripOrder) } : (payload.new as TripOrder)));
          }
        }
      )
      .subscribe();

    // B) Delivery Signature / POD Updates
    const podChannel = supabase
      .channel(`public-pod-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_signatures',
          filter: `trip_order_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setDeliverySignature(payload.new as DeliverySignature);
          } else if (payload.eventType === 'DELETE') {
            setDeliverySignature(null);
          }
        }
      )
      .subscribe();

    // C) Live Truck GPS Location Inserts
    let locChannel: ReturnType<typeof supabase.channel> | null = null;
    if (trip?.truck_id) {
      locChannel = supabase
        .channel(`public-loc-${trip.truck_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'truck_locations',
            filter: `truck_id=eq.${trip.truck_id}`,
          },
          (payload) => {
            const rawLoc = payload.new as Record<string, unknown>;
            const normalized: TruckLocation = {
              ...(rawLoc as unknown as TruckLocation),
              speed: typeof rawLoc.speed === 'number' ? rawLoc.speed : 0,
              latitude: Number(rawLoc.latitude),
              longitude: Number(rawLoc.longitude),
              timestamp: (rawLoc.recorded_at as string) || (rawLoc.timestamp as string),
              recorded_at: (rawLoc.recorded_at as string) || (rawLoc.timestamp as string),
              frigo_temperature: typeof rawLoc.frigo_temperature === 'number' ? rawLoc.frigo_temperature : null,
            };
            setLocations((prev) => {
              const next = new Map(prev);
              const list = next.get(trip.truck_id!) || [];
              next.set(trip.truck_id!, [normalized, ...list.slice(0, 24)]);
              return next;
            });

            // Update live ETA on new location ping
            calculateLiveTripEta(tripId)
              .then((res) => {
                if (res) setEtaInfo(res);
              })
              .catch((err) => console.warn('Realtime ETA calculation error:', err));
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(tripChannel);
      supabase.removeChannel(podChannel);
      if (locChannel) supabase.removeChannel(locChannel);
    };
  }, [tripId, trip?.truck_id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4" dir={dir}>
        <div className="w-12 h-12 rounded-2xl border-4 border-primary border-t-transparent animate-spin mb-4 shadow-sm" />
        <p className="text-foreground font-amiri text-lg font-bold">
          {t('جاري تحديد موقع الشحنة الدولية مباشرة...', 'Localisation de l\'expédition internationale en direct...', 'Localizando el envío internacional en directo...')}
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          {t('Trans Bodanon • نظام التتبع اللوجستي المباشر', 'Trans Bodanon • Système de Suivi Logistique en Temps Réel', 'Trans Bodanon • Sistema de Seguimiento Logístico en Tiempo Real')}
        </p>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4" dir={dir}>
        <Card className="max-w-md w-full text-center p-6 shadow-xl border-border">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold font-amiri mb-2">
            {t('الشحنة غير موجودة أو انتهت صلاحية الرابط', 'Expédition introuvable', 'Envío no encontrado')}
          </CardTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(
              'لم يتم العثور على رحلة مسجلة بهذا المعرّف. يرجى مراجعة الرابط والتأكد من رقم الشحنة أو التواصل مع قسم العمليات.',
              'Aucune expédition trouvée pour cette référence. Veuillez vérifier le lien ou contacter le support logistique.',
              'No se encontró ningún envío con esta referencia. Verifique el enlace o contacte con soporte logístico.'
            )}
          </p>
        </Card>
      </div>
    );
  }

  const latestLoc = truck?.id ? locations.get(truck.id)?.[0] : null;
  const cmrCode = trip.cmr_number || trip.cmr_export_number || `CMR-${trip.id}`;

  // Route breakdown
  const routeParts = (trip.route || '').split(/[-–—>→]/).map((s) => s.trim()).filter(Boolean);
  const originCity = routeParts[0] || t('المغرب', 'Maroc', 'Marruecos');
  const destCity = routeParts[1] || routeParts[routeParts.length - 1] || t('أوروبا', 'Europe', 'Europa');

  // Status configuration
  const getStatusBadge = () => {
    switch (trip.status) {
      case 'completed':
      case 'settled':
        return {
          label: t('تم التسليم بنجاح (e-POD)', 'Livré avec succès (e-POD)', 'Entregado con éxito (e-POD)'),
          class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-500',
        };
      case 'at_destination_export':
        return {
          label: t('في الوجهة - جارٍ التفريغ', 'À destination - Déchargement', 'En destino - Descarga'),
          class: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 animate-pulse',
          dot: 'bg-indigo-500',
        };
      case 'customs_export':
        return {
          label: t('إجراءات الجمارك والعبور', 'En dédouanement', 'En aduana y tránsito'),
          class: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
          dot: 'bg-purple-500',
        };
      case 'in_transit':
        return {
          label: t('الشحنة في الطريق الدولي', 'En transit international', 'En tránsito internacional'),
          class: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 animate-pulse',
          dot: 'bg-blue-500',
        };
      case 'pending':
      default:
        return {
          label: t('قيد التجهيز والانطلاق', 'En préparation', 'En preparación'),
          class: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
          dot: 'bg-amber-500',
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-[#070a12] dark:via-[#090d16] dark:to-[#0d131f] text-foreground p-3 sm:p-5 md:p-8" dir={dir}>
      <div className="max-w-4xl mx-auto space-y-5 md:space-y-6">

        {/* 1. Share & Language Switcher Bar */}
        <PublicTripShareBar
          tripId={trip.id}
          cmrNumber={cmrCode}
          route={trip.route}
        />

        {/* 2. Main Shipment Header Card */}
        <div className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
                <TruckLucide className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    {t('نقل لوجستي دولي', 'Transport International', 'Transporte Internacional')}
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {t('رقم الإرسالية:', 'Réf CMR :', 'Ref CMR :')} <span className="text-primary">{cmrCode}</span>
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black font-amiri tracking-tight text-foreground">
                  {trip.route}
                </h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{originCity}</span>
                  <span className="text-muted-foreground font-mono">⟶</span>
                  <span className="font-semibold text-foreground">{destCity}</span>
                  {client?.name && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        {client.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="self-start md:self-center">
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border shadow-xs ${statusBadge.class}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <span>{statusBadge.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cold-Chain Telematics Guard (Reefer Frigo Status) */}
        <ClientReeferBadge
          temperature={latestLoc?.frigo_temperature}
          cargoDescription={trip.goods_description_export}
        />

        {/* 3. Operational Specs Strip (Completely Free of Sensitive Financials) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Departure Date */}
          <div className="bg-card p-3.5 rounded-xl border border-border shadow-xs flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="overflow-hidden">
              <span className="text-[11px] text-muted-foreground block truncate">
                {t('تاريخ الانطلاق', 'Date départ', 'Fecha salida')}
              </span>
              <span className="text-xs font-bold text-foreground block mt-0.5 font-mono">
                {trip.departure_date || '—'}
              </span>
            </div>
          </div>

          {/* Expected Delivery */}
          <div className="bg-card p-3.5 rounded-xl border border-border shadow-xs flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="overflow-hidden">
              <span className="text-[11px] text-muted-foreground block truncate">
                {t('الوصول المتوقع (ETA)', 'Arrivée estimée (ETA)', 'Llegada estimada (ETA)')}
              </span>
              {etaInfo ? (
                <div>
                  <span className="text-xs font-bold text-foreground block mt-0.5 font-mono">
                    ~{etaInfo.estimatedHoursRemaining} {t('ساعة', 'h', 'h')} ({etaInfo.remainingDistanceKm} km)
                  </span>
                  {etaInfo.estimatedArrivalDate && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono block">
                      {new Date(etaInfo.estimatedArrivalDate).toLocaleDateString()} {new Date(etaInfo.estimatedArrivalDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs font-bold text-foreground block mt-0.5 font-mono">
                  {trip.unloading_date_export || t('جارٍ التحديث', 'En cours', 'En curso')}
                </span>
              )}
            </div>
          </div>

          {/* Ferry Crossing */}
          <div className="bg-card p-3.5 rounded-xl border border-border shadow-xs flex items-start gap-2.5">
            <Ship className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="overflow-hidden">
              <span className="text-[11px] text-muted-foreground block truncate">
                {t('المعبر البحري', 'Traversée', 'Travesía')}
              </span>
              <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                {trip.ferry_company || t('طنجة المتوسط - الجزيرة الخضراء', 'Tanger Med - Algésiras', 'Tánger Med - Algeciras')}
              </span>
            </div>
          </div>

          {/* Cargo Specs */}
          <div className="bg-card p-3.5 rounded-xl border border-border shadow-xs flex items-start gap-2.5">
            <Package className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="overflow-hidden">
              <span className="text-[11px] text-muted-foreground block truncate">
                {t('نوع الشحنة', 'Marchandise', 'Mercancía')}
              </span>
              <span className="text-xs font-bold text-foreground block mt-0.5 truncate">
                {trip.goods_description_export || t('بضائع دولية عامة', 'Marchandises diverses', 'Carga general')}
                {trip.weight_export ? ` (${trip.weight_export} T)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Interactive 4-Stage Transport Corridor Timeline */}
        <PublicTripTimeline trip={trip} />

        {/* Route Deviation Warning Alert */}
        {etaInfo?.isOffRoute && (
          <div className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-rose-900 dark:text-rose-200 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600" />
              </span>
              <div>
                <h4 className="font-bold text-sm font-amiri">
                  {t('تنبيه: تم رصد انحراف عن الرواق الدولي المعتمد', 'Alerte: Déviation d\'itinéraire détectée', 'Alerta: Desviación de ruta detectada')}
                </h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                  {t(
                    `موقع الشاحنة يبتعد بمقدار ${etaInfo.crossTrackDistanceKm || '>35'} كم عن خط السير المخطط. فريق العمليات يتابع الحالة مباشرة.`,
                    `Le véhicule dévie de ${etaInfo.crossTrackDistanceKm || '>35'} km par rapport au couloir prévu. L'équipe d'exploitation suit l'incident.`,
                    `El vehículo se desvía ${etaInfo.crossTrackDistanceKm || '>35'} km del corredor planificado. El equipo de operaciones supervisa el incidente.`
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5. Live GPS Interactive Tracking Map */}
        <Card className="border-border overflow-hidden shadow-md">
          <CardHeader className="pb-3 border-b border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-bold font-amiri flex items-center gap-2 text-foreground">
                <MapPin className="w-5 h-5 text-primary" />
                <span>{t('الموقع الجغرافي الحي للشاحنة', 'Position GPS en Temps Réel du Véhicule', 'Ubicación GPS en Tiempo Real del Vehículo')}</span>
              </CardTitle>

              {latestLoc ? (
                <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    {t('إشارة GPS نشطة', 'Signal GPS Actif', 'Señal GPS Activa')}
                  </span>
                  {typeof latestLoc.speed === 'number' && (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {Math.round(latestLoc.speed)} km/h
                    </span>
                  )}
                  {typeof latestLoc.frigo_temperature === 'number' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-mono text-xs font-semibold border border-cyan-500/20">
                      ❄️ {latestLoc.frigo_temperature > 0 ? `+${latestLoc.frigo_temperature.toFixed(1)}` : latestLoc.frigo_temperature.toFixed(1)}°C
                    </span>
                  )}
                  {etaInfo && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                      ⏱ ETA: ~{etaInfo.estimatedHoursRemaining}h ({etaInfo.remainingDistanceKm} km)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {t('بانتظار التقاط أول إشارة', 'En attente du signal GPS', 'Esperando señal GPS')}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 relative">
            <div className="h-[420px] md:h-[480px] w-full">
              <TrackingMap
                locations={locations}
                selectedTruck={truck}
                isSatellite={false}
                geofenceZones={[]}
              />
            </div>

            {/* Destination GPS Pin Button if available */}
            {trip.unloading_gps_url && (
              <div className="absolute bottom-3 start-3 z-[1000]">
                <a
                  href={trip.unloading_gps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/90 backdrop-blur-md text-foreground text-xs font-bold border border-border shadow-lg hover:bg-card hover:border-primary transition-all"
                >
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  <span>{t('موقع مستودع الوصول (Google Maps)', 'Entrepôt de déchargement', 'Almacén de descarga')}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground ms-0.5" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6. Proof of Delivery (e-POD) Card */}
        <PublicTripPodCard
          trip={trip}
          deliverySignature={deliverySignature}
          loading={loadingPod}
        />

        {/* 7. Security & Transport Carrier Assurance Footer */}
        <div className="pt-2 pb-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs border border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {t(
                'منظومة النقل الدولي ترانس بودانون • تتبع مشفر وموثوق e-CMR',
                'Système Trans Bodanon TMS • Suivi sécurisé et e-CMR certifié',
                'Sistema Trans Bodanon TMS • Seguimiento seguro y e-CMR certificado'
              )}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            {t(
              'البيانات المعروضة تُحدث تلقائياً عبر الأقمار الصناعية (IoT GPS Telematics) بدون الحاجة لتحديث الصفحة.',
              'Données télématiques GPS actualisées en continu sans rechargement.',
              'Datos telemáticos GPS actualizados continuamente sin recargar.'
            )}
          </p>
        </div>

      </div>
    </div>
  );
}

