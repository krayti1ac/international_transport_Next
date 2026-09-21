import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

export type AlertSeverity = 'normal' | 'warning' | 'critical';

export interface TireWearResult {
  truckId: number;
  plateNumber: string;
  model: string;
  accumulatedKm: number;
  weightedKm: number;
  twiPercentage: number; // 0 - 100+ %
  status: AlertSeverity;
  allowedLongHaul: boolean; // false if twiPercentage >= 90%
  recommendedActionAr: string;
  recommendedActionFr: string;
  recommendedActionEs: string;
}

export interface ReeferHealthResult {
  trailerId: number;
  plateNumber: string;
  reeferModel: string;
  engineHours: number;
  serviceIntervalHours: number; // 1,500 hrs
  tempDriftCount: number; // departures > 2°C for > 45 mins
  tempDriftPenalty: number;
  healthScore: number; // 0 - 100
  status: 'optimal' | 'service_due' | 'high_risk';
  recommendedActionAr: string;
  recommendedActionFr: string;
  recommendedActionEs: string;
}

export interface EngineOilHealthResult {
  truckId: number;
  plateNumber: string;
  kmSinceLastService: number;
  effectiveIntervalKm: number;
  fuelBurnFactor: number; // 1.0 baseline (36 L/100km)
  degradationPercentage: number; // 0 - 100%
  status: 'optimal' | 'due_soon' | 'overdue';
  recommendedActionAr: string;
  recommendedActionFr: string;
  recommendedActionEs: string;
}

export interface FleetPredictiveSummary {
  overallFleetHealthScore: number; // 0 - 100
  totalTrucksAudited: number;
  criticalTireCount: number;
  warningTireCount: number;
  criticalReeferCount: number;
  oilServiceDueCount: number;
  tires: TireWearResult[];
  reefers: ReeferHealthResult[];
  engines: EngineOilHealthResult[];
}

export type ClientReliabilityRating = 'A' | 'B' | 'C';

export interface ClientPaymentVelocity {
  clientId: string | number;
  clientName: string;
  totalPaidInvoices: number;
  averageDelayDays: number; // PVI (negative = early, positive = late)
  reliabilityRating: ClientReliabilityRating;
  unpaidInvoicesCount: number;
  totalOutstandingMad: string;
  totalOutstandingEur: string;
}

export interface CashFlowHorizonProjection {
  horizonDays: 30 | 60 | 90;
  labelAr: string;
  labelFr: string;
  labelEs: string;
  currentLiquidCashMad: string;
  projectedInboundMad: string;
  projectedOutboundMad: string;
  projectedNetCashMad: string;
  liquidityStatus: 'surplus' | 'balanced' | 'deficit_warning';
  breakdown: {
    inboundInvoicesCount: number;
    mandatoryFuelMad: string;
    mandatoryFerryAndCustomsMad: string;
    driverAllowancesAndSalariesMad: string;
  };
}

export interface PredictiveDashboardData {
  generatedAt: string;
  fleetHealth: FleetPredictiveSummary;
  clientVelocities: ClientPaymentVelocity[];
  cashFlowProjections: CashFlowHorizonProjection[];
}

