import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

export function calculateTripProfit(
  revenue: number | string | DecimalValue,
  expenses: { amount: number | string | DecimalValue }[]
): number {
  const totalExpenses = expenses.reduce(
    (sum, exp) => sum.plus(new Decimal(exp.amount)),
    new Decimal(0)
  );
  return new Decimal(revenue).minus(totalExpenses).toNumber();
}

export function calculateDriverSettlement(
  baseSalary: number | string | DecimalValue,
  bonusPercentage: number,
  tripProfit: number | string | DecimalValue,
  fines: { amount: number | string | DecimalValue }[]
): number {
  const salary = new Decimal(baseSalary);
  const bonus = new Decimal(tripProfit).times(new Decimal(bonusPercentage).div(100));
  const totalFines = fines.reduce(
    (sum, fine) => sum.plus(new Decimal(fine.amount)),
    new Decimal(0)
  );
  return salary.plus(bonus).minus(totalFines).toNumber();
}

export function calculateFleetDocumentStats(
  documents: { expiry_date: string | null; document_type: string }[]
) {
  const now = new Date();
  const stats = {
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    total: documents.length,
  };

  for (const doc of documents) {
    if (!doc.expiry_date) {
      stats.valid++;
      continue;
    }

    const expiry = new Date(doc.expiry_date);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      stats.expired++;
    } else if (daysUntilExpiry <= 30) {
      stats.expiringSoon++;
    } else {
      stats.valid++;
    }
  }

  return stats;
}

export function calculateROI(
  totalRevenue: number | string,
  totalCosts: number | string
): number {
  return new Decimal(totalRevenue).minus(new Decimal(totalCosts)).toNumber();
}
