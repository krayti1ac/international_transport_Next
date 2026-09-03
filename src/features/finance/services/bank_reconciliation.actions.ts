'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type { TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DATE_TOLERANCE_DAYS = 3;

export interface BankStatementRow {
  date: string;
  amount: number;
  reference?: string;
  description?: string;
  currency: string;
  balance?: number;
  raw?: Record<string, unknown>;
}

export interface ReconciliationMatch {
  bankRow: BankStatementRow;
  treasuryTransaction: TreasuryTransaction;
  confidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

export interface ReconciliationResult {
  success: boolean;
  matched: ReconciliationMatch[];
  unmatchedBankRows: BankStatementRow[];
  unmatchedSystemTransactions: TreasuryTransaction[];
  error?: string;
}

export async function autoReconcileBankStatement(
  csvData: BankStatementRow[],
  bankAccountId: number
): Promise<ReconciliationResult> {
  try {
    const supabase = await createClient();

    const { data: treasuryTransactions, error: txError } = await supabase
      .from('treasury_transactions')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .neq('reconciliation_status', 'reconciled')
      .order('created_at', { ascending: false });

    if (txError) throw txError;

    const matched: ReconciliationMatch[] = [];
    const matchedTreasuryIds = new Set<number>();
    const matchedBankIndices = new Set<number>();

    const systemTxList = (treasuryTransactions || []) as TreasuryTransaction[];

    for (let i = 0; i < csvData.length; i++) {
      const bankRow = csvData[i];
      if (matchedBankIndices.has(i)) continue;

      const bankAmount = new Decimal(bankRow.amount || 0);
      const bankDate = new Date(bankRow.date);

      for (let j = 0; j < systemTxList.length; j++) {
        const tx = systemTxList[j];
        if (matchedTreasuryIds.has(tx.id)) continue;

        const txAmount = new Decimal(tx.amount || 0);
        const txDate = new Date(tx.created_at);

        const amountDiff = bankAmount.minus(txAmount).abs();
        const amountMatches = amountDiff.lessThanOrEqualTo(new Decimal(0.01));

        const dateDiffMs = bankDate.getTime() - txDate.getTime();
        const dateDiffDays = Math.abs(dateDiffMs) / (1000 * 60 * 60 * 24);
        const dateMatches = dateDiffDays <= DATE_TOLERANCE_DAYS;

        const bankRef = (bankRow.reference || bankRow.description || '').toLowerCase();
        const txRef = (tx.reference || tx.description || '').toLowerCase();
        const refMatches = bankRef && txRef && (
          bankRef.includes(txRef) || txRef.includes(bankRef) ||
          (bankRef.length > 3 && txRef.length > 3 && levenshteinDistance(bankRef, txRef) <= 3)
        );

        if (amountMatches && dateMatches && refMatches) {
          matched.push({
            bankRow,
            treasuryTransaction: tx,
            confidence: amountMatches && dateMatches && refMatches ? 'high' : 'medium',
            matchReason: `Amount match (±0.01), date within ${dateDiffDays.toFixed(1)} days, reference similarity`,
          });

          matchedTreasuryIds.add(tx.id);
          matchedBankIndices.add(i);
          break;
        }
      }
    }

    for (const match of matched) {
      const { error: updateError } = await supabase
        .from('treasury_transactions')
        .update({
          reconciliation_status: 'reconciled',
          bank_statement_ref: match.bankRow.reference || match.bankRow.description || 'bank_reconciled',
        })
        .eq('id', match.treasuryTransaction.id);

      if (updateError) {
        console.error(`Failed to reconcile transaction ${match.treasuryTransaction.id}:`, updateError);
      }
    }

    const unmatchedBankRows = csvData.filter((_, idx) => !matchedBankIndices.has(idx));
    const unmatchedSystemTransactions = systemTxList.filter(tx => !matchedTreasuryIds.has(tx.id));

    return {
      success: true,
      matched,
      unmatchedBankRows,
      unmatchedSystemTransactions,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reconcile bank statement';
    return {
      success: false,
      matched: [],
      unmatchedBankRows: csvData,
      unmatchedSystemTransactions: [],
      error: message,
    };
  }
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

export async function confirmBankReconciliation(transactionId: number, bankStatementRef: string): Promise<{
  success: boolean;
  error?: string;
}> {
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

export async function getUnreconciledTransactions(bankAccountId?: number): Promise<{
  success: boolean;
  transactions?: TreasuryTransaction[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('treasury_transactions')
      .select('*')
      .neq('reconciliation_status', 'reconciled')
      .order('created_at', { ascending: false });

    if (bankAccountId) {
      query = query.eq('bank_account_id', bankAccountId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, transactions: (data || []) as TreasuryTransaction[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch unreconciled transactions';
    return { success: false, error: message };
  }
}

export async function createBankAccount(input: {
  name: string;
  bank_name?: string;
  account_number?: string;
  currency: string;
  account_type?: string;
  current_balance?: number;
}): Promise<{
  success: boolean;
  bankAccount?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        name: input.name.trim(),
        bank_name: input.bank_name?.trim() || input.name.trim(),
        account_number: input.account_number?.trim() || '',
        currency: input.currency || 'MAD',
        account_type: input.account_type || 'checking',
        current_balance: input.current_balance || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error in createBankAccount:', error);
      return { success: false, error: error.message || error.details || 'فشل إضافة الحساب البنكي في قاعدة البيانات' };
    }

    return { success: true, bankAccount: data };
  } catch (err: unknown) {
    const message = (err as any)?.message || (err instanceof Error ? err.message : 'فشل إضافة الحساب البنكي');
    return { success: false, error: message };
  }
}
