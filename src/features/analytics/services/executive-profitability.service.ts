import Decimal from 'decimal.js';
import type {
  InternationalCorridorCode,
  CurrencyCode,
  CorridorCostBreakdown,
  CorridorProfitabilitySummary,
  ExecutiveBiKpiSummary,
  CostCategoryShare,
  MonthlyProfitabilityPoint,
  ExecutiveBiReportData,
} from '../types/executive-bi.types';

// Ensure 20-digit precision and bankers/half-up rounding for executive financial analytics
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalValue = number | string | InstanceType<typeof Decimal>;
export type DecimalInstance = InstanceType<typeof Decimal>;

export const DEFAULT_EUR_TO_MAD_RATE = new Decimal('10.85');
export const DEFAULT_MAD_TO_MRU_RATE = new Decimal('3.95');
export const DEFAULT_MAD_TO_XOF_RATE = new Decimal('62.50');
export const ANOMALY_VARIANCE_THRESHOLD_PERCENT = 15.0; // +15% over target triggers variance alert

/**
 * 1. Converts an amount between currencies using strict Decimal.js
 */
export function convertCurrency(
  amount: DecimalValue,
  from: CurrencyCode,
  to: CurrencyCode,
  eurToMadRate: DecimalValue = DEFAULT_EUR_TO_MAD_RATE
): DecimalInstance {
  const amt = new Decimal(amount || 0);
  if (from === to) return amt;

  const eurRate = new Decimal(eurToMadRate);

  // Step 1: Normalize to MAD
  let madValue = new Decimal(0);
  switch (from) {
    case 'MAD':
      madValue = amt;
      break;
    case 'EUR':
      madValue = amt.times(eurRate);
      break;
    case 'MRU':
      madValue = amt.dividedBy(DEFAULT_MAD_TO_MRU_RATE);
      break;
    case 'XOF':
      madValue = amt.dividedBy(DEFAULT_MAD_TO_XOF_RATE);
      break;
    default:
      madValue = amt;
  }

  // Step 2: Convert from MAD to target currency
  switch (to) {
    case 'MAD':
      return madValue;
    case 'EUR':
      return madValue.dividedBy(eurRate);
    case 'MRU':
      return madValue.times(DEFAULT_MAD_TO_MRU_RATE);
    case 'XOF':
      return madValue.times(DEFAULT_MAD_TO_XOF_RATE);
    default:
      return madValue;
  }
}

/**
 * 2. Calculates Actual CPK (Cost Per Kilometer) = Total Cost / Total Km
 */
export function calculateActualCpk(
  totalCost: DecimalValue,
  totalDistanceKm: DecimalValue
): DecimalInstance {
  const cost = new Decimal(totalCost || 0);
  const km = new Decimal(totalDistanceKm || 0);
  if (km.isZero() || km.isNegative()) return new Decimal(0);
  return cost.dividedBy(km);
}

/**
 * 3. Calculates RPK (Revenue Per Kilometer) = Total Revenue / Total Km
 */
export function calculateRevenuePerKm(
  totalRevenue: DecimalValue,
  totalDistanceKm: DecimalValue
): DecimalInstance {
  const rev = new Decimal(totalRevenue || 0);
  const km = new Decimal(totalDistanceKm || 0);
  if (km.isZero() || km.isNegative()) return new Decimal(0);
  return rev.dividedBy(km);
}

/**
 * 4. Calculates Net Profit Margin % = ((Revenue - Costs) / Revenue) * 100
 */
export function calculateNetMarginPercent(
  revenue: DecimalValue,
  totalCost: DecimalValue
): DecimalInstance {
  const rev = new Decimal(revenue || 0);
  const cost = new Decimal(totalCost || 0);
  if (rev.isZero() || rev.isNegative()) return new Decimal(0);

  const profit = rev.minus(cost);
  return profit.dividedBy(rev).times(100);
}

