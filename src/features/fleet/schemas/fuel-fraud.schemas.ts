import { z } from 'zod';

export const telematicsFuelDataPointSchema = z.object({
  timestamp: z.string(),
  fuelLevelLiters: z.number().nonnegative(),
  fuelLevelPercent: z.number().min(0).max(100).optional(),
  speedKmh: z.number().min(0),
  engineStatus: z.enum(['ON', 'OFF']),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  odometerKm: z.number().optional(),
});

export const fuelReceiptDataSchema = z.object({
  receiptId: z.union([z.string(), z.number()]).optional(),
  liters: z.number().positive(),
  unitPrice: z.number().positive(),
  totalAmount: z.number().positive(),
  currency: z.string().default('MAD'),
  stationName: z.string(),
  stationLatitude: z.number().optional(),
  stationLongitude: z.number().optional(),
  timestamp: z.string(),
});

export const truckFuelConfigSchema = z.object({
  truckId: z.union([z.number(), z.string()]),
  plateNumber: z.string(),
  tankCapacityLiters: z.number().positive().default(900),
  standardRateL100km: z.number().positive().default(36.0),
  fuelPricePerLiterMad: z.number().positive().default(14.0).optional(),
  fuelType: z.string().optional(),
});

export const antiSiphoningDetectionInputSchema = z.object({
  truckConfig: truckFuelConfigSchema,
  dataPoints: z.array(telematicsFuelDataPointSchema),
  receipts: z.array(fuelReceiptDataSchema).optional(),
  tripId: z.number().optional(),
  driverId: z.string().optional(),
  companyId: z.string().optional(),
});

export const confirmIncidentDeductionSchema = z.object({
  incidentId: z.string().uuid(),
  notes: z.string().optional(),
});

export const resolveIncidentJustificationSchema = z.object({
  incidentId: z.string().uuid(),
  justificationNotes: z.string().min(3),
  resolution: z.enum(['justified', 'dismissed']),
});

export const fuelFraudFilterSchema = z.object({
  status: z.enum(['all', 'detected', 'confirmed_deduction', 'justified', 'dismissed']).optional(),
  severity: z.enum(['all', 'low', 'medium', 'high', 'critical']).optional(),
  incidentType: z.enum([
    'all',
    'rapid_siphoning',
    'tank_overflow',
    'ghost_refueling',
    'geofence_mismatch',
    'abnormal_burn_rate',
  ]).optional(),
  truckId: z.number().optional(),
  driverId: z.string().optional(),
  searchQuery: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type AntiSiphoningDetectionInputValidated = z.infer<typeof antiSiphoningDetectionInputSchema>;
export type ConfirmIncidentDeductionInput = z.infer<typeof confirmIncidentDeductionSchema>;
export type ResolveIncidentJustificationInput = z.infer<typeof resolveIncidentJustificationSchema>;
export type FuelFraudFilterValidated = z.infer<typeof fuelFraudFilterSchema>;

