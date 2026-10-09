/**
 * Trans Bodanon TMS — Reefer Refrigerant Leak & TXV Predictive Radar Types
 * Standards: EN 12830 / ATP Treaty (FRC) / ISO 14903 Refrigerant Tightness
 */

import { z } from 'zod';

export type RefrigerantType = 'R452A' | 'R404A' | 'R134a';

export type RefrigerantIncidentType =
  | 'micro_leakage'
  | 'txv_starvation_closed'
  | 'txv_flooding_open'
  | 'compressor_inefficiency'
  | 'normal';

export type RefrigerantSeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ReeferCircuitDiagnosticsLog {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  tripId?: number | null;
  tripNumber?: string;
  refrigerantType: RefrigerantType;
  suctionPressureBar: number;
  dischargePressureBar: number;
  evaporatorTempC: number;
  suctionLineTempC: number;
  condenserTempC: number;
  liquidLineTempC: number;
  superheatC: number;
  subcoolingC: number;
  compressorRpm?: number | null;
  compressorDutyCyclePct?: number | null;
  ambientTempC?: number | null;
  source: 'telematics' | 'manifold_gauge' | 'manual_entry';
  recordedAt: string;
  createdAt: string;
}

export interface ReeferPredictiveLeakIncident {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  tripId?: number | null;
  tripNumber?: string;
  refrigerantType: RefrigerantType;
  incidentType: RefrigerantIncidentType;
  severity: RefrigerantSeverityLevel;
  riskScore: number; // 0 - 100
  estimatedRefrigerantLossPct: number;
  suctionPressureBar?: number | null;
  dischargePressureBar?: number | null;
  superheatC?: number | null;
  subcoolingC?: number | null;
  description: string;
  recommendedAction: string;
  maintenanceTicketId?: number | null;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitThermodynamicEvaluation {
  incidentType: RefrigerantIncidentType;
  severity: RefrigerantSeverityLevel;
  riskScore: number; // 0 - 100
  estimatedRefrigerantLossPct: number;
  superheatC: number;
  subcoolingC: number;
  compressionRatio: number;
  description: string;
  recommendedAction: string;
  isAnomaly: boolean;
}

export interface RefrigerantRadarSummary {
  totalMonitoredReefers: number;
  healthyCircuitsCount: number;
  activeLeakIncidentsCount: number;
  txvAnomaliesCount: number;
  criticalRiskTrailersCount: number;
  averageFleetRefrigerantChargePct: number; // 0 - 100%
  fleetThermodynamicHealthRate: number; // 0 - 100%
}

// Zod validation schemas
export const recordCircuitDiagnosticsSchema = z.object({
  trailerId: z.coerce.number().positive(),
  tripId: z.coerce.number().optional().nullable(),
  refrigerantType: z.enum(['R452A', 'R404A', 'R134a']).default('R452A'),
  suctionPressureBar: z.coerce.number(),
  dischargePressureBar: z.coerce.number(),
  evaporatorTempC: z.coerce.number(),
  suctionLineTempC: z.coerce.number(),
  condenserTempC: z.coerce.number(),
  liquidLineTempC: z.coerce.number(),
  compressorRpm: z.coerce.number().optional().nullable(),
  compressorDutyCyclePct: z.coerce.number().optional().nullable(),
  ambientTempC: z.coerce.number().optional().nullable(),
  source: z.enum(['telematics', 'manifold_gauge', 'manual_entry']).default('manifold_gauge'),
});

export type RecordCircuitDiagnosticsInput = z.infer<typeof recordCircuitDiagnosticsSchema>;

export const resolveLeakIncidentSchema = z.object({
  incidentId: z.string().uuid(),
  notes: z.string().optional(),
});

export type ResolveLeakIncidentInput = z.infer<typeof resolveLeakIncidentSchema>;

