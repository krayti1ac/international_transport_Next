'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GeofenceAlert, Truck } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bell, MapPin } from 'lucide-react';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

const EVENT_TYPE_LABELS: Record<string, { text: string; color: string }> = {
  enter: { text: 'دخول', color: 'text-green-600 bg-green-50' },
  exit: { text: 'خروج', color: 'text-red-600 bg-red-50' },
};

export default function GeofenceAlertsPage() {
  const [alerts, setAlerts] = useState<(GeofenceAlert & { truck?: Truck; zone?: { name: string; zone_type: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTruck, setFilterTruck] = useState<string>('');
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

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
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'خطأ في تحميل البيانات',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = filterTruck
    ? alerts.filter((alert) => alert.truck?.plate_number?.includes(filterTruck))
    : alerts;

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
        <h1 className="text-2xl font-bold font-amiri">تنبيهات السياج الجغرافي</h1>
        <Button variant="outline" onClick={fetchAlerts}>
          تحديث
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <input
            type="text"
            placeholder="بحث بلوحة الشاحنة..."
            value={filterTruck}
            onChange={(e) => setFilterTruck(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredAlerts.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <div>
                    <div className="mb-0.5">
                      <MatriculeBadge plate={alert.truck?.plate_number || `شاحنة #${alert.truck_id}`} variant="badge" size="xs" />
                    </div>
                    <p className="text-sm text-slate-500">
                      {alert.zone?.name || `منطقة #${alert.zone_id}`} - {alert.zone?.zone_type || ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${EVENT_TYPE_LABELS[alert.event_type]?.color || 'bg-slate-100'}`}>
                    {EVENT_TYPE_LABELS[alert.event_type]?.text || alert.event_type}
                  </span>
                  <span className="text-sm text-slate-500">
                    {new Date(alert.timestamp).toLocaleString('ar-MA')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAlerts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>لا توجد تنبيهات حالياً</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
