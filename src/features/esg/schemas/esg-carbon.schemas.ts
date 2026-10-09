import { z } from 'zod';

export const carbonCalculationInputSchema = z.object({
  cargoWeightTons: z.union([z.number(), z.string()]).refine((v) => Number(v) > 0, {
    message: 'وزن الشحنة يجب أن يكون أكبر من الصفر',
  }),
  roadDistanceKm: z.union([z.number(), z.string()]).refine((v) => Number(v) >= 0, {
    message: 'المسافة البرية يجب أن تكون موجبة أو صفراً',
  }),
  ferryDistanceKm: z.union([z.number(), z.string()]).optional().default(0),
  truckEuroClass: z.enum(['euro_5', 'euro_6', 'electric_hybrid']).default('euro_6'),
  isReefer: z.boolean().default(true),
  reeferHours: z.union([z.number(), z.string()]).optional().default(0),
});

export const auditTripCarbonSchema = z.object({
  tripId: z.number().positive('رقم الرحلة مطلوب'),
  cargoWeightTons: z.number().positive('وزن الحمولة مطلوب').optional(),
  roadDistanceKm: z.number().nonnegative().optional(),
  ferryDistanceKm: z.number().nonnegative().optional(),
  truckEuroClass: z.enum(['euro_5', 'euro_6', 'electric_hybrid']).optional(),
  isReefer: z.boolean().optional(),
  reeferHours: z.number().nonnegative().optional(),
});

export const issueGreenCertificateSchema = z.object({
  tripId: z.number().positive('رقم الرحلة مطلوب'),
  sendEmailToClient: z.boolean().default(false),
});

