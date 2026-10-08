'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit.server';
import type { ParsedBankRow } from './bank-parser';
import {
  parseBankStatementUnified,
  statementRowsToLegacyBankRows,
} from './bank-statement-parser.service';
import {
  reconcileStatementCore,
  calculateForexDifferential,
} from './bank-auto-reconciler.service';
import type {
  BankStatementFormat,
  DebitCreditMark,
  StatementBalance,
  ParsedStatementTransaction,
  ParsedBankStatement,
  ForexDifferential,
  MatchConfidence,
  MatchScoreBreakdown,
  SmartReconciliationMatch,
  SmartAutoReconcileResult,
} from '../types/bank-statement.types';

// Re-export types for backward compatibility
export type {
  BankStatementFormat,
  DebitCreditMark,
  StatementBalance,
  ParsedStatementTransaction,
  ParsedBankStatement,
  ForexDifferential,
  MatchConfidence,
  MatchScoreBreakdown,
  SmartReconciliationMatch,
  SmartAutoReconcileResult,
};

// Legacy interface aliases
export type ReconciliationMatch = SmartReconciliationMatch;
export type AutoReconcileResult = SmartAutoReconcileResult;
export type BankStatementRow = ParsedBankRow;

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Run automated smart reconciliation engine between parsed bank rows and system data
 */
