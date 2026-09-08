import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CurrencyTotal {
  currency: string;
  total: number;
}

// تنسيق المبالغ المالية مع رمز العملة (بالمعيار المغربي/الفرنسي)
export function formatCurrency(
  amount?: number | string | InstanceType<typeof Decimal> | null,
  currency: string = 'MAD'
): string {
  const num = new Decimal(amount || 0).toNumber();
  return `${num.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'MAD'}`;
}

// تجميع الأرصدة مالياً حسب العملة بشكل منفصل لتفادي خلط MAD مع EUR
export function groupBalancesByCurrency(
  items: Array<{ current_balance?: number | string | null; currency?: string | null; amount?: number | string | null }>
): Record<string, number> {
  return items.reduce((acc, item) => {
    const curr = (item.currency || 'MAD').toUpperCase();
    const balance = new Decimal(item.current_balance ?? item.amount ?? 0);
    acc[curr] = new Decimal(acc[curr] || 0).plus(balance).toNumber();
    return acc;
  }, {} as Record<string, number>);
}

// حساب الفارق المالي بين سعر الصرف عند الفوترة وسعر الصرف الفعلي عند التحصيل
export function calculateForexGainLoss(
  invoiceAmount: number | string,
  initialRate: number | string,
  settlementRate: number | string
): { amount: number; type: 'gain' | 'loss' | 'neutral' } {
  const originalValueInMAD = new Decimal(invoiceAmount || 0).times(new Decimal(initialRate || 0));
  const settledValueInMAD = new Decimal(invoiceAmount || 0).times(new Decimal(settlementRate || 0));
  const diff = settledValueInMAD.minus(originalValueInMAD);

  if (diff.gt(0.01)) {
    return { amount: parseFloat(diff.toFixed(2)), type: 'gain' };
  } else if (diff.lt(-0.01)) {
    return { amount: parseFloat(diff.abs().toFixed(2)), type: 'loss' };
  }
  return { amount: 0, type: 'neutral' };
}