/**
 * 5. Calculates CPK Variance % = ((Actual CPK - Target CPK) / Target CPK) * 100
 */
export function calculateCpkVariancePercent(
  actualCpk: DecimalValue,
  targetCpk: DecimalValue
): DecimalInstance {
  const actual = new Decimal(actualCpk || 0);
  const target = new Decimal(targetCpk || 0);
  if (target.isZero() || target.isNegative()) return new Decimal(0);

  const variance = actual.minus(target);
  return variance.dividedBy(target).times(100);
}

/**
 * 6. Evaluates cost anomalies when actual CPK exceeds target by >= threshold
 */
export function evaluateCostAnomaly(
  actualCpk: DecimalValue,
  targetCpk: DecimalValue,
  thresholdPercent: number = ANOMALY_VARIANCE_THRESHOLD_PERCENT
): {
  isAnomaly: boolean;
  variancePercent: string;
  reason?: string;
} {
  const actual = new Decimal(actualCpk || 0);
  const target = new Decimal(targetCpk || 0);

  if (target.isZero()) {
    return { isAnomaly: false, variancePercent: '0.00' };
  }

  const varPct = calculateCpkVariancePercent(actual, target);
  const isAnomaly = varPct.greaterThanOrEqualTo(new Decimal(thresholdPercent));

  let reason: string | undefined;
  if (isAnomaly) {
    reason = `تجاوز تكلفة الكيلومتر الميدانية للهدف المرجعي بنسبة +${varPct.toFixed(1)}% (الحد الأقصى المسموح: +${thresholdPercent}%)`;
  }

  return {
    isAnomaly,
    variancePercent: varPct.toFixed(2),
    reason,
  };
}

/**
 * 7. Builds a single corridor summary
 */
export function buildCorridorProfitabilitySummary(params: {
  corridorCode: InternationalCorridorCode;
  corridorTitleAr: string;
  corridorTitleFr: string;
  corridorTitleEs: string;
  origin: string;
  destination: string;
  totalTripsCount: number;
  totalDistanceKm: number;
  revenue: DecimalValue;
  costs: {
    fuelCost: DecimalValue;
    ferryPortFees: DecimalValue;
    driverAllowancesAdvances: DecimalValue;
    maintenanceDepreciation: DecimalValue;
    customsTransitFees: DecimalValue;
    otherOperatingExpenses: DecimalValue;
  };
  targetCpk: DecimalValue;
  currency?: CurrencyCode;
}): CorridorProfitabilitySummary {
  const ccy = params.currency || 'MAD';
  const rev = new Decimal(params.revenue || 0);

  const fuel = new Decimal(params.costs.fuelCost || 0);
  const ferry = new Decimal(params.costs.ferryPortFees || 0);
  const driver = new Decimal(params.costs.driverAllowancesAdvances || 0);
  const maint = new Decimal(params.costs.maintenanceDepreciation || 0);
  const customs = new Decimal(params.costs.customsTransitFees || 0);
  const other = new Decimal(params.costs.otherOperatingExpenses || 0);

  const totalCost = fuel.plus(ferry).plus(driver).plus(maint).plus(customs).plus(other);
  const grossProfit = rev.minus(fuel.plus(ferry).plus(customs));
  const netProfit = rev.minus(totalCost);

  const actualCpk = calculateActualCpk(totalCost, params.totalDistanceKm);
  const rpk = calculateRevenuePerKm(rev, params.totalDistanceKm);
  const netMargin = calculateNetMarginPercent(rev, totalCost);
  const anomalyInfo = evaluateCostAnomaly(actualCpk, params.targetCpk);

  return {
    corridorCode: params.corridorCode,
    corridorTitleAr: params.corridorTitleAr,
    corridorTitleFr: params.corridorTitleFr,
    corridorTitleEs: params.corridorTitleEs,
    origin: params.origin,
    destination: params.destination,
    totalTripsCount: params.totalTripsCount,
    totalDistanceKm: params.totalDistanceKm,
    revenue: rev.toFixed(2),
    costs: {
      fuelCost: fuel.toFixed(2),
      ferryPortFees: ferry.toFixed(2),
      driverAllowancesAdvances: driver.toFixed(2),
      maintenanceDepreciation: maint.toFixed(2),
      customsTransitFees: customs.toFixed(2),
      otherOperatingExpenses: other.toFixed(2),
      totalCost: totalCost.toFixed(2),
    },
    grossProfit: grossProfit.toFixed(2),
    netOperatingProfit: netProfit.toFixed(2),
    netMarginPercent: netMargin.toFixed(2),
    actualCpk: actualCpk.toFixed(2),
    targetCpk: new Decimal(params.targetCpk || 0).toFixed(2),
    cpkVariancePercent: anomalyInfo.variancePercent,
    revenuePerKm: rpk.toFixed(2),
    isAnomaly: anomalyInfo.isAnomaly,
    anomalyReason: anomalyInfo.reason,
    currency: ccy,
  };
}

