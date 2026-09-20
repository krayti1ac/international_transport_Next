'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { Truck, TruckLocation, GeofenceZone, GeofenceAlert } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Navigation,
  Satellite,
  RefreshCw,
  Truck as TruckIcon,
  Anchor,
  Snowflake,
  Search,
  Layers,
  Radio,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import {
  STRATEGIC_PORT_ZONES,
  type StrategicPortZone,
} from '@/features/tracking/services/port-geofence.constants';
import { calculateDistance } from '@/lib/geofence';

const TrackingMap = dynamic(
  () => import('./TrackingMap').then((mod) => ({ default: mod.TrackingMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl min-h-[500px] gap-2">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">
          Loading Live Radar / جاري تشغيل رادار الأسطول...
        </p>
      </div>
    ),
  }
);

type FilterMode = 'all' | 'moving' | 'in_port' | 'frigo_alert';

const TruckTrackingScreen = () => {
  const { t, dir, locale } = useLanguage();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [locations, setLocations] = useState<Map<number, TruckLocation[]>>(new Map());
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [trucksRes, locationsRes, zonesRes] = await Promise.all([
        supabase.from('trucks').select('*').order('plate_number'),
        supabase.from('truck_locations').select('*').order('recorded_at', { ascending: false }),
        supabase.from('geofence_zones').select('*').eq('is_active', true),
      ]);

      if (trucksRes.error) throw trucksRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (zonesRes.error) throw zonesRes.error;

      setTrucks(trucksRes.data || []);

      const locationMap = new Map<number, TruckLocation[]>();
      locationsRes.data?.forEach((loc) => {
        const truckId = loc.truck_id;
        if (!locationMap.has(truckId)) {
          locationMap.set(truckId, []);
        }
        const normalizedLoc: TruckLocation = {
          ...loc,
          timestamp: loc.timestamp || loc.recorded_at,
          recorded_at: loc.recorded_at || loc.timestamp,
        };
        locationMap.get(truckId)!.push(normalizedLoc);
      });
      setLocations(locationMap);

      setGeofenceZones(zonesRes.data || []);
    } catch (error: unknown) {
      console.error('Failed to load tracking data:', error);
      const message =
        error instanceof Error
          ? error.message
          : (error as { message?: string })?.message || t('خطأ غير معروف', 'Erreur inconnue', 'Error desconocido');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur lors du chargement des données', 'Error al cargar datos'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, supabase, t]);

  useEffect(() => {
    fetchData();

    const locationsChannel = supabase
      .channel('truck-live-tracking-locations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'truck_locations',
        },
        (payload) => {
          const rawLoc = payload.new as TruckLocation;
          const newLoc: TruckLocation = {
            ...rawLoc,
            timestamp: rawLoc.timestamp || rawLoc.recorded_at,
            recorded_at: rawLoc.recorded_at || rawLoc.timestamp,
          };
          setLocations((prevMap) => {
            const newMap = new Map(prevMap);
            const history = newMap.get(newLoc.truck_id) || [];
            newMap.set(newLoc.truck_id, [newLoc, ...history]);
            return newMap;
          });
        }
      )
      .subscribe();

    const trucksChannel = supabase
      .channel('truck-live-tracking-trucks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trucks',
        },
        (payload) => {
          const updated = payload.new as Truck;
          setTrucks((prev) => prev.map((tr) => (tr.id === updated.id ? updated : tr)));
        }
      )
      .subscribe();

    const alertsChannel = supabase
      .channel('truck-live-geofence-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'geofence_alerts',
        },
        (payload) => {
          const alert = payload.new as GeofenceAlert;
          const matchedTruck = trucks.find((t) => t.id === alert.truck_id);
          const isEnter = alert.event_type === 'enter';

          toast({
            title: isEnter
              ? t('🔔 دخول منطقة جغرافية / معبر', '🔔 Entrée dans une zone géofence', '🔔 Entrada en zona geocercada')
              : t('🚪 مغادرة منطقة جغرافية', '🚪 Sortie d’une zone géofence', '🚪 Salida de zona geocercada'),
            description: `${matchedTruck?.plate_number || `#${alert.truck_id}`} - ${
              isEnter
                ? t('وصلت الشاحنة إلى النطاق الاستراتيجي', 'Le camion est arrivé dans la zone', 'El camión ha llegado a la zona')
                : t('غادرت الشاحنة النطاق الاستراتيجي', 'Le camion a quitté la zone', 'El camión ha salido de la zona')
            }`,
          });
        }
      )
      .subscribe();

    const interval = setInterval(fetchData, 60000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(locationsChannel);
      supabase.removeChannel(trucksChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, [fetchData, supabase, trucks, t, toast]);

  const getTruckHistory = useCallback(
    (truckId: number) => {
      return locations.get(truckId) || [];
    },
    [locations]
  );

  const checkTruckInPort = useCallback(
    (truckId: number): StrategicPortZone | null => {
      const history = getTruckHistory(truckId);
      if (history.length === 0) return null;
      const latest = history[0];
      const lat = Number(latest.latitude);
      const lon = Number(latest.longitude);
      if (isNaN(lat) || isNaN(lon)) return null;

      for (const zone of STRATEGIC_PORT_ZONES) {
        if (calculateDistance(lat, lon, zone.latitude, zone.longitude) <= zone.radiusKm) {
          return zone;
        }
      }
      return null;
    },
    [getTruckHistory]
  );

  const telematicsMetrics = useMemo(() => {
    let connected = 0;
    let moving = 0;
    let inPort = 0;
    let frigoMonitored = 0;
    let frigoAlerts = 0;

    trucks.forEach((truck) => {
      const history = getTruckHistory(truck.id);
      if (history.length > 0) {
        connected++;
        const latest = history[0];
        const speed = Number(latest.speed || 0);
        if (speed > 5) moving++;

        if (checkTruckInPort(truck.id)) {
          inPort++;
        }

        if (latest.frigo_temperature !== undefined && latest.frigo_temperature !== null) {
          frigoMonitored++;
          const temp = Number(latest.frigo_temperature);
          if (temp > 4) {
            frigoAlerts++;
          }
        }
      }
    });

    return {
      total: trucks.length,
      connected,
      moving,
      inPort,
      frigoMonitored,
      frigoAlerts,
    };
  }, [trucks, getTruckHistory, checkTruckInPort]);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((truck) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const plateMatch = truck.plate_number?.toLowerCase().includes(q);
        const driverMatch = truck.default_driver_name?.toLowerCase().includes(q);
        const modelMatch = truck.model?.toLowerCase().includes(q);
        if (!plateMatch && !driverMatch && !modelMatch) return false;
      }

      const history = getTruckHistory(truck.id);
      const latest = history[0];

      if (filterMode === 'moving') {
        return latest && Number(latest.speed || 0) > 5;
      }
      if (filterMode === 'in_port') {
        return !!checkTruckInPort(truck.id);
      }
      if (filterMode === 'frigo_alert') {
        return (
          latest &&
          latest.frigo_temperature !== undefined &&
          latest.frigo_temperature !== null &&
          Number(latest.frigo_temperature) > 4
        );
      }

      return true;
    });
  }, [trucks, searchQuery, filterMode, getTruckHistory, checkTruckInPort]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3" dir={dir}>
        <RefreshCw className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground font-amiri">
          {t('جاري الاتصال برادار الأسطول وسيرفرات GPS...', 'Connexion au radar de la flotte...', 'Conectando con el radar de flota...')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary animate-pulse" />
            {t('رادار الأسطول الحي والتحكم التليمتري', 'Radar de Flotte & Tour de Contrôle IoT', 'Radar de Flota y Telemetría IoT')}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {t(
              'مراقبة فورية للممر الأوروبي والممر الإفريقي عبر خوادم Traccar',
              'Supervision en temps réel des corridors Europe & Afrique via Traccar',
              'Supervisión en tiempo real de los corredores Europa y África vía Traccar'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedTruck && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTruck(null)}
              className="text-xs rounded-xl h-9 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Layers className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
              {t('عرض كافة الأسطول', 'Vue globale flotte', 'Ver toda la flota')}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSatellite(!isSatellite)}
            className="rounded-xl text-xs h-9"
          >
            <Satellite className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
            {isSatellite
              ? t('خريطة عادية', 'Plan classique', 'Mapa clásico')
              : t('صور فضائية', 'Vue satellite', 'Vista satélite')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchData}
            title={t('تحديث فوري', 'Actualiser', 'Actualizar')}
            className="h-9 w-9 rounded-xl"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground font-amiri">
                {t('الأسطول المتصل', 'Flotte Connectée', 'Flota Conectada')}
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">
                  {telematicsMetrics.connected}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  / {telematicsMetrics.total}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <TruckIcon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border/60 bg-card/60 backdrop-blur-sm shadow-xs cursor-pointer transition-colors ${
            filterMode === 'moving' ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : ''
          }`}
          onClick={() => setFilterMode(filterMode === 'moving' ? 'all' : 'moving')}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground font-amiri">
                {t('تسير على الطريق', 'En Transit', 'En Ruta')}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {telematicsMetrics.moving}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('شاحنة', 'camions', 'camiones')}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Navigation className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border/60 bg-card/60 backdrop-blur-sm shadow-xs cursor-pointer transition-colors ${
            filterMode === 'in_port' ? 'ring-2 ring-sky-500 bg-sky-500/5' : ''
          }`}
          onClick={() => setFilterMode(filterMode === 'in_port' ? 'all' : 'in_port')}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground font-amiri">
                {t('بالموانئ والمعابر', 'Aux Ports & Frontières', 'En Puertos/Fronteras')}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
                  {telematicsMetrics.inPort}
                </span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                  {t('في الانتظار', 'en attente', 'en espera')}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Anchor className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-border/60 bg-card/60 backdrop-blur-sm shadow-xs cursor-pointer transition-colors ${
            filterMode === 'frigo_alert' ? 'ring-2 ring-rose-500 bg-rose-500/5' : ''
          }`}
          onClick={() => setFilterMode(filterMode === 'frigo_alert' ? 'all' : 'frigo_alert')}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-medium text-muted-foreground font-amiri">
                  {t('سلسلة التبريد Frigo', 'Chaîne du Froid Frigo', 'Cadena de Frío Frigorífico')}
                </p>
                {telematicsMetrics.frigoAlerts > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                    {telematicsMetrics.frigoAlerts} {t('تنبيه', 'alerte', 'alerta')}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                  {telematicsMetrics.frigoMonitored}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {t('مقطورة تبريد', 'reefers', 'remolques')}
                </span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Snowflake className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-3">
          <Card className="h-[640px] flex flex-col">
            <CardHeader className="pb-3 pt-4 px-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-base font-amiri font-bold text-foreground">
                  {t('أسطول الشاحنات', 'Flotte de Camions', 'Flota de Camiones')} ({filteredTrucks.length})
                </CardTitle>
                {filterMode !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-primary px-2"
                    onClick={() => setFilterMode('all')}
                  >
                    {t('إلغاء الفلتر', 'Effacer filtre', 'Borrar filtro')}
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search
                  className={`w-3.5 h-3.5 absolute top-2.5 text-muted-foreground ${
                    dir === 'rtl' ? 'right-2.5' : 'left-2.5'
                  }`}
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(
                    'بحث باللوحة أو السائق...',
                    'Filtrer par immatriculation ou chauffeur...',
                    'Buscar por matrícula o conductor...'
                  )}
                  className={`h-8 text-xs ${dir === 'rtl' ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 flex-1 overflow-y-auto space-y-2">
              {filteredTrucks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs font-amiri">
                  {t('لا توجد شاحنات مطابقة للبحث أو الفلتر', 'Aucun camion ne correspond aux critères', 'No hay camiones que coincidan')}
                </div>
              ) : (
                filteredTrucks.map((truck) => {
                  const history = getTruckHistory(truck.id);
                  const hasLocation = history.length > 0;
                  const latest = history[0];
                  const speed = Number(latest?.speed || 0);
                  const inPortZone = checkTruckInPort(truck.id);
                  const isSelected = selectedTruck?.id === truck.id;

                  const frigoTemp =
                    latest?.frigo_temperature !== undefined && latest?.frigo_temperature !== null
                      ? Number(latest.frigo_temperature)
                      : null;
                  const hasFrigoAlert = frigoTemp !== null && frigoTemp > 4;

                  return (
                    <div
                      key={truck.id}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border/70 hover:border-primary/40 hover:bg-muted/40'
                      }`}
                      onClick={() => setSelectedTruck(truck)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" />
                        <div className="flex items-center gap-1.5">
                          {hasLocation ? (
                            <span
                              className={`text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                                inPortZone
                                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                  : speed > 5
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              {inPortZone
                                ? t('بالميناء', 'Au port', 'En puerto')
                                : speed > 5
                                ? `${Math.round(speed)} ${t('كم/س', 'km/h', 'km/h')}`
                                : t('متوقفة', 'À l’arrêt', 'Detenido')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {t('غير متصل', 'Hors ligne', 'Desconectado')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate max-w-[140px]">
                          {truck.default_driver_name || t('سائق دولي', 'Chauffeur Int.', 'Conductor')}
                        </span>
                        {truck.model && <span className="font-mono text-[10px]">{truck.model}</span>}
                      </div>

                      {(frigoTemp !== null || inPortZone) && (
                        <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
                          {inPortZone ? (
                            <span className="text-sky-700 dark:text-sky-300 font-medium truncate max-w-[160px] flex items-center gap-1">
                              <Anchor className="w-3 h-3 shrink-0" />
                              {inPortZone.name_ar}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono">
                              {latest?.recorded_at
                                ? new Date(latest.recorded_at).toLocaleTimeString(
                                    locale === 'ar' ? 'ar-MA' : 'fr-FR'
                                  )
                                : ''}
                            </span>
                          )}

                          {frigoTemp !== null && (
                            <span
                              className={`flex items-center gap-1 font-mono font-bold px-1 py-0.2 rounded ${
                                hasFrigoAlert
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                  : 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                              }`}
                            >
                              <Snowflake className="w-2.5 h-2.5" />
                              {frigoTemp > 0 ? `+${frigoTemp.toFixed(1)}` : frigoTemp.toFixed(1)}°C
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[640px] overflow-hidden border-border/70 shadow-sm relative">
            <CardContent className="p-0 h-full">
              <TrackingMap
                trucks={trucks}
                locations={locations}
                selectedTruck={selectedTruck}
                onSelectTruck={setSelectedTruck}
                isSatellite={isSatellite}
                geofenceZones={geofenceZones}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TruckTrackingScreen;