export async function autoReconcileBankStatement(
  bankRows: (ParsedBankRow | ParsedStatementTransaction)[]
): Promise<SmartAutoReconcileResult> {
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

    // Normalise incoming rows into ParsedStatementTransaction format
    const statementTransactions: ParsedStatementTransaction[] = bankRows.map((r, idx) => {
      const isStatementTx = 'statementType' in r;
      const amtDec = new Decimal(r.amount);
      return {
        id: (r as ParsedStatementTransaction).id || `ROW-${idx + 1}`,
        statementType: isStatementTx ? (r as ParsedStatementTransaction).statementType : 'csv',
        date: r.date,
        valueDate: (r as ParsedStatementTransaction).valueDate || r.date,
        amount: amtDec.toNumber(),
        amountDecimal: amtDec.toFixed(2),
        currency: r.currency || 'MAD',
        reference: r.reference,
        bankReference: (r as ParsedStatementTransaction).bankReference,
        endToEndId: (r as ParsedStatementTransaction).endToEndId,
        description: r.description || 'Transaction',
        remittanceInfo: (r as ParsedStatementTransaction).remittanceInfo,
        partnerName: (r as ParsedStatementTransaction).partnerName,
        partnerIce: (r as ParsedStatementTransaction).partnerIce,
        transactionCode: (r as ParsedStatementTransaction).transactionCode,
        balance: r.balance,
        raw: r.raw,
      };
    });

    const result = reconcileStatementCore({
      statementTransactions,
      systemTransactions: systemTransactions || [],
      invoices: (invoices as any[]) || [],
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل محرك المطابقة البنكية الآلي';
    return {
      success: false,
      matched: [],
      unmatchedBankRows: bankRows.map((r) => ({
        date: r.date,
        amount: r.amount,
        reference: r.reference,
        description: r.description,
        currency: r.currency,
        balance: r.balance,
        raw: r.raw,
      })),
      unmatchedStatementTransactions: [],
      unmatchedSystemTransactions: [],
      unmatchedInvoices: [],
      highConfidenceCount: 0,
      totalMatchedVolume: '0.00',
      forexGainCount: 0,
      forexLossCount: 0,
      totalForexImpact: '0.00',
      error: message,
    };
  }
}

/**
 * End-to-end Server Action: Parse uploaded bank statement file and execute smart reconciliation
 * Supports SWIFT MT940 (.sta, .mt940), ISO 20022 CAMT.053 (.xml), OFX, and CSV
 */
export async function parseAndReconcileStatementAction(
  fileContent: string,
  fileName?: string
): Promise<{
  success: boolean;
  statementMeta?: {
    format: BankStatementFormat;
    accountIdentification?: string;
    statementReference?: string;
    currency: string;
    openingBalance?: StatementBalance;
    closingBalance?: StatementBalance;
    totalCredit: string;
    totalDebit: string;
    transactionCount: number;
  };
  reconciliation?: SmartAutoReconcileResult;
  error?: string;
}> {
  try {
    const parsedStatement = parseBankStatementUnified(fileContent, fileName);

    if (!parsedStatement.success || parsedStatement.rows.length === 0) {
      return {
        success: false,
        error: parsedStatement.error || 'فشل استخراج العمليات من الملف المرفوع',
      };
    }

    const reconciliation = await autoReconcileBankStatement(parsedStatement.rows);

    return {
      success: true,
      statementMeta: {
        format: parsedStatement.format,
        accountIdentification: parsedStatement.accountIdentification,
        statementReference: parsedStatement.statementReference,
        currency: parsedStatement.currency,
        openingBalance: parsedStatement.openingBalance,
        closingBalance: parsedStatement.closingBalance,
        totalCredit: parsedStatement.totalCredit,
        totalDebit: parsedStatement.totalDebit,
        transactionCount: parsedStatement.transactionCount,
      },
      reconciliation,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل معالجة ومطابقة كشف الحساب البنكي';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Confirm a single match (either treasury transaction or invoice)
 * Automatically registers forex differentials and records audit logs
 */
export async function confirmSingleSmartMatch(
  match: SmartReconciliationMatch,
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

      // Audit trail
      await recordAuditLog({
        entityType: 'treasury_transaction',
        entityId: match.treasuryTransaction.id,
        actionType: 'update',
        reason: `تسوية بنكية مطابقة - ${match.matchReason}`,
        newData: {
          reconciliation_status: 'reconciled',
          bank_statement_ref: ref,
          matchScore: match.matchScore,
        },
      });

      return { success: true };
    }

    if (match.matchType === 'invoice' && match.invoice) {
      const inv = match.invoice;
      const bankAmt = new Decimal(match.bankRow.amount);
      const curPaid = new Decimal(inv.total_amount - inv.remaining_amount || 0);

      // In case of multi-currency, paid amount in invoice currency
      let invoicePaidPortion = bankAmt;
      if (match.forex?.hasForex && match.forex.exchangeRate) {
        const rateDec = new Decimal(match.forex.exchangeRate);
        if (rateDec.greaterThan(0)) {
          invoicePaidPortion = inv.currency.toUpperCase() === 'MAD'
            ? bankAmt.times(rateDec)
            : bankAmt.dividedBy(rateDec);
        }
      }

      const newPaid = curPaid.plus(invoicePaidPortion);
      const total = new Decimal(inv.total_amount);
      const newStatus = newPaid.greaterThanOrEqualTo(total.minus(0.05)) ? 'paid' : 'partial';

      // 1. Update invoice
      const { error: invUpdateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaid.toFixed(2),
          status: newStatus,
        })
        .eq('id', inv.id);

      if (invUpdateError) throw invUpdateError;

      // 2. Create reconciled treasury transaction for the settlement
      const statementRef = match.bankRow.reference || inv.invoice_number;
      const { data: createdTx, error: txCreateError } = await supabase
        .from('treasury_transactions')
        .insert({
          company_id: inv.company_id || null,
          type: 'income',
          amount: bankAmt.toNumber(),
          currency: match.bankRow.currency || inv.currency || 'MAD',
          bank_account_id: bankAccountId,
          description: `سداد بنكي مطابق للفاتورة ${inv.invoice_number} - ${match.bankRow.description || ''}`,
          reference: statementRef,
          reconciliation_status: 'reconciled',
          bank_statement_ref: match.bankRow.reference || match.bankRow.description || 'auto_reconciled',
        })
        .select('id')
        .single();

      if (txCreateError) throw txCreateError;

      // 3. Register Forex Gain / Loss if differential detected
      if (match.forex?.hasForex && match.forex.forexType !== 'neutral') {
        const diffAmountDec = new Decimal(match.forex.forexGainLossAmount);
        if (diffAmountDec.greaterThan(0.01)) {
          const isGain = match.forex.forexType === 'gain';
          await supabase.from('treasury_transactions').insert({
            company_id: inv.company_id || null,
            type: isGain ? 'income' : 'expense',
            amount: diffAmountDec.toNumber(),
            currency: match.forex.settledCurrency || 'MAD',
            bank_account_id: bankAccountId,
            description: `${isGain ? 'ربح صرف عملات (Gain de change)' : 'خسارة صرف عملات (Perte de change)'} - تسوية الفاتورة ${inv.invoice_number}`,
            reference: `FOREX-${inv.invoice_number}`,
            reconciliation_status: 'reconciled',
            bank_statement_ref: `FOREX-DIFF-${statementRef}`,
          });
        }
      }

      // 4. Audit trail
      await recordAuditLog({
        entityType: 'invoice',
        entityId: inv.id,
        actionType: 'update',
        reason: `تسوية بنكية آلية وسداد فاتورة - ${match.matchReason}`,
        newData: {
          paid_amount: newPaid.toFixed(2),
          status: newStatus,
          treasury_transaction_id: createdTx?.id,
          bank_account_id: bankAccountId,
          matchScore: match.matchScore,
          forex: match.forex,
        },
      });

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
  matches: SmartReconciliationMatch[],
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

/**
 * Fetch unreconciled treasury transactions
 */
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

/**
 * Confirm individual reconciliation link
 */
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

    await recordAuditLog({
      entityType: 'treasury_transaction',
      entityId: transactionId,
      actionType: 'update',
      reason: 'تأكيد التسوية البنكية المباشرة',
      newData: {
        reconciliation_status: 'reconciled',
        bank_statement_ref: bankStatementRef,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to confirm reconciliation';
    return { success: false, error: message };
  }
}
