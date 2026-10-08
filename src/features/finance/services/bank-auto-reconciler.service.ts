import Decimal from 'decimal.js';
import type {
  ParsedStatementTransaction,
  SmartReconciliationMatch,
  SmartAutoReconcileResult,
  ForexDifferential,
  MatchConfidence,
  MatchScoreBreakdown,
} from '../types/bank-statement.types';
import type { ParsedBankRow } from './bank-parser';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInstance = InstanceType<typeof Decimal>;

/**
 * Standard Moroccan Benchmark Exchange Rates (fallback when not fixed in contract)
 */
export const DEFAULT_BENCHMARK_RATES: Record<string, string> = {
  EUR: '10.85', // EUR to MAD benchmark
  USD: '10.05', // USD to MAD benchmark
  GBP: '12.80', // GBP to MAD benchmark
};

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
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

/**
 * Clean reference numbers (strip punctuation, spaces, common prefixes)
 */
export function normalizeReference(ref?: string): string {
  if (!ref) return '';
  return ref
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Strict Decimal.js Foreign Exchange (Forex) Differential Calculator
 * Computes Gain de Change / Perte de Change between invoice issuance and bank settlement
 */
export function calculateForexDifferential(params: {
  invoiceCurrency: string;
  settledCurrency: string;
  invoiceAmount: DecimalInstance | number | string;
  settledAmount: DecimalInstance | number | string;
  invoiceExchangeRate?: DecimalInstance | number | string;
}): ForexDifferential {
  const invCcy = (params.invoiceCurrency || 'MAD').toUpperCase();
  const setCcy = (params.settledCurrency || 'MAD').toUpperCase();

  const invAmtDec = new Decimal(params.invoiceAmount || 0);
  const setAmtDec = new Decimal(params.settledAmount || 0);

  // If same currency, no forex differential exists
  if (invCcy === setCcy) {
    return {
      hasForex: false,
      originalCurrency: invCcy,
      settledCurrency: setCcy,
      originalInvoiceAmount: invAmtDec.toFixed(2),
      settledAmount: setAmtDec.toFixed(2),
      exchangeRate: '1.0000',
      expectedSettlementInBankCurrency: invAmtDec.toFixed(2),
      forexDifference: '0.00',
      forexType: 'neutral',
      forexGainLossAmount: '0.00',
      accountingAdvice: 'تطابق في العملة (لا توجد فروق صرف)',
    };
  }

  // Cross-border settlement (e.g. Invoice EUR -> Bank MAD)
  let rateDec: DecimalInstance;
  if (params.invoiceExchangeRate && new Decimal(params.invoiceExchangeRate).greaterThan(0)) {
    rateDec = new Decimal(params.invoiceExchangeRate);
  } else if (invCcy === 'EUR' && setCcy === 'MAD') {
    rateDec = new Decimal(DEFAULT_BENCHMARK_RATES.EUR);
  } else if (invCcy === 'USD' && setCcy === 'MAD') {
    rateDec = new Decimal(DEFAULT_BENCHMARK_RATES.USD);
  } else if (invCcy === 'MAD' && setCcy === 'EUR') {
    rateDec = new Decimal(1).dividedBy(new Decimal(DEFAULT_BENCHMARK_RATES.EUR));
  } else {
    // Derive effective rate from settlement
    rateDec = invAmtDec.greaterThan(0) ? setAmtDec.dividedBy(invAmtDec) : new Decimal(1);
  }

  // Expected settlement = invoiceAmount * exchangeRate (or divided if inverted)
  const expectedSettlement = invAmtDec.times(rateDec);
  const diffDec = setAmtDec.minus(expectedSettlement);

  let forexType: 'gain' | 'loss' | 'neutral' = 'neutral';
  let advice = 'فارق صرف محايد (Ecart nul)';

  if (diffDec.greaterThan(0.01)) {
    forexType = 'gain';
    advice = `ربح صرف (Gain de change) بقيمة ${diffDec.toFixed(2)} ${setCcy} يقيد في حساب الإيرادات المالية (ح/ 7331)`;
  } else if (diffDec.lessThan(-0.01)) {
    forexType = 'loss';
    advice = `خسارة صرف (Perte de change) بقيمة ${diffDec.abs().toFixed(2)} ${setCcy} تقيد في حساب الأعباء المالية (ح/ 6331)`;
  }

  return {
    hasForex: true,
    originalCurrency: invCcy,
    settledCurrency: setCcy,
    originalInvoiceAmount: invAmtDec.toFixed(2),
    settledAmount: setAmtDec.toFixed(2),
    exchangeRate: rateDec.toFixed(4),
    expectedSettlementInBankCurrency: expectedSettlement.toFixed(2),
    forexDifference: diffDec.toFixed(2),
    forexType,
    forexGainLossAmount: diffDec.abs().toFixed(2),
    accountingAdvice: advice,
  };
}

/**
 * Calculate multi-heuristic match score between a bank row and system record
 */
export function calculateAdvancedMatchScore(params: {
  bankRow: ParsedStatementTransaction | ParsedBankRow;
  systemDate: string;
  systemAmount: number | string;
  systemCurrency?: string;
  systemRef: string;
  partnerIdentifiers?: string[];
  exchangeRate?: number | string;
}): {
  score: number;
  breakdown: MatchScoreBreakdown;
  reason: string;
  forex?: ForexDifferential;
} {
  const {
    bankRow,
    systemDate,
    systemAmount,
    systemCurrency = 'MAD',
    systemRef,
    partnerIdentifiers = [],
    exchangeRate,
  } = params;

  const breakdown: MatchScoreBreakdown = {
    amountScore: 0,
    dateScore: 0,
    referenceScore: 0,
    partnerScore: 0,
  };

  const bankAmt = new Decimal(bankRow.amount).abs();
  const sysAmt = new Decimal(systemAmount).abs();
  const bankCcy = (bankRow.currency || 'MAD').toUpperCase();
  const sysCcy = systemCurrency.toUpperCase();

  let forex: ForexDifferential | undefined;

  // 1. Amount Scoring (Max 40 points)
  if (bankCcy === sysCcy) {
    const amtDiff = bankAmt.minus(sysAmt).abs();
    if (amtDiff.isZero()) {
      breakdown.amountScore = 40;
    } else if (amtDiff.lessThanOrEqualTo(0.05)) {
      breakdown.amountScore = 38;
    } else if (amtDiff.lessThanOrEqualTo(1.0)) {
      breakdown.amountScore = 20;
    }
  } else {
    // Cross-currency evaluation (e.g. EUR invoice settled in MAD)
    forex = calculateForexDifferential({
      invoiceCurrency: sysCcy,
      settledCurrency: bankCcy,
      invoiceAmount: sysAmt,
      settledAmount: bankAmt,
      invoiceExchangeRate: exchangeRate,
    });

    const expectedDec = new Decimal(forex.expectedSettlementInBankCurrency);
    const forexDiff = bankAmt.minus(expectedDec).abs();

    if (forexDiff.lessThanOrEqualTo(1.0)) {
      breakdown.amountScore = 38;
    } else if (forexDiff.lessThanOrEqualTo(expectedDec.times(0.02))) {
      // Within 2% forex corridor
      breakdown.amountScore = 32;
    } else if (forexDiff.lessThanOrEqualTo(expectedDec.times(0.05))) {
      // Within 5% forex corridor
      breakdown.amountScore = 20;
    }
  }

  // 2. Date Proximity Scoring (Max 20 points)
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
  const bankText = `${bankRow.reference || ''} ${bankRow.description || ''} ${(bankRow as any).remittanceInfo || ''}`.toLowerCase();
  const rawSysRef = (systemRef || '').toLowerCase().trim();

  // Normalize tokens
  const normBankRef = normalizeReference(bankText);
  const normSysRef = normalizeReference(rawSysRef);

  if (rawSysRef && bankText.includes(rawSysRef)) {
    breakdown.referenceScore = 25;
  } else if (normSysRef && normBankRef.includes(normSysRef)) {
    breakdown.referenceScore = 24;
  } else if (rawSysRef.length > 3) {
    // Check partial tokens (e.g. '0042' from 'FA-2026-0042')
    const tokens = rawSysRef.split(/[-_/\s]+/).filter((t) => t.length >= 4);
    for (const t of tokens) {
      if (bankText.includes(t)) {
        breakdown.referenceScore = 20;
        break;
      }
    }

    if (breakdown.referenceScore === 0) {
      const maxLen = Math.max(rawSysRef.length, 10);
      const dist = levenshteinDistance(rawSysRef, bankText.substring(0, Math.min(bankText.length, rawSysRef.length + 10)));
      const sim = 1 - dist / maxLen;
      if (sim > 0.7) {
        breakdown.referenceScore = Math.round(18 * sim);
      }
    }
  }

  // 4. Partner Identification (ICE / Name / IBAN) (Max 15 points)
  for (const partner of partnerIdentifiers) {
    if (!partner || partner.length < 3) continue;
    const cleanPartner = partner.toLowerCase().trim();
    if (bankText.includes(cleanPartner)) {
      breakdown.partnerScore = 15;
      break;
    }
    // Also check ICE numeric only
    const digitsOnly = partner.replace(/\D/g, '');
    if (digitsOnly.length >= 9 && bankText.includes(digitsOnly)) {
      breakdown.partnerScore = 15;
      break;
    }
  }

  const score = breakdown.amountScore + breakdown.dateScore + breakdown.referenceScore + breakdown.partnerScore;
  const reasons: string[] = [];
  if (breakdown.amountScore >= 38) {
    reasons.push(forex?.hasForex ? `تطابق مالي مع تسوية العملة (${forex.originalCurrency} -> ${forex.settledCurrency})` : 'تطابق مالي تام (Amount Match)');
  }
  if (breakdown.dateScore >= 15) reasons.push('تقارب زمني مباشر (Date Proximity)');
  if (breakdown.referenceScore >= 20) reasons.push('تطابق رقم الوثيقة/الفاتورة (Ref Matched)');
  if (breakdown.partnerScore > 0) reasons.push('تطابق هوية العميل/المورد (Partner ID / ICE)');

  return {
    score,
    breakdown,
    reason: reasons.join(' + ') || 'مطابقة ذكية بالخوارزمية متعددة المعايير',
    forex,
  };
}

/**
 * Pure smart reconciliation core engine
 * Reconciles parsed statement transactions with system invoices & treasury transactions
 */
export function reconcileStatementCore(params: {
  statementTransactions: ParsedStatementTransaction[];
  systemTransactions: any[];
  invoices: any[];
}): SmartAutoReconcileResult {
  const { statementTransactions, systemTransactions, invoices } = params;

  const matched: SmartReconciliationMatch[] = [];
  const matchedBankIndices = new Set<number>();
  const matchedTreasuryIds = new Set<number>();
  const matchedInvoiceIds = new Set<number>();

  let highConfidenceCount = 0;
  let forexGainCount = 0;
  let forexLossCount = 0;
  let totalForexImpact = new Decimal(0);
  let matchedVolume = new Decimal(0);

  // Phase 1: Match against unreconciled Treasury Transactions
  for (let i = 0; i < statementTransactions.length; i++) {
    if (matchedBankIndices.has(i)) continue;
    const bankTx = statementTransactions[i];

    let bestMatch: SmartReconciliationMatch | null = null;
    let highestScore = 0;

    for (const tx of systemTransactions) {
      if (matchedTreasuryIds.has(tx.id)) continue;

      const { score, breakdown, reason, forex } = calculateAdvancedMatchScore({
        bankRow: bankTx,
        systemDate: tx.transaction_date,
        systemAmount: tx.amount,
        systemCurrency: tx.currency,
        systemRef: `${tx.reference || ''} ${tx.description || ''}`,
      });

      if (score > highestScore && score >= 45) {
        highestScore = score;
        const confidence: MatchConfidence = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
        bestMatch = {
          bankRow: {
            date: bankTx.date,
            amount: bankTx.amount,
            reference: bankTx.reference,
            description: bankTx.description,
            currency: bankTx.currency,
            raw: bankTx.raw,
          },
          statementTransaction: bankTx,
          matchType: 'treasury_transaction',
          confidence,
          matchScore: score,
          scoreBreakdown: breakdown,
          matchReason: reason,
          forex,
          treasuryTransaction: tx,
        };
      }
    }

    if (bestMatch && highestScore >= 45) {
      matched.push(bestMatch);
      matchedBankIndices.add(i);
      matchedTreasuryIds.add(bestMatch.treasuryTransaction!.id);
      matchedVolume = matchedVolume.plus(new Decimal(bankTx.amount).abs());
      if (bestMatch.confidence === 'high') highConfidenceCount++;
    }
  }

  // Phase 2: Match remaining rows against unpaid / pending Invoices
  for (let i = 0; i < statementTransactions.length; i++) {
    if (matchedBankIndices.has(i)) continue;
    const bankTx = statementTransactions[i];

    // Invoices are matched with positive credits (inflows)
    if (bankTx.amount <= 0) continue;

    let bestMatch: SmartReconciliationMatch | null = null;
    let highestScore = 0;

    for (const inv of invoices) {
      if (matchedInvoiceIds.has(inv.id)) continue;

      const totalDec = new Decimal(inv.total_amount || 0);
      const paidDec = new Decimal(inv.paid_amount || 0);
      const remainingAmount = totalDec.minus(paidDec).toNumber();

      const clientName = inv.client?.name || inv.client_name || '';
      const clientIce = inv.client?.ice || inv.client_ice || '';

      const { score, breakdown, reason, forex } = calculateAdvancedMatchScore({
        bankRow: bankTx,
        systemDate: inv.issue_date || inv.created_at,
        systemAmount: remainingAmount,
        systemCurrency: inv.currency,
        systemRef: `${inv.invoice_number} ${inv.payment_request_ref || ''}`,
        partnerIdentifiers: [clientName, clientIce],
        exchangeRate: inv.exchange_rate,
      });

      if (score > highestScore && score >= 45) {
        highestScore = score;
        const confidence: MatchConfidence = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
        bestMatch = {
          bankRow: {
            date: bankTx.date,
            amount: bankTx.amount,
            reference: bankTx.reference,
            description: bankTx.description,
            currency: bankTx.currency,
            raw: bankTx.raw,
          },
          statementTransaction: bankTx,
          matchType: 'invoice',
          confidence,
          matchScore: score,
          scoreBreakdown: breakdown,
          matchReason: reason,
          forex,
          invoice: {
            id: inv.id,
            invoice_number: inv.invoice_number,
            remaining_amount: remainingAmount,
            total_amount: totalDec.toNumber(),
            currency: inv.currency,
            client_name: clientName,
            client_ice: clientIce,
            issue_date: inv.issue_date,
            company_id: inv.company_id,
            payment_request_ref: inv.payment_request_ref,
            exchange_rate: inv.exchange_rate,
          },
        };
      }
    }

    if (bestMatch && highestScore >= 45) {
      matched.push(bestMatch);
      matchedBankIndices.add(i);
      matchedInvoiceIds.add(bestMatch.invoice!.id);
      matchedVolume = matchedVolume.plus(new Decimal(bankTx.amount).abs());
      if (bestMatch.confidence === 'high') highConfidenceCount++;

      if (bestMatch.forex?.hasForex) {
        if (bestMatch.forex.forexType === 'gain') {
          forexGainCount++;
          totalForexImpact = totalForexImpact.plus(new Decimal(bestMatch.forex.forexGainLossAmount));
        } else if (bestMatch.forex.forexType === 'loss') {
          forexLossCount++;
          totalForexImpact = totalForexImpact.minus(new Decimal(bestMatch.forex.forexGainLossAmount));
        }
      }
    }
  }

  const unmatchedBankRows: ParsedBankRow[] = [];
  const unmatchedStatementTransactions: ParsedStatementTransaction[] = [];

  for (let i = 0; i < statementTransactions.length; i++) {
    if (!matchedBankIndices.has(i)) {
      unmatchedStatementTransactions.push(statementTransactions[i]);
      unmatchedBankRows.push({
        date: statementTransactions[i].date,
        amount: statementTransactions[i].amount,
        reference: statementTransactions[i].reference,
        description: statementTransactions[i].description,
        currency: statementTransactions[i].currency,
        raw: statementTransactions[i].raw,
      });
    }
  }

  const unmatchedSystemTransactions = systemTransactions.filter((tx) => !matchedTreasuryIds.has(tx.id));
  const unmatchedInvoices = invoices.filter((inv) => !matchedInvoiceIds.has(inv.id));

  return {
    success: true,
    matched,
    unmatchedBankRows,
    unmatchedStatementTransactions,
    unmatchedSystemTransactions,
    unmatchedInvoices,
    highConfidenceCount,
    totalMatchedVolume: matchedVolume.toFixed(2),
    forexGainCount,
    forexLossCount,
    totalForexImpact: totalForexImpact.toFixed(2),
  };
}
