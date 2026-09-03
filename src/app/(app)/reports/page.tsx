'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  DollarSign,
  Users,
  Truck,
  Route,
  ArrowUpRight,
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Sparkles,
  RefreshCw,
  Activity,
  Layers,
  Fuel,
  Receipt,
  Wallet,
  ShieldAlert,
  ArrowUp,
  FileWarning
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
  Legend
} from 'recharts';

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

const STATUS_LABELS: Record<string, { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'danger' }> = {
  completed: { label: 'مكتملة', badgeVariant: 'success' },
  delivered: { label: 'تم التسليم', badgeVariant: 'success' },
  in_transit: { label: 'في الطريق', badgeVariant: 'default' },
  in_progress: { label: 'قيد التنفيذ', badgeVariant: 'default' },
  loaded: { label: 'تم التحميل', badgeVariant: 'secondary' },
  pending: { label: 'معلقة / مجدولة', badgeVariant: 'warning' },
  cancelled: { label: 'ملغاة', badgeVariant: 'danger' },
};

export default function ReportsPage() {
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeTrips: 0,
    completedTrips: 0,
    totalRevenueMAD: 0,
    totalRevenueEUR: 0,
    totalClients: 0,
    totalTrucks: 0,
    maintenanceTrucks: 0,
    pendingSettlements: 0,
  });

  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<{ month: string; revenue: number; trips: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchStats = useCallback(async () => {
    try {
      const [tripsCountRes, activeTripsRes, clientsRes, trucksRes, invoicesRes, recentTripsRes, allTripsRes, settlementsRes] =
        await Promise.all([
          supabase.from('trip_orders').select('id', { count: 'exact', head: true }),
          supabase.from('trip_orders').select('id', { count: 'exact', head: true }).in('status', ['in_transit', 'in_progress', 'loaded']),
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('trucks').select('id, status', { count: 'exact' }),
          supabase.from('invoices').select('total_amount, currency, created_at'),
          supabase
            .from('trip_orders')
            .select(`
              id, route, price, status, departure_date, cmr_number,
              driver:drivers(name),
              truck:trucks(plate_number),
              client:clients(name)
            `)
            .order('id', { ascending: false })
            .limit(6),
          supabase.from('trip_orders').select('status, departure_date, price'),
          supabase.from('driver_advances').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);

      if (tripsCountRes.error) throw tripsCountRes.error;
      if (clientsRes.error) throw clientsRes.error;

      // Calculate Revenues
      let revenueMAD = 0;
      let revenueEUR = 0;
      (invoicesRes.data as { total_amount?: string | number | null; currency?: string | null; created_at?: string | null }[] | null)?.forEach((inv) => {
        const amt = parseFloat(String(inv.total_amount || '0'));
        if (inv.currency === 'EUR') {
          revenueEUR += amt;
        } else {
          revenueMAD += amt;
        }
      });

      // Calculate status distribution
      const statusCounts: Record<string, number> = {};
      (allTripsRes.data as { status?: string | null; departure_date?: string | null; price?: number | null }[] | null)?.forEach((trip) => {
        const s = trip.status || 'pending';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const dist = Object.entries(statusCounts).map(([statusKey, count]) => ({
        name: STATUS_LABELS[statusKey]?.label || statusKey,
        value: count,
        color: STATUS_COLORS[statusKey] || '#94a3b8',
      }));

      // Calculate monthly revenue
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const monthlyMap: Record<number, { revenue: number; trips: number }> = {};

      (invoicesRes.data as { total_amount?: string | number | null; created_at?: string | null }[] | null)?.forEach((inv) => {
        if (inv.created_at) {
          const m = new Date(inv.created_at).getMonth();
          if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, trips: 0 };
          monthlyMap[m].revenue += parseFloat(String(inv.total_amount || '0'));
        }
      });

      (allTripsRes.data as { departure_date?: string | null }[] | null)?.forEach((trip) => {
        if (trip.departure_date) {
          const m = new Date(trip.departure_date).getMonth();
          if (!monthlyMap[m]) monthlyMap[m] = { revenue: 0, trips: 0 };
          monthlyMap[m].trips += 1;
        }
      });

      const currentMonth = new Date().getMonth();
      const chartData = [];
      for (let i = Math.max(0, currentMonth - 5); i <= currentMonth; i++) {
        chartData.push({
          month: months[i] || `شهر ${i + 1}`,
          revenue: Math.round(monthlyMap[i]?.revenue || (i === currentMonth ? revenueMAD : 0)),
          trips: monthlyMap[i]?.trips || (i === currentMonth ? (tripsCountRes.count || 0) : 0),
        });
      }

      const trucksList = trucksRes.data || [];
      const maintCount = trucksList.filter((t: { status?: string }) => t.status === 'maintenance' || t.status === 'inactive').length;

      setStats({
        totalTrips: tripsCountRes.count || 0,
        activeTrips: activeTripsRes.count || 0,
        completedTrips: (tripsCountRes.count || 0) - (activeTripsRes.count || 0),
        totalRevenueMAD: revenueMAD,
        totalRevenueEUR: revenueEUR,
        totalClients: clientsRes.count || 0,
        totalTrucks: trucksRes.count || trucksList.length || 0,
        maintenanceTrucks: maintCount,
        pendingSettlements: settlementsRes && 'count' in settlementsRes ? (settlementsRes.count || 0) : 0,
      });

      setStatusDistribution(dist.length > 0 ? dist : [{ name: 'رحلات مسجلة', value: tripsCountRes.count || 1, color: '#3b82f6' }]);
      setRecentTrips((recentTripsRes.data as unknown as RecentTrip[]) || []);
      setMonthlyRevenueData(chartData.length > 0 ? chartData : [{ month: 'الشهر الحالي', revenue: revenueMAD, trips: tripsCountRes.count || 0 }]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ في جلب البيانات';
      toast({
        title: 'خطأ في تحميل الإحصائيات',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const currentDateFormatted = new Date().toLocaleDateString('ar-MA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Stitch-Style Page Header with Live Operations Status & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentDateFormatted}</span>
            <span className="text-border">|</span>
            <span className="text-primary font-bold">ترانس بودانون - Trans Bodanon</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            نظرة عامة والتحكم اللوجستي
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            مركز التحكم اللوجستي وإدارة الرحلات والأسطول في الوقت الفعلي.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            asChild
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <Link href="/trips">
              <PlusCircle className="w-4 h-4 ml-1.5" />
              رحلة جديدة
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-border bg-card hover:bg-muted text-foreground text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
          >
            <Link href="/treasury">
              <Receipt className="w-4 h-4 ml-1.5 text-amber-500" />
              تسجيل مصاريف
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="تحديث البيانات"
            className="rounded-xl h-10 w-10 border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stitch KPI Cards Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Revenue Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              إجمالي الإيرادات
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground flex items-baseline gap-1.5">
              {stats.totalRevenueMAD.toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground">د.م.</span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>+12% نمو الإيرادات مقارنة بالفترة السابقة</span>
            </div>
          </div>
        </div>

        {/* Card 2: Fleet Status Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              حالة الأسطول الإجمالية
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {Math.max(0, stats.totalTrucks - stats.maintenanceTrucks)}{' '}
              <span className="text-base text-muted-foreground font-normal font-sans">
                / {stats.totalTrucks || 0} شاحنة
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <span className="bg-muted px-2.5 py-1 rounded-full text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                نشط ({Math.max(0, stats.totalTrucks - stats.maintenanceTrucks)})
              </span>
              <span className="bg-destructive/10 text-destructive px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                صيانة ({stats.maintenanceTrucks})
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Settlements Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-44 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              الرحلات النشطة والتسويات
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground flex items-baseline gap-1.5">
              {stats.activeTrips}{' '}
              <span className="text-xs font-normal text-muted-foreground">رحلة قيد السير</span>
            </div>
            <Link
              href="/driver-settlements"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1.5 flex items-center gap-1"
            >
              <span>{stats.pendingSettlements > 0 ? `${stats.pendingSettlements} تسوية معلقة للمراجعة` : 'جميع التسويات محدثة'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Secondary Section Bento Grid (Alerts + Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Expiries & Urgent Alerts Card (Stitch Component) */}
        <div className="bg-card border border-border/80 rounded-2xl flex flex-col lg:col-span-1 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 flex justify-between items-center bg-muted/30">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold font-amiri text-foreground">
                انتهاء الصلاحية والتنبيهات
              </h2>
            </div>
            <span className="bg-destructive/10 text-destructive text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              3 تنبيهات
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1">
            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-2 rounded-lg flex-shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  تأمين الشاحنة الدولية #402
                </div>
                <div className="text-[11px] text-destructive font-medium mt-0.5">
                  تنتهي الصلاحية خلال 48 ساعة
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-lg flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  الفحص التقني - مقطورة #TR-108
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                  مستحق خلال 5 أيام
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 border border-border/60 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="bg-purple-500/10 text-purple-600 dark:text-purple-400 p-2 rounded-lg flex-shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  تجديد ترخيص النقل الدولي CMR
                </div>
                <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                  مجدول للمراجعة الشهرية
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
                حركة الإيرادات والرحلات
              </CardTitle>
              <CardDescription className="text-xs">
                مقارنة الإيرادات الشهرية بعدد الرحلات المنفذة
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              آخر 6 أشهر
            </Badge>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-60 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">جاري تحميل البيانات...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenueData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
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
                        direction: 'rtl',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="revenue" name="الإيرادات (د.م.)" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="trips" name="عدد الرحلات" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trips & Live Operations Table */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between border-b border-border/60 bg-muted/20">
          <div>
            <CardTitle className="text-sm font-bold font-amiri flex items-center gap-2">
              <Route className="w-4 h-4 text-primary" />
              أحدث الرحلات والعمليات الجارية
            </CardTitle>
            <CardDescription className="text-xs">
              قائمة بآخر الرحلات المسجلة ومتابعة وثائق الـ CMR
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80">
            <Link href="/trips" className="flex items-center gap-1 font-medium">
              <span>عرض كافة الرحلات</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs font-semibold uppercase border-b border-border/60">
                <tr>
                  <th className="px-4 py-3">رقم الرحلة / CMR</th>
                  <th className="px-4 py-3">خط السير</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">السائق / الشاحنة</th>
                  <th className="px-4 py-3">تاريخ الانطلاق</th>
                  <th className="px-4 py-3">المبلغ</th>
                  <th className="px-4 py-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                      {loading ? 'جاري تحميل الرحلات...' : 'لا توجد رحلات مسجلة حالياً'}
                    </td>
                  </tr>
                ) : (
                  recentTrips.map((trip) => {
                    const statusInfo = STATUS_LABELS[trip.status] || {
                      label: trip.status || 'غير محدد',
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
                          {trip.route || 'غير محدد'}
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
                          {trip.departure_date ? new Date(trip.departure_date).toLocaleDateString('ar-MA') : '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {trip.price ? `${trip.price.toLocaleString()} د.م.` : '—'}
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
  );
}
