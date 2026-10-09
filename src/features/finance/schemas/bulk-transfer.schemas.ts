import { z } from 'zod';

export const createBulkBatchSchema = z.object({
  paymentMethod: z.enum(['sepa_credit_transfer', 'moroccan_lcn_virement', 'standard_wire']),
  formatType: z.enum(['pain_001_001_03', 'moroccan_lcn_virement', 'csv_banking']),
  executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ التحويل غير صالح (YYYY-MM-DD)'),
  currency: z.string().min(3).max(3).default('MAD'),
  sourceBankAccountId: z.number().nullable().optional(),
  sourceRib: z.string().optional(),
  debtorIban: z.string().optional(),
  debtorBic: z.string().optional(),
  statementIds: z.array(z.number()).min(1, 'يجب تحديد بيان مخالصة واحد على الأقل'),
  notes: z.string().optional(),
});

export const executeBatchSchema = z.object({
  batchId: z.number().int().positive(),
});

export const cancelBatchSchema = z.object({
  batchId: z.number().int().positive(),
  reason: z.string().optional(),
});

export type CreateBulkBatchInput = z.infer<typeof createBulkBatchSchema>;
export type ExecuteBatchInput = z.infer<typeof executeBatchSchema>;
export type CancelBatchInput = z.infer<typeof cancelBatchSchema>;
