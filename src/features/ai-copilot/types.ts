export type CargoType = 'dry' | 'reefer' | 'hazardous';
export type FerryRoute = 'tanger_med_algeciras' | 'tanger_med_motril' | 'nador_almeria';

export interface TripFeasibilityParams {
  origin: string;
  destination: string;
  cargoType: CargoType;
  ferryRoute: FerryRoute;
  targetMarginPercent?: number; // Default 22%
  roadDistanceKm?: number;
  reeferHours?: number;
}

export interface CostBreakdownItem {
  key: string;
  labelAr: string;
  labelFr: string;
  amountMad: string;
  amountEur: string;
  percentage: number;
}

export interface TripFeasibilityResult {
  origin: string;
  destination: string;
  cargoType: CargoType;
  estimatedDistanceKm: number;
  totalCostMad: string;
  totalCostEur: string;
  breakdown: CostBreakdownItem[];
  recommendedPriceMad: string;
  recommendedPriceEur: string;
  targetMarginPercent: number;
  projectedProfitMad: string;
  projectedProfitEur: string;
  breakevenPriceMad: string;
  breakevenPriceEur: string;
  routeInsights: {
    recommendedRefuelingStations: string[];
    mandatoryRestPauses: number;
    estimatedTransitHours: number;
    ferryCrossingHours: number;
  };
}

export interface ReadinessCheckItem {
  id: string;
  titleAr: string;
  titleFr: string;
  category: 'customs' | 'truck' | 'driver' | 'cargo';
  status: 'passed' | 'warning' | 'missing';
  detailsAr: string;
  detailsFr: string;
  actionRequired?: string;
}

export interface ReadinessAuditResult {
  score: number; // 0 - 100%
  status: 'ready' | 'needs_attention' | 'blocked';
  summaryAr: string;
  summaryFr: string;
  checks: ReadinessCheckItem[];
  passedCount: number;
  warningCount: number;
  missingCount: number;
}

export interface CopilotChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  quickReplies?: string[];
}

