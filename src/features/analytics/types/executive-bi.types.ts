export type InternationalCorridorCode =
  | 'agadir_dakar'
  | 'tanger_valencia_perpignan'
  | 'casablanca_paris'
  | 'dakhla_nouakchott'
  | 'agadir_rotterdam'
  | 'other_corridor';

export type CurrencyCode = 'MAD' | 'EUR' | 'MRU' | 'XOF';

export interface CorridorCostBreakdown {
  fuelCost: string;
  ferryPortFees: string;
  driverAllowancesAdvances: string;
  maintenanceDepreciation: string;
  customsTransitFees: string;
  otherOperatingExpenses: string;
  totalCost: string;
}

export interface CorridorProfitabilitySummary {
  corridorCode: InternationalCorridorCode;
  corridorTitleAr: string;
  corridorTitleFr: string;
  corridorTitleEs: string;
  origin: string;
  destination: string;
  totalTripsCount: number;
  totalDistanceKm: number;
  revenue: string;
  costs: CorridorCostBreakdown;
  grossProfit: string;
  netOperatingProfit: string;
  netMarginPercent: string;
  actualCpk: string;
  targetCpk: string;
  cpkVariancePercent: string;
  revenuePerKm: string;
  isAnomaly: boolean;
  anomalyReason?: string;
  currency: CurrencyCode;
}

export interface ExecutiveBiKpiSummary {
  totalRevenue: string;
  totalOperatingCosts: string;
  grossProfit: string;
  netOperatingProfit: string;
  overallNetMarginPercent: string;
  totalDistanceKm: number;
  totalTripsCompleted: number;
  averageActualCpk: string;
  averageTargetCpk: string;
  averageRevenuePerKm: string;
  fleetOperatingEfficiencyPercent: string;
  anomalousCorridorsCount: number;
  reportingCurrency: CurrencyCode;
  forexRateEurToMad: string;
}

export interface MonthlyProfitabilityPoint {
  month: string;
  revenue: number;
  costs: number;
  netProfit: number;
  marginPercent: number;
  cpk: number;
  rpk: number;
}

export interface CostCategoryShare {
  nameAr: string;
  nameFr: string;
  nameEs: string;
  category: keyof Omit<CorridorCostBreakdown, 'totalCost'>;
  amount: number;
  percentage: number;
  color: string;
}

export interface ExecutiveBiReportData {
  kpis: ExecutiveBiKpiSummary;
  corridors: CorridorProfitabilitySummary[];
  monthlyTrend: MonthlyProfitabilityPoint[];
  costDistribution: CostCategoryShare[];
  generatedAt: string;
}

