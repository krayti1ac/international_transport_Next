'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/language-provider';
import { formatCurrency } from '@/lib/forex';
import type { FleetUtilizationReport } from '../types';
import { getFleetUtilizationReport } from '../services/fleet-utilization.actions';
import { Truck, Container, Users, Activity, AlertTriangle } from 'lucide-react';

const PERIOD_DAYS_DEFAULT = 30;

export function FleetUtilizationView() {
  const { t, dir } = useLanguage();
  const [report, setReport] = useState<FleetUtilizationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS_DEFAULT);
    return d.toISOString().split('T')[0];
  }, []);
  const defaultEnd = useMemo(() => today.toISOString().split('T')[0], [today]);

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getFleetUtilizationReport({ periodStart, periodEnd });
        if (res.success && res.data) setReport(res.data);
        else setError(res.error || 'Failed to load report');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodStart, periodEnd]);

  const getRecommendationBadge = (rec: 'optimal' | 'underused' | 'overused') => {
    if (rec === 'optimal')
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">{t('مثالي', 'Optimal')}</Badge>;
    if (rec === 'underused')
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">{t('استخدام منخفض', 'Sous-utilisé')}</Badge>;
    return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">{t('استخدام مكثف', 'Sur-utilisé')}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground text-sm">
        {t('جاري تحليل بيانات استخدام الأسطول...', 'Analyse de l\'utilisation de la flotte...')}
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="p-8 text-center text-rose-600 text-sm">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        {error || t('فشل تحميل التقرير', 'Échec du chargement')}
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            {t('تحليل استخدام الأسطول', 'Analyse d\'Utilisation de la Flotte')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('تقرير دوري لنسبة استفادة الشاحنات والمقطورات والسائقين', 'Rapport périodique sur l\'utilisation des camions, remorques et chauffeurs')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <SummaryCard
          icon={<Truck className="w-5 h-5" />}
          label={t('الشاحنات', 'Camions')}
          value={`${report.summary.totalTrucks}`}
          sub={t('متوسط الاستخدام', 'Utilisation moyenne') + `: ${report.summary.avgTruckUtilization}%`}
          color="blue"
        />
        <SummaryCard
          icon={<Container className="w-5 h-5" />}
          label={t('المقطورات', 'Remorques')}
          value={`${report.summary.totalTrailers}`}
          sub={t('متوسط الاستخدام', 'Utilisation moyenne') + `: ${report.summary.avgTrailerUtilization}%`}
          color="teal"
        />
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          label={t('السائقين', 'Chauffeurs')}
          value={`${report.summary.totalDrivers}`}
          sub={t('متوسط الاستخدام', 'Utilisation moyenne') + `: ${report.summary.avgDriverUtilization}%`}
          color="purple"
        />
        <SummaryCard
          icon={<Activity className="w-5 h-5" />}
          label={t('مؤشر الاستخدام', "Taux d'utilisation")}
          value={`${report.summary.underutilizedCount}`}
          sub={t('أصول منخفضة الاستخدام', 'sous-utilisés')}
          color="amber"
          alert={report.summary.underutilizedCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <UtilizationTable
          title={t('استخدام الشاحنات', 'Utilisation des camions')}
          icon={<Truck className="w-4 h-4" />}
          data={report.trucks}
          columns={[
            { key: 'plateNumber', label: t('اللوحة', 'Plaque') },
            { key: 'completedTrips', label: t('رحلات مكتملة', 'Missions') },
            { key: 'utilizationRate', label: t('النسبة', 'Taux'), suffix: '%' },
            { key: 'totalRevenue', label: t('الإيراد', 'Revenu'), format: 'currency' },
          ]}
        />
        <UtilizationTable
          title={t('استخدام المقطورات', 'Utilisation des remorques')}
          icon={<Container className="w-4 h-4" />}
          data={report.trailers}
          columns={[
            { key: 'plateNumber', label: t('اللوحة', 'Plaque') },
            { key: 'completedTrips', label: t('رحلات مكتملة', 'Missions') },
            { key: 'utilizationRate', label: t('النسبة', 'Taux'), suffix: '%' },
          ]}
        />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {t('استخدام السائقين', 'Utilisation des chauffeurs')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                  <th className="py-3 px-4 text-start font-semibold">{t('السائق', 'Chauffeur')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('رحلات مكتملة', 'Missions')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('نسبة الاستخدام', "Taux d'utilisation")}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('الإيراد', 'Revenu')}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t('التوصية', 'Recommandation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {report.drivers.map((d) => (
                  <tr key={d.driverId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-semibold">{d.driverName}</td>
                    <td className="py-3 px-4 font-mono">{d.completedTrips}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.utilizationRate >= 80 ? 'bg-rose-500' : d.utilizationRate >= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, d.utilizationRate))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px]">{d.utilizationRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(d.totalRevenue, 'MAD')}</td>
                    <td className="py-3 px-4">{getRecommendationBadge(d.recommendation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'teal' | 'purple' | 'amber';
  alert?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600',
    teal: 'bg-teal-500/10 text-teal-600',
    purple: 'bg-purple-500/10 text-purple-600',
    amber: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <Card className={`border-border ${alert ? 'border-amber-500/30' : ''}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function UtilizationTable({
  title,
  icon,
  data,
  columns,
}: {
  title: string;
  icon: React.ReactNode;
  data: { plateNumber: string; completedTrips: number; utilizationRate: number; totalRevenue?: number; recommendation: string }[];
  columns: { key: string; label: string; suffix?: string; format?: 'currency' }[];
}) {
  const { t } = useLanguage();

  const getRecommendationBadge = (rec: 'optimal' | 'underused' | 'overused') => {
    if (rec === 'optimal')
      return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">{t('مثالي', 'Optimal')}</Badge>;
    if (rec === 'underused')
      return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">{t('استخدام منخفض', 'Sous-utilisé')}</Badge>;
    return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">{t('استخدام مكثف', 'Sur-utilisé')}</Badge>;
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs">
                {columns.map((col) => (
                  <th key={col.key} className="py-3 px-4 text-start font-semibold">{col.label}</th>
                ))}
                <th className="py-3 px-4 text-start font-semibold">{t('التوصية', 'Recommandation')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {data.map((item) => (
                <tr key={item.plateNumber} className="hover:bg-muted/30 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4">
                      {col.format === 'currency'
                        ? formatCurrency(item.totalRevenue || 0, 'MAD')
                        : col.key === 'utilizationRate'
                          ? `${item.utilizationRate}${col.suffix || ''}`
                          : item[col.key as keyof typeof item]}
                    </td>
                  ))}
                  <td className="py-3 px-4">{getRecommendationBadge(item.recommendation as 'optimal' | 'underused' | 'overused')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
