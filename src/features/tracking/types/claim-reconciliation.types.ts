/**
 * Trans Bodanon TMS — Automated Credit Note & General Ledger Reconciliation Types
 * Accounting Framework: Moroccan General Accounting Plan (PCM) / IFRS 15 / EU GDP / ATP
 * Standards: Article 92-I-10° CGI (Exonération TVA Transport International)
 */

import { z } from 'zod';
import type { CargoCategory, ClaimStatus, SettlementType } from './reefer-claim-settlement.types';

export type CreditNoteReason =
  | 'cargo_thermal_excursion'
  | 'dock_door_prolonged_exposure'
  | 'total_cargo_spoilage'
  | 'commercial_goodwill_rebate';

export type LedgerReconciliationStatus =
  | 'pending'
  | 'reconciled'
  | 'posted_to_erp'
  | 'rolled_back';

export interface GeneralLedgerEntry {
  entryNumber: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  currency: string;
  description: string;
}

export interface InsuranceReceivableLedgerEntry {
  entryNumber: string;
  accountCode: string; // e.g. "3488 - Créances diverses / Assurances à recevoir"
  accountName: string;
  debit: number;
  credit: number;
  insurerName: string;
  policyNumber: string;
}

export interface ClaimReconciliationDetails {
  id: string;
  claimId: string;
  claimReference: string;
  tripId: number;
  tripNumber: string;
  clientId: number | string;
  clientName: string;
  originalInvoiceId?: number | null;
  originalInvoiceNumber?: string | null;
  creditNoteId?: number | null;
  creditNoteNumber: string;
  reason: CreditNoteReason;
  currency: string;
  grossLossAmount: number;
  deductibleAmount: number;
  netClaimAmount: number;
  htAmount: number;
  tvaRatePct: number;
  tvaAmount: number;
  ttcAmount: number;
  clientOpeningBalance: number;
  clientClosingBalance: number;
  treasuryTransactionId?: number | null;
  status: LedgerReconciliationStatus;
  reconciledAt: string;
  reconciledBy?: string;
  ledgerEntries: GeneralLedgerEntry[];
  insuranceReceivableEntry?: InsuranceReceivableLedgerEntry;
  notes?: string;
}

export const reconcileClaimCreditNoteSchema = z.object({
  claimId: z.string().min(1),
  claimReference: z.string().min(1),
  tripId: z.number().int().positive(),
  tripNumber: z.string().min(1),
  clientId: z.union([z.number(), z.string()]).default(1),
  clientName: z.string().min(1).default('Maroc Primeurs Export S.A.'),
  originalInvoiceId: z.number().optional().nullable(),
  originalInvoiceNumber: z.string().optional().nullable(),
  creditNoteNumber: z.string().min(1),
  reason: z
    .enum([
      'cargo_thermal_excursion',
      'dock_door_prolonged_exposure',
      'total_cargo_spoilage',
      'commercial_goodwill_rebate',
    ])
    .default('cargo_thermal_excursion'),
  netClaimAmount: z.number().positive(),
  currency: z.string().default('MAD'),
  tvaRatePct: z.number().min(0).max(100).default(0), // 0% under Article 92-I-10° CGI
  isTaxExempt: z.boolean().default(true),
  taxExemptionClause: z
    .string()
    .default('Exonération de TVA en vertu de l’article 92-I-10° du CGI (Transport International)'),
  insurerName: z.string().default('Allianz Maroc / RMA Watanya'),
  policyNumber: z.string().default('POL-FRIGO-2026-TANGIER'),
  notes: z.string().optional(),
});

export type ReconcileClaimCreditNoteInput = z.input<typeof reconcileClaimCreditNoteSchema>;
export type ReconcileClaimCreditNoteValidated = z.infer<typeof reconcileClaimCreditNoteSchema>;

export const rollbackClaimSettlementSchema = z.object({
  claimId: z.string().min(1),
  creditNoteNumber: z.string().min(1),
  reason: z.string().min(3),
});

export type RollbackClaimSettlementInput = z.infer<typeof rollbackClaimSettlementSchema>;

export const queryClaimReconciliationSchema = z.object({
  claimId: z.string().min(1),
});

export type QueryClaimReconciliationInput = z.infer<typeof queryClaimReconciliationSchema>;

