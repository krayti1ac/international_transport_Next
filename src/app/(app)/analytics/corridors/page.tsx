import { getCorridorAnalyticsAction } from '@/features/analytics/services/corridor-analytics.actions';
import { CorridorAnalyticsView } from '@/features/analytics/components/CorridorAnalyticsView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'تحليلات الممرين والربحية والوقود | Trans Bodanon TMS',
  description: 'مقارنة الأداء المالي والتشغيلي وكفاءة الوقود بين الممر الأوروبي والممر الإفريقي بدقة Decimal.js',
};

export default async function CorridorAnalyticsPage() {
  const res = await getCorridorAnalyticsAction();

  const emptyFallback = {
    overall: {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMarginPercent: 0,
      totalTrips: 0,
      totalDistanceKm: 0,
      totalFuelLiters: 0,
      averageConsumptionL100km: 36.0,
      currency: 'MAD',
    },
    europeanMaritime: {
      corridor: 'european_maritime' as const,
      totalTrips: 0,
      totalRevenue: 0,
      totalDirectExpenses: 0,
      netProfit: 0,
      profitMarginPercent: 0,
      totalRoadDistanceKm: 0,
      totalFerryDistanceKm: 0,
      totalDistanceKm: 0,
      totalFuelLiters: 0,
      totalFuelCost: 0,
      averageConsumptionL100km: 0,
      revenuePerKm: 0,
      expensesPerKm: 0,
      netProfitPerKm: 0,
      ferryOrTransitCost: 0,
      customsCost: 0,
      driverAllowances: 0,
      otherExpenses: 0,
    },
    africanOverland: {
      corridor: 'african_overland' as const,
      totalTrips: 0,
      totalRevenue: 0,
      totalDirectExpenses: 0,
      netProfit: 0,
      profitMarginPercent: 0,
      totalRoadDistanceKm: 0,
      totalFerryDistanceKm: 0,
      totalDistanceKm: 0,
      totalFuelLiters: 0,
      totalFuelCost: 0,
      averageConsumptionL100km: 0,
      revenuePerKm: 0,
      expensesPerKm: 0,
      netProfitPerKm: 0,
      ferryOrTransitCost: 0,
      customsCost: 0,
      driverAllowances: 0,
      otherExpenses: 0,
    },
    fuelAnomalies: [],
    trips: [],
  };

  const data = res.success && res.data ? res.data : emptyFallback;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <CorridorAnalyticsView initialData={data} />
    </div>
  );
}

