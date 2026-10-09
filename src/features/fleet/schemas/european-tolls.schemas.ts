import { z } from 'zod';

export const tollProviderSchema = z.enum([
  'dkv',
  'telepass',
  'as24',
  'eurotoll',
  'totalenergies_pass',
  'manual',
  'generic',
]);

export const tollCountryCodeSchema = z.enum([
  'ES',
  'FR',
  'DE',
  'NL',
  'BE',
  'LU',
  'DK',
  'SE',
  'PT',
  'IT',
  'MA',
  'MR',
  'SN',
]);

export const tollSystemSchema = z.enum([
  'via_t',
  'telepeage',
  'lkw_maut',
  'eurovignette',
  'viapass',
  'cemavat',
  'generic_toll',
]);

export const uploadTollInvoiceBatchSchema = z.object({
  provider: tollProviderSchema,
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  billing_period_start: z.string().optional().nullable(),
  billing_period_end: z.string().optional().nullable(),
  raw_file_content: z.string().min(1, 'File content is empty'),
  file_name: z.string().optional().nullable(),
  exchange_rate_to_mad: z.number().positive().optional().default(10.85),
});

export const manualTollEstimateSchema = z.object({
  country_code: tollCountryCodeSchema,
  highway_code: z.string().optional(),
  distance_km: z.number().nonnegative().optional(),
  net_amount_eur: z.number().nonnegative().optional(),
  vat_rate: z.number().nonnegative().optional(),
  exchange_rate_to_mad: z.number().positive().optional().default(10.85),
  is_eurovignette: z.boolean().optional(),
});

export const updateTollExpenseStatusSchema = z.object({
  id: z.number().int().positive(),
  reconciliation_status: z.enum(['matched', 'discrepancy', 'unmatched', 'flagged_leakage']).optional(),
  vat_recovery_status: z.enum(['pending', 'submitted', 'refunded', 'rejected', 'exempt']).optional(),
  trip_id: z.number().int().positive().nullable().optional(),
  reconciliation_notes: z.string().optional().nullable(),
});

export type UploadTollInvoiceBatchInput = z.infer<typeof uploadTollInvoiceBatchSchema>;
export type ManualTollEstimateInput = z.infer<typeof manualTollEstimateSchema>;
export type UpdateTollExpenseStatusInput = z.infer<typeof updateTollExpenseStatusSchema>;

