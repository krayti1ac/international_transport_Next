import { z } from 'zod';

export const getTripReeferAuditSchema = z.object({
  tripId: z.union([z.string(), z.number()]),
});

export const generateReeferCertificateSchema = z.object({
  tripId: z.union([z.string(), z.number()]),
  forceReissue: z.boolean().optional().default(false),
});

export const logReeferTelemetrySchema = z.object({
  tripId: z.union([z.string(), z.number()]),
  supplyAirTemp: z.number(),
  returnAirTemp: z.number(),
  ambientTemp: z.number().optional(),
  evaporatorTemp: z.number().optional(),
  compressorStatus: z.enum(['running', 'cycle_sentry', 'defrost', 'off']).default('running'),
  isDefrostActive: z.boolean().default(false),
  doorOpenSensor: z.boolean().default(false),
  dieselFuelLevelLiters: z.number().optional(),
  dieselBurnRateLph: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isGeofenceSafe: z.boolean().default(true),
});

export const upsertTripReeferProfileSchema = z.object({
  tripId: z.union([z.string(), z.number()]),
  trailerId: z.union([z.string(), z.number()]).optional().nullable(),
  coolingUnitBrand: z.string().min(2).default('Carrier Transicold'),
  atpClass: z.enum(['class_a', 'class_b', 'class_c']).default('class_c'),
  cargoCategory: z.enum(['fresh_produce', 'deep_frozen', 'pharma_cold', 'meat_chilled']).default('fresh_produce'),
  setpointTemp: z.number(),
  minTempThreshold: z.number(),
  maxTempThreshold: z.number(),
  maxAllowedExcursionMinutes: z.number().int().min(5).default(45),
  mktActivationEnergyKj: z.number().default(83.144),
});

export type GetTripReeferAuditInput = z.infer<typeof getTripReeferAuditSchema>;
export type GenerateReeferCertificateInput = z.infer<typeof generateReeferCertificateSchema>;
export type LogReeferTelemetryInput = z.infer<typeof logReeferTelemetrySchema>;
export type UpsertTripReeferProfileInput = z.infer<typeof upsertTripReeferProfileSchema>;

