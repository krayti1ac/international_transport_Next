/**
 * Trans Bodanon TMS — Commercial Bills Financial Precision & Portfolio Calculator
 * Standards: Moroccan Commercial Code / Bank Discounting (Escompte commercial 360j, TVA 10%)
 * Precision: Strict Decimal.js operations for agios, net proceeds, and portfolio aggregation.
 */

import Decimal from 'decimal.js';
import type {
  CommercialBill,
  CommercialBillsSummary,
  MaturityUrgency,
} from '../types/commercial-bills.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface DiscountCalculationInput {
  faceValue: number;
  annualRatePct: number; // e.g. 6.5%
  daysToMaturity: number; // e.g. 45 days
  fixedCommissionMad?: number; // e.g. 30 MAD
  includeVat10Pct?: boolean;
}

export interface DiscountCalculationOutput {
  faceValue: number;
  agios: number;
  vatAmount: number;
  totalDeductions: number;
  netProceeds: number;
}

/**
 * Calculates banking discount agios and net liquidity proceeds using 360-day commercial standard
 */
export function calculateNetDiscountProceeds(
  input: DiscountCalculationInput
): DiscountCalculationOutput {
  const faceValDec = new Decimal(Math.max(0, input.faceValue));
  const rateDec = new Decimal(Math.max(0, input.annualRatePct));
  const daysDec = new Decimal(Math.max(0, input.daysToMaturity));
  const fixedFeeDec = new Decimal(Math.max(0, input.fixedCommissionMad || 0));

  // Base interest agios = (FaceValue * Rate * Days) / (360 * 100)
  const interestDec = faceValDec
    .times(rateDec)
    .times(daysDec)
    .dividedBy(new Decimal(36000));

  const agiosDec = interestDec.plus(fixedFeeDec);

  // Bank fee TVA in Morocco is 10%
  const vatDec = input.includeVat10Pct !== false ? agiosDec.times(new Decimal(0.1)) : new Decimal(0);
  const totalDeductionsDec = agiosDec.plus(vatDec);
  const netProceedsDec = Decimal.max(0, faceValDec.minus(totalDeductionsDec));

  return {
    faceValue: Number(faceValDec.toFixed(2)),
    agios: Number(agiosDec.toFixed(2)),
    vatAmount: Number(vatDec.toFixed(2)),
    totalDeductions: Number(totalDeductionsDec.toFixed(2)),
    netProceeds: Number(netProceedsDec.toFixed(2)),
  };
}

/**
 * Evaluates the maturity urgency of a commercial bill relative to today
 */
export function getMaturityUrgency(dueDateStr: string): MaturityUrgency {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  if (diffDays <= 7) return 'due_soon';
  return 'upcoming';
}

/**
 * Computes portfolio KPIs and status aggregation using Decimal.js
 */
export function calculatePortfolioSummary(
  bills: CommercialBill[],
  currency = 'MAD'
): CommercialBillsSummary {
  let portfolioDec = new Decimal(0);
  let remittedDec = new Decimal(0);
  let discountedDec = new Decimal(0);
  let clearedDec = new Decimal(0);
  let bouncedDec = new Decimal(0);

  let dueWithin7Count = 0;
  let dueWithin7Dec = new Decimal(0);

  let overdueCount = 0;
  let overdueDec = new Decimal(0);

  for (const b of bills) {
    const val = new Decimal(b.faceValue || 0);
    const urgency = getMaturityUrgency(b.dueDate);

    switch (b.status) {
      case 'in_portfolio':
        portfolioDec = portfolioDec.plus(val);
        if (urgency === 'overdue') {
          overdueCount += 1;
          overdueDec = overdueDec.plus(val);
        } else if (urgency === 'due_today' || urgency === 'due_soon') {
          dueWithin7Count += 1;
          dueWithin7Dec = dueWithin7Dec.plus(val);
        }
        break;
      case 'remitted_for_collection':
        remittedDec = remittedDec.plus(val);
        if (urgency === 'overdue') {
          overdueCount += 1;
          overdueDec = overdueDec.plus(val);
        } else if (urgency === 'due_today' || urgency === 'due_soon') {
          dueWithin7Count += 1;
          dueWithin7Dec = dueWithin7Dec.plus(val);
        }
        break;
      case 'discounted':
        discountedDec = discountedDec.plus(val);
        break;
      case 'cleared':
        clearedDec = clearedDec.plus(val);
        break;
      case 'bounced_unpaid':
        bouncedDec = bouncedDec.plus(val);
        break;
      default:
        break;
    }
  }

  return {
    totalPortfolioValue: Number(portfolioDec.toFixed(2)),
    totalRemittedValue: Number(remittedDec.toFixed(2)),
    totalDiscountedValue: Number(discountedDec.toFixed(2)),
    totalClearedValue: Number(clearedDec.toFixed(2)),
    totalBouncedValue: Number(bouncedDec.toFixed(2)),
    dueWithin7DaysCount: dueWithin7Count,
    dueWithin7DaysValue: Number(dueWithin7Dec.toFixed(2)),
    overdueCount,
    overdueValue: Number(overdueDec.toFixed(2)),
    totalBillsCount: bills.length,
    currency,
  };
}
