'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useLanguage } from '@/components/language-provider';
import type {
  CorridorPnlAnalyticsResult,
  CorridorTripPnlDetail,
} from '../types/corridor-pnl.types';
import { getCorridorPnlAnalyticsAction } from '../services/corridor-pnl.actions';
import {
  Truck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Compass,
  Download,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Gauge,
  Calendar,
  Layers,
  Scale,
  Fuel,
  Ship,
  Sparkles,
  ArrowRight,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

interface CorridorPnlDashboardViewProps {
  initialData: CorridorPnlAnalyticsResult;
}

export function CorridorPnlDashboardView({ initialData }: CorridorPnlDashboardViewProps) {
  const { t, dir, formatNumber } = useLanguage();
  const [data, setData] = useState<CorridorPnlAnalyticsResult>(initialData);
  const [selectedCorridor, setSelectedCorridor] = useState<'all' | 'european_maritime' | 'african_overland'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleApplyFilter = () => {
    startTransition(async () => {
      const res = await getCorridorPnlAnalyticsAction({
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
      t('رقم الـ CMR', 'N° CMR', 'Nº CMR'),
      t('تاريخ الانطلاق', 'Date Départ', 'Fecha Salida'),
      t('الممر الدولي', 'Corridor', 'Corredor'),
      t('المسار', 'Trajet', 'Ruta'),
      t('الشاحنة', 'Camion', 'Camión'),
      t('السائق', 'Chauffeur', 'Conductor'),
      t('الحمولة (طن)', 'Tonnage (t)', 'Carga (t)'),
      t('المسافة (كم)', 'Distance (km)', 'Distancia (km)'),
      t('الإيراد (MAD)', 'Revenu (MAD)', 'Ingresos (MAD)'),
      t('التكلفة التشغيلية (MAD)', 'Coût Opérationnel (MAD)', 'Coste Operativo (MAD)'),
      t('صافي الربح (MAD)', 'Bénéfice Net (MAD)', 'Beneficio Neto (MAD)'),
      t('هامش الربح (%)', 'Marge Nette (%)', 'Margen Neto (%)'),
      t('تكلفة الكيلومتر CPK (MAD)', 'Coût au Km CPK (MAD)', 'Coste por Km CPK (MAD)'),
      t('إيراد الكيلومتر RPK (MAD)', 'Revenu au Km RPK (MAD)', 'Ingreso por Km RPK (MAD)'),
    ];

    const rows = filteredTrips.map((tr) => [
      tr.cmrNumber,
      tr.departureDate,
      tr.corridor === 'african_overland' ? 'African Overland' : 'European Maritime',
      `"${tr.route}"`,
      tr.truckPlate,
      `"${tr.driverName}"`,
      tr.cargoWeightTons,
      tr.totalDistanceKm,
      tr.revenueMad,
      tr.totalCostMad,
      tr.netProfitMad,
      `${tr.netMarginPercent}%`,
      tr.cpkMad,
      tr.rpkMad,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `corridor-pnl-cpk-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTrips = data.trips.filter((tr) => {
    if (selectedCorridor !== 'all' && tr.corridor !== selectedCorridor) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tr.cmrNumber.toLowerCase().includes(q) ||
      tr.route.toLowerCase().includes(q) ||
      tr.truckPlate.toLowerCase().includes(q) ||
      tr.driverName.toLowerCase().includes(q)
    );
  });

  const { overall, africanOverland: afr, europeanMaritime: euro, anomalies, benchmarkTrip272 } = data;

  return (
    <div className="space-y-6" dir={dir}>
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900/90 via-slate-900 to-blue-950 p-6 rounded-2xl border border-emerald-500/30 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Compass className="w-6 h-6 animate-pulse" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {t(
                'محرك ذكاء الممرات وهوامش الربحية وتكلفة الكيلومتر (CPK & P&L Engine)',
                'Intelligence des Corridors, Marges P&L et Coût au Kilomètre (CPK Engine)',
                'Inteligencia de Corredores, Márgenes P&L y Coste por Kilómetro (CPK Engine)'
              )}
            </h1>
          </div>
          <p className="text-sm text-slate-300 max-w-3xl">
            {t(
              'تحليل دقيق لتكلفة الكيلومتر الصافية (CPK) وهوامش الربحية الإجمالية والصافية بدقة Decimal.js الصارمة، مع مقارنة مباشرة بين الممر البري الإفريقي والممر البحري الأوروبي.',
              'Analyse rigoureuse du coût net au kilomètre (CPK) et des marges brutes/nettes sous Decimal.js, comparant le corridor africain overland et le corridor maritime européen.',
              'Análisis riguroso del coste neto por kilómetro (CPK) y márgenes brutos/netos con Decimal.js, comparando el corredor terrestre africano y el marítimo europeo.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 text-xs"
          >
            <Download className="w-4 h-4" />
            {t('تصدير التقرير (CSV/Excel)', 'Exporter le Rapport (CSV/Excel)', 'Exportar Informe (CSV/Excel)')}
          </Button>
          <Link href="/mission-control">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-xs">
              <Activity className="w-4 h-4" />
              {t('رادار العمليات الميدانية', 'Radar Mission Control', 'Radar Control de Misión')}
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Benchmark Showcase: Flagship Trip #272 */}
      {benchmarkTrip272 && (
        <Card className="border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/20 overflow-hidden shadow-lg">
          <CardContent className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-500/40 text-emerald-400 mt-1">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs">
                      {t('المأمورية الميدانية المرجعية المعتمدة', 'Mission Pilote de Référence Certifiée', 'Misión Piloto de Referencia Certificada')}
                    </Badge>
                    <Badge className="bg-emerald-600 text-white font-mono text-xs">
                      {benchmarkTrip272.cmrNumber}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {t('الرحلة #272 (أكادير ➔ الكركارات ➔ روصو ➔ دكار)', 'Mission #272 (Agadir ➔ Guerguerat ➔ Rosso ➔ Dakar)', 'Misión #272 (Agadir ➔ Guerguerat ➔ Rosso ➔ Dakar)')}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {t(
                      'الممر البري الأطلسي — السائق: عبد الكريم الخمليشي (شاحنة تبريد 10101-أ-40)',
                      'Corridor Overland Atlantique — Chauffeur : Abdelkrim Khamlichi (Frigo 10101-A-40)',
                      'Corredor Terrestre Atlántico — Conductor: Abdelkrim Khamlichi (Frigo 10101-A-40)'
                    )}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {t(
                      'تم توثيق إثبات التسليم الرقمي e-POD بختم HMAC-SHA256 المشفر وإعفاء المادة 92-I-10° من المدونة العامة للضرائب CGI بنجاح.',
                      'Signature e-POD scellée par HMAC-SHA256 avec exonération TVA article 92-I-10° du CGI vérifiée.',
                      'Firma e-POD sellada con HMAC-SHA256 y exención de IVA según el artículo 92-I-10° del CGI verificada.'
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block">{t('تكلفة الكيلومتر (CPK)', 'Coût au Km (CPK)', 'Coste por Km (CPK)')}</span>
                  <span className="text-sm font-bold text-emerald-400">{benchmarkTrip272.cpkMad} MAD/km</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('عائد الكيلومتر (RPK)', 'Revenu au Km (RPK)', 'Ingreso por Km (RPK)')}</span>
                  <span className="text-sm font-bold text-blue-400">{benchmarkTrip272.rpkMad} MAD/km</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('صافي الهامش', 'Marge Nette', 'Margen Neto')}</span>
                  <span className="text-sm font-bold text-emerald-300">{benchmarkTrip272.netMarginPercent}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('صافي الربح', 'Bénéfice Net', 'Beneficio Neto')}</span>
                  <span className="text-sm font-bold text-white">+{formatNumber(benchmarkTrip272.netProfitMad)} MAD</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Global KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fleet CPK */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                {t('تكلفة الكيلومتر الموحدة للأسطول (CPK)', 'Coût Moyen Flotte au Km (CPK)', 'Coste Medio Flota por Km (CPK)')}
              </span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Gauge className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {overall.costPerKmMad}{' '}
              <span className="text-xs font-normal text-slate-400">MAD / km</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>{t('إيراد الكيلومتر (RPK)', 'Revenu au Km (RPK)', 'Ingreso por Km (RPK)')}:</span>
              <span className="font-mono text-blue-400 font-semibold">{overall.revenuePerKmMad} MAD</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Net Profit Margin % */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                {t('متوسط هامش الربح الصافي', 'Marge Bénéficiaire Nette', 'Margen de Beneficio Neto')}
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mb-1">
              %{overall.netMarginPercent}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>{t('الهامش الإجمالي (Gross)', 'Marge Brute', 'Margen Bruto')}:</span>
              <span className="font-mono text-emerald-300 font-semibold">%{overall.grossMarginPercent}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Operating Volume */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                {t('إجمالي المسافات والرحلات', 'Volume Kilométrique & Missions', 'Volumen Kilométrico y Viajes')}
              </span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-1">
              {formatNumber(overall.totalKm)}{' '}
              <span className="text-xs font-normal text-slate-400">km</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>{t('الرحلات المنفذة', 'Missions Réalisées', 'Viajes Realizados')}:</span>
              <span className="font-mono text-purple-300 font-semibold">{overall.totalTrips} {t('رحلة', 'voyages', 'viajes')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Ton-Kilometer Efficiency */}
        <Card className="border-slate-800 bg-slate-900/60 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">
                {t('تكلفة الطن-كيلومتر (Cost / t·km)', 'Coût à la Tonne-Km (t·km)', 'Coste por Tonelada-Km (t·km)')}
              </span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mb-1">
              {overall.costPerTonKmMad}{' '}
              <span className="text-xs font-normal text-slate-400">MAD / t·km</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>{t('إيراد الطن-كم (Rev / t·km)', 'Revenu t·km', 'Ingreso t·km')}:</span>
              <span className="font-mono text-amber-300 font-semibold">{overall.revenuePerTonKmMad} MAD</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Head-to-Head Comparison: African Overland vs European Maritime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* African Overland Box */}
        <Card className="border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Truck className="w-5 h-5" />
                </span>
                <div>
                  <CardTitle className="text-lg text-white">
                    {t('الممر البري الإفريقي (African Overland)', 'Corridor Terrestre Africain', 'Corredor Terrestre Africano')}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    {t('المغرب ➔ موريتانيا ➔ السنغال (الكركارات & روصو)', 'Maroc ➔ Mauritanie ➔ Sénégal (Guerguerat & Rosso)', 'Marruecos ➔ Mauritania ➔ Senegal (Guerguerat y Rosso)')}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 font-mono text-xs">
                {afr.totalTrips} {t('رحلات', 'voyages', 'viajes')}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Core Metrics */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800 font-mono text-center">
              <div>
                <span className="text-[11px] text-slate-400 block">{t('تكلفة الكيلومتر CPK', 'Coût CPK', 'Coste CPK')}</span>
                <span className="text-base font-bold text-amber-400">{afr.costPerKmMad} MAD</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">{t('عائد الكيلومتر RPK', 'Revenu RPK', 'Ingreso RPK')}</span>
                <span className="text-base font-bold text-blue-400">{afr.revenuePerKmMad} MAD</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">{t('صافي الهامش', 'Marge Nette', 'Margen')}</span>
                <span className="text-base font-bold text-emerald-400">%{afr.netMarginPercent}</span>
              </div>
            </div>

            {/* CPK Cost Breakdown Bars */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                {t('توزيع عناصر تكلفة الكيلومتر الصافية (CPK Breakdown)', 'Décomposition du Coût au Km (CPK)', 'Desglose del Coste por Km (CPK)')}
              </span>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Fuel className="w-3.5 h-3.5 text-blue-400" />
                    {t('المحروقات والوقود', 'Carburant', 'Combustible')}:
                  </span>
                  <span>{afr.cpkBreakdown.fuelCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    {t('بدلات ومهمة السائق', 'Indemnités Chauffeur', 'Dietas Conductor')}:
                  </span>
                  <span>{afr.cpkBreakdown.driverAllowanceCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    {t('الجمارك ومعبر الكركارات', 'Douane & Guerguerat', 'Aduana y Guerguerat')}:
                  </span>
                  <span>{afr.cpkBreakdown.customsCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    {t('عبارة روصو النهرية', 'Ferry Fluvial Rosso', 'Ferry Fluvial Rosso')}:
                  </span>
                  <span>{afr.cpkBreakdown.ferryTransitCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Gauge className="w-3.5 h-3.5 text-rose-400" />
                    {t('الصيانة واهتراء المسار', 'Maintenance & Usure', 'Mantenimiento')}:
                  </span>
                  <span>{afr.cpkBreakdown.maintenanceCpk} MAD/km</span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('إجمالي صافي الربح:', 'Bénéfice Net Total :', 'Beneficio Neto Total:')}</span>
              <span className="font-mono font-bold text-emerald-400">+{formatNumber(afr.netProfitMad)} MAD</span>
            </div>
          </CardContent>
        </Card>

        {/* European Maritime Box */}
        <Card className="border-blue-500/30 bg-gradient-to-b from-slate-900 to-slate-950 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Ship className="w-5 h-5" />
                </span>
                <div>
                  <CardTitle className="text-lg text-white">
                    {t('الممر البحري الأوروبي (European Maritime)', 'Corridor Maritime Européen', 'Corredor Marítimo Europeo')}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    {t('طنجة المتوسط ➔ الجزيرة الخضراء / ألميريا ➔ فرنسا', 'Tanger Med ➔ Algésiras / Almería ➔ France', 'Tánger Med ➔ Algeciras / Almería ➔ Francia')}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 font-mono text-xs">
                {euro.totalTrips} {t('رحلات', 'voyages', 'viajes')}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Core Metrics */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800 font-mono text-center">
              <div>
                <span className="text-[11px] text-slate-400 block">{t('تكلفة الكيلومتر CPK', 'Coût CPK', 'Coste CPK')}</span>
                <span className="text-base font-bold text-blue-400">{euro.costPerKmMad} MAD</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">{t('عائد الكيلومتر RPK', 'Revenu RPK', 'Ingreso RPK')}</span>
                <span className="text-base font-bold text-cyan-400">{euro.revenuePerKmMad} MAD</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">{t('صافي الهامش', 'Marge Nette', 'Margen')}</span>
                <span className="text-base font-bold text-emerald-400">%{euro.netMarginPercent}</span>
              </div>
            </div>

            {/* CPK Cost Breakdown Bars */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                {t('توزيع عناصر تكلفة الكيلومتر الصافية (CPK Breakdown)', 'Décomposition du Coût au Km (CPK)', 'Desglose del Coste por Km (CPK)')}
              </span>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Fuel className="w-3.5 h-3.5 text-blue-400" />
                    {t('المحروقات والوقود', 'Carburant', 'Combustible')}:
                  </span>
                  <span>{euro.cpkBreakdown.fuelCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    {t('العبارات البحرية والموانئ', 'Ferries & Transit Portuaire', 'Ferries y Tránsito Portuario')}:
                  </span>
                  <span>{euro.cpkBreakdown.ferryTransitCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    {t('بدلات السائق الأوروبي', 'Indemnités Chauffeur', 'Dietas Conductor')}:
                  </span>
                  <span>{euro.cpkBreakdown.driverAllowanceCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Gauge className="w-3.5 h-3.5 text-rose-400" />
                    {t('الصيانة واستهلاك الإطارات', 'Maintenance & Pneus', 'Mantenimiento')}:
                  </span>
                  <span>{euro.cpkBreakdown.maintenanceCpk} MAD/km</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Compass className="w-3.5 h-3.5 text-purple-400" />
                    {t('الطرق السيارة والموانئ', 'Péages & Taxes Port', 'Peajes')}:
                  </span>
                  <span>{euro.cpkBreakdown.otherCpk} MAD/km</span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('إجمالي صافي الربح:', 'Bénéfice Net Total :', 'Beneficio Neto Total:')}</span>
              <span className="font-mono font-bold text-emerald-400">+{formatNumber(euro.netProfitMad)} MAD</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Variance Radar & Overrun Anomalies (>15%) */}
      {anomalies.length > 0 && (
        <Card className="border-rose-500/30 bg-slate-900/50 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <CardTitle className="text-base text-white">
                  {t('رادار الشذوذ وتجاوز التكاليف المرجعية (>15% CPK Overrun Radar)', 'Radar des Anomalies de Coût (>15% Dépassement CPK)', 'Radar de Anomalías de Coste (>15% Exceso CPK)')}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  {t('رحلات سجلت انحرافاً ملحوظاً في تكلفة الكيلومتر مقارنة بخط الأساس للممر الدولي', 'Missions présentant un dépassement significatif du coût kilométrique de référence', 'Viajes con desviación significativa respecto al coste por km de referencia')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right" dir={dir}>
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">{t('المهمة / CMR', 'Mission / CMR', 'Misión / CMR')}</th>
                    <th className="p-2.5">{t('الشاحنة والسائق', 'Véhicule & Chauffeur', 'Vehículo y Conductor')}</th>
                    <th className="p-2.5">{t('الممر', 'Corridor', 'Corredor')}</th>
                    <th className="p-2.5">{t('تكلفة الرحلة CPK', 'CPK Mission', 'CPK Misión')}</th>
                    <th className="p-2.5">{t('المعيار المرجعي', 'Référence', 'Referencia')}</th>
                    <th className="p-2.5">{t('نسبة التجاوز', 'Écart (%)', 'Desviación (%)')}</th>
                    <th className="p-2.5">{t('المحرك الرئيسي للزيادة', 'Facteur Dominant', 'Factor Dominante')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {anomalies.map((anom) => (
                    <tr key={anom.tripId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-2.5 font-mono text-white font-medium">{anom.cmrNumber}</td>
                      <td className="p-2.5 text-slate-300">
                        <span className="font-mono text-slate-200 block">{anom.truckPlate}</span>
                        <span className="text-[11px] text-slate-400">{anom.driverName}</span>
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className={anom.corridor === 'african_overland' ? 'border-amber-500/40 text-amber-400' : 'border-blue-500/40 text-blue-400'}>
                          {anom.corridor === 'african_overland' ? 'African' : 'European'}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-mono text-rose-300 font-bold">{anom.tripCpkMad} MAD/km</td>
                      <td className="p-2.5 font-mono text-slate-400">{anom.baselineCpkMad} MAD/km</td>
                      <td className="p-2.5 font-mono text-rose-400 font-bold">+{anom.variancePercent}%</td>
                      <td className="p-2.5">
                        <Badge className="bg-rose-950/80 text-rose-300 border border-rose-800/40">
                          {t(anom.primaryCostDriverLabelAr, anom.primaryCostDriverLabelFr, anom.primaryCostDriverLabelEs)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Filter & Search Bar */}
      <Card className="border-slate-800 bg-slate-900/60">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                variant={selectedCorridor === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCorridor('all')}
                className="text-xs h-9"
              >
                {t('كافة الممرات', 'Tous les Corridors', 'Todos los Corredores')}
              </Button>
              <Button
                variant={selectedCorridor === 'african_overland' ? 'default' : 'outline'}
                onClick={() => setSelectedCorridor('african_overland')}
                className="text-xs h-9 border-amber-500/30 text-amber-300"
              >
                {t('الممر الإفريقي', 'Corridor Africain', 'Corredor Africano')}
              </Button>
              <Button
                variant={selectedCorridor === 'european_maritime' ? 'default' : 'outline'}
                onClick={() => setSelectedCorridor('european_maritime')}
                className="text-xs h-9 border-blue-500/30 text-blue-300"
              >
                {t('الممر الأوروبي', 'Corridor Européen', 'Corredor Europeo')}
              </Button>
            </div>

            <div className="flex-1 w-full">
              <Input
                placeholder={t('البحث برقم الـ CMR أو السائق أو الشاحنة أو المسار...', 'Recherche par CMR, chauffeur, camion ou trajet...', 'Buscar por CMR, conductor, camión o ruta...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9 bg-slate-950/60 border-slate-700"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 bg-slate-950/60 border-slate-700 w-auto"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 bg-slate-950/60 border-slate-700 w-auto"
              />
              <Button
                onClick={handleApplyFilter}
                disabled={isPending}
                className="text-xs h-9 bg-slate-800 hover:bg-slate-700 text-white gap-1"
              >
                <Filter className="w-3.5 h-3.5" />
                {t('تطبيق', 'Filtrer', 'Filtrar')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7. Comprehensive Trips P&L Register */}
      <Card className="border-slate-800 bg-slate-900/60 shadow-md">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">
              {t('سجل مردودية وتكاليف الرحلات (Trips CPK & P&L Register)', 'Registre de Rentabilité & Coût des Missions', 'Registro de Rentabilidad y Coste de Viajes')}
            </CardTitle>
            <span className="text-xs text-slate-400 font-mono">
              {filteredTrips.length} {t('رحلة معروضة', 'missions affichées', 'viajes mostrados')}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right" dir={dir}>
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">{t('الـ CMR', 'CMR', 'CMR')}</th>
                  <th className="p-3">{t('المسار والممر', 'Trajet & Corridor', 'Ruta y Corredor')}</th>
                  <th className="p-3">{t('الشاحنة / السائق', 'Camion / Chauffeur', 'Camión / Conductor')}</th>
                  <th className="p-3">{t('المسافة (كم)', 'Distance (km)', 'Distancia')}</th>
                  <th className="p-3">{t('الإيراد (MAD)', 'Revenu', 'Ingreso')}</th>
                  <th className="p-3">{t('التكلفة (MAD)', 'Coût Total', 'Coste Total')}</th>
                  <th className="p-3">{t('صافي الربح', 'Bénéfice Net', 'Beneficio')}</th>
                  <th className="p-3">{t('الهامش %', 'Marge %', 'Margen %')}</th>
                  <th className="p-3">{t('تكلفة الكيلومتر (CPK)', 'CPK (MAD/km)', 'CPK')}</th>
                  <th className="p-3">{t('عائد الكيلومتر (RPK)', 'RPK (MAD/km)', 'RPK')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      {t('لا توجد رحلات مطابقة لمعايير البحث الحالية.', 'Aucune mission ne correspond aux critères actuels.', 'No hay viajes que coincidan con los criterios actuales.')}
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((tr) => (
                    <tr
                      key={tr.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        tr.isBenchmarkTrip ? 'bg-emerald-950/30 font-medium' : ''
                      }`}
                    >
                      <td className="p-3 font-mono text-white font-semibold flex items-center gap-1.5">
                        {tr.cmrNumber}
                        {tr.isBenchmarkTrip && (
                          <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5">
                            {t('مرجعي', 'Pilote', 'Piloto')}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-slate-300">
                        <span className="block font-medium text-slate-200">{tr.route}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] mt-1 ${
                            tr.corridor === 'african_overland'
                              ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                              : 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                          }`}
                        >
                          {tr.corridor === 'african_overland' ? 'African Overland' : 'European Maritime'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-300">
                        <span className="font-mono text-slate-200 block">{tr.truckPlate}</span>
                        <span className="text-[11px] text-slate-400">{tr.driverName}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{formatNumber(tr.totalDistanceKm)} km</td>
                      <td className="p-3 font-mono text-slate-200">{formatNumber(tr.revenueMad)}</td>
                      <td className="p-3 font-mono text-slate-400">{formatNumber(tr.totalCostMad)}</td>
                      <td className="p-3 font-mono text-emerald-400 font-semibold">
                        +{formatNumber(tr.netProfitMad)}
                      </td>
                      <td className="p-3 font-mono text-emerald-300">%{tr.netMarginPercent}</td>
                      <td className="p-3 font-mono text-amber-300 font-bold">{tr.cpkMad}</td>
                      <td className="p-3 font-mono text-blue-300">{tr.rpkMad}</td>
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

