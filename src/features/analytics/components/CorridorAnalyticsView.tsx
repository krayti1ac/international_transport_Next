'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import type { CorridorAnalyticsResult, InternationalCorridor } from '../types/corridor.types';
import { getCorridorAnalyticsAction } from '../services/corridor-analytics.actions';
import {
  Ship,
  Truck,
  Fuel,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Compass,
  Download,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Gauge,
  Calendar,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

interface CorridorAnalyticsViewProps {
  initialData: CorridorAnalyticsResult;
}

export function CorridorAnalyticsView({ initialData }: CorridorAnalyticsViewProps) {
  const { t, dir } = useLanguage();
  const [data, setData] = useState<CorridorAnalyticsResult>(initialData);
  const [selectedCorridor, setSelectedCorridor] = useState<'all' | 'european_maritime' | 'african_overland'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = () => {
    startTransition(async () => {
      const res = await getCorridorAnalyticsAction({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        corridor: selectedCorridor,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'CMR Number',
      'Departure Date',
      'Corridor',
      'Route',
      'Truck',
      'Driver',
      'Revenue (MAD)',
      'Direct Expenses (MAD)',
      'Net Profit (MAD)',
      'Margin (%)',
      'Road Distance (km)',
      'Fuel Liters',
      'Rate (L/100km)',
    ];

    const rows = filteredTrips.map((tr) => [
      tr.cmrNumber,
      tr.departureDate,
      tr.corridor,
      `"${tr.route}"`,
      tr.truckPlate,
      `"${tr.driverName}"`,
      tr.revenue,
      tr.directExpenses,
      tr.netProfit,
      `${tr.profitMarginPercent}%`,
      tr.roadDistanceKm,
      tr.fuelLiters,
      tr.fuelConsumptionRate,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `corridor-analytics-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTrips = data.trips.filter((tr) => {
    const matchesCorridor =
      selectedCorridor === 'all' || tr.corridor === selectedCorridor;
    const matchesSearch =
      tr.cmrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.truckPlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tr.driverName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCorridor && matchesSearch;
  });

  const euro = data.europeanMaritime;
  const afr = data.africanOverland;

  return (
    <div className="space-y-6 pb-16" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-amiri text-foreground">
                {t(
                  'تحليلات الربحية ومقارنة الممرين وكفاءة الوقود',
                  'P&L des Corridors & Télématique Carburant'
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'الممر الأوروبي البحري (طنجة المتوسط) مقابل الممر الإفريقي البري (الكركارات ➔ دكار) بدقة Decimal.js',
                  'Comparaison Maritime Europe vs Terrestre Afrique avec précision financière stricte'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {t('تصدير Excel / CSV', 'Exporter CSV')}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="bg-card/60 backdrop-blur-xs border-border/70">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t('الممر اللوجستي', 'Corridor')}
              </label>
              <select
                value={selectedCorridor}
                onChange={(e) => setSelectedCorridor(e.target.value as 'all' | 'european_maritime' | 'african_overland')}
                className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="all">{t('جميع الممرات', 'Tous les corridors')}</option>
                <option value="european_maritime">
                  {t('الممر الأوروبي البحري (طنجة/إسبانيا)', 'Maritime Europe (Tanger/Espagne)')}
                </option>
                <option value="african_overland">
                  {t('الممر الإفريقي البري (الكركارات/دكار)', 'Terrestre Afrique (Guerguerat/Dakar)')}
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t('من تاريخ', 'Date Début')}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t('إلى تاريخ', 'Date Fin')}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t('بحث سريع', 'Recherche')}
              </label>
              <Input
                type="text"
                placeholder={t('رقم CMR، الشاحنة، السائق...', 'N° CMR, plaque, chauffeur...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div>
              <Button
                onClick={handleApplyFilter}
                disabled={isPending}
                className="w-full text-xs h-9 flex items-center justify-center gap-1.5"
              >
                <Filter className="w-3.5 h-3.5" />
                {isPending ? t('جاري التحديث...', 'Filtrage...') : t('تطبيق الفلتر', 'Appliquer')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. Bento KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card to-card/50 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('إجمالي إيرادات النولون', 'Chiffre d\'Affaires Global')}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data.overall.totalRevenue.toLocaleString()} {data.overall.currency}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>{data.overall.totalTrips} {t('مأموريات منجزة', 'missions réalisées')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Direct Expenses */}
        <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card to-card/50 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('إجمالي التكاليف المباشرة', 'Charges Directes Totales')}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data.overall.totalExpenses.toLocaleString()} {data.overall.currency}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {t('وقود، موانئ، عبارات، ورسوم جمركية', 'Carburant, ports, traversées & douanes')}
            </div>
          </CardContent>
        </Card>

        {/* Net Operating Profit */}
        <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card to-card/50 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('صافي الربح التشغيلي', 'Bénéfice Net d\'Exploitation')}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {data.overall.netProfit.toLocaleString()} {data.overall.currency}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {data.overall.profitMarginPercent.toFixed(2)}%
              </span>
              <span>{t('هامش الربح الإجمالي', 'Marge nette globale')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Fuel Burn Efficiency */}
        <Card className="border-border/80 relative overflow-hidden bg-gradient-to-br from-card to-card/50 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {t('متوسط استهلاك الوقود', 'Conso Moyenne Flotte')}
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Fuel className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-foreground">
              {data.overall.averageConsumptionL100km.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">L/100km</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {data.overall.totalFuelLiters.toLocaleString()} {t('لتر محروقات مستهلكة', 'litres consommés')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Side-by-Side Corridor Comparison Matrix */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                {t(
                  'مصفوفة مقارنة الأداء بين الممرين (P&L Matrix)',
                  'Matrice Comparative des Deux Corridors'
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'تحليل الهوامش، العوائد لكل كيلومتر، وهيكل المصروفات التشغيلية المباشرة',
                  'Structure des coûts, rendement kilométrique et rentabilité relative'
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* European Maritime Corridor Card */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {t('الممر الأوروبي البحري', 'Corridor Maritime Européen')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {t('طنجة المتوسط ➔ الجزيرة الخضراء / ألميريا', 'Tanger Med ➔ Algeciras / Almería')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400 text-xs">
                  {euro.totalTrips} {t('رحلات', 'trips')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('الإيرادات', 'Chiffre d\'Affaires')}</span>
                  <span className="font-bold font-mono text-sm text-foreground">{euro.totalRevenue.toLocaleString()} MAD</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('المصاريف المباشرة', 'Charges Directes')}</span>
                  <span className="font-bold font-mono text-sm text-rose-500">{euro.totalDirectExpenses.toLocaleString()} MAD</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('صافي الربح', 'Bénéfice Net')}</span>
                  <span className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {euro.netProfit.toLocaleString()} MAD
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('هامش الربحية', 'Marge Nette')}</span>
                  <span className="font-bold font-mono text-sm text-primary">
                    {euro.profitMarginPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Progress visual */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{t('هامش الربح التشغيلي', 'Marge nette')}</span>
                  <span className="font-bold">{euro.profitMarginPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(euro.profitMarginPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Cost breakdown breakdown */}
              <div className="pt-2 border-t border-blue-500/20 text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t('تذاكر الباخرة وموانئ ألميريا:', 'Traversées & ports :')}</span>
                  <span className="font-mono text-foreground font-medium">{euro.ferryOrTransitCost.toLocaleString()} MAD</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('تكلفة الوقود:', 'Carburant :')}</span>
                  <span className="font-mono text-foreground font-medium">{euro.totalFuelCost.toLocaleString()} MAD</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('العائد المالي لكل كيلومتر:', 'Rendement au km :')}</span>
                  <span className="font-mono text-emerald-600 font-medium">{euro.revenuePerKm.toFixed(2)} MAD/km</span>
                </div>
              </div>
            </div>

            {/* African Overland Corridor Card */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {t('الممر الإفريقي البري', 'Corridor Terrestre Africain')}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {t('الكركارات ➔ موريتانيا ➔ السنغال (دكار)', 'Guerguerat ➔ Mauritanie ➔ Sénégal')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 dark:text-emerald-400 text-xs">
                  {afr.totalTrips} {t('رحلات', 'trips')}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('الإيرادات', 'Chiffre d\'Affaires')}</span>
                  <span className="font-bold font-mono text-sm text-foreground">{afr.totalRevenue.toLocaleString()} MAD</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('المصاريف المباشرة', 'Charges Directes')}</span>
                  <span className="font-bold font-mono text-sm text-rose-500">{afr.totalDirectExpenses.toLocaleString()} MAD</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('صافي الربح', 'Bénéfice Net')}</span>
                  <span className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                    {afr.netProfit.toLocaleString()} MAD
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-muted-foreground block text-[10px]">{t('هامش الربحية', 'Marge Nette')}</span>
                  <span className="font-bold font-mono text-sm text-primary">
                    {afr.profitMarginPercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Progress visual */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{t('هامش الربح التشغيلي', 'Marge nette')}</span>
                  <span className="font-bold">{afr.profitMarginPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(afr.profitMarginPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Cost breakdown breakdown */}
              <div className="pt-2 border-t border-emerald-500/20 text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t('جمارك الكركارات وروصو والبطاقة:', 'Douanes & passages fluviaux :')}</span>
                  <span className="font-mono text-foreground font-medium">
                    {(afr.customsCost + afr.ferryOrTransitCost + afr.otherExpenses).toLocaleString()} MAD
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('تكلفة الوقود المباشرة:', 'Carburant :')}</span>
                  <span className="font-mono text-foreground font-medium">{afr.totalFuelCost.toLocaleString()} MAD</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('العائد المالي لكل كيلومتر:', 'Rendement au km :')}</span>
                  <span className="font-mono text-emerald-600 font-medium">{afr.revenuePerKm.toFixed(2)} MAD/km</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Fuel BI & Telematics Anomaly Radar */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">
                  {t('رادار كفاءة الوقود ورصد الشذوذ والاحتيال', 'Radar d\'Efficacité Carburant & Détection des Anomalies')}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(
                    'معدل الحرق الفعلي (L/100km)، مطابقة الفواتير، ورصد الشاحنات ذات الاستهلاك المشبوه (>38 L/100km)',
                    'Consommation réelle, écarts par camion et alertes de surconsommation (>38 L/100km)'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                &lt; 32 {t('كفء', 'Économique')}
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                32-36 {t('معياري', 'Normal')}
              </Badge>
              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px]">
                &gt; 38 {t('مرتفع / تدقيق', 'Risque élevé')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 font-semibold text-start">{t('الشاحنة والموديل', 'Camion & Modèle')}</th>
                  <th className="p-3 font-semibold text-start">{t('السائق', 'Chauffeur')}</th>
                  <th className="p-3 font-semibold text-start">{t('الممر', 'Corridor')}</th>
                  <th className="p-3 font-semibold text-center">{t('المسافة المقطوعة', 'Distance Km')}</th>
                  <th className="p-3 font-semibold text-center">{t('لترات الوقود', 'Litres')}</th>
                  <th className="p-3 font-semibold text-center">{t('المعدل الفعلي', 'Taux Réel')}</th>
                  <th className="p-3 font-semibold text-center">{t('الفارق عن المعيار', 'Écart')}</th>
                  <th className="p-3 font-semibold text-center">{t('حالة التدقيق', 'Statut')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.fuelAnomalies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      {t('لا توجد شاحنات مسجلة في هذا النطاق', 'Aucun enregistrement disponible')}
                    </td>
                  </tr>
                ) : (
                  data.fuelAnomalies.map((tr) => {
                    const isHigh = tr.status === 'high_risk';
                    const isEff = tr.status === 'efficient';
                    return (
                      <tr
                        key={tr.truckId}
                        className={`hover:bg-muted/30 transition-colors ${
                          isHigh ? 'bg-rose-500/5' : ''
                        }`}
                      >
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            <MatriculeBadge plate={tr.plateNumber} size="sm" />
                            <span className="text-[11px] text-muted-foreground">{tr.model}</span>
                          </div>
                        </td>
                        <td className="p-3 text-foreground font-medium">{tr.driverName}</td>
                        <td className="p-3">
                          <span className="text-[11px] text-muted-foreground">
                            {tr.corridor === 'european_maritime'
                              ? t('أوروبي بحري', 'Maritime Europe')
                              : t('إفريقي بري', 'Terrestre Afrique')}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{tr.totalRoadKm.toLocaleString()} km</td>
                        <td className="p-3 text-center font-mono">{tr.totalFuelLiters.toLocaleString()} L</td>
                        <td className="p-3 text-center font-mono font-bold">
                          <span
                            className={
                              isHigh
                                ? 'text-rose-600 dark:text-rose-400'
                                : isEff
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-foreground'
                            }
                          >
                            {tr.actualConsumptionRate.toFixed(1)} L/100km
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-[11px]">
                          <span className={tr.differenceL100km > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                            {tr.differenceL100km > 0 ? `+${tr.differenceL100km.toFixed(1)}` : tr.differenceL100km.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {isHigh ? (
                            <Badge variant="destructive" className="text-[10px] gap-1 py-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              {t('شذوذ / تسريب محتمل', 'Anomalie / Surconso')}
                            </Badge>
                          ) : isEff ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1 py-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('اقتصادي ممتاز', 'Éco-Performant')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0.5">
                              {t('معياري طبيعي', 'Conforme')}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Detailed Corridor Trips Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold">
                {t('سجل مأموريات الشحن الدولي والربحية التفصيلية', 'Détail des Missions & Rentabilité')}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  'قائمة الرحلات المكتملة مع تفصيل الإيرادات والتكاليف المباشرة وصافي الربح لكل مأمورية',
                  'Liste des voyages clôturés avec P&L complet par trajet'
                )}
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredTrips.length} {t('مأمورية مطابقة', 'voyages')}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 font-semibold text-start">{t('المعرف و CMR', 'ID & CMR')}</th>
                  <th className="p-3 font-semibold text-start">{t('التاريخ', 'Date')}</th>
                  <th className="p-3 font-semibold text-start">{t('المسار والممر', 'Trajet & Corridor')}</th>
                  <th className="p-3 font-semibold text-start">{t('الشاحنة والسائق', 'Camion & Chauffeur')}</th>
                  <th className="p-3 font-semibold text-end">{t('الإيراد', 'Revenu')}</th>
                  <th className="p-3 font-semibold text-end">{t('المصاريف', 'Charges')}</th>
                  <th className="p-3 font-semibold text-end">{t('صافي الربح', 'Bénéfice')}</th>
                  <th className="p-3 font-semibold text-center">{t('الهامش', 'Marge')}</th>
                  <th className="p-3 font-semibold text-center">{t('الإجراء', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      {t('لا توجد مأموريات مطابقة لمعايير البحث', 'Aucune mission trouvée')}
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((tr) => (
                    <tr key={tr.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">
                        <div className="font-mono text-foreground font-bold">#{tr.id}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{tr.cmrNumber}</div>
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{tr.departureDate}</td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{tr.route}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {tr.corridor === 'european_maritime'
                            ? t('الممر الأوروبي البحري', 'Maritime Europe')
                            : t('الممر الإفريقي البري', 'Terrestre Afrique')}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <MatriculeBadge plate={tr.truckPlate} size="sm" />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{tr.driverName}</div>
                      </td>
                      <td className="p-3 text-end font-mono font-medium text-foreground">
                        {tr.revenue.toLocaleString()} {tr.currency}
                      </td>
                      <td className="p-3 text-end font-mono text-rose-500">
                        {tr.directExpenses.toLocaleString()} {tr.currency}
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {tr.netProfit.toLocaleString()} {tr.currency}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            tr.profitMarginPercent >= 40
                              ? 'border-emerald-500 text-emerald-600'
                              : 'border-blue-500 text-blue-600'
                          }`}
                        >
                          {tr.profitMarginPercent.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          href={`/trips/${tr.id}`}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-muted text-primary transition-colors"
                          title={t('عرض تفاصيل المأمورية', 'Voir détails')}
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
