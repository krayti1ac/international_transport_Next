import { z } from 'zod';

export const transitCorridorTypeSchema = z.enum([
  'european_maritime',
  'african_overland',
  'domestic_morocco',
]);

export const auditTripDispatchSchema = z.object({
  driver_id: z.number().int().positive({ message: 'Driver ID is required' }),
  truck_id: z.number().int().positive().nullable().optional(),
  trailer_id: z.number().int().positive().nullable().optional(),
  corridor_type: transitCorridorTypeSchema.default('european_maritime'),
  trip_id: z.number().int().positive().nullable().optional(),
  trip_date: z.string().optional(),
});

export const sendDriverExpiryAlertSchema = z.object({
  driver_id: z.number().int().positive(),
  document_name_ar: z.string().min(1),
  document_name_fr: z.string().min(1),
  document_name_es: z.string().min(1),
  days_remaining: z.number().int(),
  expiry_date: z.string().min(1),
  locale: z.enum(['ar', 'fr', 'es']).default('ar'),
});

export const updateDriverTransitCredentialsSchema = z.object({
  driver_id: z.number().int().positive(),
  passport_number: z.string().optional().nullable(),
  passport_expiry_date: z.string().optional().nullable(),
  visa_number: z.string().optional().nullable(),
  visa_expiry_date: z.string().optional().nullable(),
  african_visa_number: z.string().optional().nullable(),
  african_visa_expiry_date: z.string().optional().nullable(),
  yellow_fever_vaccine_date: z.string().optional().nullable(),
  driver_card_qualification_expiry: z.string().optional().nullable(),
});

export type AuditTripDispatchInput = z.infer<typeof auditTripDispatchSchema>;
export type SendDriverExpiryAlertInput = z.infer<typeof sendDriverExpiryAlertSchema>;
export type UpdateDriverTransitCredentialsInput = z.infer<typeof updateDriverTransitCredentialsSchema>;

