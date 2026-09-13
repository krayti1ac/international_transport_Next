'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import type { ParsedBankRow } from './bank-parser';

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchScoreBreakdown {
  amountScore: number;
  dateScore: number;
  referenceScore: number;
  partnerScore: number;
}

export interface ReconciliationMatch {
  bankRow: ParsedBankRow;
  matchType: 'treasury_transaction' | 'invoice';
  confidence: MatchConfidence;
  matchScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  matchReason: string;
  treasuryTransaction?: {
    id: number;
    amount: number;
    currency: string;
    type: string;
    description: string;
    reference?: string;
    transaction_date: string;
  };
  invoice?: {
    id: number;
    invoice_number: string;
    remaining_amount: number;
    total_amount: number;
    currency: string;
    client_name?: string;
    issue_date: string;
    company_id?: string;
    payment_request_ref?: string;
  };
}

export interface AutoReconcileResult {
  success: boolean;
  matched: ReconciliationMatch[];
  unmatchedBankRows: ParsedBankRow[];
  unmatchedSystemTransactions: any[];
  unmatchedInvoices: any[];
  highConfidenceCount: number;
  totalMatchedVolume: string;
  error?: string;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function calculateMatchScore(
  bankRow: ParsedBankRow,
  systemDate: string,
  systemAmount: number,
  systemRef: string,
  partnerIdentifiers: string[] = []
): { score: number; breakdown: MatchScoreBreakdown; reason: string } {
  const breakdown: MatchScoreBreakdown = {
    amountScore: 0,
    dateScore: 0,
    referenceScore: 0,
    partnerScore: 0,
  };

  // 1. Amount Scoring (Max 40 points)
  const bankAmt = new Decimal(bankRow.amount).abs();
  const sysAmt = new Decimal(systemAmount).abs();
  const amtDiff = bankAmt.minus(sysAmt).abs();

  if (amtDiff.isZero()) {
    breakdown.amountScore = 40;
  } else if (amtDiff.lessThanOrEqualTo(0.05)) {
    breakdown.amountScore = 38;
  } else if (amtDiff.lessThanOrEqualTo(1.0)) {
    breakdown.amountScore = 20;
  } else {
    breakdown.amountScore = 0;
  }

  // 2. Date Scoring (Max 20 points)
  if (bankRow.date && systemDate) {
    const bankD = new Date(bankRow.date).getTime();
    const sysD = new Date(systemDate).getTime();
    const diffDays = Math.abs(bankD - sysD) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      breakdown.dateScore = 20;
    } else if (diffDays <= 3) {
      breakdown.dateScore = 15;
    } else if (diffDays <= 7) {
      breakdown.dateScore = 10;
    } else if (diffDays <= 15) {
      breakdown.dateScore = 5;
    }
  }

  // 3. Reference Matching (Max 25 points)
  const bankText = `${bankRow.reference || ''} ${bankRow.description || ''}`.toLowerCase().trim();
  const cleanSysRef = (systemRef || '').toLowerCase().trim();

  if (cleanSysRef && bankText.includes(cleanSysRef)) {
    breakdown.referenceScore = 25;
  } else if (cleanSysRef && cleanSysRef.length > 3) {
    const maxLen = Math.max(cleanSysRef.length, bankText.length);
    const dist = levenshteinDistance(cleanSysRef, bankText.substring(0, Math.min(bankText.length, cleanSysRef.length + 5)));
    const sim = 1 - dist / Math.max(maxLen, 1);
    if (sim > 0.7) {
      breakdown.referenceScore = Math.round(25 * sim);
    }
  }

  // 4. Partner Identification (ICE / Name) (Max 15 points)
  for (const partner of partnerIdentifiers) {
    if (partner && partner.length > 3 && bankText.includes(partner.toLowerCase())) {
      breakdown.partnerScore = 15;
      break;
    }
  }

  const score = breakdown.amountScore + breakdown.dateScore + breakdown.referenceScore + breakdown.partnerScore;
  const reasons: string[] = [];
  if (breakdown.amountScore >= 38) reasons.push('تطابق مالي تام (Amount Match)');
  if (breakdown.dateScore >= 15) reasons.push('تقارب زمني مباشر (Date Proximity)');
  if (breakdown.referenceScore >= 15) reasons.push('تطابق المرجع (Ref Matched)');
  if (breakdown.partnerScore > 0) reasons.push('تطابق هوية العميل/المورد (Partner ID)');

  return {
    score,
    breakdown,
    reason: reasons.join(' + ') || 'مطابقة جزئية بالخوارزمية الذكية',
  };
}

