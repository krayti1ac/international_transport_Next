/**
 * TransSalges TMS — Groupage LTL vs. FTL Margin BI Types
 * Standards: Loading Meter (13.60 LDM standard semi-trailer), Cost Per Kilometer (CPK),
 * European Maritime Corridor (Tanger Med <-> EU) & African Overland Corridor (Guerguerat -> Dakar)
 * Financial Precision: Decimal.js (precision: 20, ROUND_HALF_UP)
 */

import type { InternationalCorridor } from '@/types/database';

export type LoadMode = 'ltl' | 'ftl';

export interface GroupageCostAllocationRecord {
  id?: string;
  trip_id: number;
  total_fuel_cost?: number;
  total_ferry_cost?: number;
  total_tolls_cost?: number;
  total_customs_cost?: number;
  total_driver_cost?: number;
  total_shared_cost?: number;
  total_revenue?: number;
  total_net_profit?: number;
  overall_profit_margin_pct?: number;
  currency?: string;
  consignments_count?: number;
  created_at?: string;
}

export interface TripCostBreakdown {
  fuelMad: number;
  ferryMad: number;
  tollsMad: number;
  customsMad: number;
  driverMad: number;
  otherMad: number;
}

export interface TripMarginBiItem {
  id: number;
  cmrNumber: string;
  route: string;
  departureDate: string;
  corridor: InternationalCorridor;
  mode: LoadMode;
  consignmentsCount: number;
  totalLdm: number;
  maxTrailerLdm: number;
  trailerUtilizationPct: number;
  cargoWeightTons: number;
  totalDistanceKm: number;
  roadDistanceKm: number;
  ferryDistanceKm: number;
  revenueMad: number;
  operatingCostMad: number;
  netProfitMad: number;
  netMarginPct: number;
  revenuePerLdmMad: number;
  netMarginPerLdmMad: number;
  cpkMad: number;
  rpkMad: number;
  costBreakdown: TripCostBreakdown;
  currency: string;
}

export interface ModeMetricsSummary {
  corridor: InternationalCorridor | 'all';
  mode: LoadMode;
  tripCount: number;
  totalConsignments: number;
  totalRevenueMad: number;
  totalOperatingCostsMad: number;
  totalNetProfitMad: number;
  netMarginPct: number;
  totalDistanceKm: number;
  totalLdm: number;
  avgLdmPerTrip: number;
  avgTrailerUtilizationPct: number;
  avgRevenuePerLdmMad: number;
  avgNetMarginPerLdmMad: number;
  avgCpkMad: number;
  avgRpkMad: number;
  costBreakdown: TripCostBreakdown;
}

export interface ModeComparisonMetrics {
  netMarginDifferencePct: number; // LTL % minus FTL %
  revenuePerLdmPremiumPct: number; // ((LTL Rev/LDM - FTL Rev/LDM) / FTL Rev/LDM) * 100
  netMarginPerLdmPremiumPct: number; // ((LTL Margin/LDM - FTL Margin/LDM) / FTL Margin/LDM) * 100
  cpkDifferenceMad: number; // LTL CPK - FTL CPK
  utilizationBreakevenLdm: number; // Minimum LDM required for LTL net profit >= FTL net profit
  winnerMode: 'ltl' | 'ftl' | 'balanced';
  tacticalRecommendationAr: string;
  tacticalRecommendationFr: string;
  tacticalRecommendationEs: string;
}

export interface CorridorGroupageVsFtlSummary {
  corridor: InternationalCorridor | 'all';
  corridorNameAr: string;
  corridorNameFr: string;
  corridorNameEs: string;
  ltl: ModeMetricsSummary;
  ftl: ModeMetricsSummary;
  comparison: ModeComparisonMetrics;
}

export interface LdmEfficiencyBucket {
  bucketRange: string; // e.g., '< 8 LDM', '8 - 11 LDM', '11 - 13.6 LDM'
  tripCount: number;
  avgUtilizationPct: number;
  avgNetMarginPct: number;
  avgRevenuePerLdmMad: number;
  avgNetProfitMad: number;
}

export interface GroupageMarginBiResult {
  overall: CorridorGroupageVsFtlSummary;
  europeanMaritime: CorridorGroupageVsFtlSummary;
  africanOverland: CorridorGroupageVsFtlSummary;
  trips: TripMarginBiItem[];
  ldmBuckets: LdmEfficiencyBucket[];
  currencyRates: {
    MAD: number;
    EUR: number;
    MRU: number;
    XOF: number;
  };
  generatedAt: string;
}

export interface GroupageMarginBiFilter {
  startDate?: string;
  endDate?: string;
  corridor?: 'all' | 'european_maritime' | 'african_overland';
  modeFilter?: 'all' | 'ltl_only' | 'ftl_only';
}
