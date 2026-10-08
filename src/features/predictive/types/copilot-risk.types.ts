/**
 * Predictive Logistics AI Copilot & Risk Radar — Type Definitions
 * Trans Bodanon TMS
 */

import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';
import type { CargoThermalProfile } from '@/features/mission-control/types';

export type RiskSeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskCategory =
  | 'cold_chain'
  | 'fuel_anomaly'
  | 'border_delay'
  | 'driver_fatigue';

export interface TripRiskFactor {
  category: RiskCategory;
  score: number; // 0 - 100
  weight: number; // Decimal weight (e.g., 0.35, 0.25)
  weightedScore: number; // score * weight
  severity: RiskSeverityLevel;
  titleAr: string;
  titleFr: string;
  titleEs: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEs: string;
  metrics: {
    value: number | string;
    target?: number | string;
    unit?: string;
    variancePercentage?: number;
    details?: Record<string, string | number | boolean>;
  };
}

export type CopilotActionType =
  | 'adjust_reefer_setpoint'
  | 'reroute_fuel_station'
  | 'driver_rest_alert'
  | 'escalate_customs_transit'
  | 'emergency_dispatch';

export interface CopilotRecommendation {
  id: string;
  tripId: number;
  category: RiskCategory;
  severity: RiskSeverityLevel;
  actionType: CopilotActionType;
  titleAr: string;
  titleFr: string;
  titleEs: string;
  recommendationAr: string;
  recommendationFr: string;
  recommendationEs: string;
  suggestedParams?: {
    suggestedTemp?: number;
    nearestStation?: string;
    restAreaName?: string;
    customsLane?: string;
    alertMessage?: string;
  };
  applied: boolean;
  appliedAt?: string;
  appliedBy?: string;
}

export interface TripRiskAssessment {
  tripId: number;
  truckId: number;
  truckPlate: string;
  trailerPlate?: string;
  driverId?: number;
  driverName: string;
  driverPhone?: string;
  corridor: InternationalCorridor | 'domestic';
  compositeRiskScore: number; // 0 - 100
  overallSeverity: RiskSeverityLevel;
  factors: TripRiskFactor[];
  recommendations: CopilotRecommendation[];
  assessedAt: string;
}

export interface FleetCopilotInsight {
  totalTripsEvaluated: number;
  highRiskTripsCount: number;
  criticalTripsCount: number;
  averageFleetRiskScore: number;
  overallFleetStatus: RiskSeverityLevel;
  categoryDistribution: Record<
    RiskCategory,
    {
      count: number;
      avgScore: number;
      criticalCount: number;
    }
  >;
  topCriticalTrips: TripRiskAssessment[];
  generatedAt: string;
}

export interface ApplyCopilotMitigationPayload {
  tripId: number;
  recommendationId: string;
  actionType: CopilotActionType;
  notes?: string;
}
