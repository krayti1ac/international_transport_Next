'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { TruckLocation, GeofenceZone } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Calendar, RefreshCw } from 'lucide-react';
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

interface HistoricalTrackingProps {
  trucks: { id: number; plate_number: string }[];
}

export default function HistoricalTracking({ trucks }: HistoricalTrackingProps) {
  const { t, dir } = useLanguage();
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [history, setHistory] = useState<TruckLocation[]>([]);
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const selectedTruck = trucks.find(t => t.id.toString() === selectedTruckId) || null;

  const fetchHistory = useCallback(async () => {
    if (!selectedTruckId) return;
    setLoading(true);
    try {
      const [historyRes, zonesRes] = await Promise.all([
        supabase()
          .from('truck_locations')
          .select('*')
          .eq('truck_id', parseInt(selectedTruckId, 10))
          .order('recorded_at', { ascending: true }),
        supabase().from('geofence_zones').select('*').eq('is_active', true),
      ]);

      if (historyRes.error) throw historyRes.error;
      if (zonesRes.error) throw zonesRes.error;

      let filteredHistory = (historyRes.data || []) as TruckLocation[];
      if (startDate) {
        filteredHistory = filteredHistory.filter(loc => loc.recorded_at && loc.recorded_at >= startDate);
      }
      if (endDate) {
        filteredHistory = filteredHistory.filter(loc => loc.recorded_at && loc.recorded_at <= endDate);
      }

      setHistory(filteredHistory);
      setGeofenceZones((zonesRes.data || []) as GeofenceZone[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في تحميل البيانات', 'Erreur lors du chargement des données'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedTruckId, startDate, endDate, supabase, toast, t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const locationsMap = useCallback(() => {
    const map = new Map<number, TruckLocation[]>();
    if (selectedTruckId && history.length > 0) {
      map.set(parseInt(selectedTruckId, 10), history);
    }
    return map;
  }, [selectedTruckId, history]);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const speeds = history.map(h => h.speed).filter((s): s is number => s !== undefined && s !== null);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const start = history[0];
    const end = history[history.length - 1];
    const distance = start && end ? calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude) : 0;
    return { avgSpeed: Math.round(avgSpeed), maxSpeed: Math.round(maxSpeed), distance: distance.toFixed(1), points: history.length };
  }, [history]);

  return (
    <div className="space-y-6" dir={dir}>
      <Card>
        <CardHeader>
          <CardTitle className="font-amiri">
            {t('التتبع التاريخي للأسطول', 'Suivi historique de la flotte')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('الشاحنة', 'Camion')}
              </label>
              <select
                value={selectedTruckId}
                onChange={(e) => setSelectedTruckId(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('اختر شاحنة', 'Sélectionner un camion')}</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id.toString()}>
                    {truck.plate_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('من تاريخ', 'Date de début')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('إلى تاريخ', 'Date de fin')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchHistory} disabled={loading || !selectedTruckId} className="w-full">
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Calendar className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                    {t('عرض', 'Afficher')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t('نقاط التتبع', 'Points de suivi')}</p>
              <p className="text-2xl font-bold text-foreground">{stats.points}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t('المسافة (كم)', 'Distance (km)')}</p>
              <p className="text-2xl font-bold text-foreground">{stats.distance}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t('متوسط السرعة', 'Vitesse moyenne')}</p>
              <p className="text-2xl font-bold text-foreground">{stats.avgSpeed} <span className="text-sm">km/h</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{t('السرعة القصوى', 'Vitesse max')}</p>
              <p className="text-2xl font-bold text-foreground">{stats.maxSpeed} <span className="text-sm">km/h</span></p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTruck && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri flex items-center gap-2">
              <MatriculeBadge plate={selectedTruck.plate_number} variant="badge" size="xs" />
              {t('المسار الجغرافي', 'Trace géographique')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px]">
              <TrackingMap
                locations={locationsMap()}
                selectedTruck={selectedTruck ? { ...selectedTruck, plate_number: selectedTruck.plate_number } as unknown as import('@/types/database').Truck : null}
                isSatellite={false}
                geofenceZones={geofenceZones}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedTruckId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm">{t('اختر شاحنة لعرض مسارها التاريخي', 'Sélectionnez un camion pour afficher son historique')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
