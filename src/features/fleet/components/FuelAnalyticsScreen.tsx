'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fuel, AlertTriangle, TrendingUp, RefreshCw, Truck } from 'lucide-react';
import { calculateFuelAnalytics } from '@/features/fleet/services/fuel_intelligence.actions';
import Decimal from 'decimal.js';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type { TruckFuelStats, FuelAnomaly } from '@/features/fleet/services/fuel_intelligence.actions';
import { useLanguage } from '@/components/language-provider';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const CONSUMPTION_THRESHOLD = 35;

export default function FuelAnalyticsScreen() {
  const { t, dir, locale } = useLanguage();
  const [truckStats, setTruckStats] = useState<TruckFuelStats[]>([]);
  const [anomalies, setAnomalies] = useState<FuelAnomaly[]>([]);
  const [totalTrucks, setTotalTrucks] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await calculateFuelAnalytics();
      if (result.success) {
        setTruckStats(result.trucks || []);
        setAnomalies(result.anomalies || []);
        setTotalTrucks(result.totalTrucks ?? (result.trucks || []).length);
      } else {
        throw new Error(result.error || t('فشل في حساب تحليلات الوقود', 'Échec du calcul des analyses de carburant'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('حدث خطأ أثناء تحميل تحليلات الوقود', 'Erreur lors du chargement des analyses de carburant');
      toast({ title: t('خطأ', 'Erreur'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

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

  const averageConsumption = useMemo(() => {
    if (truckStats.length === 0) return '0';
    const total = truckStats.reduce(
      (sum, t) => sum.plus(new Decimal(t.lPer100km || 0)),
      new Decimal(0)
    );
    return total.dividedBy(new Decimal(truckStats.length)).toFixed(1);
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
      <div className="flex items-center justify-center h-96" dir={dir}>
        <p className="text-muted-foreground">{t('جاري تحميل تحليلات الوقود...', 'Chargement des analyses de carburant...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('تحليلات استهلاك الوقود', 'Analyses de la Consommation de Carburant')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('مراقبة كفاءة الشاحنات واكتشاف التسريبات', 'Surveillance du rendement et détection des anomalies')}
          </p>
        </div>
        <Button onClick={fetchReport} variant="outline">
          <RefreshCw className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('تحديث', 'Actualiser')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Fuel className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {t('إجمالي الشاحنات', 'Total Véhicules')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTrucks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {truckStats.length > 0 ? `${truckStats.length} ${t('بنشاط وقود مسجل', 'avec consommation enregistrée')}` : t('شاحنة مسجلة', 'véhicule(s) enregistré(s)')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              {t('تنبيهات حرجة', 'Alertes Critiques')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalAnomalies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('تسريبات محتملة', 'Fuites / Anomalies suspectées')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {t('متوسط الاستهلاك', 'Consommation Moyenne')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {averageConsumption}
            </div>
            <p className="text-xs text-muted-foreground mt-1">L/100km</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-amiri text-foreground">
            {t('متوسط الاستهلاك لكل شاحنة (L/100km)', 'Consommation moyenne par camion (L/100km)')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
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
                  formatter={(value: unknown) => [`${value} L/100km`, t('الاستهلاك', 'Consommation')]}
                />
                <Bar dataKey="lPer100km" fill="#2563eb" name="L/100km" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Fuel className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">{t('لا توجد بيانات استهلاك وقود كافية لعرض الرسم البياني حالياً', 'Données insuffisantes pour afficher le graphique')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {anomalies.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="font-amiri text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('الشذوذ والشبهات في استهلاك الوقود', 'Anomalies et Suspicion de Fraude Carburant')}
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
                          {t('التاريخ: ', 'Date : ')}{anomaly.date ? new Date(anomaly.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-MA') : t('غير محدد', 'Non défini')}
                        </p>
                      </div>
                    </div>
                    <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                      <p className="font-bold font-mono text-red-600 dark:text-red-400">
                        {anomaly.lPer100km} L/100km
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {anomaly.liters} {t('لتر', 'L')} / {anomaly.distanceKm} {t('كم', 'km')}
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
            <CardTitle className="font-amiri text-foreground">{t('تفاصيل الشاحنات', 'Détails des Véhicules')}</CardTitle>
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
                        {truck.receiptsCount} {t('إيصالات', 'reçus')} • {truck.totalDistanceKm} {t('كم', 'km')}
                      </p>
                    </div>
                  </div>
                  <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="font-bold font-mono text-foreground">
                      {truck.lPer100km} L/100km
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(truck.status)}`}>
                      {truck.status === 'normal' ? t('طبيعي', 'Normal') : truck.status === 'warning' ? t('تحذير', 'Avertissement') : t('حرج', 'Critique')}
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
            <p className="text-muted-foreground">{t('لا توجد بيانات استهلاك وقود كافية للتحليل', 'Aucune donnée de consommation de carburant disponible')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
