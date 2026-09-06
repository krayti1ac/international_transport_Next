'use client';

import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Truck, Users, TrendingUp, Calendar } from 'lucide-react';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ReportStats {
  totalRevenue: number;
  totalTrips: number;
  totalClients: number;
  paidInvoices: number;
  totalInvoices: number;
  monthlyRevenue: { month: string; revenue: number }[];
  tripStatus: { name: string; value: number }[];
  invoiceStatus: { name: string; value: number }[];
  topClients: { name: string; revenue: number }[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AdvancedReportsPage() {
  const { t, dir, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalTrips: 0,
    totalClients: 0,
    paidInvoices: 0,
    totalInvoices: 0,
    monthlyRevenue: [],
    tripStatus: [],
    invoiceStatus: [],
    topClients: [],
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchReports();
  }, [selectedMonth]);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

      // جلب الفواتير
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // جلب الرحلات
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*')
        .gte('departure_date', startDate)
        .lte('departure_date', endDate);

      // جلب العملاء
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // حساب الإحصائيات بواسطة Decimal.js
      const invoices = invoicesData || [];
      const trips = tripsData || [];

      let revSum = new Decimal(0);
      invoices
        .filter((i: any) => i.status === 'paid')
        .forEach((i: any) => {
          revSum = revSum.plus(new Decimal(i.total_amount || 0));
        });
      const totalRevenue = revSum.toNumber();

      const paidInvoices = invoices.filter((i: any) => i.status === 'paid').length;

      // تجميع الإيرادات الشهرية بواسطة Decimal.js
      const monthlyData: { [key: string]: InstanceType<typeof Decimal> } = {};
      invoices.forEach((inv: any) => {
        const monthKey = inv.created_at?.slice(0, 7) || '';
        if (!monthlyData[monthKey]) monthlyData[monthKey] = new Decimal(0);
        monthlyData[monthKey] = monthlyData[monthKey].plus(new Decimal(inv.total_amount || 0));
      });

      // تجميع حالات الرحلات
      const tripStatusCount: { [key: string]: number } = {};
      trips.forEach((trip: any) => {
        tripStatusCount[trip.status] = (tripStatusCount[trip.status] || 0) + 1;
      });

      // تجميع حالات الفواتير
      const invoiceStatusCount: { [key: string]: number } = {};
      invoices.forEach((inv: any) => {
        invoiceStatusCount[inv.status] = (invoiceStatusCount[inv.status] || 0) + 1;
      });

      setStats({
        totalRevenue,
        totalTrips: trips.length,
        totalClients: clientsCount || 0,
        paidInvoices,
        totalInvoices: invoices.length,
        monthlyRevenue: Object.entries(monthlyData).map(([m, rev]) => ({ month: m, revenue: rev.toNumber() })),
        tripStatus: Object.entries(tripStatusCount).map(([name, value]) => ({ name, value })),
        invoiceStatus: Object.entries(invoiceStatusCount).map(([name, value]) => ({ name, value })),
        topClients: [],
      });
    } catch (error: any) {
      toast({
        title: t('خطأ في جلب التقارير', 'Erreur lors du chargement des rapports'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: { [key: string]: string } = {
      planned: t('مخطط لها', 'Planifié'),
      in_progress: t('قيد التنفيذ', 'En cours'),
      completed: t('مكتملة', 'Terminé'),
      cancelled: t('ملغاة', 'Annulé'),
      paid: t('مدفوعة', 'Payée'),
      unpaid: t('غير مدفوعة', 'Impayée'),
      partially_paid: t('مدفوعة جزئياً', 'Partiellement payée'),
      overdue: t('متأخرة', 'En retard'),
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t('جاري تحميل التقارير...', 'Chargement des rapports en cours...')}</p>
      </div>
    );
  }

  const collectionPercent = stats.totalInvoices
    ? new Decimal(stats.paidInvoices).dividedBy(stats.totalInvoices).times(100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
            {t('التقارير المتقدمة', 'Rapports Avancés')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('تحليل شامل للأداء المالي والعمليات', 'Analyse approfondie des performances financières et opérations')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-border bg-background text-foreground rounded-lg"
          />
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('إجمالي الإيرادات', 'Revenu Total')}
            </CardTitle>
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {stats.totalRevenue.toLocaleString(locale === 'ar' ? 'ar-MA' : 'fr-FR')} {t('درهم', 'MAD')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('من الفواتير المدفوعة', 'Sur factures encaissées')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('الرحلات', 'Trajets')}
            </CardTitle>
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{stats.totalTrips}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('خلال هذا الشهر', 'Durant ce mois')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('الفواتير المدفوعة', 'Factures Payées')}
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {stats.paidInvoices} / {stats.totalInvoices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('نسبة التحصيل:', 'Taux de recouvrement:')} {collectionPercent}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('العملاء النشطون', 'Clients Actifs')}
            </CardTitle>
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('عميل نشط', 'client actif')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">
              {t('الإيرادات الشهرية', 'Revenus Mensuels')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                <Bar dataKey="revenue" fill="#2563eb" name={t('الإيرادات', 'Revenus')} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">
              {t('حالة الرحلات', 'Statut des Trajets')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.tripStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${getStatusText(name as string)} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {stats.tripStatus.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">
              {t('حالة الفواتير', 'Statut des Factures')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.invoiceStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${getStatusText(name as string)} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {stats.invoiceStatus.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
