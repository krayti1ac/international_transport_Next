'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  BarChart3,
  PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export function TcoDashboard({ vehicleId, vehicleType }: { vehicleId: number; vehicleType: 'truck' | 'trailer' }) {
  const { t, dir } = useLanguage();
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

  const isFleetView = rows.length > 1;

  const costBreakdownChartData = useMemo(() => {
    if (rows.length === 0) return [];

    if (!isFleetView && rows.length === 1) {
      const r = rows[0];
      return [
        {
          name: t('وقود', 'Carburant', 'Fuel'),
          value: r.fuelCost,
          color: '#3b82f6',
        },
        {
          name: t('صيانة', 'Maintenance', 'Maintenance'),
          value: r.maintenanceCost,
          color: '#f59e0b',
        },
        {
          name: t('رحلات', 'Trajets', 'Trips'),
          value: r.tripCost,
          color: '#10b981',
        },
      ].filter((d) => d.value > 0);
    }

    return [
      {
        name: t('وقود', 'Carburant', 'Fuel'),
        value: aggregates?.totalFuel || 0,
        color: '#3b82f6',
      },
      {
        name: t('صيانة', 'Maintenance', 'Maintenance'),
        value: aggregates?.totalMaint || 0,
        color: '#f59e0b',
      },
      {
        name: t('رحلات', 'Trajets', 'Trips'),
        value: aggregates?.totalTrip || 0,
        color: '#10b981',
      },
    ].filter((d) => d.value > 0);
  }, [rows, aggregates, isFleetView, t]);

  const fleetComparisonData = useMemo(() => {
    if (!isFleetView) return [];
    const sorted = [...rows]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);
    return sorted.map((r) => ({
      name: r.truckName.length > 14 ? r.truckName.slice(0, 14) + '…' : r.truckName,
      fullName: r.truckName,
      وقود: parseFloat(r.fuelCost.toFixed(2)),
      صيانة: parseFloat(r.maintenanceCost.toFixed(2)),
      رحلات: parseFloat(r.tripCost.toFixed(2)),
    }));
  }, [rows, isFleetView]);

  const distanceChartData = useMemo(() => {
    if (!isFleetView) return [];
    const sorted = [...rows]
      .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm)
      .slice(0, 10);
    return sorted.map((r) => ({
      name: r.truckName.length > 14 ? r.truckName.slice(0, 14) + '…' : r.truckName,
      fullName: r.truckName,
      km: parseFloat(r.totalDistanceKm.toFixed(2)),
    }));
  }, [rows, isFleetView]);

  const formatMoney = (value: number) =>
    `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

  const getHealthColor = (value: number, threshold: number) => {
    if (value <= threshold) return 'text-emerald-600 dark:text-emerald-400';
    if (value <= threshold * 1.4) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

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

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
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

      {/* KPI Cards */}
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

      {/* Charts Section */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cost Breakdown Bar Chart */}
          <Card className={isFleetView ? 'lg:col-span-2' : 'lg:col-span-1'}>
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="font-amiri text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                {isFleetView
                  ? t('مقارنة التكاليف حسب الشاحنة', 'Comparaison des coûts par camion', 'Cost comparison by truck')
                  : t('تفكيك التكاليف', 'Décomposition des coûts', 'Cost breakdown')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isFleetView && fleetComparisonData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fleetComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val) => [formatMoney(typeof val === 'number' ? val : 0), '']}
                      />
                      <Legend />
                      <Bar dataKey="وقود" stackId="1" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="صيانة" stackId="1" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="رحلات" stackId="1" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : costBreakdownChartData.length > 0 ? (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costBreakdownChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val) => [formatMoney(typeof val === 'number' ? val : 0), '']}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {costBreakdownChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {t('لا توجد بيانات كافية للرسم', 'Données insuffisantes pour le graphique')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cost Composition Donut */}
          {costBreakdownChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="font-amiri text-sm flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" />
                  {t('توزيع التكاليف', 'Répartition des coûts', 'Cost distribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costBreakdownChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {costBreakdownChartData.map((entry, idx) => (
                          <Cell key={`pie-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(val) => [formatMoney(typeof val === 'number' ? val : 0), '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 w-full pt-3 border-t border-border">
                  {costBreakdownChartData.map((entry, idx) => {
                    const total = costBreakdownChartData.reduce((s, d) => s + d.value, 0);
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{pct}%</span>
                          <span className="text-muted-foreground font-mono text-[10px]">{formatMoney(entry.value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Distance Chart (Fleet View Only) */}
      {isFleetView && distanceChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="font-amiri text-sm flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              {t('المسافة المقطوعة حسب الشاحنة (كم)', 'Distance parcourue par camion (km)', 'Distance traveled by truck (km)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distanceChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val.toLocaleString()}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                     formatter={(val) => [`${typeof val === 'number' ? val.toLocaleString() : val} km`, '']}
                  />
                  <Bar dataKey="km" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Details List */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="font-amiri text-sm text-foreground">
              {vehicleType === 'truck'
                ? t('تفاصيل الشاحنة', 'Détails du camion')
                : t('تفاصيل أسطول الشاحنات', 'Détails de la flotte')}
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
                        {' • '}
                        {t('الصيانة: ', 'Maintenance: ')}
                        {row.maintenanceCount}
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
