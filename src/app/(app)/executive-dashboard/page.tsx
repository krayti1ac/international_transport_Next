import { getExecutiveMetrics } from '@/features/analytics/services/executive-metrics.actions';
import { ExecutiveCharts } from '@/features/analytics/components/ExecutiveCharts';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/forex';
import { Truck } from '@/components/icons/vehicle-icons';
import { LayoutDashboard, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { useFiscalStore } from '@/lib/stores/fiscal-store';

export const dynamic = 'force-dynamic';

export default async function ExecutiveDashboardPage() {
  const { startDate, endDate } = useFiscalStore.getState();
  const metrics = await getExecutiveMetrics(startDate, endDate);

  const totalTrucks = Object.values(metrics.fleetStatus).reduce((a, b) => a + b, 0);
  const activeAndInTransit = metrics.fleetStatus.active + metrics.fleetStatus.in_transit;
  const fleetUtilization = totalTrucks > 0 ? Math.round((activeAndInTransit / totalTrucks) * 100) : 0;

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            اللوحة القيادية التنفيذية
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            نظرة شمولية حية على الأداء المالي، التدفقات النقدية، وجاهزية أسطول النقل الدولي
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <Card className="border-r-4 border-r-emerald-500 shadow-xs border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">إجمالي الإيرادات المفوترة</p>
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metrics.totalRevenueMAD, 'MAD')}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                + {formatCurrency(metrics.totalRevenueEUR, 'EUR')}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Debts */}
        <Card className="border-r-4 border-r-rose-500 shadow-xs border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">الديون المستحقة (غير المحصلة)</p>
              <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {formatCurrency(metrics.outstandingDebtMAD, 'MAD')}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                + {formatCurrency(metrics.outstandingDebtEUR, 'EUR')}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Fleet Utilization */}
        <Card className="border-r-4 border-r-blue-500 shadow-xs border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">معدل تشغيل الأسطول</p>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {fleetUtilization}%
              </p>
              <p className="text-xs text-muted-foreground">
                {activeAndInTransit} شاحنة في الخدمة الفعلية
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Fleet */}
        <Card className="border-r-4 border-r-amber-500 shadow-xs border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">إجمالي أسطول الشاحنات</p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {totalTrucks} مركبة
              </p>
              <p className="text-xs text-muted-foreground">
                {metrics.fleetStatus.maintenance} صيانة · {metrics.fleetStatus.inactive} متوقفة
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharts Component */}
      <ExecutiveCharts trendData={metrics.monthlyTrend} fleetStatus={metrics.fleetStatus} />
    </div>
  );
}
