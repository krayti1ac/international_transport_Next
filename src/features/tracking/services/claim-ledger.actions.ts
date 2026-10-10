'use server';

/**
 * Trans Bodanon TMS — Automated Credit Note & General Ledger Reconciliation Actions
 * Standards: PCM Accounting Plan / Article 92-I-10° CGI / IFRS 15
 */

import {
  reconcileClaimCreditNoteSchema,
  rollbackClaimSettlementSchema,
  type ClaimReconciliationDetails,
  type ReconcileClaimCreditNoteInput,
  type RollbackClaimSettlementInput,
} from '../types/claim-reconciliation.types';
import {
  reconcileCargoClaimCreditNote,
  rollbackClaimCreditNoteSettlement,
  getClaimReconciliationDetails,
} from './cargo-claim-ledger-sync.service';

export async function reconcileClaimCreditNoteAction(
  rawInput: ReconcileClaimCreditNoteInput
): Promise<{
  success: boolean;
  data?: ClaimReconciliationDetails;
  error?: string;
}> {
  try {
    const parsed = reconcileClaimCreditNoteSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const result = await reconcileCargoClaimCreditNote(parsed.data);

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    console.error('[reconcileClaimCreditNoteAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown server error during ledger reconciliation',
    };
  }
}

export async function rollbackClaimSettlementAction(
  rawInput: RollbackClaimSettlementInput
): Promise<{
  success: boolean;
  data?: { rolledBackAt: string; message: string };
  error?: string;
}> {
  try {
    const parsed = rollbackClaimSettlementSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const result = await rollbackClaimCreditNoteSettlement(parsed.data);

    return {
      success: true,
      data: {
        rolledBackAt: result.rolledBackAt,
        message: result.message,
      },
    };
  } catch (err) {
    console.error('[rollbackClaimSettlementAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown server error during rollback',
    };
  }
}

export async function getClaimReconciliationDetailsAction(
  claimId: string
): Promise<{
  success: boolean;
  data: ClaimReconciliationDetails | null;
  error?: string;
}> {
  try {
    if (!claimId) {
      return { success: false, data: null, error: 'Claim ID is required' };
    }
    const details = await getClaimReconciliationDetails(claimId);
    return { success: true, data: details };
  } catch (err) {
    console.error('[getClaimReconciliationDetailsAction Error]:', err);
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : 'Failed to query reconciliation details',
    };
  }
}

