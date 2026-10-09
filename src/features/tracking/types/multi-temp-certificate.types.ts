/**
 * Trans Bodanon TMS — Multi-Compartment Independent GDP Certificate Types
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP 2013/C 343/01
 */

import { z } from 'zod';
import type { CargoCategory, CompartmentCode } from './multi-temp.types';

export interface CompartmentTelemetrySample {
  time: string;
  supply: number;
  return: number;
  cargo: number;
  mode: string;
  door: boolean;
}

export interface CompartmentCertificatePayload {
  certificateNumber: string;
  compartmentCode: CompartmentCode;
  compartmentName: string;
  cargoCategory: CargoCategory;
  trailerId: number;
  trailerPlate: string;
  tripId?: number | null;
  tripNumber?: string;
  cmrNumber?: string;
  clientName?: string;
  driverName?: string;
  route?: string;
  setpointTempC: number;
  minTempLimitC: number;
  maxTempLimitC: number;
  mktTempC: number;
  avgSupplyAirTempC: number;
  avgReturnAirTempC: number;
  excursionMinutes: number;
  doorOpenCount: number;
  evaporatorModel?: string | null;
  bulkheadPositionPct: number;
  status: 'compliant' | 'warning' | 'breached';
  complianceScore: number; // 0 - 100
  issuedAt: string;
  verificationHash: string;
  verificationUrl: string;
  logsSample: CompartmentTelemetrySample[];
  locale: 'ar' | 'fr' | 'es';
}

export interface CompartmentCertificateExportResult {
  success: boolean;
  certificateNumber?: string;
  compartmentCode?: CompartmentCode;
  htmlContent?: string;
  verificationHash?: string;
  verificationUrl?: string;
  error?: string;
}

export interface BatchCompartmentExportResult {
  success: boolean;
  trailerPlate?: string;
  certificates?: CompartmentCertificateExportResult[];
  error?: string;
}

// Zod validation schemas
export const generateCompartmentCertificateSchema = z.object({
  compartmentId: z.string().uuid(),
  trailerId: z.coerce.number().positive(),
  tripId: z.coerce.number().optional().nullable(),
  locale: z.enum(['ar', 'fr', 'es']).default('ar'),
});

export type GenerateCompartmentCertificateInput = z.infer<typeof generateCompartmentCertificateSchema>;

export const exportBatchCompartmentCertificatesSchema = z.object({
  trailerId: z.coerce.number().positive(),
  tripId: z.coerce.number().optional().nullable(),
  locale: z.enum(['ar', 'fr', 'es']).default('ar'),
});

export type ExportBatchCompartmentCertificatesInput = z.infer<typeof exportBatchCompartmentCertificatesSchema>;

