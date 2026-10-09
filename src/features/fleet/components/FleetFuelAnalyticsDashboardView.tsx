'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/forex';
import {
  Fuel,
  Gauge,
  TrendingDown,
  TrendingUp,
  Award,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  Flame,
  Zap,
  Activity,
  User,
  Compass,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { getFleetFuelBiSummaryAction } from '../services/fuel-bi.actions';
import type {
  FleetFuelBiSummary,
  DriverEcoScore,
  CorridorFuelBenchmark,
  GeoFuelCluster,
  EfficiencyTier,
} from '../types/fuel-telematics-bi.types';

export function FleetFuelAnalyticsDashboardView() {
  const { t, dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FleetFuelBiSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedClusterType, setSelectedClusterType] = useState<'all' | 'theft' | 'station'>('all');

  const loadData = () => {
    setLoading(true);
    getFleetFuelBiSummaryAction()
      .then((res) => {
        if (res.success && res.data) {
          setSummary(res.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered driver leaderboard
  const filteredDrivers = useMemo(() => {
    if (!summary?.driverRankings) return [];
    return summary.driverRankings.filter((d) => {
      const matchSearch =
        searchQuery === '' ||
        d.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.driverMatricule && d.driverMatricule.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTier = tierFilter === 'all' || d.tier === tierFilter;
      return matchSearch && matchTier;
    });
  }, [summary, searchQuery, tierFilter]);

  // Filtered geo clusters
  const filteredClusters = useMemo(() => {
    if (!summary?.geoClusters) return [];
    if (selectedClusterType === 'all') return summary.geoClusters;
    if (selectedClusterType === 'theft')
      return summary.geoClusters.filter((c) => c.type === 'theft_hotspot');
    return summary.geoClusters.filter((c) => c.type === 'refuel_station');
  }, [summary, selectedClusterType]);

  const getTierBadge = (tier: EfficiencyTier) => {
    switch (tier) {
      case 'elite':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-bold">
            <Sparkles className="w-3 h-3" />
            <span>Elite (A+)</span>
          </Badge>
        );
      case 'optimal':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] gap-1 font-bold">
            <Award className="w-3 h-3" />
            <span>Optimal (A)</span>
          </Badge>
        );
      case 'standard':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
            Standard (B)
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>Review (C/D)</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 p-5 rounded-2xl border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Fuel className="w-6 h-6 text-primary" />
            {t(
              'ذكاء الأعمال المتقدم لاستهلاك الوقود والقيادة الاقتصادية',
              'Intelligence Carburant & Télématique Éco-Conduite',
              'Inteligencia de Combustible y Telemática Eco-Conducción'
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'مؤشرات الأداء الميداني L/100km، تكلفة الكيلومتر (CPK)، ومقارنة الممرات الأوروبية والصحراوية',
              'Analyse de la consommation L/100km, CPK, et benchmarks des corridors Sahara & UE',
              'Análisis de consumo L/100km, CPK, y benchmarks de corredores Sahara y UE'
            )}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading || isPending}
          className="h-9 gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث البيانات', 'Actualiser', 'Actualizar')}</span>
        </Button>
      </div>

      {/* Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Fleet Average Consumption */}
        <Card className="rounded-2xl border bg-card/70 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('متوسط استهلاك الأسطول', 'Consommation Moyenne', 'Consumo Medio')}
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                <Gauge className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground flex items-baseline gap-1">
              <span>{summary?.averageFleetLPer100Km || '—'}</span>
              <span className="text-xs font-medium text-muted-foreground">L / 100km</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('المعدل المعياري:', 'Norme :', 'Norma:')} 33.5 L</span>
              {(summary?.averageFleetLPer100Km || 0) <= 33.5 ? (
                <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                  <TrendingDown className="w-3 h-3" />
                  {t('اقتصادي', 'Optimal', 'Óptimo')}
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-0.5 font-bold">
                  <TrendingUp className="w-3 h-3" />
                  {t('استهلاك مرتفع', 'Élevé', 'Elevado')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Fuel Cost Per Kilometer (CPK) */}
        <Card className="rounded-2xl border bg-card/70 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('تكلفة الكيلومتر من الوقود (CPK)', 'Coût au Km (CPK Carburant)', 'Coste por Km (CPK)')}
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground flex items-baseline gap-1">
              <span>{summary?.averageFleetCpkMad || '—'}</span>
              <span className="text-xs font-medium text-muted-foreground">MAD / km</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>
                {t(
                  `إجمالي: ${summary?.totalFuelConsumedLiters.toLocaleString()} لتر`,
                  `Total: ${summary?.totalFuelConsumedLiters.toLocaleString()} L`,
                  `Total: ${summary?.totalFuelConsumedLiters.toLocaleString()} L`
                )}
              </span>
              <span className="font-mono text-[10px]">
                {formatCurrency(summary?.totalFuelCostMad || 0, 'MAD')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Fleet Eco-Driving Score */}
        <Card className="rounded-2xl border bg-card/70 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('مؤشر القيادة الاقتصادية للأسطول', 'Score Éco-Conduite', 'Score Eco-Conducción')}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground flex items-baseline gap-1">
              <span>{summary?.averageEcoScore || 0}</span>
              <span className="text-xs font-medium text-muted-foreground">/ 100</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('أفضل سائق:', 'Meilleur conducteur :', 'Mejor chofer:')}</span>
              <span className="font-bold text-foreground truncate max-w-[120px]">
                {summary?.driverRankings?.[0]?.driverName || '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Theft Loss Prevented */}
        <Card className="rounded-2xl border bg-card/70 shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('قيمة الهدر والشفط المرصود', 'Pertes par Vol Détectées', 'Pérdidas por Robo')}
              </span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-foreground">
              {formatCurrency(summary?.preventedTheftLossMad || 0, 'MAD')}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{t('حوادث الشفط المرصودة', 'Incidents détectés', 'Incidentes')}</span>
              <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-500/20 bg-rose-500/5">
                {summary?.geoClusters.filter((c) => c.type === 'theft_hotspot').length || 0} {t('بؤرة', 'foyers', 'focos')}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Leaderboard & Corridors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Eco-Driving Leaderboard */}
        <Card className="lg:col-span-2 rounded-2xl border bg-card">
          <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>
                  {t(
                    'لوحة تصنيف السائقين والقيادة الاقتصادية (Eco-Driving Leaderboard)',
                    'Classement des Conducteurs & Éco-Conduite',
                    'Clasificación de Choferes y Eco-Conducción'
                  )}
                </span>
              </CardTitle>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('بحث عن سائق...', 'Rechercher...', 'Buscar...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 ps-8 pe-2 text-xs rounded-lg border bg-background text-foreground w-36 sm:w-44"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border bg-background text-foreground"
              >
                <option value="all">{t('كافة الفئات', 'Toutes catégories', 'Todas')}</option>
                <option value="elite">Elite (A+)</option>
                <option value="optimal">Optimal (A)</option>
                <option value="standard">Standard (B)</option>
                <option value="under_review">{t('قيد المراجعة', 'Sous revue', 'Revisión')}</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-muted/40 text-muted-foreground border-b font-medium">
                  <tr>
                    <th className="py-2.5 px-3 text-start">#</th>
                    <th className="py-2.5 px-3 text-start">{t('السائق', 'Conducteur', 'Chofer')}</th>
                    <th className="py-2.5 px-3 text-start">{t('التقييم', 'Score', 'Puntuación')}</th>
                    <th className="py-2.5 px-3 text-start">{t('الفئة', 'Catégorie', 'Categoría')}</th>
                    <th className="py-2.5 px-3 text-start">{t('الاستهلاك', 'L/100km', 'L/100km')}</th>
                    <th className="py-2.5 px-3 text-start">{t('تكلفة CPK', 'CPK (MAD)', 'CPK (MAD)')}</th>
                    <th className="py-2.5 px-3 text-start">{t('سلوكيات القيادة', 'Télématique', 'Comportamiento')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDrivers.map((driver) => {
                    const isTop1 = driver.rank === 1;
                    const isTop2 = driver.rank === 2;
                    const isTop3 = driver.rank === 3;

                    return (
                      <tr key={driver.driverId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-bold font-mono">
                          {isTop1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center text-xs">
                              🥇
                            </span>
                          ) : isTop2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-300/40 text-slate-700 flex items-center justify-center text-xs">
                              🥈
                            </span>
                          ) : isTop3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700/20 text-amber-800 flex items-center justify-center text-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="text-muted-foreground ps-1.5">{driver.rank}</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{driver.driverName}</span>
                          </div>
                          {driver.driverMatricule && (
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              {driver.driverMatricule}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-sm text-foreground">
                              {driver.score}
                            </span>
                            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  driver.score >= 90
                                    ? 'bg-emerald-500'
                                    : driver.score >= 80
                                    ? 'bg-blue-500'
                                    : driver.score >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${driver.score}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">{getTierBadge(driver.tier)}</td>

                        <td className="py-3 px-3 font-mono font-medium">
                          {driver.actualLPer100Km} <span className="text-[10px] text-muted-foreground">L</span>
                        </td>

                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {driver.fuelCpkMad} <span className="text-[10px]">DH/km</span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 text-[10px]">
                            {driver.behaviors.overspeedCount > 0 ? (
                              <span className="bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded font-mono" title={t('تجاوز السرعة', 'Excès de vitesse', 'Exceso velocidad')}>
                                ⚡ {driver.behaviors.overspeedCount}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-mono">✓ 0</span>
                            )}

                            {driver.behaviors.hardAccelerationCount > 0 && (
                              <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-mono" title={t('تسارع عنيف', 'Accélération brusque', 'Aceleración')}>
                                🚀 {driver.behaviors.hardAccelerationCount}
                              </span>
                            )}

                            {driver.behaviors.hardBrakingCount > 0 && (
                              <span className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded font-mono" title={t('فرملة حادة', 'Freinage brusque', 'Frenada')}>
                                🛑 {driver.behaviors.hardBrakingCount}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Corridors Benchmark Variance */}
        <div className="space-y-6">
          <Card className="rounded-2xl border bg-card">
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                <span>
                  {t(
                    'مقارنة كفاءة الممرات الدولية (Corridor Benchmarks)',
                    'Benchmarks des Corridors',
                    'Benchmarks de Corredores'
                  )}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {summary?.corridorBenchmarks.map((corridor) => (
                <div key={corridor.corridorId} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">
                        {corridor.corridorName}
                      </h4>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {corridor.totalTrips} {t('رحلة معتمدة', 'voyages', 'viajes')} • {corridor.averageDistanceKm.toLocaleString()} km avg
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        corridor.status === 'optimal'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : corridor.status === 'acceptable'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                      }`}
                    >
                      {corridor.variancePct > 0 ? `+${corridor.variancePct}%` : `${corridor.variancePct}%`}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-muted-foreground">{t('الفعلي:', 'Actuel :', 'Actual:')} {corridor.actualLPer100Km} L</span>
                      <span className="text-muted-foreground">{t('المعياري:', 'Norme :', 'Norma:')} {corridor.baselineLPer100Km} L</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className={`h-full rounded-full ${
                          corridor.status === 'optimal'
                            ? 'bg-emerald-500'
                            : corridor.status === 'acceptable'
                            ? 'bg-blue-500'
                            : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (corridor.actualLPer100Km / 45) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Geo Fuel Clusters & Heatmap Threat Radar */}
      <Card className="rounded-2xl border bg-card">
        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              <span>
                {t(
                  'الخريطة الحرارية الميدانية: محطات التزود المعتمدة مقابل بؤر الشفط',
                  'Radar Géographique : Stations vs Foyers de Vol',
                  'Radar Geográfico: Estaciones vs Focos de Robo'
                )}
              </span>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t(
                'تتبع إحداثيات GPS لمحطات التعبئة والمواقع المشبوهة لسرقة الوقود عبر ممرات النقل',
                'Cartographie des points de ravitaillement et des zones à haut risque de siphonnage',
                'Mapeo de estaciones y zonas de alto riesgo de robo de combustible'
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setSelectedClusterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                selectedClusterType === 'all'
                  ? 'bg-background text-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('الكل', 'Tous', 'Todos')}
            </button>
            <button
              type="button"
              onClick={() => setSelectedClusterType('theft')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedClusterType === 'theft'
                  ? 'bg-rose-500 text-white font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>{t('بؤر الشفط', 'Foyers de Vol', 'Focos de Robo')}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedClusterType('station')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                selectedClusterType === 'station'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Fuel className="w-3 h-3" />
              <span>{t('محطات التزود', 'Stations', 'Estaciones')}</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredClusters.map((cluster) => {
              const isTheft = cluster.type === 'theft_hotspot';
              const mapsUrl = `https://www.google.com/maps?q=${cluster.latitude},${cluster.longitude}`;

              return (
                <div
                  key={cluster.id}
                  className={`p-3.5 rounded-2xl border transition-all hover:shadow-xs flex flex-col justify-between space-y-3 ${
                    isTheft
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          isTheft
                            ? 'bg-rose-500/15 text-rose-600'
                            : 'bg-blue-500/15 text-blue-600'
                        }`}
                      >
                        {isTheft ? <Flame className="w-4 h-4" /> : <Fuel className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-foreground leading-tight">
                          {cluster.name}
                        </h5>
                        {cluster.city && (
                          <span className="text-[10px] text-muted-foreground">
                            {cluster.city}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono shrink-0 ${
                        cluster.riskLevel === 'critical'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : cluster.riskLevel === 'high'
                          ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                          : cluster.riskLevel === 'medium'
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      }`}
                    >
                      {isTheft ? t('خطر أمني', 'Risque Élevé', 'Riesgo Alto') : t('محطة معتمدة', 'Agréée', 'Aprobada')}
                    </Badge>
                  </div>

                  <div className="bg-background/80 rounded-xl p-2.5 text-xs space-y-1 font-mono border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[10px]">
                        {isTheft ? t('الوقود المفقود:', 'Volume volé :', 'Combustible perdido:') : t('الكمية المعبأة:', 'Volume ravitaillé :', 'Cantidad:')}
                      </span>
                      <span className="font-bold text-foreground">
                        {cluster.totalVolumeLiters.toLocaleString()} L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-[10px]">
                        {t('الأثر المالي:', 'Impact financier :', 'Impacto financiero:')}
                      </span>
                      <span className={isTheft ? 'font-bold text-rose-600' : 'font-bold text-foreground'}>
                        {formatCurrency(cluster.financialImpactMad, 'MAD')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                    </span>

                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>{t('عرض في Maps', 'Google Maps', 'Ver en Maps')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

