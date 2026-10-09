/**
 * Trans Bodanon TMS — Multi-Temp & Multi-Compartment Reefer Types
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / GDP Pharma Cold Chain
 */

import { z } from 'zod';

export type CompartmentConfigurationType = 'bi_temp' | 'tri_temp' | 'single_temp';

export type CompartmentCode = 'C1' | 'C2' | 'C3';

export type CargoCategory = 'deep_frozen' | 'fresh_produce' | 'pharma_cold' | 'meat_chilled';

export type EvaporatorMode = 'cooling' | 'heating' | 'defrost' | 'null';

export type DoorType = 'rear' | 'side' | 'none';

export interface ReeferCompartmentProfile {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  tripId?: number | null;
  tripNumber?: string;
  configurationType: CompartmentConfigurationType;
  compartmentCode: CompartmentCode;
  compartmentName: string;
  cargoCategory: CargoCategory;
  setpointTempC: number;
  minTempLimitC: number;
  maxTempLimitC: number;
  evaporatorModel?: string | null;
  hasSideDoor: boolean;
  hasRearDoor: boolean;
  bulkheadPositionPct: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReeferCompartmentTelemetryLog {
  id: string;
  companyId: number;
  compartmentId: string;
  compartmentCode?: CompartmentCode;
  compartmentName?: string;
  trailerId: number;
  trailerPlate?: string;
  tripId?: number | null;
  tripNumber?: string;
  supplyAirTempC: number;
  returnAirTempC: number;
  cargoProbeTempC: number;
  evaporatorMode: EvaporatorMode;
  doorOpen: boolean;
  doorType: DoorType;
  isExcursion: boolean;
  recordedAt: string;
  createdAt: string;
}

export interface ReeferCrossBulkheadAlert {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  tripId?: number | null;
  tripNumber?: string;
  sourceCompartmentCode: CompartmentCode;
  adjacentCompartmentCode: CompartmentCode;
  deltaTC: number; // |T_source - T_adjacent|
  leakageRateCPerHr: number; // °C/hr
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendedAction: string;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
}

export interface CompartmentMktAudit {
  compartmentCode: CompartmentCode;
  compartmentName: string;
  cargoCategory: CargoCategory;
  setpointTempC: number;
  mktTempC: number;
  avgSupplyAirTempC: number;
  avgReturnAirTempC: number;
  excursionMinutes: number;
  doorOpenCount: number;
  isCompliant: boolean;
  status: 'compliant' | 'warning' | 'breached';
}

export interface MultiTempTrailerMatrixSummary {
  trailerId: number;
  trailerPlate: string;
  configurationType: CompartmentConfigurationType;
  totalCompartments: number;
  compartments: Array<{
    profile: ReeferCompartmentProfile;
    latestLog?: ReeferCompartmentTelemetryLog;
    mktAudit?: CompartmentMktAudit;
  }>;
  bulkheadIntegrityScore: number; // 0 - 100%
  activeBulkheadAlertsCount: number;
  overallStatus: 'optimal' | 'warning' | 'critical';
}

// Zod validation schemas
export const createCompartmentProfileSchema = z.object({
  trailerId: z.coerce.number().positive(),
  tripId: z.coerce.number().optional().nullable(),
  configurationType: z.enum(['bi_temp', 'tri_temp', 'single_temp']).default('bi_temp'),
  compartmentCode: z.enum(['C1', 'C2', 'C3']),
  compartmentName: z.string().min(2),
  cargoCategory: z.enum(['deep_frozen', 'fresh_produce', 'pharma_cold', 'meat_chilled']).default('deep_frozen'),
  setpointTempC: z.coerce.number(),
  minTempLimitC: z.coerce.number(),
  maxTempLimitC: z.coerce.number(),
  evaporatorModel: z.string().optional().nullable(),
  hasSideDoor: z.boolean().default(false),
  hasRearDoor: z.boolean().default(true),
  bulkheadPositionPct: z.coerce.number().int().min(10).max(90).default(50),
});

export type CreateCompartmentProfileInput = z.infer<typeof createCompartmentProfileSchema>;

export const recordCompartmentTelemetrySchema = z.object({
  compartmentId: z.string().uuid(),
  trailerId: z.coerce.number().positive(),
  tripId: z.coerce.number().optional().nullable(),
  supplyAirTempC: z.coerce.number(),
  returnAirTempC: z.coerce.number(),
  cargoProbeTempC: z.coerce.number(),
  evaporatorMode: z.enum(['cooling', 'heating', 'defrost', 'null']).default('cooling'),
  doorOpen: z.boolean().default(false),
  doorType: z.enum(['rear', 'side', 'none']).default('none'),
  recordedAt: z.string().optional(),
});

export type RecordCompartmentTelemetryInput = z.infer<typeof recordCompartmentTelemetrySchema>;

export const resolveBulkheadAlertSchema = z.object({
  alertId: z.string().uuid(),
  notes: z.string().optional(),
});

export type ResolveBulkheadAlertInput = z.infer<typeof resolveBulkheadAlertSchema>;

