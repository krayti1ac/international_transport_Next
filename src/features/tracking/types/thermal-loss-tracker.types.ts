/**
 * Trans Bodanon TMS — Unloading Dock Door Open Duration & Thermal Loss Tracker Types
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Agreement (FRC)
 */

import { z } from 'zod';
import type { CargoCategory } from './multi-temp.types';

export type { CargoCategory };

export type DockDoorState = 'closed' | 'open' | 'extended_open_warning' | 'critical_excursion';

export type ThermalIncidentLevel = 'normal' | 'warning' | 'critical';

export interface DockDoorCycleMetrics {
  doorOpenTimestamp: string;
  doorCloseTimestamp?: string | null;
  durationMinutes: number;
  tempAtOpenC: number;
  tempAtCloseC: number;
  tempRiseDeltaC: number; // tempAtCloseC - tempAtOpenC
  thermalRiseRatePerMin: number; // °C per minute
  ambientTempC: number;
  maxAllowedTempC: number;
  mktEstimatedImpactC: number; // Estimated Mean Kinetic Temperature elevation
}

export interface EpodColdChainIncidentAnnex {
  annexId: string;
  tripId: number;
  tripNumber: string;
  truckId: number;
  truckPlate: string;
  driverId: string | number;
  driverName: string;
  receiverName: string;
  receiverPhone?: string;
  dockId: string;
  dockName: string;
  facilityOrPort: string;
  compartment: 'C1' | 'C2' | 'C3';
  cargoCategory: CargoCategory;
  doorCycle: {
    doorOpenTimestamp: string;
    doorCloseTimestamp: string;
    durationMinutes: number;
  };
  thermalMetrics: DockDoorCycleMetrics;
  incidentLevel: ThermalIncidentLevel;
  annexRequired: boolean;
  driverSignature?: string | null;
  receiverSignature?: string | null;
  cryptographicSeal: string; // HMAC-SHA256 signature
  generatedAt: string;
  status: 'draft' | 'annex_attached' | 'dispatched_receiver';
  notes?: string | null;
}

export const logDockDoorCycleSchema = z.object({
  tripId: z.number().int().positive(),
  tripNumber: z.string().min(1),
  truckId: z.number().int().positive(),
  truckPlate: z.string().min(1),
  driverId: z.union([z.string(), z.number()]),
  driverName: z.string().min(1),
  dockId: z.string().min(1),
  dockName: z.string().min(1),
  facilityOrPort: z.string().min(1),
  compartment: z.enum(['C1', 'C2', 'C3']).default('C1'),
  cargoCategory: z.enum([
    'deep_frozen',
    'fresh_produce',
    'pharma_cold',
    'meat_chilled',
  ]).default('fresh_produce'),
  doorOpenTimestamp: z.string().min(1),
  doorCloseTimestamp: z.string().optional().nullable(),
  tempAtOpenC: z.number(),
  tempAtCloseC: z.number().optional(),
  ambientTempC: z.number().default(24.0),
  maxAllowedTempC: z.number().default(6.0),
  receiverName: z.string().default('Receptor Mercamadrid Frío'),
  receiverPhone: z.string().optional(),
  notes: z.string().optional(),
});

export type LogDockDoorCycleInput = z.infer<typeof logDockDoorCycleSchema>;

export const attachThermalAnnexToEpodSchema = z.object({
  annexId: z.string().min(1),
  tripId: z.number().int().positive(),
  receiverSignature: z.string().min(10, 'Receiver signature data is required'),
  driverSignature: z.string().min(10, 'Driver signature data is required'),
  receiverName: z.string().min(1),
  notes: z.string().optional(),
});

export type AttachThermalAnnexToEpodInput = z.infer<typeof attachThermalAnnexToEpodSchema>;

export const queryDockThermalLossSchema = z.object({
  tripId: z.number().int().positive().optional(),
  dockId: z.string().optional(),
  incidentLevel: z.enum(['normal', 'warning', 'critical']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type QueryDockThermalLossInput = z.infer<typeof queryDockThermalLossSchema>;

