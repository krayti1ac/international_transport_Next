/**
 * Trans Bodanon TMS — Claim Reconciliation & Ledger Math Helpers
 * Pure mathematical and accounting calculation functions (Safe for Client & Server).
 * Strictly compliant with Decimal.js & Article 92-I-10° du Code Général des Impôts.
 */

import Decimal from 'decimal.js';
import type {
  GeneralLedgerEntry,
  InsuranceReceivableLedgerEntry,
} from '../types/claim-reconciliation.types';

/**
 * Computes exact tax and net financial figures using Decimal.js
 */
export function calculateCreditNoteFinancials(params: {
  netClaimAmount: number;
  tvaRatePct: number;
  isTaxExempt: boolean;
}): {
  htAmount: number;
  tvaAmount: number;
  ttcAmount: number;
} {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  const netDec = new Decimal(params.netClaimAmount);

  if (params.isTaxExempt || params.tvaRatePct === 0) {
    const amount = Number(netDec.toFixed(2));
    return {
      htAmount: amount,
      tvaAmount: 0,
      ttcAmount: amount,
    };
  }

  const tvaRate = new Decimal(params.tvaRatePct).dividedBy(100);
  const htDec = netDec.dividedBy(new Decimal(1).plus(tvaRate));
  const tvaDec = netDec.minus(htDec);

  return {
    htAmount: Number(htDec.toFixed(2)),
    tvaAmount: Number(tvaDec.toFixed(2)),
    ttcAmount: Number(netDec.toFixed(2)),
  };
}

/**
 * Generates double-entry general ledger entries (Moroccan General Accounting Plan PCM)
 */
export function generateDoubleEntryLedger(params: {
  creditNoteNumber: string;
  claimReference: string;
  clientName: string;
  currency: string;
  htAmount: number;
  tvaAmount: number;
  ttcAmount: number;
  insurerName: string;
  policyNumber: string;
}): {
  ledgerEntries: GeneralLedgerEntry[];
  insuranceReceivableEntry: InsuranceReceivableLedgerEntry;
} {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  const ttcDec = new Decimal(params.ttcAmount);
  const htDec = new Decimal(params.htAmount);
  const tvaDec = new Decimal(params.tvaAmount);

  // 1. Credit Note to Client: Debits Rabais/Avaries (7129) + TVA Régularisation (4455) = Credit Clients (3421)
  const entries: GeneralLedgerEntry[] = [
    {
      entryNumber: `${params.creditNoteNumber}-01`,
      accountCode: '7129',
      accountName: 'Rabais, remises et ristournes accordés (Pertes sur avaries fret)',
      debit: Number(htDec.toFixed(2)),
      credit: 0,
      currency: params.currency,
      description: `Avoir client suite litige marchandise mâturée/altérée - Réf: ${params.claimReference}`,
    },
  ];

  if (tvaDec.greaterThan(0)) {
    entries.push({
      entryNumber: `${params.creditNoteNumber}-02`,
      accountCode: '4455',
      accountName: 'État - TVA facturée à régulariser',
      debit: Number(tvaDec.toFixed(2)),
      credit: 0,
      currency: params.currency,
      description: `Régularisation TVA sur avoir client - Réf: ${params.claimReference}`,
    });
  }

  entries.push({
    entryNumber: `${params.creditNoteNumber}-03`,
    accountCode: '3421',
    accountName: `Clients (${params.clientName})`,
    debit: 0,
    credit: Number(ttcDec.toFixed(2)),
    currency: params.currency,
    description: `Imputation avoir sur compte client - Avoir ${params.creditNoteNumber}`,
  });

  // 2. Insurance Indemnity Receivable (Compte 3488 / 7588)
  const insuranceReceivableEntry: InsuranceReceivableLedgerEntry = {
    entryNumber: `${params.creditNoteNumber}-INS`,
    accountCode: '3488',
    accountName: `Créances diverses - Indemnités à recevoir (${params.insurerName})`,
    debit: Number(ttcDec.toFixed(2)),
    credit: 0,
    insurerName: params.insurerName,
    policyNumber: params.policyNumber,
  };

  return { ledgerEntries: entries, insuranceReceivableEntry };
}

