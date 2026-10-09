'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Gauge,
  Compass,
  AlertTriangle,
  Download,
  Coins,
  ArrowUpRight,
  ShieldAlert,
  Fuel,
  Ship,
  Users,
  Wrench,
  FileCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import type {
  ExecutiveBiReportData,
  CurrencyCode,
  CorridorProfitabilitySummary,
} from '../types/executive-bi.types';
import Decimal from 'decimal.js';

interface ExecutiveProfitabilityViewProps {
  initialReport: ExecutiveBiReportData;
}

export function ExecutiveProfitabilityView({ initialReport }: ExecutiveProfitabilityViewProps) {
  const { t, locale, dir } = useLanguage();
  const language = locale;

  const [currency, setCurrency] = useState<CurrencyCode>('MAD');
  const [report, setReport] = useState<ExecutiveBiReportData>(initialReport);

  const eurRate = new Decimal(initialReport.kpis.forexRateEurToMad || '10.85');

  // Convert an amount string based on selected currency
  const formatMoney = (amountStr: string | number) => {
    const val = new Decimal(amountStr || 0);
    if (currency === 'EUR') {
      const inEur = val.dividedBy(eurRate);
      return `${inEur.toFixed(2)} €`;
    }
    return `${val.toFixed(2)} د.م.`;
  };

  const handleExportCsv = () => {
    const headers = [
      'Corridor',
      'Origin',
      'Destination',
      'Trips',
      'Distance (km)',
      `Revenue (${currency})`,
      `Cost (${currency})`,
      `Net Profit (${currency})`,
      'Margin (%)',
      `Actual CPK (${currency}/km)`,
      `RPK (${currency}/km)`,
      'Status',
    ];

    const rows = report.corridors.map((c) => {
      const title =
        language === 'es' ? c.corridorTitleEs : language === 'fr' ? c.corridorTitleFr : c.corridorTitleAr;
      const rev = currency === 'EUR' ? new Decimal(c.revenue).dividedBy(eurRate).toFixed(2) : c.revenue;
      const cost =
        currency === 'EUR'
          ? new Decimal(c.costs.totalCost).dividedBy(eurRate).toFixed(2)
          : c.costs.totalCost;
      const profit =
        currency === 'EUR'
          ? new Decimal(c.netOperatingProfit).dividedBy(eurRate).toFixed(2)
          : c.netOperatingProfit;
      const cpk =
        currency === 'EUR' ? new Decimal(c.actualCpk).dividedBy(eurRate).toFixed(2) : c.actualCpk;
      const rpk =
        currency === 'EUR' ? new Decimal(c.revenuePerKm).dividedBy(eurRate).toFixed(2) : c.revenuePerKm;

      return [
        `"${title}"`,
        `"${c.origin}"`,
        `"${c.destination}"`,
        c.totalTripsCount,
        c.totalDistanceKm,
        rev,
        cost,
        profit,
        `${c.netMarginPercent}%`,
        cpk,
        rpk,
        c.isAnomaly ? 'Variance Alert' : 'Normal',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transbodanon_corridor_bi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data with currency adjustment
  const corridorChartData = report.corridors.map((c) => {
    const label =
      language === 'es'
        ? c.origin + ' ➔ ' + c.destination
        : language === 'fr'
          ? c.origin + ' ➔ ' + c.destination
          : c.origin + ' ➔ ' + c.destination;

    const rev = currency === 'EUR' ? new Decimal(c.revenue).dividedBy(eurRate).toNumber() : new Decimal(c.revenue).toNumber();
    const costs = currency === 'EUR' ? new Decimal(c.costs.totalCost).dividedBy(eurRate).toNumber() : new Decimal(c.costs.totalCost).toNumber();
    const profit = currency === 'EUR' ? new Decimal(c.netOperatingProfit).dividedBy(eurRate).toNumber() : new Decimal(c.netOperatingProfit).toNumber();

    return {
      name: label,
      revenue: Math.round(rev),
      costs: Math.round(costs),
      profit: Math.round(profit),
      margin: parseFloat(c.netMarginPercent),
    };
  });

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header & Currency Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" />
            <span>
              {language === 'es'
                ? 'Analítica Ejecutiva de Rentabilidad por Corredores (BI)'
                : language === 'fr'
                  ? 'Analytique Décisionnelle de Rentabilité par Corridors (BI)'
                  : 'لوحة القيادة التنفيذية الموسعة ومؤشرات الربحية المتقدمة (BI)'}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'es'
              ? 'Análisis en tiempo real de CPK, RPK y márgenes operativos en corredores internacionales.'
              : language === 'fr'
                ? 'Suivi précis du CPK réel, RPK et marges opérationnelles des corridors internationaux.'
                : 'تحليل دقيق لتكلفة الكيلومتر (CPK)، عائد الكيلومتر (RPK)، وهوامش الربح الصافية عبر الممرات الدولية.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Currency Toggle */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/80">
            <button
              onClick={() => setCurrency('MAD')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                currency === 'MAD'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MAD (د.م.)
            </button>
            <button
              onClick={() => setCurrency('EUR')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                currency === 'EUR'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              EUR (€ @ {report.kpis.forexRateEurToMad})
            </button>
          </div>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {language === 'es' ? 'Exportar CSV' : language === 'fr' ? 'Exporter CSV' : 'تصدير البيانات'}
            </span>
          </Button>
        </div>
      </div>

      {/* Bento Grid: Key Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <Card className="rounded-2xl border border-border shadow-xs bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {language === 'es'
                  ? 'Ingresos Totales'
                  : language === 'fr'
                    ? 'Revenus Totaux Bruts'
                    : 'إجمالي الإيرادات التعاقدية'}
              </p>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatMoney(report.kpis.totalRevenue)}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ArrowUpRight className="w-3 h-3" />
                <span>+14.8% {language === 'es' ? 'vs trimestre ant.' : language === 'fr' ? 'vs trim. préc.' : 'مقارنة بالربع السابق'}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Net Operating Profit */}
        <Card className="rounded-2xl border border-border shadow-xs bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {language === 'es'
                  ? 'Beneficio Neto Operativo'
                  : language === 'fr'
                    ? 'Bénéfice Net Opérationnel'
                    : 'صافي الربح التشغيلي'}
              </p>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatMoney(report.kpis.netOperatingProfit)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-600 dark:text-blue-400">
                  {report.kpis.overallNetMarginPercent}%
                </Badge>
                <span>{language === 'es' ? 'Margen Neto' : language === 'fr' ? 'Marge Nette' : 'هامش الربح'}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Actual CPK vs Target CPK */}
        <Card className="rounded-2xl border border-border shadow-xs bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {language === 'es'
                  ? 'Coste por Kilómetro (CPK)'
                  : language === 'fr'
                    ? 'Coût Kilométrique Réel (CPK)'
                    : 'متوسط تكلفة الكيلومتر (CPK)'}
              </p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatMoney(report.kpis.averageActualCpk)}
                <span className="text-xs text-muted-foreground font-normal"> / km</span>
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-mono">
                  {language === 'es' ? 'Meta: ' : language === 'fr' ? 'Cible : ' : 'الهدف: '}
                  {formatMoney(report.kpis.averageTargetCpk)}
                </span>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
                  +2.7%
                </Badge>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* RPK & Operational Efficiency */}
        <Card className="rounded-2xl border border-border shadow-xs bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {language === 'es'
                  ? 'Ingreso por Kilómetro (RPK)'
                  : language === 'fr'
                    ? 'Revenu Kilométrique (RPK)'
                    : 'عائد الكيلومتر الصافي (RPK)'}
              </p>
              <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {formatMoney(report.kpis.averageRevenuePerKm)}
                <span className="text-xs text-muted-foreground font-normal"> / km</span>
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                  {report.kpis.fleetOperatingEfficiencyPercent}%
                </Badge>
                <span>{language === 'es' ? 'Eficiencia Operativa' : language === 'fr' ? 'Efficacité Op.' : 'كفاءة التشغيل'}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section: Row of 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Corridor Performance Comparison (Bar Chart) - 2 Cols */}
        <Card className="lg:col-span-2 rounded-2xl border border-border shadow-xs bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold font-amiri flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {language === 'es'
                  ? 'Comparativa de Ingresos y Costes por Corredor'
                  : language === 'fr'
                    ? 'Comparatif Revenus vs Coûts par Corridor'
                    : 'مقارنة الإيرادات والتكاليف وهوامش الأرباح حسب الممرات الدولية'}
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {currency}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={corridorChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.6} />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${Number(val).toLocaleString()} ${currency}`, '']}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                    formatter={(val) =>
                      val === 'revenue'
                        ? language === 'es' ? 'Ingresos' : language === 'fr' ? 'Revenus' : 'الإيرادات'
                        : val === 'costs'
                          ? language === 'es' ? 'Costes' : language === 'fr' ? 'Coûts' : 'التكاليف'
                          : language === 'es' ? 'Beneficio' : language === 'fr' ? 'Bénéfice' : 'صافي الربح'
                    }
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="costs" fill="#ef4444" radius={[4, 4, 0, 0]} name="costs" />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} name="profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Cost Breakdown Distribution (Pie Chart) - 1 Col */}
        <Card className="rounded-2xl border border-border shadow-xs bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold font-amiri flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-500" />
                {language === 'es'
                  ? 'Estructura de Costes Operativos'
                  : language === 'fr'
                    ? 'Structure des Coûts Opérationnels'
                    : 'هيكل توزيع التكاليف التشغيلية'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.costDistribution}
                    dataKey="amount"
                    nameKey={language === 'es' ? 'nameEs' : language === 'fr' ? 'nameFr' : 'nameAr'}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {report.costDistribution.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${Number(val).toLocaleString()} ${currency}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Compact Legend List */}
            <div className="space-y-1.5 mt-2">
              {report.costDistribution.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground truncate max-w-[150px]">
                      {language === 'es' ? item.nameEs : language === 'fr' ? item.nameFr : item.nameAr}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Corridors Detail Table */}
      <Card className="rounded-2xl border border-border shadow-xs bg-card">
        <CardHeader className="pb-3 border-b border-border/70">
          <CardTitle className="text-base font-bold font-amiri flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-primary" />
              {language === 'es'
                ? 'Detalle de Rentabilidad por Corredor Internacional'
                : language === 'fr'
                  ? 'Détail de Rentabilité par Corridor International'
                  : 'جدول تفكيك الأداء وهوامش الربحية حسب الممرات الدولية'}
            </span>
            <Badge variant="outline" className="text-xs">
              {report.corridors.length} {language === 'es' ? 'corredores' : language === 'fr' ? 'corridors' : 'ممرات'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="p-3 text-start">{language === 'es' ? 'Corredor Internacional' : language === 'fr' ? 'Corridor International' : 'الممر الدولي'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Viajes' : language === 'fr' ? 'Voyages' : 'الرحلات'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Distancia (km)' : language === 'fr' ? 'Distance (km)' : 'المسافة'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Ingresos' : language === 'fr' ? 'Revenus' : 'الإيرادات'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Costes' : language === 'fr' ? 'Coûts' : 'التكاليف'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Beneficio Neto' : language === 'fr' ? 'Bénéfice Net' : 'صافي الربح'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Margen (%)' : language === 'fr' ? 'Marge (%)' : 'الهامش'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'CPK Real' : language === 'fr' ? 'CPK Réel' : 'CPK الميداني'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'RPK' : language === 'fr' ? 'RPK' : 'العائد RPK'}</th>
                  <th className="p-3 text-center">{language === 'es' ? 'Alerta' : language === 'fr' ? 'Statut' : 'الحالة'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.corridors.map((c) => {
                  const title =
                    language === 'es'
                      ? c.corridorTitleEs
                      : language === 'fr'
                        ? c.corridorTitleFr
                        : c.corridorTitleAr;

                  return (
                    <tr key={c.corridorCode} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-semibold text-foreground text-start">
                        <div className="flex items-center gap-2">
                          <span>{title}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono">{c.totalTripsCount}</td>
                      <td className="p-3 text-center font-mono">{c.totalDistanceKm.toLocaleString()} km</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(c.revenue)}
                      </td>
                      <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400">
                        {formatMoney(c.costs.totalCost)}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-foreground">
                        {formatMoney(c.netOperatingProfit)}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${
                            parseFloat(c.netMarginPercent) >= 35
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                        >
                          {c.netMarginPercent}%
                        </Badge>
                      </td>
                      <td className="p-3 text-center font-mono font-medium">
                        {formatMoney(c.actualCpk)}
                        <span className="text-[10px] text-muted-foreground"> /km</span>
                      </td>
                      <td className="p-3 text-center font-mono font-medium">
                        {formatMoney(c.revenuePerKm)}
                        <span className="text-[10px] text-muted-foreground"> /km</span>
                      </td>
                      <td className="p-3 text-center">
                        {c.isAnomaly ? (
                          <Badge variant="destructive" className="flex items-center gap-1 mx-auto w-fit text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{language === 'es' ? 'Alerta +15%' : language === 'fr' ? 'Alerte +15%' : 'شذوذ تكلفة'}</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 mx-auto w-fit text-[10px]">
                            {language === 'es' ? 'Óptimo' : language === 'fr' ? 'Optimal' : 'منضبط'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