/**
 * 8. Aggregates executive report KPIs and distribution across corridors
 */
export function buildExecutiveBiReport(
  corridors: CorridorProfitabilitySummary[],
  monthlyTrend: MonthlyProfitabilityPoint[] = [],
  reportingCurrency: CurrencyCode = 'MAD',
  eurToMadRate: DecimalValue = DEFAULT_EUR_TO_MAD_RATE
): ExecutiveBiReportData {
  let totalRevDec = new Decimal(0);
  let totalCostDec = new Decimal(0);
  let totalGrossDec = new Decimal(0);
  let totalNetDec = new Decimal(0);
  let totalKm = 0;
  let totalTrips = 0;
  let anomalousCount = 0;

  let totalFuelDec = new Decimal(0);
  let totalFerryDec = new Decimal(0);
  let totalDriverDec = new Decimal(0);
  let totalMaintDec = new Decimal(0);
  let totalCustomsDec = new Decimal(0);
  let totalOtherDec = new Decimal(0);

  for (const c of corridors) {
    const rev = convertCurrency(c.revenue, c.currency, reportingCurrency, eurToMadRate);
    const cost = convertCurrency(c.costs.totalCost, c.currency, reportingCurrency, eurToMadRate);
    const gross = convertCurrency(c.grossProfit, c.currency, reportingCurrency, eurToMadRate);
    const net = convertCurrency(c.netOperatingProfit, c.currency, reportingCurrency, eurToMadRate);

    totalRevDec = totalRevDec.plus(rev);
    totalCostDec = totalCostDec.plus(cost);
    totalGrossDec = totalGrossDec.plus(gross);
    totalNetDec = totalNetDec.plus(net);

    totalKm += c.totalDistanceKm;
    totalTrips += c.totalTripsCount;
    if (c.isAnomaly) anomalousCount++;

    totalFuelDec = totalFuelDec.plus(convertCurrency(c.costs.fuelCost, c.currency, reportingCurrency, eurToMadRate));
    totalFerryDec = totalFerryDec.plus(convertCurrency(c.costs.ferryPortFees, c.currency, reportingCurrency, eurToMadRate));
    totalDriverDec = totalDriverDec.plus(convertCurrency(c.costs.driverAllowancesAdvances, c.currency, reportingCurrency, eurToMadRate));
    totalMaintDec = totalMaintDec.plus(convertCurrency(c.costs.maintenanceDepreciation, c.currency, reportingCurrency, eurToMadRate));
    totalCustomsDec = totalCustomsDec.plus(convertCurrency(c.costs.customsTransitFees, c.currency, reportingCurrency, eurToMadRate));
    totalOtherDec = totalOtherDec.plus(convertCurrency(c.costs.otherOperatingExpenses, c.currency, reportingCurrency, eurToMadRate));
  }

  const overallNetMargin = calculateNetMarginPercent(totalRevDec, totalCostDec);
  const avgActualCpk = calculateActualCpk(totalCostDec, totalKm);
  const avgRpk = calculateRevenuePerKm(totalRevDec, totalKm);

  // Efficiency: (Revenue - Costs) / Target CPK scaled or target comparison
  const efficiencyPercent = totalRevDec.isZero()
    ? '0.0'
    : Decimal.max(0, new Decimal(100).minus(totalCostDec.dividedBy(totalRevDec).times(100))).toFixed(1);

  const kpis: ExecutiveBiKpiSummary = {
    totalRevenue: totalRevDec.toFixed(2),
    totalOperatingCosts: totalCostDec.toFixed(2),
    grossProfit: totalGrossDec.toFixed(2),
    netOperatingProfit: totalNetDec.toFixed(2),
    overallNetMarginPercent: overallNetMargin.toFixed(2),
    totalDistanceKm: totalKm,
    totalTripsCompleted: totalTrips,
    averageActualCpk: avgActualCpk.toFixed(2),
    averageTargetCpk: '3.30',
    averageRevenuePerKm: avgRpk.toFixed(2),
    fleetOperatingEfficiencyPercent: efficiencyPercent,
    anomalousCorridorsCount: anomalousCount,
    reportingCurrency,
    forexRateEurToMad: new Decimal(eurToMadRate).toFixed(2),
  };

  // Cost Distribution shares
  const costSum = totalCostDec.isZero() ? new Decimal(1) : totalCostDec;
  const costDistribution: CostCategoryShare[] = [
    {
      nameAr: 'استهلاك الوقود (ديزل)',
      nameFr: 'Carburant (Gazole)',
      nameEs: 'Combustible (Diésel)',
      category: 'fuelCost',
      amount: totalFuelDec.toNumber(),
      percentage: totalFuelDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#3b82f6', // blue
    },
    {
      nameAr: 'العبارات والموانئ الدولية',
      nameFr: 'Ferries & Ports Internationaux',
      nameEs: 'Ferris y Puertos Internacionales',
      category: 'ferryPortFees',
      amount: totalFerryDec.toNumber(),
      percentage: totalFerryDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#06b6d4', // cyan
    },
    {
      nameAr: 'سلف وبدلات السائقين',
      nameFr: 'Avances & Indemnités Chauffeurs',
      nameEs: 'Anticipos y Dietas de Conductores',
      category: 'driverAllowancesAdvances',
      amount: totalDriverDec.toNumber(),
      percentage: totalDriverDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#10b981', // emerald
    },
    {
      nameAr: 'الصيانة الدورية والإهلاك',
      nameFr: 'Maintenance & Dépréciation',
      nameEs: 'Mantenimiento y Depreciación',
      category: 'maintenanceDepreciation',
      amount: totalMaintDec.toNumber(),
      percentage: totalMaintDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#f59e0b', // amber
    },
    {
      nameAr: 'الجمارك والترانزيت الإفريقي/الأوروبي',
      nameFr: 'Douanes & Transit International',
      nameEs: 'Aduanas y Tránsito Internacional',
      category: 'customsTransitFees',
      amount: totalCustomsDec.toNumber(),
      percentage: totalCustomsDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#8b5cf6', // purple
    },
    {
      nameAr: 'مصاريف تشغيلية أخرى',
      nameFr: 'Autres Frais Opérationnels',
      nameEs: 'Otros Gastos Operativos',
      category: 'otherOperatingExpenses',
      amount: totalOtherDec.toNumber(),
      percentage: totalOtherDec.dividedBy(costSum).times(100).toDecimalPlaces(1).toNumber(),
      color: '#64748b', // slate
    },
  ];

  return {
    kpis,
    corridors,
    monthlyTrend,
    costDistribution,
    generatedAt: new Date().toISOString(),
  };
}
