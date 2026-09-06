'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { Truck, TruckLocation, GeofenceZone } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Satellite, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';

const TrackingMap = dynamic(
  () => import('./TrackingMap').then((mod) => ({ default: mod.TrackingMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-xl min-h-[400px]">
        <p className="text-muted-foreground text-sm font-medium">Loading map / جاري تحميل الخريطة...</p>
      </div>
    ),
  }
);

const TruckTrackingScreen = () => {
  const { t, dir, locale } = useLanguage();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [locations, setLocations] = useState<Map<number, TruckLocation[]>>(new Map());
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);
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
          : (error as { message?: string })?.message || t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur lors du chargement des données'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, supabase, t]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('truck-live-tracking')
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trucks',
        },
        (payload) => {
          const updated = payload.new as Truck;
          setTrucks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }
      )
      .subscribe();

    const interval = setInterval(fetchData, 60000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const getTruckHistory = (truckId: number) => {
    return locations.get(truckId) || [];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3" dir={dir}>
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('جاري تحميل البيانات...', 'Chargement des données...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri text-foreground">{t('تتبع الشاحنات', 'Suivi de la Flotte en Direct')}</h1>
        <Button variant="outline" onClick={() => setIsSatellite(!isSatellite)} className="rounded-xl text-xs h-9">
          <Satellite className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {isSatellite ? t('خريطة عادية', 'Plan classique') : t('صور فضائية', 'Vue satellite')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri text-foreground">{t('الشاحنات', 'Camions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trucks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('لا توجد شاحنات مسجلة حالياً', 'Aucun camion enregistré pour le moment')}
                  </div>
                ) : (
                  trucks.map((truck) => {
                    const history = getTruckHistory(truck.id);
                    const hasLocation = history.length > 0;
                    const latestTime = history[0]?.recorded_at || history[0]?.timestamp;
                    return (
                      <div
                        key={truck.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTruck?.id === truck.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                        onClick={() => setSelectedTruck(truck)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                            <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" />
                          </div>
                          {hasLocation && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                              <Navigation className="w-3 h-3" />
                              {t('متصل', 'En ligne')}
                            </span>
                          )}
                        </div>
                        {hasLocation && latestTime && (
                          <div className="mt-2 text-xs text-muted-foreground font-mono">
                            {t('آخر تحديث: ', 'Dernière màj : ')}{new Date(latestTime).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[600px] overflow-hidden">
            <CardContent className="p-0 h-full">
              <TrackingMap
                locations={locations}
                selectedTruck={selectedTruck}
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