/**
 * Run automated smart reconciliation engine between parsed bank rows and system data
 */
export async function autoReconcileBankStatement(
  bankRows: ParsedBankRow[]
): Promise<AutoReconcileResult> {
  try {
    const supabase = await createClient();

    // 1. Fetch unreconciled treasury transactions
    const { data: systemTransactions, error: txError } = await supabase
      .from('treasury_transactions')
      .select('id, amount, currency, type, description, reference, transaction_date, reconciliation_status')
      .or('reconciliation_status.is.null,reconciliation_status.neq.reconciled')
      .order('transaction_date', { ascending: false })
      .limit(500);

    if (txError) throw txError;

    // 2. Fetch pending or partial invoices
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        total_amount,
        paid_amount,
        currency,
        issue_date,
        created_at,
        company_id,
        payment_request_ref,
        client:clients(id, name, ice)
      `)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(500);

    if (invError) throw invError;

    const matched: ReconciliationMatch[] = [];
    const matchedBankIndices = new Set<number>();
    const matchedTreasuryIds = new Set<number>();
    const matchedInvoiceIds = new Set<number>();

    let highConfidenceCount = 0;
    let matchedVolume = new Decimal(0);

    const systemTxList = systemTransactions || [];
    const invoiceList = (invoices as any[]) || [];

    // Phase A: Match against Treasury Transactions
    for (let i = 0; i < bankRows.length; i++) {
      if (matchedBankIndices.has(i)) continue;
      const bankRow = bankRows[i];

      let bestMatch: ReconciliationMatch | null = null;
      let highestScore = 0;

      for (const tx of systemTxList) {
        if (matchedTreasuryIds.has(tx.id)) continue;

        const { score, breakdown, reason } = calculateMatchScore(
          bankRow,
          tx.transaction_date,
          tx.amount,
          `${tx.reference || ''} ${tx.description || ''}`
        );

        if (score > highestScore && score >= 50) {
          highestScore = score;
          const confidence: MatchConfidence = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
          bestMatch = {
            bankRow,
            matchType: 'treasury_transaction',
            confidence,
            matchScore: score,
            scoreBreakdown: breakdown,
            matchReason: reason,
            treasuryTransaction: tx,
          };
        }
      }

      if (bestMatch && highestScore >= 50) {
        matched.push(bestMatch);
        matchedBankIndices.add(i);
        matchedTreasuryIds.add(bestMatch.treasuryTransaction!.id);
        matchedVolume = matchedVolume.plus(new Decimal(bankRow.amount).abs());
        if (bestMatch.confidence === 'high') highConfidenceCount++;
      }
    }

    // Phase B: Match remaining bank rows against Invoices
    for (let i = 0; i < bankRows.length; i++) {
      if (matchedBankIndices.has(i)) continue;
      const bankRow = bankRows[i];

      // Only positive bank credits (income) match client invoices
      if (bankRow.amount <= 0) continue;

      let bestMatch: ReconciliationMatch | null = null;
      let highestScore = 0;

      for (const inv of invoiceList) {
        if (matchedInvoiceIds.has(inv.id)) continue;

        const totalDec = new Decimal(inv.total_amount || 0);
        const paidDec = new Decimal(inv.paid_amount || 0);
        const remainingAmount = totalDec.minus(paidDec).toNumber();

        const clientName = inv.client?.name || '';
        const clientIce = inv.client?.ice || '';

        const { score, breakdown, reason } = calculateMatchScore(
          bankRow,
          inv.issue_date || inv.created_at,
          remainingAmount,
          `${inv.invoice_number} ${inv.payment_request_ref || ''}`,
          [clientName, clientIce]
        );

        if (score > highestScore && score >= 50) {
          highestScore = score;
          const confidence: MatchConfidence = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
          bestMatch = {
            bankRow,
            matchType: 'invoice',
            confidence,
            matchScore: score,
            scoreBreakdown: breakdown,
            matchReason: reason,
            invoice: {
              id: inv.id,
              invoice_number: inv.invoice_number,
              remaining_amount: remainingAmount,
              total_amount: totalDec.toNumber(),
              currency: inv.currency,
              client_name: clientName,
              issue_date: inv.issue_date,
              company_id: inv.company_id,
              payment_request_ref: inv.payment_request_ref,
            },
          };
        }
      }

      if (bestMatch && highestScore >= 50) {
        matched.push(bestMatch);
        matchedBankIndices.add(i);
        matchedInvoiceIds.add(bestMatch.invoice!.id);
        matchedVolume = matchedVolume.plus(new Decimal(bankRow.amount).abs());
        if (bestMatch.confidence === 'high') highConfidenceCount++;
      }
    }

    const unmatchedBankRows = bankRows.filter((_, idx) => !matchedBankIndices.has(idx));
    const unmatchedSystemTransactions = systemTxList.filter((tx) => !matchedTreasuryIds.has(tx.id));
    const unmatchedInvoices = invoiceList
      .filter((inv) => !matchedInvoiceIds.has(inv.id))
      .map((inv) => ({
        ...inv,
        client_name: inv.client?.name,
      }));

    return {
      success: true,
      matched,
      unmatchedBankRows,
      unmatchedSystemTransactions,
      unmatchedInvoices,
      highConfidenceCount,
      totalMatchedVolume: matchedVolume.toFixed(2),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل محرك المطابقة البنكية الآلي';
    return {
      success: false,
      matched: [],
      unmatchedBankRows: bankRows,
      unmatchedSystemTransactions: [],
      unmatchedInvoices: [],
      highConfidenceCount: 0,
      totalMatchedVolume: '0.00',
      error: message,
    };
  }
}

/**
 * Confirm a single match (either treasury transaction or invoice)
 */
export async function confirmSingleSmartMatch(
  match: ReconciliationMatch,
  bankAccountId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    if (match.matchType === 'treasury_transaction' && match.treasuryTransaction) {
      const ref = match.bankRow.reference || match.bankRow.description || 'bank_reconciled';
      const { error } = await supabase
        .from('treasury_transactions')
        .update({
          reconciliation_status: 'reconciled',
          bank_statement_ref: ref,
        })
        .eq('id', match.treasuryTransaction.id);

      if (error) throw error;
      return { success: true };
    }

    if (match.matchType === 'invoice' && match.invoice) {
      const inv = match.invoice;
      const bankAmt = new Decimal(match.bankRow.amount);
      const curPaid = new Decimal(inv.total_amount - inv.remaining_amount || 0);
      const newPaid = curPaid.plus(bankAmt);
      const total = new Decimal(inv.total_amount);
      const newStatus = newPaid.greaterThanOrEqualTo(total) ? 'paid' : 'partial';

      // 1. Update invoice
      const { error: invUpdateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaid.toFixed(2),
          status: newStatus,
        })
        .eq('id', inv.id);

      if (invUpdateError) throw invUpdateError;

      // 2. Create reconciled treasury transaction
      const { error: txCreateError } = await supabase
        .from('treasury_transactions')
        .insert({
          company_id: inv.company_id || null,
          type: 'income',
          amount: bankAmt.toNumber(),
          currency: inv.currency || match.bankRow.currency || 'MAD',
          bank_account_id: bankAccountId,
          description: `سداد بنكي مطابق للفاتورة ${inv.invoice_number} - ${match.bankRow.description || ''}`,
          reference: match.bankRow.reference || inv.invoice_number,
          reconciliation_status: 'reconciled',
          bank_statement_ref: match.bankRow.reference || match.bankRow.description || 'auto_reconciled',
        });

      if (txCreateError) throw txCreateError;
      return { success: true };
    }

    return { success: false, error: 'نوع المطابقة غير صالح' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تأكيد المطابقة';
    return { success: false, error: message };
  }
}

/**
 * Confirm batch high confidence matches
 */
export async function confirmBatchReconciliation(
  matches: ReconciliationMatch[],
  bankAccountId: number
): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
  let processedCount = 0;
  const errors: string[] = [];

  for (const match of matches) {
    const result = await confirmSingleSmartMatch(match, bankAccountId);
    if (result.success) {
      processedCount++;
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    success: errors.length === 0,
    processedCount,
    errors,
  };
}

export type BankStatementRow = ParsedBankRow;

export async function getUnreconciledTransactions() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('treasury_transactions')
      .select('*')
      .or('reconciliation_status.is.null,reconciliation_status.neq.reconciled')
      .order('transaction_date', { ascending: false });

    if (error) throw error;
    return { success: true, transactions: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch unreconciled transactions';
    return { success: false, error: message };
  }
}

export async function confirmBankReconciliation(
  transactionId: number,
  bankStatementRef: string = 'bank_reconciled'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('treasury_transactions')
      .update({
        reconciliation_status: 'reconciled',
        bank_statement_ref: bankStatementRef,
      })
      .eq('id', transactionId);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to confirm reconciliation';
    return { success: false, error: message };
  }
}

