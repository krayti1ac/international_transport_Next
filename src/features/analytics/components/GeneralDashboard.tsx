'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  Truck,
  Route,
  ArrowUpRight,
  PlusCircle,
  FileText,
  Sparkles,
  RefreshCw,
  Wallet,
  ShieldAlert,
  ArrowUp,
  FileWarning,
  MapPin,
  Receipt,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useLanguage } from '@/components/language-provider';
import { useDashboardDataQuery } from '@/lib/query/hooks';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface RecentTrip {
  id: number;
  route: string;
  price: number;
  status: string;
  departure_date: string;
  cmr_number?: string;
  driver?: { name: string } | null;
  truck?: { plate_number: string } | null;
  client?: { name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  delivered: '#10b981',
  in_transit: '#3b82f6',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  loaded: '#8b5cf6',
};

export default function GeneralDashboard() {
  const { t, dir, locale } = useLanguage();
  const { data: dashboardData, isLoading, refetch, isRefetching } = useDashboardDataQuery();

  const statusLabels: Record<string, { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'danger' }> = useMemo(() => ({
    completed: { label: t('مكتملة', 'Terminée'), badgeVariant: 'success' },
    delivered: { label: t('تم التسليم', 'Livrée'), badgeVariant: 'success' },
    in_transit: { label: t('في الطريق', 'En transit'), badgeVariant: 'default' },
    in_progress: { label: t('قيد التنفيذ', 'En cours'), badgeVariant: 'default' },
    loaded: { label: t('تم التحميل', 'Chargée'), badgeVariant: 'secondary' },
    pending: { label: t('معلقة / مجدولة', 'En attente / Planifiée'), badgeVariant: 'warning' },
    cancelled: { label: t('ملغاة', 'Annulée'), badgeVariant: 'danger' },
  }), [t]);

  const stats = dashboardData?.stats || {
    totalTrips: 0,
    activeTrips: 0,
    completedTrips: 0,
    totalRevenueMAD: 0,
    totalRevenueEUR: 0,
    totalClients: 0,
    totalTrucks: 0,
    maintenanceTrucks: 0,
    pendingSettlements: 0,
  };

  const statusDistribution = dashboardData?.statusDistribution || [];
  const recentTrips = (dashboardData?.recentTrips as unknown as RecentTrip[]) || [];
  const monthlyRevenueData = dashboardData?.monthlyRevenueData || [];
  const loading = isLoading;
  const refreshing = isRefetching;

  const handleRefresh = () => {
    refetch();
  };

  const currentDateFormatted = new Date().toLocaleDateString(
    locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR',
    {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  const localizedMonthlyData = useMemo(() => {
    const monthMap: Record<string, { es: string; fr: string }> = {
      'يناير': { es: 'Ene', fr: 'Janv' },
      'فبراير': { es: 'Feb', fr: 'Févr' },
      'مارس': { es: 'Mar', fr: 'Mars' },
      'أبريل': { es: 'Abr', fr: 'Avr' },
      'مايو': { es: 'May', fr: 'Mai' },
      'يونيو': { es: 'Jun', fr: 'Juin' },
      'يوليو': { es: 'Jul', fr: 'Juil' },
      'أغسطس': { es: 'Ago', fr: 'Août' },
      'سبتمبر': { es: 'Sep', fr: 'Sept' },
      'أكتوبر': { es: 'Oct', fr: 'Oct' },
      'نوفمبر': { es: 'Nov', fr: 'Nov' },
      'ديسمبر': { es: 'Dic', fr: 'Déc' },
    };
    return monthlyRevenueData.map((item) => ({
      ...item,
      month: locale === 'es'
        ? (monthMap[item.month]?.es || item.month)
        : locale === 'fr'
        ? (monthMap[item.month]?.fr || item.month)
        : item.month,
    }));
  }, [monthlyRevenueData, locale]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentDateFormatted}</span>
            <span className="text-border">|</span>
            <span className="text-primary font-bold">Trans Bodanon TMS</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            {t('لوحة التحكم العامة والعمليات اللوجستية', 'Tableau de Bord Général & Opérations')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t(
              'مركز المراقبة والتحكم اللوجستي اليومي، وإدارة الرحلات والأسطول في الوقت الفعلي.',
              'Centre de surveillance et de contrôle logistique quotidien, gestion des trajets et de la flotte en temps réel.'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <Link href="/trips">
              <PlusCircle className={`w-4 h-4 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'}`} />
              {t('رحلة جديدة', 'Nouveau trajet')}
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <Link href="/truck-tracking">
              <MapPin className={`w-4 h-4 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'} text-blue-500`} />
              {t('تتبع الأسطول', 'Suivi de la flotte')}
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <Link href="/treasury">
              <Receipt className={`w-4 h-4 ${dir === 'rtl' ? 'ms-1.5' : 'me-1.5'} text-amber-500`} />
              {t('تسجيل مصاريف', 'Saisie dépenses')}
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title={t('تحديث البيانات', 'Actualiser')}
            className="rounded-xl h-10 w-10 border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Primary KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Operational Revenue */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              {t('إجمالي الإيرادات المسجلة', 'Chiffre d\'affaires enregistré')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground flex items-baseline gap-1.5" dir="ltr">
              {stats.totalRevenueMAD.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR')}
              <span className="text-xs font-normal text-muted-foreground">{t('د.م.', 'MAD')}</span>
            </div>
            {stats.totalRevenueEUR > 0 && (
              <div className="text-xs font-mono text-muted-foreground mt-1" dir="ltr">
                + {stats.totalRevenueEUR.toLocaleString()} €
              </div>
            )}
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{t('معدل نمو متواصل في رحلات النقل الدولي', 'Croissance continue du transport international')}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Fleet Status Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              {t('جاهزية الأسطول والشاحنات', 'Disponibilité de la flotte')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {Math.max(0, stats.totalTrucks - stats.maintenanceTrucks)}{' '}
              <span className="text-base text-muted-foreground font-normal font-sans">
                / {stats.totalTrucks || 0} {t('شاحنة', 'camions')}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <span className="bg-muted px-2.5 py-1 rounded-full text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {t('نشط', 'Actif')} ({Math.max(0, stats.totalTrucks - stats.maintenanceTrucks)})
              </span>
              <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                {t('صيانة', 'Maintenance')} ({stats.maintenanceTrucks})
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Trips & Settlements */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              {t('الرحلات النشطة والعهد', 'Trajets en cours & Avances')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground flex items-baseline gap-1.5">
              {stats.activeTrips}{' '}
              <span className="text-xs font-normal text-muted-foreground">{t('رحلة في الطريق', 'trajets en route')}</span>
            </div>
            <Link
              href="/driver-settlements"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1.5 flex items-center gap-1"
            >
              <span>{stats.pendingSettlements > 0 ? `${stats.pendingSettlements} ${t('تسوية معلقة للمراجعة', 'règlements en attente')}` : t('جميع تسويات السائقين مكتملة', 'Tous les règlements sont à jour')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary Section Bento Grid (Alerts + Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Expiries & Urgent Alerts Card */}
        <div className="bg-card border border-border/80 rounded-2xl flex flex-col lg:col-span-1 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 flex justify-between items-center bg-muted/30">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold font-amiri text-foreground">
                {t('التنبيهات التشغيلية والوثائق', 'Alertes Opérationnelles & Documents')}
              </h2>
            </div>
            <span className="bg-destructive/10 text-destructive text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              3 {t('تنبيهات', 'alertes')}
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1">
            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded-lg flex-shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {t('تأمين الشاحنة الدولية #402', 'Assurance Camion International #402')}
                </div>
                <div className="text-[11px] text-destructive font-medium mt-0.5">
                  {t('تنتهي الصلاحية خلال 48 ساعة', 'Expire dans 48 heures')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-lg flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {t('الفحص التقني - مقطورة #TR-108', 'Visite Technique - Remorque #TR-108')}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  {t('مستحق خلال 5 أيام', 'Échéance dans 5 jours')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-2 rounded-lg flex-shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {t('تجديد ترخيص النقل الدولي CMR', 'Renouvellement Licence Transport CMR')}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  {t('مجدول للمراجعة الشهرية', 'Programmé pour revue')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Flow Chart */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs lg:col-span-2">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold font-amiri flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {t('حركة الإيرادات والرحلات التشغيلية', 'Évolution du Chiffre d\'Affaires & Trajets')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('مقارنة الإيرادات الشهرية بعدد الرحلات المنفذة', 'Comparaison mensuelle revenus et nombre de trajets')}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {t('آخر 6 أشهر', '6 derniers mois')}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-60 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">{t('جاري تحميل البيانات...', 'Chargement...')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={localizedMonthlyData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: '0.75rem',
                        direction: dir,
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="revenue" name={t('الإيرادات (د.م.)', 'Revenus (MAD)')} fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="trips" name={t('عدد الرحلات', 'Nombre de trajets')} fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution and Operations Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs lg:col-span-1">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold font-amiri flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t('توزيع حالات الرحلات', 'Répartition des Statuts')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('الحالة التشغيلية للرحلات المسجلة بالنظام', 'Statut opérationnel des trajets enregistrés')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '0.75rem',
                      direction: dir,
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {statusDistribution.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground truncate">{t(item.name, item.name)}:</span>
                  <span className="font-mono font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Trips Table */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden lg:col-span-2">
          <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
            <div>
              <CardTitle className="text-sm font-bold font-amiri flex items-center gap-2">
                <Route className="w-4 h-4 text-primary" />
                {t('أحدث الرحلات والعمليات الجارية', 'Derniers Trajets & Opérations')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('متابعة حركة النقل الفوري وأرقام إرساليات الـ CMR', 'Suivi du fret en temps réel et numéros CMR')}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
              <Link href="/trips" className="flex items-center gap-1 font-medium">
                <span>{t('عرض كافة الرحلات', 'Voir tous les trajets')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className={`w-full ${dir === 'rtl' ? 'text-right' : 'text-left'} text-sm`}>
                <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                  <tr>
                    <th className="px-4 py-3">{t('رقم الرحلة / CMR', 'N° Trajet / CMR')}</th>
                    <th className="px-4 py-3">{t('خط السير', 'Itinéraire')}</th>
                    <th className="px-4 py-3">{t('العميل', 'Client')}</th>
                    <th className="px-4 py-3">{t('السائق / الشاحنة', 'Chauffeur / Camion')}</th>
                    <th className="px-4 py-3">{t('تاريخ الانطلاق', 'Date départ')}</th>
                    <th className="px-4 py-3">{t('المبلغ', 'Montant')}</th>
                    <th className="px-4 py-3 text-center">{t('الحالة', 'Statut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentTrips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        {loading ? t('جاري تحميل الرحلات...', 'Chargement...') : t('لا توجد رحلات مسجلة حالياً', 'Aucun trajet enregistré')}
                      </td>
                    </tr>
                  ) : (
                    recentTrips.map((trip) => {
                      const statusInfo = statusLabels[trip.status] || {
                        label: trip.status || t('غير محدد', 'Non défini'),
                        badgeVariant: 'outline' as const,
                      };

                      return (
                        <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                            #{trip.id}
                            {trip.cmr_number && (
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                CMR: {trip.cmr_number}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            {trip.route || t('غير محدد', 'Non défini')}
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground text-xs">
                            {trip.client?.name || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <span className="font-medium text-foreground block mb-1">{trip.driver?.name || '—'}</span>
                            {trip.truck?.plate_number && (
                              <MatriculeBadge plate={trip.truck.plate_number} variant="badge" size="xs" />
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR') : '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                            {trip.price ? `${trip.price.toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'es' ? 'es-ES' : 'fr-FR')} ${t('د.م.', 'MAD')}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge variant={statusInfo.badgeVariant} className="text-[10px] px-2.5 py-0.5 rounded-full">
                              {statusInfo.label}
                            </Badge>
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
      </div>
    </div>
  );
}
