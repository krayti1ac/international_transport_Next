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

export function calculateFIFOAllocation(
  invoices: { id: number; total_amount: number; paid_amount: number; status: string }[],
  paymentAmount: number | string | DecimalValue
): { invoiceId: number; allocatedAmount: number }[] {
  let remaining = new Decimal(paymentAmount);
  const allocations: { invoiceId: number; allocatedAmount: number }[] = [];

  const sortedInvoices = [...invoices].sort((a, b) => a.id - b.id);

  for (const invoice of sortedInvoices) {
    if (remaining.isZero()) break;

    const total = new Decimal(invoice.total_amount);
    const paid = new Decimal(invoice.paid_amount || 0);
    const outstanding = total.minus(paid);

    if (outstanding.isZero() || outstanding.isNegative()) continue;

    const allocated = remaining.greaterThan(outstanding) ? outstanding : remaining;
    allocations.push({
      invoiceId: invoice.id,
      allocatedAmount: allocated.toNumber(),
    });

    remaining = remaining.minus(allocated);
  }

  return allocations;
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
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US', {
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
