import { z } from 'zod';

export const supplierPayableItemSchema = z.object({
  payableId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  supplierName: z.string().min(1),
  invoiceReference: z.string().min(1),
  category: z
    .enum(['fuel_provider', 'ferry_operator', 'toll_operator', 'maintenance_vendor'])
    .default('fuel_provider'),
  amount: z.union([z.number().positive(), z.string().min(1)]),
  bankName: z.string().optional(),
  bankRib: z.string().optional(),
  bankIban: z.string().optional(),
  bankBic: z.string().optional(),
});

export const createBulkBatchSchema = z
  .object({
    paymentMethod: z.enum(['sepa_credit_transfer', 'moroccan_lcn_virement', 'standard_wire']),
    formatType: z.enum(['pain_001_001_03', 'moroccan_lcn_virement', 'csv_banking']),
    executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ التحويل غير صالح (YYYY-MM-DD)'),
    currency: z.string().min(3).max(3).default('MAD'),
    sourceBankAccountId: z.number().nullable().optional(),
    sourceRib: z.string().optional(),
    debtorIban: z.string().optional(),
    debtorBic: z.string().optional(),
    statementIds: z.array(z.number()).default([]),
    supplierPayables: z.array(supplierPayableItemSchema).default([]),
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.statementIds.length > 0 || data.supplierPayables.length > 0,
    {
      message: 'يجب تحديد بيان مخالصة سائق أو فاتورة مورد واحدة على الأقل',
      path: ['statementIds'],
    }
  );

export const executeBatchSchema = z.object({
  batchId: z.number().int().positive(),
  exchangeRateEurToMad: z.string().optional(),
});

export const cancelBatchSchema = z.object({
  batchId: z.number().int().positive(),
  reason: z.string().optional(),
});

export type SupplierPayableItemInput = z.infer<typeof supplierPayableItemSchema>;
export type CreateBulkBatchInput = z.input<typeof createBulkBatchSchema>;
export type ExecuteBatchInput = z.input<typeof executeBatchSchema>;
export type CancelBatchInput = z.infer<typeof cancelBatchSchema>;
