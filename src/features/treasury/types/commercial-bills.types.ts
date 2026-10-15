/**
 * Trans Bodanon TMS — Commercial Bills, Promissory Notes & Moroccan LCN Engine Types
 * Standards: Moroccan LCN (Lettre de Change Normalisée), Chèques, Traites
 * Strict Decimal.js operations for face value, bank discount agios, and FIFO clearing.
 */

import { z } from 'zod';

export type BillType = 'lcn_promissory_note' | 'cheque' | 'traite';

export type BillStatus =
  | 'in_portfolio'
  | 'remitted_for_collection'
  | 'discounted'
  | 'cleared'
  | 'bounced_unpaid'
  | 'cancelled';

export type MaturityUrgency = 'overdue' | 'due_today' | 'due_soon' | 'upcoming';

export interface CommercialBill {
  id: string;
  companyId?: number | null;
  billType: BillType;
  billNumber: string;
  clientId?: number | null;
  clientName: string;
  issuerName?: string | null;
  drawerBankName?: string | null;
  drawerBankRib?: string | null;
  faceValue: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: BillStatus;
  remittanceDate?: string | null;
  remittanceBankAccountId?: number | null;
  remittanceReference?: string | null;
  clearedDate?: string | null;
  clearedAmount?: number | null;
  discountFee: number;
  bounceReason?: string | null;
  bounceDate?: string | null;
  bounceFee: number;
  treasuryTransactionId?: number | null;
  allocatedInvoiceIds: number[];
  imageUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialBillsSummary {
  totalPortfolioValue: number;
  totalRemittedValue: number;
  totalDiscountedValue: number;
  totalClearedValue: number;
  totalBouncedValue: number;
  dueWithin7DaysCount: number;
  dueWithin7DaysValue: number;
  overdueCount: number;
  overdueValue: number;
  totalBillsCount: number;
  currency: string;
}

export const createCommercialBillSchema = z.object({
  billType: z.enum(['lcn_promissory_note', 'cheque', 'traite']).default('lcn_promissory_note'),
  billNumber: z.string().min(1, 'Bill or check number is required'),
  clientId: z.number().int().positive().optional().nullable(),
  clientName: z.string().min(1, 'Client name is required'),
  issuerName: z.string().optional().nullable(),
  drawerBankName: z.string().optional().nullable(),
  drawerBankRib: z.string().optional().nullable(),
  faceValue: z.number().positive('Face value must be positive'),
  currency: z.string().default('MAD'),
  issueDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export type CreateCommercialBillInput = z.input<typeof createCommercialBillSchema>;
export type CreateCommercialBillValidated = z.infer<typeof createCommercialBillSchema>;

export const remitCommercialBillSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  operationType: z.enum(['collection', 'discount']).default('collection'),
  remittanceDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  bankAccountId: z.number().int().positive().optional().nullable(),
  remittanceReference: z.string().min(1, 'Remittance slip reference is required'),
  discountFee: z.number().nonnegative().optional().default(0),
});

export type RemitCommercialBillInput = z.input<typeof remitCommercialBillSchema>;

export const clearCommercialBillSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  clearedDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  clearedAmount: z.number().positive().optional().nullable(),
  bankAccountId: z.number().int().positive().optional().nullable(),
  triggerFifoAllocation: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export type ClearCommercialBillInput = z.input<typeof clearCommercialBillSchema>;

export const bounceCommercialBillSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  bounceDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  bounceReason: z.string().min(1, 'Bounce reason is required'),
  bounceFee: z.number().nonnegative().default(0),
  reverseSettlement: z.boolean().default(true),
});

export type BounceCommercialBillInput = z.input<typeof bounceCommercialBillSchema>;

