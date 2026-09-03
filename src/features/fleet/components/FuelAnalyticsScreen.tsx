'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fuel, AlertTriangle, TrendingUp, RefreshCw, Truck } from 'lucide-react';
import { calculateFuelAnalytics } from '@/features/fleet/services/fuel_intelligence.actions';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type { TruckFuelStats, FuelAnomaly } from '@/features/fleet/services/fuel_intelligence.actions';

const CONSUMPTION_THRESHOLD = 35;

export default function FuelAnalyticsScreen() {
  const [truckStats, setTruckStats] = useState<TruckFuelStats[]>([]);
  const [anomalies, setAnomalies] = useState<FuelAnomaly[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchTrucks = useCallback(async () => {
    try {
      await supabase.from('trucks').select('id, plate_number').order('plate_number');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch trucks';
      console.error(message);
    }
  }, [supabase]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await calculateFuelAnalytics();
      if (result.success) {
        setTruckStats(result.trucks || []);
        setAnomalies(result.anomalies || []);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional data fetch
    fetchReport();
  }, [fetchReport]);

  const chartData = useMemo(() => {
    return truckStats.map((truck) => ({
      name: truck.truckName,
      lPer100km: truck.lPer100km,
      threshold: CONSUMPTION_THRESHOLD,
    }));
  }, [truckStats]);

  const criticalAnomalies = anomalies.filter((a) => a.severity === 'high');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25';
      case 'medium':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25';
      default:
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25';
      case 'warning':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25';
      default:
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري تحميل تحليلات الوقود...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">تحليلات استهلاك الوقود</h1>
          <p className="text-sm text-muted-foreground mt-0.5">مراقبة كفاءة الشاحنات واكتشاف التسريبات</p>
        </div>
        <Button onClick={fetchReport} variant="outline">
          <RefreshCw className="w-4 h-4 ml-2" />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              إجمالي الشاحنات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{truckStats.length}</div>
            <p className="text-xs text-muted-foreground mt-1">شاحنة نشطة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              تنبيهات حرجة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalAnomalies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">تسريبات محتملة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              متوسط الاستهلاك
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {truckStats.length > 0
                ? (truckStats.reduce((sum, t) => sum + t.lPer100km, 0) / truckStats.length).toFixed(1)
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">L/100km</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-amiri text-foreground">متوسط الاستهلاك لكل شاحنة (L/100km)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" />
              <YAxis stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
                formatter={(value: unknown) => [`${value} L/100km`, 'الاستهلاك']}
              />
              <Bar dataKey="lPer100km" fill="#2563eb" name="L/100km" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {anomalies.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="font-amiri text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              الشذوذ والاحتيال في استهلاك الوقود
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(anomaly.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/15">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <MatriculeBadge plate={anomaly.truckName} variant="badge" size="xs" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {anomaly.notes}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          التاريخ: {new Date(anomaly.date).toLocaleDateString('ar-MA')}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold font-mono text-red-600 dark:text-red-400">
                        {anomaly.lPer100km} L/100km
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {anomaly.liters} لتر / {anomaly.distanceKm} كم
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {truckStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">تفاصيل الشاحنات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {truckStats.map((truck) => (
                <div
                  key={truck.truckId}
                  className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/15">
                      <Fuel className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="mb-1">
                        <MatriculeBadge plate={truck.truckName} variant="badge" size="xs" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {truck.receiptsCount} إيصالات • {truck.totalDistanceKm} كم
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold font-mono text-foreground">
                      {truck.lPer100km} L/100km
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(truck.status)}`}>
                      {truck.status === 'normal' ? 'طبيعي' : truck.status === 'warning' ? 'تحذير' : 'حرج'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {anomalies.length === 0 && truckStats.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Fuel className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد بيانات استهلاك وقود كافية للتحليل</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
