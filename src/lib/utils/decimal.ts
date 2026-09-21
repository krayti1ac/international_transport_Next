import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

export function toDecimal(value: number | string | DecimalValue) {
  return new Decimal(value);
}

export function add(a: number | string | DecimalValue, b: number | string | DecimalValue) {
  return new Decimal(a).plus(new Decimal(b));
}

export function subtract(a: number | string | DecimalValue, b: number | string | DecimalValue) {
  return new Decimal(a).minus(new Decimal(b));
}

export function multiply(a: number | string | DecimalValue, b: number | string | DecimalValue) {
  return new Decimal(a).times(new Decimal(b));
}

export function divide(a: number | string | DecimalValue, b: number | string | DecimalValue) {
  return new Decimal(a).div(new Decimal(b));
}

export function formatCurrency(amount: number | string | DecimalValue, currency: string = 'MAD'): string {
  const num = new Decimal(amount).toNumber();
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export interface FIFOInvoiceInput {
  id: number;
  invoice_number?: string;
  total_amount: number | string;
  paid_amount?: number | string | null;
  status?: string;
  issue_date?: string | null;
  currency?: string;
  exchange_rate?: number | string | null;
  trip_id?: number | null;
}

export interface FIFOAllocationItem {
  invoiceId: number;
  invoiceNumber: string;
  allocatedAmount: number;
  newPaidAmount: number;
  remainingDue: number;
  newStatus: 'paid' | 'partially_paid';
  forexGainLoss?: {
    amount: number;
    type: 'gain' | 'loss' | 'neutral';
  };
  forexEntry?: {
    id?: number;
    amount: number;
    type: 'gain' | 'loss' | 'neutral';
  };
}

export function calculateFIFOAllocation(
  invoices: FIFOInvoiceInput[],
  paymentAmount: number | string | DecimalValue,
  settlementRate?: number | string | null
): FIFOAllocationItem[] & {
  totalAllocated: number;
  unallocatedCredit: number;
  affectedInvoicesCount: number;
  allocations: FIFOAllocationItem[];
  creditNotePayload?: {
    amount: number;
    currency: string;
    reason: string;
  };
} {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  let remaining = new Decimal(paymentAmount || 0);
  if (remaining.isNegative()) remaining = new Decimal(0);

  let totalAllocatedDec = new Decimal(0);
  const allocations: FIFOAllocationItem[] = [];

  // Sort invoices strictly by issue_date ASC (nulls last) then id ASC
  const sortedInvoices = [...invoices].sort((a, b) => {
    if (a.issue_date && b.issue_date) {
      const diff = new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime();
      if (diff !== 0) return diff;
    } else if (a.issue_date && !b.issue_date) {
      return -1;
    } else if (!a.issue_date && b.issue_date) {
      return 1;
    }
    return Number(a.id) - Number(b.id);
  });

  for (const invoice of sortedInvoices) {
    if (remaining.isZero()) break;

    const total = new Decimal(invoice.total_amount || 0);
    const paid = new Decimal(invoice.paid_amount || 0);
    const outstanding = total.minus(paid);

    if (outstanding.isZero() || outstanding.isNegative()) continue;

    let allocated: DecimalValue;
    let newStatus: 'paid' | 'partially_paid';
    let newPaidAmount: DecimalValue;

    if (remaining.greaterThanOrEqualTo(outstanding)) {
      allocated = outstanding;
      newPaidAmount = total;
      newStatus = 'paid';
      remaining = remaining.minus(allocated);
    } else {
      allocated = remaining;
      newPaidAmount = paid.plus(allocated);
      newStatus = 'partially_paid';
      remaining = new Decimal(0);
    }

    totalAllocatedDec = totalAllocatedDec.plus(allocated);

    // Forex calculation if applicable (EUR invoice with initial & settlement rate)
    let forexGainLoss: FIFOAllocationItem['forexGainLoss'];
    if (
      settlementRate &&
      invoice.currency?.toUpperCase() === 'EUR'
    ) {
      const initialRate = invoice.exchange_rate ? new Decimal(invoice.exchange_rate) : new Decimal(10.85);
      const diff = allocated.times(new Decimal(settlementRate).minus(initialRate));
      if (diff.gt(0.01)) {
        forexGainLoss = { amount: parseFloat(diff.toFixed(2)), type: 'gain' };
      } else if (diff.lt(-0.01)) {
        forexGainLoss = { amount: parseFloat(diff.abs().toFixed(2)), type: 'loss' };
      } else {
        forexGainLoss = { amount: 0, type: 'neutral' };
      }
    }

    allocations.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || `#${invoice.id}`,
      allocatedAmount: parseFloat(allocated.toFixed(2)),
      newPaidAmount: parseFloat(newPaidAmount.toFixed(2)),
      remainingDue: parseFloat(total.minus(newPaidAmount).toFixed(2)),
      newStatus,
      forexGainLoss,
    });
  }

  const result = allocations as FIFOAllocationItem[] & {
    totalAllocated: number;
    unallocatedCredit: number;
    affectedInvoicesCount: number;
    allocations: FIFOAllocationItem[];
    creditNotePayload?: {
      amount: number;
      currency: string;
      reason: string;
    };
  };

  const unallocatedAmount = parseFloat(remaining.toFixed(2));
  result.totalAllocated = parseFloat(totalAllocatedDec.toFixed(2));
  result.unallocatedCredit = unallocatedAmount;
  result.affectedInvoicesCount = allocations.length;
  result.allocations = allocations;

  if (unallocatedAmount > 0) {
    result.creditNotePayload = {
      amount: unallocatedAmount,
      currency: invoices[0]?.currency || 'MAD',
      reason: 'فائض سداد دفعات العميل بنظام FIFO (رصيد دائن معلق)',
    };
  }

  return result;
}

