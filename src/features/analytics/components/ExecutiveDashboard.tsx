'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Receipt,
  Truck,
  Car,
  Landmark,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Fuel,
  Activity,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import {
  getExecutiveKPIs,
  type ExecutiveKPI,
} from '@/features/analytics/services/analytics.actions';
import { formatCurrency } from '@/lib/forex';
import { MatriculeBadge } from '@/components/ui/matricule-badge';

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<ExecutiveKPI | null>(null);
  const [chartView, setChartView] = useState<'bar' | 'area'>('bar');
  const [alertFilter, setAlertFilter] = useState<'all' | 'expired_document' | 'late_invoice'>('all');
  const { toast } = useToast();

  const fetchKPIs = useCallback(async () => {
    try {
      setRefreshing(true);
      const result = await getExecutiveKPIs();
      if (result.success && result.data) {
        setKpis(result.data);
      } else {
        toast({
          title: 'خطأ',
          description: result.error || 'فشل في جلب المؤشرات التنفيذية',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4" dir="rtl">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">جاري إعداد وتحليل مؤشرات لوحة القيادة التنفيذية...</p>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-16 space-y-4" dir="rtl">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-foreground font-bold">لا توجد بيانات متاحة حالياً</p>
        <Button onClick={fetchKPIs} variant="outline" className="rounded-xl">
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const totalLiquidityMAD = kpis.totalLiquidAssets['MAD'] || 0;
  const totalLiquidityEUR = kpis.totalLiquidAssets['EUR'] || 0;

  const filteredAlerts = alertFilter === 'all'
    ? kpis.criticalAlerts
    : kpis.criticalAlerts.filter((a) => a.type === alertFilter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10" dir="rtl">
      {/* 1. Header with Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>ذكاء الأعمال واللوحة التنفيذية (Executive BI)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-amiri tracking-tight text-foreground flex items-center gap-2">
            اللوحة القيادية التنفيذية
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            متابعة شاملة للإيرادات، صافي الأرباح، التدفقات النقدية، وكفاءة أسطول النقل الدولي
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchKPIs}
            disabled={refreshing}
            className="rounded-xl h-9 text-xs flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>تحديث المؤشرات</span>
          </Button>

          <Link href="/trips">
            <Button size="sm" className="rounded-xl h-9 text-xs flex items-center gap-1.5 shadow-sm">
              <Truck className="w-3.5 h-3.5" />
              <span>إدارة الرحلات</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Total Revenue */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">إجمالي الإيرادات</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(kpis.totalRevenue, 'MAD')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>عقود النقل الدولي النشطة</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Net Profit */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">صافي الأرباح</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-xl sm:text-2xl font-extrabold font-mono ${kpis.netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
              {formatCurrency(kpis.netProfit, 'MAD')}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1">
              <span>هامش الربح: {kpis.profitMargin}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: MAD Liquidity */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">السيولة النقدية (MAD)</span>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-foreground">
              {formatCurrency(totalLiquidityMAD, 'MAD')}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">البنوك والخزينة المحلية</p>
          </CardContent>
        </Card>

        {/* Card 4: EUR Liquidity */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">السيولة الدولية (EUR)</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
              {formatCurrency(totalLiquidityEUR, 'EUR')}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">حسابات أوروبا والعبور</p>
          </CardContent>
        </Card>

        {/* Card 5: Unpaid Invoices */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">ديون غير محصلة</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
              {formatCurrency(kpis.totalUnpaidInvoices, 'MAD')}
            </div>
            <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">فواتير بانتظار السداد</p>
          </CardContent>
        </Card>

        {/* Card 6: Fleet Utilization */}
        <Card className="rounded-2xl border-border/70 bg-card shadow-xs hover:shadow-md transition-all">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">تشغيل الأسطول</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {kpis.fleetUtilizationRate}%
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(kpis.fleetUtilizationRate, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {kpis.activeTrucksCount} من {kpis.totalTrucksCount} شاحنات نشطة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue vs Expenses Chart (Span 2) */}
        <Card className="lg:col-span-2 rounded-2xl border-border/80 bg-card shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
                <Activity className="w-5 h-5 text-primary" />
                مقارنة الإيرادات مقابل المصروفات شهرياً
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                تطور التدفقات المالية الشهرية وصافي الأرباح
              </CardDescription>
            </div>

            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
              <button
                onClick={() => setChartView('bar')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  chartView === 'bar' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                أعمدة
              </button>
              <button
                onClick={() => setChartView('area')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  chartView === 'area' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                مساحي
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'bar' ? (
                  <BarChart data={kpis.monthlyFinancials} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="monthName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value), 'MAD'),
                        name === 'revenue' ? 'الإيرادات' : name === 'expenses' ? 'المصروفات' : 'صافي الربح',
                      ]}
                      labelFormatter={(label) => `شهر ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs font-semibold text-foreground">
                          {value === 'revenue' ? 'الإيرادات' : value === 'expenses' ? 'المصروفات التشغيلية' : 'صافي الربح'}
                        </span>
                      )}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} name="revenue" maxBarSize={32} />
                    <Bar dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} name="expenses" maxBarSize={32} />
                    <Bar dataKey="netProfit" fill="#3b82f6" radius={[6, 6, 0, 0]} name="netProfit" maxBarSize={32} />
                  </BarChart>
                ) : (
                  <AreaChart data={kpis.monthlyFinancials} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="monthName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value), 'MAD'),
                        name === 'revenue' ? 'الإيرادات' : name === 'expenses' ? 'المصروفات' : 'صافي الربح',
                      ]}
                      labelFormatter={(label) => `شهر ${label}`}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs font-semibold text-foreground">
                          {value === 'revenue' ? 'الإيرادات' : value === 'expenses' ? 'المصروفات' : 'صافي الربح'}
                        </span>
                      )}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" name="revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="expenses" />
                    <Area type="monotone" dataKey="netProfit" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="netProfit" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Status Donut Chart (Span 1) */}
        <Card className="rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-border/40">
            <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
              <Truck className="w-5 h-5 text-blue-500" />
              توزيع حالة الأسطول
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              نسبة الجاهزية والتشغيل الميداني للشاحنات
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-center">
            <div className="h-[210px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpis.fleetStatusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {kpis.fleetStatusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} شاحنة`, name]}
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                      borderRadius: '10px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black font-mono text-foreground">{kpis.totalTrucksCount}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">إجمالي الشاحنات</span>
              </div>
            </div>

            {/* Status Legend Grid */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
              {kpis.fleetStatusDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground text-[11px] truncate max-w-[85px]">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground text-xs">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Second Row: Cost Breakdown & Critical Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operating Cost Breakdown */}
        <Card className="rounded-2xl border-border/80 bg-card shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-border/40">
            <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
              <Fuel className="w-5 h-5 text-amber-500" />
              هيكل وتوزيع المصروفات التشغيلية
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              توزيع تكاليف الوقود، العبّارات، الرواتب، والصيانة
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kpis.expensesBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {kpis.expensesBreakdown.map((entry, index) => (
                        <Cell key={`exp-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), 'MAD')}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        borderColor: 'var(--border)',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs">
                {kpis.expensesBreakdown.map((item) => {
                  const percent = kpis.totalExpenses > 0 ? Math.round((item.value / kpis.totalExpenses) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-foreground font-medium text-[11px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-[10px] text-muted-foreground font-sans">({percent}%)</span>
                        <span className="font-bold text-foreground text-xs">{formatCurrency(item.value, 'MAD')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Alerts & Action Feed */}
        <Card className="rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between">
          <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                مركز التنبيهات والقرارات الحرجة
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                تنبيهات الوثائق المنتهية والفواتير المتأخرة المستحقة
              </CardDescription>
            </div>

            <div className="flex items-center bg-muted/60 p-0.5 rounded-xl border border-border/50 text-xs">
              <button
                onClick={() => setAlertFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  alertFilter === 'all' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                الكل ({kpis.criticalAlerts.length})
              </button>
              <button
                onClick={() => setAlertFilter('expired_document')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  alertFilter === 'expired_document' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                وثائق
              </button>
              <button
                onClick={() => setAlertFilter('late_invoice')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  alertFilter === 'late_invoice' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                فواتير
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 max-h-[280px] overflow-y-auto space-y-2.5">
            {filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-xs font-semibold text-foreground">لا توجد تنبيهات حرجة في هذا القسم</p>
                <p className="text-[11px] text-muted-foreground">جميع الوثائق والفواتير مطابقة وتحت السيطرة</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${
                    alert.severity === 'high'
                      ? 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
                      : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{alert.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          alert.severity === 'high'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {alert.type === 'expired_document' ? 'وثيقة رسمية' : 'فاتورة معلقة'}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{alert.description}</p>
                  </div>

                  {alert.actionUrl && (
                    <Link href={alert.actionUrl}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] rounded-lg shrink-0 text-primary hover:bg-primary/10">
                        معاينة
                        <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Fleet Performance & ROI Summary Table */}
      <Card className="rounded-2xl border-border/80 bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-amiri text-lg flex items-center gap-2 text-foreground">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              مصفوفة ربحية وعائد الاستثمار لكل شاحنة (Fleet ROI Matrix)
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              مقارنة الإيرادات، الوقود، الصيانة، وصافي العائد على مستوى كل شاحنة
            </CardDescription>
          </div>

          <Link href="/fleet">
            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs">
              <Car className="w-3.5 h-3.5 ml-1.5" />
              إدارة الأسطول
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/60 text-muted-foreground uppercase border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3">الشاحنة</th>
                  <th className="px-4 py-3">السائق المسند</th>
                  <th className="px-4 py-3 text-center">عدد الرحلات</th>
                  <th className="px-4 py-3">إجمالي الإيرادات</th>
                  <th className="px-4 py-3">مصاريف الوقود</th>
                  <th className="px-4 py-3">الصيانة والإصلاح</th>
                  <th className="px-4 py-3">صافي الربح</th>
                  <th className="px-4 py-3 text-center">عائد الاستثمار (ROI)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {kpis.fleetROI.map((truck) => (
                  <tr key={truck.truckId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3.5 font-medium">
                      <div className="flex items-center gap-2">
                        <MatriculeBadge plate={truck.plateNumber} variant="badge" size="xs" />
                        <span className="text-muted-foreground text-[11px] hidden sm:inline">({truck.model})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-foreground font-medium">{truck.driverName}</td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted border border-border text-[11px]">
                        {truck.tripsCount} رحلات
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(truck.revenue, 'MAD')}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {formatCurrency(truck.fuelCost, 'MAD')}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted-foreground">
                      {formatCurrency(truck.maintenanceCost, 'MAD')}
                    </td>
                    <td className={`px-4 py-3.5 font-mono font-extrabold ${truck.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {formatCurrency(truck.netProfit, 'MAD')}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                          truck.roi >= 50
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : truck.roi >= 0
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                        }`}
                      >
                        {truck.roi >= 0 ? `+${truck.roi}%` : `${truck.roi}%`}
                      </span>
                    </td>
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
