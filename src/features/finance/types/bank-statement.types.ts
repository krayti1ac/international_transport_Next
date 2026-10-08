import type { ParsedBankRow } from '../services/bank-parser';

export type BankStatementFormat = 'mt940' | 'camt053' | 'ofx' | 'csv';

export type DebitCreditMark = 'credit' | 'debit';

export interface StatementBalance {
  date: string; // YYYY-MM-DD
  amount: string; // Decimal string
  currency: string;
  type: DebitCreditMark;
}

export interface ParsedStatementTransaction {
  id: string;
  statementType: BankStatementFormat;
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD
  amount: number; // Signed: positive = credit, negative = debit
  amountDecimal: string; // Decimal.js string for precision
  currency: string;
  reference?: string;
  bankReference?: string;
  endToEndId?: string;
  description: string;
  remittanceInfo?: string;
  partnerName?: string;
  partnerIban?: string;
  partnerIce?: string;
  transactionCode?: string;
  balance?: number;
  raw?: Record<string, unknown>;
}

export interface ParsedBankStatement {
  success: boolean;
  format: BankStatementFormat;
  statementReference?: string;
  accountIdentification?: string; // IBAN or Moroccan RIB (24 digits)
  statementNumber?: string;
  currency: string;
  openingBalance?: StatementBalance;
  closingBalance?: StatementBalance;
  rows: ParsedStatementTransaction[];
  totalCredit: string;
  totalDebit: string;
  transactionCount: number;
  error?: string;
}

export interface ForexDifferential {
  hasForex: boolean;
  originalCurrency: string;
  settledCurrency: string;
  originalInvoiceAmount: string;
  settledAmount: string;
  exchangeRate: string;
  expectedSettlementInBankCurrency: string;
  forexDifference: string;
  forexType: 'gain' | 'loss' | 'neutral';
  forexGainLossAmount: string;
  accountingAdvice: string;
}

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchScoreBreakdown {
  amountScore: number;
  dateScore: number;
  referenceScore: number;
  partnerScore: number;
}

export interface SmartReconciliationMatch {
  bankRow: ParsedBankRow;
  statementTransaction?: ParsedStatementTransaction;
  matchType: 'treasury_transaction' | 'invoice';
  confidence: MatchConfidence;
  matchScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  matchReason: string;
  forex?: ForexDifferential;
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
    client_ice?: string;
    issue_date: string;
    company_id?: string;
    payment_request_ref?: string;
    exchange_rate?: number;
  };
}

export interface SmartAutoReconcileResult {
  success: boolean;
  matched: SmartReconciliationMatch[];
  unmatchedBankRows: ParsedBankRow[];
  unmatchedStatementTransactions: ParsedStatementTransaction[];
  unmatchedSystemTransactions: any[];
  unmatchedInvoices: any[];
  highConfidenceCount: number;
  totalMatchedVolume: string;
  forexGainCount: number;
  forexLossCount: number;
  totalForexImpact: string;
  error?: string;
}
