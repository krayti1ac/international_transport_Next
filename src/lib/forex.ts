export interface CurrencyTotal {
  currency: string;
  total: number;
}

export function formatCurrency(amount: number | string, currency: string = 'MAD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  return `${num.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function groupBalancesByCurrency(
  items: Array<{ current_balance?: number; currency?: string; amount?: number }>
): Record<string, number> {
  return items.reduce((acc, item) => {
    const curr = (item.currency || 'MAD').toUpperCase();
    const balance = item.current_balance ?? item.amount ?? 0;
    acc[curr] = (acc[curr] || 0) + Number(balance);
    return acc;
  }, {} as Record<string, number>);
}

export function calculateForexGainLoss(
  invoiceAmount: number,
  initialRate: number,
  settlementRate: number
): { amount: number; type: 'gain' | 'loss' | 'neutral' } {
  const originalValueInMAD = invoiceAmount * initialRate;
  const settledValueInMAD = invoiceAmount * settlementRate;
  const diff = settledValueInMAD - originalValueInMAD;

  if (diff > 0.01) {
    return { amount: parseFloat(diff.toFixed(2)), type: 'gain' };
  } else if (diff < -0.01) {
    return { amount: parseFloat(Math.abs(diff).toFixed(2)), type: 'loss' };
  }
  return { amount: 0, type: 'neutral' };
}
