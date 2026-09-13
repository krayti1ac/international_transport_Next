export interface QuarterlyForecast {
  quarter: string; // e.g. 'Q1-2027'
  quarterNameAr: string;
  quarterNameFr: string;
  projectedRevenueMad: string;
  projectedRevenueEur: string;
  projectedFuelExpensesMad: string;
  projectedNetProfitMad: string;
  projectedNetProfitEur: string;
  projectedTripsCount: number;
  projectedGrowthRatePercent: number;
  confidenceScorePercent: number;
}

export interface BranchEfficiencyMetrics {
  branchId: number;
  branchName: string;
  city: string;
  country: string;
  isHeadquarters: boolean;
  totalTrucks: number;
  activeTrucks: number;
  utilizationRatePercent: number;
  loadedKm: number;
  emptyKm: number;
  emptyKmRatioPercent: number; // Taux de kilomètres à vide
  revenuePerKmMad: string;
  netProfitMad: string;
  profitContributionPercent: number;
}

export interface CrossBorderMaintenanceRisk {
  truckId: number;
  plateNumber: string;
  model: string;
  currentMileageKm: number;
  kmUntilNextService: number;
  serviceCategory: 'engine_oil_service' | 'brake_retarder' | 'tires_alignment' | 'cooling_reefer';
  riskLevel: 'low' | 'warning' | 'critical';
  estimatedCostMad: string;
  estimatedCostEur: string;
  adviceAr: string;
  adviceFr: string;
  mustServiceBeforeCrossing: boolean;
}

export interface StrategicGrowthRecommendation {
  id: string;
  category: 'corridor_expansion' | 'fleet_bunkering' | 'ferry_contract' | 'empty_mileage';
  titleAr: string;
  titleFr: string;
  impactScore: 'high' | 'medium' | 'transformational';
  descriptionAr: string;
  descriptionFr: string;
  projectedAnnualSavingsMad: string;
  projectedAnnualSavingsEur: string;
}

export interface PredictiveInsightsSummary {
  periodLabel: string;
  generatedAt: string;
  overallFleetHealthScore: number; // 0-100
  emptyKmReductionTargetPercent: number;
  totalForecastedRevenueMad: string;
  totalForecastedRevenueEur: string;
  totalForecastedNetProfitMad: string;
  totalForecastedNetProfitEur: string;
  forecasts: QuarterlyForecast[];
  branches: BranchEfficiencyMetrics[];
  maintenanceRadar: CrossBorderMaintenanceRisk[];
  recommendations: StrategicGrowthRecommendation[];
}

