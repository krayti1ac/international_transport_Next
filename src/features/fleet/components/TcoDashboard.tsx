'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import { calculateTcoPerKm } from '@/features/fleet/services/tco.actions';
import type { TcoBreakdown } from '@/features/fleet/services/tco.actions';
import {
  TrendingDown,
  Fuel,
  Wrench,
  Route,
  Calculator,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export function TcoDashboard({ vehicleId, vehicleType }: { vehicleId: number; vehicleType: 'truck' | 'trailer' }) {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<TcoBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTco = useCallback(async () => {
    setLoading(true);
    try {
      const result = await calculateTcoPerKm(vehicleType === 'truck' ? vehicleId : undefined);
      if (!result.success) throw new Error(result.error);
      const filtered = vehicleType === 'truck'
        ? (result.data || []).filter((r) => r.truckId === vehicleId)
        : (result.data || []);
      setRows(filtered);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({ title: t('خطأ في تحميل التكلفة', 'Erreur de chargement TCO'), description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [vehicleId, vehicleType, toast, t]);

  useEffect(() => {
    fetchTco();
  }, [fetchTco]);

  const aggregates = useMemo(() => {
    if (rows.length === 0) return null;
    const totalDistance = rows.reduce((s, r) => s + r.totalDistanceKm, 0);
    const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);
    const totalFuel = rows.reduce((s, r) => s + r.fuelCost, 0);
    const totalMaint = rows.reduce((s, r) => s + r.maintenanceCost, 0);
    const totalTrip = rows.reduce((s, r) => s + r.tripCost, 0);
    const safeDistance = totalDistance > 0 ? totalDistance : 1;
    return {
      totalDistance,
      totalCost,
      totalFuel,
      totalMaint,
      totalTrip,
      costPerKm: totalCost / safeDistance,
      fuelPerKm: totalFuel / safeDistance,
      maintPerKm: totalMaint / safeDistance,
      tripPerKm: totalTrip / safeDistance,
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground" dir={dir}>
        {t('جاري احتساب تكلفة الكيلومتر...', 'Calcul du coût par km en cours...')}
      </div>
    );
  }

  if (!aggregates) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          <Calculator className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>{t('لا توجد بيانات كافية لحساب تكلفة الكيلومتر', 'Données insuffisantes pour le calcul du coût par km')}</p>
        </CardContent>
      </Card>
    );
  }

  const formatMoney = (value: number) =>
    `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

  const getHealthColor = (value: number, threshold: number) => {
    if (value <= threshold) return 'text-emerald-600 dark:text-emerald-400';
    if (value <= threshold * 1.4) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="space-y-5" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-amiri text-lg font-bold text-foreground">
            {t('مؤشر التكلفة التشغيلية للكيلومتر (TCO)', 'Coût Total de Possession par km (TCO)')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('يتم احتساب التكلفة بناءً على الوقود + الصيانة + تكاليف الرحلات الموثقة', 'Basé sur carburant + maintenance + coûts des trajets documentés')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTco} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
          {t('تحديث', 'Actualiser')}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Fuel className="w-4 h-4 text-blue-500" />
              {t('تكلفة الوقود / كم', 'Carburant / km')}
            </div>
            <p className={`text-xl font-bold font-mono ${getHealthColor(aggregates.fuelPerKm, 1.2)}`}>
              {aggregates.fuelPerKm.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(aggregates.totalFuel)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wrench className="w-4 h-4 text-amber-500" />
              {t('صيانة / كم', 'Maintenance / km')}
            </div>
            <p className={`text-xl font-bold font-mono ${getHealthColor(aggregates.maintPerKm, 0.4)}`}>
              {aggregates.maintPerKm.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(aggregates.totalMaint)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Route className="w-4 h-4 text-indigo-500" />
              {t('رحلات / كم', 'Trajets / km')}
            </div>
            <p className={`text-xl font-bold font-mono ${getHealthColor(aggregates.tripPerKm, 3.5)}`}>
              {aggregates.tripPerKm.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(aggregates.totalTrip)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calculator className="w-4 h-4 text-rose-500" />
              {t('التكلفة الإجمالية / كم', 'Coût total / km')}
            </div>
            <p className={`text-xl font-bold font-mono ${getHealthColor(aggregates.costPerKm, 5)}`}>
              {aggregates.costPerKm.toFixed(4)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">{formatMoney(aggregates.totalCost)}</p>
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-sm text-foreground">
              {vehicleType === 'truck'
                ? t('تفاصيل الشاحنة', 'Détails du camion')
                : t('لا توجد تكلفة TCO مخصصة للمقطورات حالياً', 'Pas de TCO spécifique pour les remorques pour le moment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.truckId} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                      <MatriculeBadge plate={row.truckName} variant="badge" size="sm" />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t('المسافة: ', 'Distance: ')}
                        {row.totalDistanceKm.toLocaleString()} km
                        {' • '}
                        {t('الرحلات: ', 'Trajets: ')}
                        {row.tripsCount}
                      </p>
                    </div>
                  </div>
                  <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                    <p className="font-bold font-mono text-foreground">{row.totalCostPerKm.toFixed(4)} MAD/km</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('إجمالي التكلفة', 'Coût total')}: {formatMoney(row.totalCost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
