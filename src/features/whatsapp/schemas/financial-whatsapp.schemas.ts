import { z } from 'zod';

export const sendDriverClearanceWhatsAppSchema = z.object({
  statementId: z.union([z.string(), z.number()]),
  phone: z.string().optional(),
  lang: z.enum(['ar', 'fr', 'es']).default('ar'),
});

export const sendFuelTheftAlertWhatsAppSchema = z.object({
  incidentId: z.string(),
  recipientPhone: z.string().optional(),
  lang: z.enum(['ar', 'fr', 'es']).default('ar'),
  forceBypassCooldown: z.boolean().default(false),
});

export type SendDriverClearanceWhatsAppInput = z.infer<typeof sendDriverClearanceWhatsAppSchema>;
export type SendFuelTheftAlertWhatsAppInput = z.infer<typeof sendFuelTheftAlertWhatsAppSchema>;
