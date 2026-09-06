'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { useDashboardDataQuery } from '@/lib/query/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { formatCurrency } from '@/lib/forex';
import {
  Truck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Wrench,
  FileCheck,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  DollarSign,
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
} from 'recharts';

export function DashboardClient() {
  const { t, dir, locale } = useLanguage();
  const { data, isLoading, refetch, isRefetching } = useDashboardDataQuery();

  const stats = data?.stats;
  const recentTrips = data?.recentTrips || [];
  const statusDistribution = data?.statusDistribution || [];
  const monthlyRevenueData = data?.monthlyRevenueData || [];

  const localizedStatusMap: Record<string, string> = useMemo(
    () => ({
      completed: t('مكتملة', 'Terminée', 'Completed'),
      delivered: t('تم التسليم', 'Livrée', 'Delivered'),
      in_transit: t('في الطريق', 'En transit', 'In Transit'),
      in_progress: t('قيد التنفيذ', 'En cours', 'In Progress'),
      loaded: t('تم التحميل', 'Chargé', 'Loaded'),
      pending: t('قيد الانتظار', 'En attente', 'Pending'),
      cancelled: t('ملغاة', 'Annulée', 'Cancelled'),
    }),
    [t]
  );

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black font-amiri text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            {t('لوحة التحكم الإحصائية', 'Tableau de Bord Général', 'General Dashboard')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              'مؤشرات الأداء اللوجستي، التدفق المالي، والجاهزية الفورية للأسطول',
              'Indicateurs logistiques, flux de trésorerie et disponibilité de la flotte',
              'Logistics KPIs, cash flow metrics, and real-time fleet availability'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="rounded-xl h-9 text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''} ${
                dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'
              }`}
            />
            {t('تحديث البيانات', 'Actualiser', 'Refresh')}
          </Button>
          <Link href="/trips">
            <Button className="rounded-xl h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              {t('إدارة الرحلات', 'Gestion des Trajets', 'Manage Trips')}
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي الرحلات', 'Total Trajets', 'Total Trips')}</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                {isLoading ? '...' : stats?.totalTrips || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('رحلات قيد التنفيذ', 'Trajets en cours', 'Active Trips')}</p>
              <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {isLoading ? '...' : stats?.activeTrips || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('رحلات مكتملة', 'Trajets livrés', 'Completed Trips')}</p>
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {isLoading ? '...' : stats?.completedTrips || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('إجمالي العملاء', 'Total Clients', 'Total Clients')}</p>
              <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                {isLoading ? '...' : stats?.totalClients || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs md:col-span-2">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('إيراد الفواتير الإجمالي (MAD)', 'Chiffre d’affaires facturé (MAD)', 'Total Invoiced (MAD)')}
                </p>
                <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {isLoading ? '...' : formatCurrency(stats?.totalRevenueMAD, 'MAD')}
                </p>
              </div>
            </div>
            {stats?.totalRevenueEUR ? (
              <span className="text-xs font-mono font-bold bg-muted px-2.5 py-1 rounded-lg text-muted-foreground">
                {formatCurrency(stats.totalRevenueEUR, 'EUR')}
              </span>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('شاحنات في الصيانة', 'En maintenance', 'In Maintenance')}</p>
              <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                {isLoading ? '...' : stats?.maintenanceTrucks || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('سلف معلقة للتسوية', 'Avances en attente', 'Pending Advances')}</p>
              <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {isLoading ? '...' : stats?.pendingSettlements || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Chart */}
        <Card className="lg:col-span-2 rounded-2xl border-border shadow-xs">
          <CardHeader>
            <CardTitle className="font-amiri text-base">
              {t('الإيرادات الشهرية المقدرة', 'Revenu mensuel estimé', 'Estimated Monthly Revenue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
                    }}
                    formatter={(val: number) => [formatCurrency(val, 'MAD'), t('الإيراد', 'Revenu', 'Revenue')]}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution Pie Chart */}
        <Card className="rounded-2xl border-border shadow-xs flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="font-amiri text-base">
              {t('توزيع حالات الرحلات', 'Répartition des statuts', 'Trip Status Breakdown')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusDistribution.map((entry, idx) => (
                      <Cell key={`status-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full pt-3 border-t border-border">
              {statusDistribution.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground truncate">{entry.name}</span>
                  </div>
                  <span className="font-bold font-mono text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips Table */}
      <Card className="rounded-2xl border-border shadow-xs overflow-hidden">
        <CardHeader className="border-b border-border/70 py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <span>{t('آخر الرحلات المسجلة', 'Derniers trajets enregistrés', 'Recent Trips')}</span>
          </CardTitle>
          <Link href="/trips" className="text-xs text-primary hover:underline flex items-center gap-1">
            <span>{t('عرض الكل', 'Voir tout', 'View all')}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentTrips.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{t('لا توجد رحلات مسجلة بعد', 'Aucun voyage enregistré', 'No registered trips yet')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs">
                    <th className="py-3 px-4 text-start font-semibold">{t('الرحلة / المسار', 'Trajet / Route', 'Trip / Route')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الشاحنة', 'Tracteur', 'Truck')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('السائق', 'Chauffeur', 'Driver')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('التاريخ', 'Date', 'Date')}</th>
                    <th className="py-3 px-4 text-start font-semibold">{t('الحالة', 'Statut', 'Status')}</th>
                    <th className="py-3 px-4 text-end font-semibold">{t('الإجراء', 'Action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary font-bold">#{trip.id}</span>
                          <span className="truncate max-w-[220px]">{trip.route}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <MatriculeBadge plate={trip.truck?.plate_number || '—'} variant="badge" size="xs" />
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        {trip.driver?.name || t('غير مسند', 'Non assigné', 'Unassigned')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-muted-foreground">
                        {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US') : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="outline" className="text-xs">
                          {localizedStatusMap[trip.status] || trip.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <Link href={`/trips/${trip.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
