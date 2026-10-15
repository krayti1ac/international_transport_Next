/**
 * Trans Bodanon TMS — Groupage Cost Allocator & P&L Calculation Service
 * Standards: Proportional Multi-Consignment Cost Sharing (Chargeable Weight / LDM)
 * Precision: Strict Decimal.js calculations for all currency, allocations, and profit margins.
 */

import Decimal from 'decimal.js';
import type { TripConsignment } from '../types/groupage-ltl.types';
import type {
  CostAllocationMode,
  TripOperatingCosts,
  ConsignmentAllocationItem,
  GroupageTripPnlSummary,
} from '../types/groupage-split-billing.types';

export function calculateTripTotalOperatingCost(costs: {
  fuelCost?: number;
  ferryCost?: number;
  tollsCost?: number;
  customsCost?: number;
  driverCost?: number;
  currency?: string;
}): TripOperatingCosts {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  const fuelDec = new Decimal(Math.max(0, costs.fuelCost || 0));
  const ferryDec = new Decimal(Math.max(0, costs.ferryCost || 0));
  const tollsDec = new Decimal(Math.max(0, costs.tollsCost || 0));
  const customsDec = new Decimal(Math.max(0, costs.customsCost || 0));
  const driverDec = new Decimal(Math.max(0, costs.driverCost || 0));

  const totalSharedCostDec = fuelDec
    .plus(ferryDec)
    .plus(tollsDec)
    .plus(customsDec)
    .plus(driverDec);

  return {
    fuelCost: Number(fuelDec.toFixed(2)),
    ferryCost: Number(ferryDec.toFixed(2)),
    tollsCost: Number(tollsDec.toFixed(2)),
    customsCost: Number(customsDec.toFixed(2)),
    driverCost: Number(driverDec.toFixed(2)),
    totalSharedCost: Number(totalSharedCostDec.toFixed(2)),
    currency: costs.currency || 'MAD',
  };
}

/**
 * Distributes shared operating costs across groupage consignments and calculates net profitability
 */
export function calculateGroupageCostAllocation(
  consignments: TripConsignment[],
  costs: TripOperatingCosts,
  mode: CostAllocationMode = 'chargeable_weight'
): GroupageTripPnlSummary {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  const tripId = consignments[0]?.tripId || 0;
  const currency = costs.currency || consignments[0]?.currency || 'MAD';
  const totalSharedCostDec = new Decimal(costs.totalSharedCost);

  if (!consignments || consignments.length === 0) {
    return {
      tripId,
      allocationMode: mode,
      operatingCosts: costs,
      totalRevenue: 0,
      totalAllocatedCost: 0,
      totalNetProfit: Number(new Decimal(0).minus(totalSharedCostDec).toFixed(2)),
      overallProfitMarginPct: 0,
      isProfitable: false,
      consignmentsCount: 0,
      invoicedCount: 0,
      currency,
      items: [],
      allocatedAt: new Date().toISOString(),
    };
  }

  // 1. Calculate the total metric base (Total Chargeable Weight or Total LDM)
  let totalMetricDec = new Decimal(0);
  let totalRevenueDec = new Decimal(0);
  let invoicedCount = 0;

  for (const c of consignments) {
    const metricVal = mode === 'chargeable_weight'
      ? Math.max(0, c.chargeableWeightKg || 0)
      : Math.max(0, c.ldmMeters || 0);
    totalMetricDec = totalMetricDec.plus(new Decimal(metricVal));
    totalRevenueDec = totalRevenueDec.plus(new Decimal(c.freightPrice || 0));
    if (c.invoiceId || c.invoiceNumber) {
      invoicedCount++;
    }
  }

  // Fallback if all metric values are 0
  const equalRatioDec = new Decimal(1).dividedBy(new Decimal(consignments.length));

  // 2. Compute individual allocations
  let runningAllocatedDec = new Decimal(0);
  const items: ConsignmentAllocationItem[] = [];

  for (let i = 0; i < consignments.length; i++) {
    const c = consignments[i];
    const metricVal = mode === 'chargeable_weight'
      ? Math.max(0, c.chargeableWeightKg || 0)
      : Math.max(0, c.ldmMeters || 0);

    const shareRatioDec = totalMetricDec.greaterThan(0)
      ? new Decimal(metricVal).dividedBy(totalMetricDec)
      : equalRatioDec;

    let allocatedDec = totalSharedCostDec.times(shareRatioDec);

    // Reconcile rounding difference on the last item so that sum of items exactly equals totalSharedCostDec
    if (i === consignments.length - 1) {
      const remainingDec = totalSharedCostDec.minus(runningAllocatedDec);
      allocatedDec = remainingDec;
    } else {
      allocatedDec = new Decimal(allocatedDec.toFixed(2));
      runningAllocatedDec = runningAllocatedDec.plus(allocatedDec);
    }

    const revenueDec = new Decimal(c.freightPrice || 0);
    const netMarginDec = revenueDec.minus(allocatedDec);
    const marginPct = revenueDec.greaterThan(0)
      ? Number(netMarginDec.dividedBy(revenueDec).times(100).toFixed(2))
      : 0;

    items.push({
      consignmentId: c.id,
      consignmentReference: c.consignmentReference,
      clientId: c.clientId,
      clientName: c.clientName,
      cargoDescription: c.cargoDescription,
      revenue: Number(revenueDec.toFixed(2)),
      chargeableWeightKg: c.chargeableWeightKg,
      ldmMeters: c.ldmMeters,
      shareRatioPct: Number(shareRatioDec.times(100).toFixed(2)),
      allocatedCost: Number(allocatedDec.toFixed(2)),
      netMargin: Number(netMarginDec.toFixed(2)),
      profitMarginPct: marginPct,
      isProfitable: netMarginDec.greaterThanOrEqualTo(0),
      invoiceId: c.invoiceId || null,
      invoiceNumber: c.invoiceNumber || null,
      invoicedAt: c.invoicedAt || null,
      isInvoiced: Boolean(c.invoiceId || c.invoiceNumber),
      currency: c.currency || currency,
    });
  }

  // 3. Consolidated trip P&L
  const totalNetProfitDec = totalRevenueDec.minus(totalSharedCostDec);
  const overallMarginPct = totalRevenueDec.greaterThan(0)
    ? Number(totalNetProfitDec.dividedBy(totalRevenueDec).times(100).toFixed(2))
    : 0;

  return {
    tripId,
    allocationMode: mode,
    operatingCosts: costs,
    totalRevenue: Number(totalRevenueDec.toFixed(2)),
    totalAllocatedCost: Number(totalSharedCostDec.toFixed(2)),
    totalNetProfit: Number(totalNetProfitDec.toFixed(2)),
    overallProfitMarginPct: overallMarginPct,
    isProfitable: totalNetProfitDec.greaterThanOrEqualTo(0),
    consignmentsCount: consignments.length,
    invoicedCount,
    currency,
    items,
    allocatedAt: new Date().toISOString(),
  };
}

