'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Truck, TruckLocation, GeofenceZone } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Navigation, Satellite } from 'lucide-react';
import { TrackingMap } from './TrackingMap';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

const TruckTrackingScreen = () => {
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
        supabase.from('truck_locations').select('*').order('timestamp', { ascending: false }),
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
        locationMap.get(truckId)!.push(loc);
      });
      setLocations(locationMap);

      setGeofenceZones(zonesRes.data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'خطأ في تحميل البيانات',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          const newLoc = payload.new as TruckLocation;
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
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-amiri">تتبع الشاحنات</h1>
        <Button variant="outline" onClick={() => setIsSatellite(!isSatellite)}>
          <Satellite className="w-4 h-4 ml-2" />
          {isSatellite ? 'خريطة عادية' : 'صور فضائية'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri">الشاحنات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {trucks.map((truck) => {
                  const history = getTruckHistory(truck.id);
                  const hasLocation = history.length > 0;
                  return (
                    <div
                      key={truck.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTruck?.id === truck.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setSelectedTruck(truck)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                          <MatriculeBadge plate={truck.plate_number} variant="badge" size="xs" />
                        </div>
                        {hasLocation && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            متصل
                          </span>
                        )}
                      </div>
                      {hasLocation && (
                        <div className="mt-2 text-sm text-slate-500">
                          آخر تحديث: {new Date(history[0].timestamp).toLocaleString('ar-MA')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-[600px]">
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
