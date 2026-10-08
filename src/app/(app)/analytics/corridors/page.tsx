import { getCorridorAnalyticsAction } from '@/features/analytics/services/corridor-analytics.actions';
import { getCorridorPnlAnalyticsAction } from '@/features/analytics/services/corridor-pnl.actions';
import { CorridorHubView } from '@/features/analytics/components/CorridorHubView';
import type { CorridorPnlAnalyticsResult } from '@/features/analytics/types/corridor-pnl.types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ذكاء الممرات وهوامش الربحية وتكلفة الكيلومتر (CPK) | Trans Bodanon TMS',
  description: 'تحليل دقيق لتكلفة الكيلومتر الصافية (CPK) وهوامش الربحية وكفاءة الوقود بين الممر الأوروبي والممر الإفريقي بدقة Decimal.js',
};

export default async function CorridorAnalyticsPage() {
  const [fuelRes, pnlRes] = await Promise.all([
    getCorridorAnalyticsAction(),
    getCorridorPnlAnalyticsAction(),
  ]);

  const emptyFuelFallback = {
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

  const emptyPnlFallback: CorridorPnlAnalyticsResult = {
    overall: {
      corridor: 'all',
      corridorNameAr: 'الأسطول الموحد',
      corridorNameFr: 'Flotte Globale',
      corridorNameEs: 'Flota Global',
      totalTrips: 0,
      totalRevenueMad: 0,
      totalOperatingCostsMad: 0,
      netProfitMad: 0,
      grossMarginPercent: 0,
      netMarginPercent: 0,
      totalKm: 0,
      totalRoadKm: 0,
      totalFerryKm: 0,
      revenuePerKmMad: 0,
      costPerKmMad: 0,
      netProfitPerKmMad: 0,
      cpkBreakdown: {
        fuelCpk: 0,
        maintenanceCpk: 0,
        ferryTransitCpk: 0,
        customsCpk: 0,
        driverAllowanceCpk: 0,
        otherCpk: 0,
        totalCpk: 0,
      },
      totalCargoTons: 0,
      totalTonKm: 0,
      costPerTonKmMad: 0,
      revenuePerTonKmMad: 0,
    },
    africanOverland: {
      corridor: 'african_overland',
      corridorNameAr: 'الممر البري الإفريقي',
      corridorNameFr: 'Corridor Terrestre Africain',
      corridorNameEs: 'Corredor Terrestre Africano',
      totalTrips: 0,
      totalRevenueMad: 0,
      totalOperatingCostsMad: 0,
      netProfitMad: 0,
      grossMarginPercent: 0,
      netMarginPercent: 0,
      totalKm: 0,
      totalRoadKm: 0,
      totalFerryKm: 0,
      revenuePerKmMad: 0,
      costPerKmMad: 0,
      netProfitPerKmMad: 0,
      cpkBreakdown: {
        fuelCpk: 0,
        maintenanceCpk: 0,
        ferryTransitCpk: 0,
        customsCpk: 0,
        driverAllowanceCpk: 0,
        otherCpk: 0,
        totalCpk: 0,
      },
      totalCargoTons: 0,
      totalTonKm: 0,
      costPerTonKmMad: 0,
      revenuePerTonKmMad: 0,
    },
    europeanMaritime: {
      corridor: 'european_maritime',
      corridorNameAr: 'الممر البحري الأوروبي',
      corridorNameFr: 'Corridor Maritime Européen',
      corridorNameEs: 'Corredor Marítimo Europeo',
      totalTrips: 0,
      totalRevenueMad: 0,
      totalOperatingCostsMad: 0,
      netProfitMad: 0,
      grossMarginPercent: 0,
      netMarginPercent: 0,
      totalKm: 0,
      totalRoadKm: 0,
      totalFerryKm: 0,
      revenuePerKmMad: 0,
      costPerKmMad: 0,
      netProfitPerKmMad: 0,
      cpkBreakdown: {
        fuelCpk: 0,
        maintenanceCpk: 0,
        ferryTransitCpk: 0,
        customsCpk: 0,
        driverAllowanceCpk: 0,
        otherCpk: 0,
        totalCpk: 0,
      },
      totalCargoTons: 0,
      totalTonKm: 0,
      costPerTonKmMad: 0,
      revenuePerTonKmMad: 0,
    },
    anomalies: [],
    trips: [],
    currencyRates: {
      MAD: 1.0,
      EUR: 10.85,
      MRU: 0.25,
      XOF: 0.0165,
    },
  };

  const fuelData = fuelRes.success && fuelRes.data ? fuelRes.data : emptyFuelFallback;
  const pnlData = pnlRes.success && pnlRes.data ? pnlRes.data : emptyPnlFallback;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <CorridorHubView pnlData={pnlData} fuelData={fuelData} />
    </div>
  );
}

