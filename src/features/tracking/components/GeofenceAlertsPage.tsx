'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { GeofenceAlert, Truck } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bell, MapPin, RefreshCw } from 'lucide-react';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';

export default function GeofenceAlertsPage() {
  const { t, dir, locale } = useLanguage();
  const [alerts, setAlerts] = useState<(GeofenceAlert & { truck?: Truck; zone?: { name: string; zone_type: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTruck, setFilterTruck] = useState<string>('');
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case 'enter':
        return { text: t('دخول', 'Entrée'), color: 'text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-400' };
      case 'exit':
        return { text: t('خروج', 'Sortie'), color: 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400' };
      default:
        return { text: eventType, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const query = supabase()
        .from('geofence_alerts')
        .select('*, trucks(*), geofence_zones(name, zone_type)')
        .order('timestamp', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setAlerts(data || []);
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
  }, [supabase, toast, t]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = filterTruck
    ? alerts.filter((alert) => alert.truck?.plate_number?.toLowerCase().includes(filterTruck.toLowerCase()))
    : alerts;

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
        <h1 className="text-2xl font-bold font-amiri text-foreground">{t('تنبيهات السياج الجغرافي', 'Alertes de Géorepérage')}</h1>
        <Button variant="outline" onClick={fetchAlerts} className="rounded-xl text-xs h-9">
          <RefreshCw className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
          {t('تحديث', 'Actualiser')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <input
            type="text"
            placeholder={t('بحث بلوحة الشاحنة...', 'Rechercher par immatriculation...')}
            value={filterTruck}
            onChange={(e) => setFilterTruck(e.target.value)}
            className="w-full px-3 py-2 border border-border bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const eventInfo = getEventTypeLabel(alert.event_type);
          return (
            <Card key={alert.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <div className="mb-0.5">
                        <MatriculeBadge plate={alert.truck?.plate_number || `${t('شاحنة', 'Camion')} #${alert.truck_id}`} variant="badge" size="xs" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.zone?.name || `${t('منطقة', 'Zone')} #${alert.zone_id}`} - {alert.zone?.zone_type || ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${eventInfo.color}`}>
                      {eventInfo.text}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(alert.timestamp).toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAlerts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm">{t('لا توجد تنبيهات حالياً', 'Aucune alerte pour le moment')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
