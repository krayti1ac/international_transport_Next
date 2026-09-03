'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Truck, Users, TrendingUp, Calendar } from 'lucide-react';

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

      // حساب الإحصائيات
      const invoices = invoicesData || [];
      const trips = tripsData || [];

      const totalRevenue = invoices
        .filter((i: any) => i.status === 'paid')
        .reduce((sum: number, i: any) => sum + (Number(i.total_amount) || 0), 0);

      const paidInvoices = invoices.filter((i: any) => i.status === 'paid').length;

      // تجميع الإيرادات الشهرية
      const monthlyData: { [key: string]: number } = {};
      invoices.forEach((inv: any) => {
        const monthKey = inv.created_at?.slice(0, 7) || '';
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (Number(inv.total_amount) || 0);
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
        monthlyRevenue: Object.entries(monthlyData).map(([month, revenue]) => ({ month, revenue })),
        tripStatus: Object.entries(tripStatusCount).map(([name, value]) => ({ name, value })),
        invoiceStatus: Object.entries(invoiceStatusCount).map(([name, value]) => ({ name, value })),
        topClients: [],
      });
    } catch (error: any) {
      toast({
        title: 'خطأ في جلب التقارير',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const map: { [key: string]: string } = {
      planned: 'مخطط لها',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتملة',
      cancelled: 'ملغاة',
      paid: 'مدفوعة',
      unpaid: 'غير مدفوعة',
      partially_paid: 'مدفوعة جزئياً',
      overdue: 'متأخرة',
    };
    return map[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">جاري تحميل التقارير...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">التقارير المتقدمة</h1>
          <p className="text-sm text-muted-foreground mt-0.5">تحليل شامل للأداء المالي والعمليات</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات</CardTitle>
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{stats.totalRevenue.toLocaleString('ar-MA')} درهم</div>
            <p className="text-xs text-muted-foreground mt-1">من الفواتير المدفوعة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الرحلات</CardTitle>
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{stats.totalTrips}</div>
            <p className="text-xs text-muted-foreground mt-1">خلال هذا الشهر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الفواتير المدفوعة</CardTitle>
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {stats.paidInvoices} / {stats.totalInvoices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              نسبة التحصيل: {stats.totalInvoices ? ((stats.paidInvoices / stats.totalInvoices) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">العملاء النشطون</CardTitle>
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground mt-1">عميل نشط</p>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">الإيرادات الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                <Bar dataKey="revenue" fill="#2563eb" name="الإيرادات" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-amiri text-foreground">حالة الرحلات</CardTitle>
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
            <CardTitle className="font-amiri text-foreground">حالة الفواتير</CardTitle>
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
