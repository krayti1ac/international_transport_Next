/**
 * Trans Bodanon TMS — Automated Recurring Invoices Service
 * Manages recurring transport billing schedules, cycle advancement, and automated payload generation.
 * Strictly adheres to Decimal.js financial and mathematical precision rules.
 */

import Decimal from 'decimal.js';
import type {
  RecurringInvoiceSchedule,
  RecurringFrequency,
  CreateRecurringScheduleInput,
  GeneratedRecurringInvoice,
} from '../types/recurring-invoice.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 1. Computes the next billing issue date based on frequency and designated billing day
 */
export function calculateNextBillingDate(
  frequency: RecurringFrequency,
  fromDate: string | Date,
  billingDayOfMonth: number = 1
): string {
  const base = new Date(fromDate);
  const next = new Date(base);

  switch (frequency) {
    case 'weekly':
      next.setDate(base.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(base.getDate() + 14);
      break;
    case 'monthly': {
      next.setDate(1);
      next.setMonth(base.getMonth() + 1);
      // Clamp day to valid range in that month
      const daysInTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(Math.max(1, billingDayOfMonth), daysInTargetMonth);
      next.setDate(targetDay);
      break;
    }
    case 'quarterly': {
      next.setDate(1);
      next.setMonth(base.getMonth() + 3);
      const daysInTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(Math.max(1, billingDayOfMonth), daysInTargetMonth);
      next.setDate(targetDay);
      break;
    }
    case 'annually': {
      next.setDate(1);
      next.setFullYear(base.getFullYear() + 1);
      const daysInTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(Math.max(1, billingDayOfMonth), daysInTargetMonth);
      next.setDate(targetDay);
      break;
    }
  }

  return next.toISOString().split('T')[0];
}

/**
 * 2. Checks if a recurring schedule is eligible and due for billing
 */
export function isScheduleDueForBilling(
  schedule: RecurringInvoiceSchedule,
  asOfDateStr?: string
): boolean {
  if (schedule.status !== 'active') return false;

  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const nextIssue = new Date(schedule.nextIssueDate);

  // If next issue date is in the future, not due yet
  if (nextIssue.getTime() > asOf.getTime()) {
    return false;
  }

  // Check end date if defined
  if (schedule.endDate) {
    const end = new Date(schedule.endDate);
    if (nextIssue.getTime() > end.getTime()) {
      return false;
    }
  }

  // Check maximum cycles completed
  if (schedule.maxCycles && schedule.totalCyclesCompleted >= schedule.maxCycles) {
    return false;
  }

  return true;
}

/**
 * 3. Builds a new recurring schedule record with Decimal.js verified amounts
 */
export function buildRecurringScheduleRecord(
  input: CreateRecurringScheduleInput,
  options?: { companyId?: number }
): RecurringInvoiceSchedule {
  const htDec = new Decimal(input.amountHt || 0);
  const tvaRateDec = input.isArticle92Exempt ? new Decimal(0) : new Decimal(input.tvaRate || 0);

  // tvaAmount = ht * (tvaRate / 100)
  const tvaAmountDec = htDec.times(tvaRateDec.dividedBy(100));
  // totalTtc = ht + tvaAmount
  const ttcDec = htDec.plus(tvaAmountDec);

  const start = input.startDate || new Date().toISOString().split('T')[0];
  const billingDay = input.billingDayOfMonth || new Date(start).getDate();

  return {
    id: `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    companyId: options?.companyId || 1,
    clientId: input.clientId,
    title: input.title,
    frequency: input.frequency,
    currency: input.currency || 'MAD',
    amountHt: htDec.toFixed(2),
    tvaRate: tvaRateDec.toFixed(2),
    tvaAmount: tvaAmountDec.toFixed(2),
    totalAmountTtc: ttcDec.toFixed(2),
    isArticle92Exempt: input.isArticle92Exempt ?? true,
    startDate: start,
    endDate: input.endDate,
    nextIssueDate: start, // First cycle issues on start date
    billingDayOfMonth: billingDay,
    autoSendEmail: input.autoSendEmail ?? true,
    autoSendWhatsapp: input.autoSendWhatsapp ?? true,
    autoGeneratePaymentLink: input.autoGeneratePaymentLink ?? true,
    preferredGateway: input.preferredGateway || 'multi',
    status: 'active',
    totalCyclesCompleted: 0,
    maxCycles: input.maxCycles,
    itemsBreakdown: input.itemsBreakdown || [
      {
        description: input.title,
        quantity: '1.00',
        unitPrice: htDec.toFixed(2),
        lineTotal: htDec.toFixed(2),
      },
    ],
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 4. Advances schedule state upon successful generation of an invoice
 */
export function advanceScheduleCycle(
  schedule: RecurringInvoiceSchedule,
  issuedDateStr?: string
): {
  updatedSchedule: RecurringInvoiceSchedule;
  isCompleted: boolean;
} {
  const issuedDate = issuedDateStr || schedule.nextIssueDate;
  const newCycleCount = schedule.totalCyclesCompleted + 1;

  const nextDate = calculateNextBillingDate(
    schedule.frequency,
    issuedDate,
    schedule.billingDayOfMonth
  );

  let isCompleted = false;
  let newStatus = schedule.status;

  // Check if completed by cycle count
  if (schedule.maxCycles && newCycleCount >= schedule.maxCycles) {
    isCompleted = true;
    newStatus = 'completed';
  }

  // Check if completed by end date
  if (schedule.endDate && new Date(nextDate).getTime() > new Date(schedule.endDate).getTime()) {
    isCompleted = true;
    newStatus = 'completed';
  }

  const updated: RecurringInvoiceSchedule = {
    ...schedule,
    lastIssuedDate: issuedDate,
    nextIssueDate: nextDate,
    totalCyclesCompleted: newCycleCount,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  return {
    updatedSchedule: updated,
    isCompleted,
  };
}

/**
 * 5. Formats a standardized invoice number for recurring cycles
 */
export function generateRecurringInvoiceNumber(
  scheduleId: string | number,
  cycleIndex: number,
  dateStr?: string
): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const cleanId = String(scheduleId).replace(/[^0-9]/g, '').slice(-4) || '1001';
  const cycle = String(cycleIndex).padStart(2, '0');

  return `FA-REC-${year}${month}-${cleanId}-${cycle}`;
}
