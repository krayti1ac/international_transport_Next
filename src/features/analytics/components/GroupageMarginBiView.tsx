'use client';

/**
 * TransSalges TMS — Groupage LTL vs. FTL Margin BI Executive View
 * Standards: 13.60 LDM standard semi-trailer, Cost Per Kilometer (CPK),
 * European Maritime Corridor & African Overland Corridor Analysis.
 * Financial Precision: Strictly rendered with Decimal.js calculations.
 */

import { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import type {
  GroupageMarginBiResult,
  CorridorGroupageVsFtlSummary,
} from '../types/groupage-margin-bi.types';
import { getGroupageMarginBiAction } from '../services/groupage-margin-bi.actions';
import {
  Layers,
  Truck,
  Scale,
  Fuel,
  Compass,
  Download,
  Filter,
  Lightbulb,
  ShieldCheck,
  Search,
  BarChart3,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface GroupageMarginBiViewProps {
  initialData: GroupageMarginBiResult;
}

export function GroupageMarginBiView({ initialData }: GroupageMarginBiViewProps) {
  const { t, dir, formatNumber, locale } = useLanguage();
  const [data, setData] = useState<GroupageMarginBiResult>(initialData);
  const [selectedCorridor, setSelectedCorridor] = useState<'all' | 'european_maritime' | 'african_overland'>('all');
  const [selectedMode, setSelectedMode] = useState<'all' | 'ltl_only' | 'ftl_only'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = () => {
    startTransition(async () => {
      const res = await getGroupageMarginBiAction({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        corridor: selectedCorridor,
        modeFilter: selectedMode,
      });
      if (res.success && res.data) {
        setData(res.data);
      }
    });
  };

  // Resolve current active summary based on corridor filter
  const activeSummary: CorridorGroupageVsFtlSummary = useMemo(() => {
    if (selectedCorridor === 'european_maritime') {
      return data.europeanMaritime;
    }
    if (selectedCorridor === 'african_overland') {
      return data.africanOverland;
    }
    return data.overall;
  }, [data, selectedCorridor]);

  // Filtered trips list by search query
  const filteredTrips = useMemo(() => {
    return data.trips.filter((trip) => {
      if (selectedMode === 'ltl_only' && trip.mode !== 'ltl') return false;
      if (selectedMode === 'ftl_only' && trip.mode !== 'ftl') return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        trip.cmrNumber.toLowerCase().includes(query) ||
        trip.route.toLowerCase().includes(query)
      );
    });
  }, [data.trips, selectedMode, searchQuery]);

  const handleExportCsv = () => {
    const headers = [
      t('رقم الـ CMR', 'N° CMR', 'Nº CMR'),
      t('المسار', 'Trajet', 'Ruta'),
      t('تاريخ الانطلاق', 'Date Départ', 'Fecha Salida'),
      t('الممر الدولي', 'Corridor', 'Corredor'),
      t('نمط الشحن', 'Mode de Chargement', 'Modo de Carga'),
      t('عدد الإرساليات', 'Nombre d’Envois', 'Núm. Envíos'),
      t('المتر الطولي LDM', 'Mètres Linéaires (LDM)', 'Metros Lineales (LDM)'),
      t('نسبة إشغال المقطورة (%)', 'Taux d’Occupation (%)', 'Tasa de Ocupación (%)'),
      t('المسافة (كم)', 'Distance (km)', 'Distancia (km)'),
      t('الإيراد (MAD)', 'Revenu (MAD)', 'Ingresos (MAD)'),
      t('التكلفة التشغيلية (MAD)', 'Coût Opérationnel (MAD)', 'Coste Operativo (MAD)'),
      t('صافي الربح (MAD)', 'Bénéfice Net (MAD)', 'Beneficio Neto (MAD)'),
      t('هامش الربح (%)', 'Marge Nette (%)', 'Margen Neto (%)'),
      t('عائد المتر الطولي (MAD/LDM)', 'Revenu par LDM (MAD/LDM)', 'Ingreso por LDM (MAD/LDM)'),
      t('تكلفة الكيلومتر CPK (MAD)', 'Coût au Km CPK (MAD)', 'Coste por Km CPK (MAD)'),
    ];

    const rows = filteredTrips.map((trip) => [
      trip.cmrNumber,
      `"${trip.route}"`,
      trip.departureDate,
      trip.corridor === 'european_maritime' ? 'European Maritime' : 'African Overland',
      trip.mode === 'ltl' ? 'Groupage (LTL)' : 'Full Truckload (FTL)',
      trip.consignmentsCount,
      trip.totalLdm.toFixed(2),
      `${trip.trailerUtilizationPct.toFixed(1)}%`,
      trip.totalDistanceKm,
      trip.revenueMad.toFixed(2),
      trip.operatingCostMad.toFixed(2),
      trip.netProfitMad.toFixed(2),
      `${trip.netMarginPct.toFixed(2)}%`,
      trip.revenuePerLdmMad.toFixed(2),
      trip.cpkMad.toFixed(2),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transsalges_groupage_margin_bi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Recharts Chart 1: LDM Revenue & Margin Comparison
  const chartLdmComparison = [
    {
      name: t('الأوروبي (LTL)', 'Europe (LTL)', 'Europa (LTL)'),
      revPerLdm: data.europeanMaritime.ltl.avgRevenuePerLdmMad,
      marginPerLdm: data.europeanMaritime.ltl.avgNetMarginPerLdmMad,
      netMarginPct: data.europeanMaritime.ltl.netMarginPct,
    },
    {
      name: t('الأوروبي (FTL)', 'Europe (FTL)', 'Europa (FTL)'),
      revPerLdm: data.europeanMaritime.ftl.avgRevenuePerLdmMad,
      marginPerLdm: data.europeanMaritime.ftl.avgNetMarginPerLdmMad,
      netMarginPct: data.europeanMaritime.ftl.netMarginPct,
    },
    {
      name: t('الإفريقي (LTL)', 'Afrique (LTL)', 'África (LTL)'),
      revPerLdm: data.africanOverland.ltl.avgRevenuePerLdmMad,
      marginPerLdm: data.africanOverland.ltl.avgNetMarginPerLdmMad,
      netMarginPct: data.africanOverland.ltl.netMarginPct,
    },
    {
      name: t('الإفريقي (FTL)', 'Afrique (FTL)', 'África (FTL)'),
      revPerLdm: data.africanOverland.ftl.avgRevenuePerLdmMad,
      marginPerLdm: data.africanOverland.ftl.avgNetMarginPerLdmMad,
      netMarginPct: data.africanOverland.ftl.netMarginPct,
    },
  ];

  // Recharts Chart 2: Cost Structure by Mode (MAD)
  const chartCostStructure = [
    {
      category: t('الوقود', 'Carburant', 'Combustible'),
      LTL: activeSummary.ltl.costBreakdown.fuelMad,
      FTL: activeSummary.ftl.costBreakdown.fuelMad,
    },
    {
      category: t('العبّارات والترانزيت', 'Ferry & Transit', 'Ferry y Tránsito'),
      LTL: activeSummary.ltl.costBreakdown.ferryMad,
      FTL: activeSummary.ftl.costBreakdown.ferryMad,
    },
    {
      category: t('رسوم الطرق', 'Péages / Vignettes', 'Peajes / Viñetas'),
      LTL: activeSummary.ltl.costBreakdown.tollsMad,
      FTL: activeSummary.ftl.costBreakdown.tollsMad,
    },
    {
      category: t('الجمارك والموانئ', 'Douane & Ports', 'Aduana y Puertos'),
      LTL: activeSummary.ltl.costBreakdown.customsMad,
      FTL: activeSummary.ftl.costBreakdown.customsMad,
    },
    {
      category: t('بدلات السائقين', 'Indemnités Chauffeurs', 'Dietas Conductores'),
      LTL: activeSummary.ltl.costBreakdown.driverMad,
      FTL: activeSummary.ftl.costBreakdown.driverMad,
    },
  ];

  const getLocalizedRecommendation = () => {
    if (locale === 'fr') return activeSummary.comparison.tacticalRecommendationFr;
    if (locale === 'es') return activeSummary.comparison.tacticalRecommendationEs;
    return activeSummary.comparison.tacticalRecommendationAr;
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {t(
                    'ذكاء ربحية الشحن التجميعي (LTL) مقابل الكامل (FTL)',
                    'BI Rentabilité Groupage (LTL) vs Lot Complet (FTL)',
                    'BI Rentabilidad Grupaje (LTL) vs Carga Completa (FTL)'
                  )}
                </h1>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-950/30 text-xs">
                  {t('محرك 13.60 LDM و CPK', 'Moteur 13.60 LDM & CPK', 'Motor 13.60 LDM y CPK')}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-slate-400">
                {t(
                  'مقارنة العائد الصافي للمتر الطولي (LDM) وتكلفة الكيلومتر (CPK) عبر الممرين الأوروبي والإفريقي بدقة Decimal.js',
                  'Comparaison du rendement au mètre linéaire (LDM) et coût au km (CPK) entre corridors européen et africain',
                  'Comparativa de rendimiento por metro lineal (LDM) y coste por km (CPK) entre corredores europeo y africano'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs gap-2"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            {t('تصدير التقرير (CSV)', 'Exporter CSV', 'Exportar CSV')}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Corridor Selector Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 me-2 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                {t('الممر:', 'Corridor:', 'Corredor:')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCorridor('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCorridor === 'all'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('كافة الممرات', 'Tous les Corridors', 'Todos los Corredores')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCorridor('european_maritime')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCorridor === 'european_maritime'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('الممر البحري الأوروبي', 'Corridor Maritime Européen', 'Corredor Marítimo Europeo')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedCorridor('african_overland')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCorridor === 'african_overland'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('الممر البري الإفريقي', 'Corridor Terrestre Africain', 'Corredor Terrestre Africano')}
              </button>
            </div>

            {/* Mode Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 me-2 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                {t('النمط:', 'Mode:', 'Modo:')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('كافة الأنماط', 'Tous les Modes', 'Todos los Modos')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('ltl_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMode === 'ltl_only'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('تجميعي (LTL)', 'Groupage (LTL)', 'Grupaje (LTL)')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('ftl_only')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedMode === 'ftl_only'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('كامل (FTL)', 'Complet (FTL)', 'Completo (FTL)')}
              </button>
            </div>

            {/* Date Pickers & Search */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-xs w-32 text-slate-200"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-xs w-32 text-slate-200"
              />
              <Button
                onClick={handleApplyFilter}
                disabled={isPending}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1"
              >
                <Filter className="w-3.5 h-3.5" />
                {t('تطبيق', 'Filtrer', 'Filtrar')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Margin Premium */}
        <Card className="bg-slate-900/70 border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400">
                {t('فارق هامش الربح الصافي (LTL vs FTL)', 'Différentiel Marge Nette (LTL vs FTL)', 'Diferencial Margen Neto (LTL vs FTL)')}
              </CardTitle>
              <span className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                <Percent className="w-4 h-4" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-white">
                {activeSummary.comparison.netMarginDifferencePct >= 0 ? '+' : ''}
                {activeSummary.comparison.netMarginDifferencePct}%
              </span>
              <Badge
                className={
                  activeSummary.comparison.winnerMode === 'ltl'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                    : 'bg-purple-950/60 text-purple-400 border-purple-500/30'
                }
              >
                {activeSummary.comparison.winnerMode === 'ltl'
                  ? t('LTL رابح', 'Avantage LTL', 'Ventaja LTL')
                  : t('FTL رابح', 'Avantage FTL', 'Ventaja FTL')}
              </Badge>
            </div>
            <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
              <span>{t('هامش LTL:', 'Marge LTL:', 'Margen LTL:')} <strong className="text-cyan-400">{activeSummary.ltl.netMarginPct}%</strong></span>
              <span>{t('هامش FTL:', 'Marge FTL:', 'Margen FTL:')} <strong className="text-purple-400">{activeSummary.ftl.netMarginPct}%</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Revenue per LDM */}
        <Card className="bg-slate-900/70 border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400">
                {t('عائد المتر الطولي (MAD / LDM)', 'Revenu par Mètre Linéaire (MAD / LDM)', 'Ingreso por Metro Lineal (MAD / LDM)')}
              </CardTitle>
              <span className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                <Layers className="w-4 h-4" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-white">
                {formatNumber(activeSummary.ltl.avgRevenuePerLdmMad)}
              </span>
              <span className="text-xs text-slate-400">MAD / LDM</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
              <span>{t('علاوة LDM:', 'Prime LDM:', 'Prima LDM:')} <strong className="text-emerald-400">+{activeSummary.comparison.revenuePerLdmPremiumPct}%</strong></span>
              <span>FTL: {formatNumber(activeSummary.ftl.avgRevenuePerLdmMad)} MAD</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Cost Per Kilometer (CPK) */}
        <Card className="bg-slate-900/70 border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400">
                {t('تكلفة الكيلومتر CPK (MAD / km)', 'Coût au Kilomètre CPK (MAD / km)', 'Coste por Kilómetro CPK (MAD / km)')}
              </CardTitle>
              <span className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400">
                <Fuel className="w-4 h-4" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-white">
                {formatNumber(activeSummary.ltl.avgCpkMad)}
              </span>
              <span className="text-xs text-slate-400">MAD / km</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
              <span>{t('فارق التكلفة:', 'Écart CPK:', 'Diferencia CPK:')} <strong className="text-indigo-400">{activeSummary.comparison.cpkDifferenceMad >= 0 ? '+' : ''}{activeSummary.comparison.cpkDifferenceMad} MAD</strong></span>
              <span>FTL: {formatNumber(activeSummary.ftl.avgCpkMad)} MAD</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Average Trailer Utilization */}
        <Card className="bg-slate-900/70 border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400">
                {t('متوسط إشغال مقطورة التجميع (LDM)', 'Occupation Moyenne Remorque LTL (LDM)', 'Ocupación Media Semirremolque LTL (LDM)')}
              </CardTitle>
              <span className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-400">
                <Truck className="w-4 h-4" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-white">
                {activeSummary.ltl.avgLdmPerTrip}
              </span>
              <span className="text-xs text-slate-400">/ 13.60 LDM ({activeSummary.ltl.avgTrailerUtilizationPct}%)</span>
            </div>
            <div className="text-xs text-slate-400 flex justify-between border-t border-slate-800/80 pt-2">
              <span>{t('نقطة التعادل:', 'Seuil Équilibre:', 'Punto Equilibrio:')} <strong className="text-amber-400">{activeSummary.comparison.utilizationBreakevenLdm} LDM</strong></span>
              <span>{activeSummary.ltl.totalConsignments} {t('إرسالية', 'envois', 'envíos')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI / BI Tactical Dispatch Recommendation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">
                {t('التوصية الاستراتيجية لتشغيل الرحلات (AI Dispatch Advisor)', 'Conseil Stratégique d’Exploitation (AI Dispatch)', 'Recomendación Estratégica de Despacho (AI Dispatch)')}
              </h4>
              <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/40 text-[10px]">
                {activeSummary.corridorNameAr}
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              {getLocalizedRecommendation()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div className="text-[11px] text-slate-400">
            <div>{t('عتبة التعادل الربحي', 'Seuil de Rentabilité', 'Umbral de Rentabilidad')}</div>
            <div className="text-white font-bold">{activeSummary.comparison.utilizationBreakevenLdm} / 13.60 LDM</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue & Margin per LDM */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  {t('مقارنة عائد وصافي ربح المتر الطولي (MAD/LDM)', 'Rendement & Marge par Mètre Linéaire (MAD/LDM)', 'Rendimiento y Margen por Metro Lineal (MAD/LDM)')}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  {t('مقارنة تفصيلية بين الشحن التجميعي والكامل عبر الممرين', 'Comparaison détaillée LTL vs FTL par corridor', 'Comparativa detallada LTL vs FTL por corredor')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartLdmComparison} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: unknown) => [`${formatNumber(Number(val) || 0)} MAD`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="revPerLdm" name={t('الإيراد لكل LDM', 'Revenu / LDM', 'Ingreso / LDM')} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="marginPerLdm" name={t('صافي الربح لكل LDM', 'Marge Nette / LDM', 'Margen Neto / LDM')} fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Cost Structure Breakdown */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Fuel className="w-4 h-4 text-indigo-400" />
                  {t('هيكل التكاليف التشغيلية (LTL مقابل FTL)', 'Structure des Coûts Opérationnels (LTL vs FTL)', 'Estructura de Costes Operativos (LTL vs FTL)')}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  {t('توزيع نفقات الرحلات بحسب نوع المصروف (MAD)', 'Répartition des dépenses par poste de coût (MAD)', 'Distribución de gastos por partida de coste (MAD)')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartCostStructure} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val: unknown) => [`${formatNumber(Number(val) || 0)} MAD`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="LTL" name={t('تجميعي (LTL)', 'Groupage (LTL)', 'Grupaje (LTL)')} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="FTL" name={t('شحن كامل (FTL)', 'Complet (FTL)', 'Completo (FTL)')} fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LDM Capacity Consolidation Buckets */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            {t('شرائح كفاءة الإشغال المترية (LDM Consolidation Efficiency Tiers)', 'Paliers d’Efficacité d’Occupation (LDM Tiers)', 'Tramos de Eficiencia de Ocupación (Tramos LDM)')}
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            {t(
              'تأثير زيادة حمولة المقطورة على هامش الربحية وعائد المتر الطولي',
              'Impact du remplissage de la remorque sur la marge nette et le rendement au LDM',
              'Impacto del llenado del semirremolque en el margen neto y rendimiento por LDM'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.ldmBuckets.map((bucket, index) => (
              <div
                key={bucket.bucketRange}
                className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{bucket.bucketRange}</span>
                  <Badge
                    variant="outline"
                    className={
                      index === 2
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                        : index === 1
                        ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30'
                        : 'border-amber-500 text-amber-400 bg-amber-950/30'
                    }
                  >
                    {bucket.tripCount} {t('رحلات', 'voyages', 'viajes')}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{t('نسبة إشغال المقطورة:', 'Taux d’Occupation:', 'Tasa de Ocupación:')}</span>
                    <strong className="text-slate-200">{bucket.avgUtilizationPct}%</strong>
                  </div>
                  <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${index === 2 ? 'bg-emerald-500' : index === 1 ? 'bg-cyan-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, bucket.avgUtilizationPct)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-700/60 pt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">{t('هامش الربح', 'Marge Nette', 'Margen Neto')}</span>
                    <span className="font-bold text-emerald-400">{bucket.avgNetMarginPct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('عائد / LDM', 'Revenu / LDM', 'Ingreso / LDM')}</span>
                    <span className="font-bold text-white">{formatNumber(bucket.avgRevenuePerLdmMad)} MAD</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trips & Consignments Detailed Breakdown Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-cyan-400" />
                {t('سجل الرحلات التفصيلي وتحليل LDM و CPK', 'Détail des Voyages & Analyse LDM / CPK', 'Detalle de Viajes y Análisis LDM / CPK')}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {t('بيانات دقيقة لكل رحلة مع تفصيل الإرساليات والمؤشرات المالية', 'Données précises par voyage avec indicateurs financiers', 'Datos precisos por viaje con indicadores financieros')}
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute top-2.5 start-3 text-slate-400" />
              <Input
                placeholder={t('بحث برقم CMR أو المسار...', 'Rechercher par CMR ou trajet...', 'Buscar por CMR o ruta...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800 border-slate-700 text-xs ps-9 text-slate-200"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start text-slate-300">
              <thead className="text-[11px] uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 text-start">{t('الـ CMR والمسار', 'CMR & Trajet', 'CMR y Ruta')}</th>
                  <th className="py-3 px-2 text-center">{t('الممر الدولي', 'Corridor', 'Corredor')}</th>
                  <th className="py-3 px-2 text-center">{t('النمط', 'Mode', 'Modo')}</th>
                  <th className="py-3 px-2 text-center">{t('الإرساليات', 'Envois', 'Envíos')}</th>
                  <th className="py-3 px-2 text-center">{t('المتر الطولي (LDM)', 'LDM', 'LDM')}</th>
                  <th className="py-3 px-2 text-center">{t('الإشغال', 'Occupation', 'Ocupación')}</th>
                  <th className="py-3 px-3 text-end">{t('الإيراد (MAD)', 'Revenu (MAD)', 'Ingresos (MAD)')}</th>
                  <th className="py-3 px-3 text-end">{t('التكلفة (MAD)', 'Coût (MAD)', 'Coste (MAD)')}</th>
                  <th className="py-3 px-3 text-end">{t('الربح الصافي', 'Bénéfice Net', 'Beneficio Neto')}</th>
                  <th className="py-3 px-2 text-center">{t('الهامش %', 'Marge %', 'Margen %')}</th>
                  <th className="py-3 px-3 text-end">{t('MAD / LDM', 'MAD / LDM', 'MAD / LDM')}</th>
                  <th className="py-3 px-2 text-end">{t('CPK (MAD)', 'CPK (MAD)', 'CPK (MAD)')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      {t('لا توجد رحلات مطابقة لمعايير البحث الحالية', 'Aucun voyage trouvé', 'No se encontraron viajes')}
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{trip.cmrNumber}</div>
                        <div className="text-[11px] text-slate-400">{trip.route}</div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={
                            trip.corridor === 'european_maritime'
                              ? 'border-indigo-500/40 text-indigo-400 bg-indigo-950/20 text-[10px]'
                              : 'border-amber-500/40 text-amber-400 bg-amber-950/20 text-[10px]'
                          }
                        >
                          {trip.corridor === 'european_maritime' ? t('أوروبي بحري', 'Maritime EU', 'Marítimo EU') : t('إفريقي بري', 'Africain', 'Africano')}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge
                          className={
                            trip.mode === 'ltl'
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40 text-[10px]'
                              : 'bg-purple-950/80 text-purple-300 border-purple-500/40 text-[10px]'
                          }
                        >
                          {trip.mode === 'ltl' ? 'LTL' : 'FTL'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center font-medium">
                        {trip.consignmentsCount}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-white">
                        {trip.totalLdm}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`text-[11px] font-medium ${trip.trailerUtilizationPct >= 80 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {trip.trailerUtilizationPct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-end font-medium text-slate-200">
                        {formatNumber(trip.revenueMad)}
                      </td>
                      <td className="py-3 px-3 text-end text-slate-400">
                        {formatNumber(trip.operatingCostMad)}
                      </td>
                      <td className="py-3 px-3 text-end font-bold text-emerald-400">
                        {formatNumber(trip.netProfitMad)}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-white">
                        {trip.netMarginPct}%
                      </td>
                      <td className="py-3 px-3 text-end font-medium text-cyan-400">
                        {formatNumber(trip.revenuePerLdmMad)}
                      </td>
                      <td className="py-3 px-2 text-end text-slate-300">
                        {trip.cpkMad}
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