export function calculateTreasuryBalance(
  transactions: { type: string; amount: number; currency: string }[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  for (const tx of transactions) {
    if (!(tx.currency in balances)) {
      balances[tx.currency] = 0;
    }

    const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount));

    if (tx.type === 'trip_revenue' || tx.type === 'deposit') {
      balances[tx.currency] += amount;
    } else {
      balances[tx.currency] -= amount;
    }
  }

  return balances;
}

export function formatDate(date: string | Date, locale: string = 'ar'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function getDaysUntilExpiry(expiryDate: string | Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiryStatusColor(daysUntilExpiry: number): 'red' | 'orange' | 'green' {
  if (daysUntilExpiry < 0) return 'red';
  if (daysUntilExpiry <= 30) return 'orange';
  return 'green';
}

export interface FIFOPaymentResult {
  success: boolean;
  paymentId?: number;
  totalAllocated: number;
  unallocatedCredit: number;
  affectedInvoicesCount: number;
  creditBalanceId?: number;
  creditNotePayload?: {
    amount: number;
    currency: string;
    reason: string;
  };
  allocations: {
    invoiceId: number;
    invoiceNumber: string;
    allocatedAmount: number;
    newPaidAmount: number;
    newStatus: 'paid' | 'partially_paid';
    remainingDue?: number;
    forexGainLoss?: {
      amount: number;
      type: 'gain' | 'loss' | 'neutral';
    };
    forexEntry?: {
      id?: number;
      amount: number;
      type: 'gain' | 'loss' | 'neutral';
    };
  }[];
  forexEntries?: Array<{
    invoiceId: number;
    amount: number;
    type: 'gain' | 'loss' | 'neutral';
    id?: number;
    treasuryTransactionId?: number;
  }>;
  treasuryTransactionId?: number;
  error?: string;
}

/**
 * حساب معاينة فورية لتوزيع الدفعة بالأقدمية FIFO دون التأثير على قاعدة البيانات.
 */
export function previewFIFOAllocation(
  invoices: FIFOInvoiceInput[],
  amount: number,
  settlementRate?: number
): FIFOPaymentResult {
  const amountDec = new Decimal(amount);
  const allocationResult = calculateFIFOAllocation(invoices, amountDec, settlementRate);
  return {
    success: true,
    totalAllocated: allocationResult.totalAllocated,
    unallocatedCredit: allocationResult.unallocatedCredit,
    affectedInvoicesCount: allocationResult.affectedInvoicesCount,
    allocations: allocationResult.allocations,
    creditNotePayload: allocationResult.creditNotePayload,
  };
}
