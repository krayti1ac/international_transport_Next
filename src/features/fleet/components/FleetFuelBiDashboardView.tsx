'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Fuel,
  Gauge,
  Snowflake,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  MapPin,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Coins,
  Award,
  AlertTriangle,
  Clock,
  FileSearch,
} from 'lucide-react';
import {
  getFleetFuelBiDashboardAction,
  resolveFuelBiAnomalyAlertAction,
} from '../services/fleet-fuel-bi.actions';
import type {
  FleetFuelBiDashboardData,
  FuelBiAnomalyAlert,
  FuelEfficiencyGrade,
} from '../types/fleet-fuel-bi.types';

export function FleetFuelBiDashboardView() {
  const tBi = useTranslations('fleetFuelBi');
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [corridorFilter, setCorridorFilter] = useState<
    'ALL' | 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA'
  >('ALL');
  const [onlyReefer, setOnlyReefer] = useState(false);
  const [data, setData] = useState<FleetFuelBiDashboardData | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFleetFuelBiDashboardAction({
        corridorCode: corridorFilter,
        onlyReeferTrips: onlyReefer,
      });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({
          title: t('خطأ في التحميل', 'Erreur de chargement', 'Error de carga'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [corridorFilter, onlyReefer, toast, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleResolveAnomaly = async (
    alert: FuelBiAnomalyAlert,
    resolution: 'verified_legitimate' | 'confirmed_fraud'
  ) => {
    setResolvingId(alert.id);
    try {
      const res = await resolveFuelBiAnomalyAlertAction({
        alertId: alert.id,
        resolution,
      });
      if (res.success) {
        toast({
          title:
            resolution === 'verified_legitimate'
              ? t(
                  'تم اعتماد إيصال الوقود كعملية شرعية',
                  'Reçu de carburant validé comme légitime',
                  'Recibo de combustible validado como legítimo'
                )
              : t(
                  'تم تأكيد مخالفة الوقود وتوثيقها في سجل التدقيق',
                  'Anomalie carburant confirmée et auditée',
                  'Fraude de combustible confirmado y auditado'
                ),
          description: `${alert.plateNumber} — ${alert.stationName}`,
        });
        await loadDashboard();
      }
    } finally {
      setResolvingId(null);
    }
  };

  const renderGradeBadge = (grade: FuelEfficiencyGrade, score: number) => {
    switch (grade) {
      case 'A+':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-mono text-xs">
            A+ ({score})
          </Badge>
        );
      case 'A':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-mono text-xs">
            A ({score})
          </Badge>
        );
      case 'B':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono text-xs">
            B ({score})
          </Badge>
        );
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-mono text-xs">
            {grade} ({score})
          </Badge>
        );
    }
  };

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        {t(
          'جاري تحليل بيانات CAN-Bus ومطابقة إيصالات المحطات جغرافياً...',
          'Analyse des données CAN-Bus et rapprochement GPS des reçus...',
          'Analizando datos CAN-Bus y conciliando recibos por GPS...'
        )}
      </div>
    );
  }

  if (!data) return null;

  const netSavNum = Number(data.netFuelSavingsOrWasteMad);
  const isNetSaving = netSavNum >= 0;

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Filter & Action Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card/60 border border-border p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Fuel className="w-5 h-5 text-primary" />
            <span>{tBi('title')}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{tBi('subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={corridorFilter}
            onChange={(e) =>
              setCorridorFilter(
                e.target.value as 'ALL' | 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA'
              )
            }
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">{tBi('filterCorridorAll')}</option>
            <option value="MA-ES-FR">{tBi('filterCorridorEu')}</option>
            <option value="MA-MR-SN">{tBi('filterCorridorAf')}</option>
            <option value="DOMESTIC-MA">{tBi('filterCorridorMa')}</option>
          </select>

          <Button
            type="button"
            variant={onlyReefer ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyReefer((prev) => !prev)}
            className="h-9 rounded-xl text-xs gap-1.5"
          >
            <Snowflake className="w-3.5 h-3.5" />
            <span>{tBi('filterReeferOnly')}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="h-9 rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{tBi('refreshBtn')}</span>
          </Button>
        </div>
      </div>

      {/* 4 Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fuel + Tractor vs Reefer Split */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {tBi('bentoTotalFuel')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Fuel className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground" dir="ltr">
              {data.totalFuelLiters} L
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
              <Badge variant="outline" className="text-[10px] font-mono">
                {tBi('bentoTractorVsReefer', {
                  tractor: data.totalTractorLiters,
                  reefer: data.totalReeferLiters,
                })}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Cost Per Kilometer (CPK MAD & EUR) */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{tBi('bentoCpk')}</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Gauge className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground" dir="ltr">
              {data.fleetAverageCpkMad} MAD/km
            </div>
            <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">
              ≈ {data.fleetAverageCpkEur} EUR/km • {data.fleetActualTractorLPer100Km} L/100km
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Net Financial Savings or Waste */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {tBi('bentoNetSavings')}
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isNetSaving
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-rose-500/10 text-rose-600'
                }`}
              >
                {isNetSaving ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
              </div>
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                isNetSaving ? 'text-emerald-600' : 'text-rose-600'
              }`}
              dir="ltr"
            >
              {isNetSaving ? '+' : ''}
              {data.netFuelSavingsOrWasteMad} MAD
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isNetSaving ? tBi('bentoSavingsPositive') : tBi('bentoSavingsNegative')} (
              <span className="font-mono" dir="ltr">
                {data.fleetBaselineLPer100Km} L/100km
              </span>
              )
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Geo-Anomaly & OCR Forensic Radar */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {tBi('bentoGeoRadar')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600" dir="ltr">
              {data.preventedFraudLossMad} MAD
            </div>
            <div className="text-[11px] text-muted-foreground">
              {tBi('bentoGeoSub', {
                geo: data.geoMismatchAlertsCount,
                ocr: data.pendingManualReviewCount,
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Currency Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* BarChart: Baseline vs Actual Tractor L/100km per Corridor */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="py-3.5 px-5 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span>{tBi('chartCorridorTitle')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.corridorChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="corridorCode" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 42]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="baselineLPer100Km"
                    name={tBi('chartBaselineLegend')}
                    fill="#64748b"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="actualTractorLPer100Km"
                    name={tBi('chartActualLegend')}
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Corridor Reefer Burn Sub-Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/60">
              {data.corridorChartData.map((corr) => (
                <div
                  key={corr.corridorCode}
                  className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="font-mono">{corr.corridorCode}</span>
                    <Badge variant="outline" className="text-[10px] font-mono" dir="ltr">
                      <Snowflake className="w-3 h-3 me-1 text-sky-500" />
                      {corr.reeferAvgLPerHour} L/h
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex justify-between" dir="ltr">
                    <span>Tractor: {corr.totalTractorLiters}L</span>
                    <span>Reefer: {corr.totalReeferLiters}L</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Currency Fuel Cost Breakdown (MAD / EUR) */}
        <Card className="border-border">
          <CardHeader className="py-3.5 px-5 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>{tBi('currencyCardTitle')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* MAD Share */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{tBi('madFuelLabel')}</span>
                <span className="font-mono font-bold text-emerald-600" dir="ltr">
                  {data.currencyBreakdown.madSharePct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.min(100, Number(data.currencyBreakdown.madSharePct))}%` }}
                />
              </div>
              <div
                className="flex items-center justify-between text-[11px] text-muted-foreground font-mono"
                dir="ltr"
              >
                <span>{data.currencyBreakdown.madTotalLiters} L</span>
                <span>{data.currencyBreakdown.madTotalCost} MAD</span>
              </div>
            </div>

            {/* EUR Share */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{tBi('eurFuelLabel')}</span>
                <span className="font-mono font-bold text-blue-600" dir="ltr">
                  {data.currencyBreakdown.eurSharePct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, Number(data.currencyBreakdown.eurSharePct))}%` }}
                />
              </div>
              <div
                className="flex items-center justify-between text-[11px] text-muted-foreground font-mono"
                dir="ltr"
              >
                <span>{data.currencyBreakdown.eurTotalLiters} L</span>
                <span>
                  {data.currencyBreakdown.eurTotalCostInEur} EUR (
                  {data.currencyBreakdown.eurTotalCostInMad} MAD)
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-border/70 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {t('الإجمالي الموحد بالدرهم', 'Total Consolidé MAD', 'Total Consolidado MAD')}
              </span>
              <span className="text-base font-bold font-mono text-foreground" dir="ltr">
                {data.currencyBreakdown.combinedTotalCostMad} MAD
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fleet Efficiency Leaderboard Table */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <span>{tBi('leaderboardTitle')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                  <th className="py-3 px-4 text-start font-semibold">{tBi('colRank')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{tBi('colTruckDriver')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{tBi('colCorridor')}</th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {tBi('colTractorReeferSplit')}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">
                    {tBi('colBaselineVsActual')}
                  </th>
                  <th className="py-3 px-4 text-start font-semibold">{tBi('colCpk')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{tBi('colSavingsWaste')}</th>
                  <th className="py-3 px-4 text-end font-semibold">{tBi('colGrade')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.leaderboard.map((row) => {
                  const rowSavNum = Number(row.financialSavingsOrWasteMad);
                  const isRowPositive = rowSavNum >= 0;
                  return (
                    <tr key={`${row.truckId}-${row.driverId}`} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono font-bold text-sm">#{row.rank}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MatriculeBadge plate={row.plateNumber} variant="badge" size="sm" />
                            <span className="font-semibold text-foreground">{row.driverName}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {row.truckModel} • {row.odometerDistanceKm} km
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {row.corridorCode}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono" dir="ltr">
                        <div className="text-foreground font-semibold">
                          Tractor: {row.fuelSplit.tractorLiters} L ({row.fuelSplit.tractorSharePct}
                          %)
                        </div>
                        {row.isReeferTrip ? (
                          <div className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1">
                            <Snowflake className="w-3 h-3" />
                            <span>
                              Reefer ({row.reeferBrand === 'carrier_transicold' ? 'Carrier' : 'TK'}
                              ): {row.fuelSplit.reeferLiters} L ({row.fuelSplit.reeferBurnRateLPerHour}{' '}
                              L/h)
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">Dry / Curtainsider</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono" dir="ltr">
                        <div className="font-bold text-foreground">
                          {row.actualTractorLPer100Km} L/100km
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Norm: {row.baselineLPer100Km} ({Number(row.variancePct) > 0 ? '+' : ''}
                          {row.variancePct}%)
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono" dir="ltr">
                        <div className="font-semibold">{row.costPerKmMad} MAD/km</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.costPerKmEur} EUR/km
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono" dir="ltr">
                        <span
                          className={`font-bold ${
                            isRowPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isRowPositive ? '+' : ''}
                          {row.financialSavingsOrWasteMad} MAD
                        </span>
                      </td>
                      <td className="py-3 px-4 text-end">
                        {renderGradeBadge(row.grade, row.efficiencyScore)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Forensic OCR vs GPS & CAN-Bus Anomaly Alerts Radar */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3.5 px-5 border-b border-border">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>{tBi('anomalyRadarTitle')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data.anomalyAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <MatriculeBadge plate={alert.plateNumber} variant="badge" size="sm" />
                  <span className="font-bold text-xs text-foreground">{alert.driverName}</span>
                  <Badge
                    className={
                      alert.severity === 'critical'
                        ? 'bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]'
                        : 'bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]'
                    }
                  >
                    {alert.anomalyType} • {alert.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    <FileSearch className="w-3 h-3 me-1" />
                    OCR: {alert.ocrConfidenceScore}%
                  </Badge>
                </div>

                <p className="text-xs text-foreground font-medium">{alert.reasonSummary}</p>

                <div
                  className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground font-mono"
                  dir="ltr"
                >
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    GPS Δ: {alert.gpsDistanceDeviationKm} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Time Δ: {alert.timeDeviationMinutes} min
                  </span>
                  <span>
                    OCR Claimed: {alert.claimedLiters}L vs CAN-Bus: {alert.telematicsObservedLiters}
                    L (Δ {alert.discrepancyLiters}L)
                  </span>
                  <span className="font-bold text-rose-600">
                    Impact: {alert.financialImpactMad} MAD
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {alert.status === 'pending_review' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolvingId === alert.id}
                      onClick={() => handleResolveAnomaly(alert, 'verified_legitimate')}
                      className="h-8 rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{tBi('approveReceiptBtn')}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolvingId === alert.id}
                      onClick={() => handleResolveAnomaly(alert, 'confirmed_fraud')}
                      className="h-8 rounded-xl text-xs gap-1.5 border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{tBi('confirmFraudBtn')}</span>
                    </Button>
                  </>
                ) : (
                  <Badge
                    className={
                      alert.status === 'verified_legitimate'
                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs'
                        : 'bg-rose-500/15 text-rose-600 border-rose-500/30 text-xs'
                    }
                  >
                    {alert.status === 'verified_legitimate' ? (
                      <ShieldCheck className="w-3.5 h-3.5 me-1" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 me-1" />
                    )}
                    {alert.status === 'verified_legitimate'
                      ? tBi('statusVerified')
                      : tBi('statusFraud')}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

