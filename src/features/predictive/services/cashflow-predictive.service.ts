import Decimal from 'decimal.js';
import type { Invoice, Client, TreasuryTransaction } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';
import type {
  ClientPaymentVelocity,
  CashFlowHorizonProjection,
  ClientReliabilityRating,
} from '../types/predictive-engine.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const EUR_TO_MAD_RATE = new Decimal(10.85);

export interface PaymentAllocationRecord {
  id?: number;
  payment_id: number;
  invoice_id: number;
  allocated_amount: number;
  created_at?: string;
}

/**
 * Computes the Payment Velocity Index (PVI) for each client based on paid invoices.
 */
export function computeClientPaymentVelocities(
  clients: Client[],
  invoices: Invoice[],
  allocations: PaymentAllocationRecord[] = []
): ClientPaymentVelocity[] {
  const invoicesByClient = new Map<string, Invoice[]>();
  invoices.forEach((inv) => {
    const cId = String(inv.client_id || '');
    if (!cId) return;
    const list = invoicesByClient.get(cId) || [];
    list.push(inv);
    invoicesByClient.set(cId, list);
  });

  const allocationDatesByInvoice = new Map<number, string>();
  allocations.forEach((alloc) => {
    if (alloc.created_at) {
      allocationDatesByInvoice.set(alloc.invoice_id, alloc.created_at);
    }
  });

  const results: ClientPaymentVelocity[] = [];

  for (const client of clients) {
    const cId = String(client.id);
    const clientInvoices = invoicesByClient.get(cId) || [];

    const paidInvoices = clientInvoices.filter(
      (inv) => inv.status === 'paid' || inv.status === 'settled'
    );
    const unpaidInvoices = clientInvoices.filter(
      (inv) => inv.status !== 'paid' && inv.status !== 'settled' && inv.status !== 'cancelled'
    );

    let totalDelayDaysDec = new Decimal(0);
    let countedInvoices = 0;

    for (const inv of paidInvoices) {
      if (!inv.due_date) continue;

      const dueDate = new Date(inv.due_date);
      // Settlement date from allocation or fallback to created_at or due_date
      const settlementDateStr =
        allocationDatesByInvoice.get(inv.id) || inv.created_at || inv.due_date;
      const settlementDate = new Date(settlementDateStr);

      const diffDays = Math.round(
        (settlementDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      totalDelayDaysDec = totalDelayDaysDec.plus(new Decimal(diffDays));
      countedInvoices++;
    }

    let avgDelayDec = new Decimal(0);
    if (countedInvoices > 0) {
      avgDelayDec = totalDelayDaysDec.dividedBy(new Decimal(countedInvoices));
    }

    const averageDelayDays = Math.round(avgDelayDec.toNumber());
    let reliabilityRating: ClientReliabilityRating = 'A';

    if (averageDelayDays > 15) {
      reliabilityRating = 'C';
    } else if (averageDelayDays > 0) {
      reliabilityRating = 'B';
    } else {
      reliabilityRating = 'A';
    }

    // Sum outstanding amounts
    let outstandingMadDec = new Decimal(0);
    let outstandingEurDec = new Decimal(0);

    for (const inv of unpaidInvoices) {
      const totalDec = new Decimal(inv.total_amount || 0);
      const paidDec = new Decimal(inv.paid_amount || 0);
      const dueDec = totalDec.minus(paidDec);

      if (dueDec.greaterThan(0)) {
        if ((inv.currency || 'MAD').toUpperCase() === 'EUR') {
          outstandingEurDec = outstandingEurDec.plus(dueDec);
          outstandingMadDec = outstandingMadDec.plus(dueDec.times(EUR_TO_MAD_RATE));
        } else {
          outstandingMadDec = outstandingMadDec.plus(dueDec);
        }
      }
    }

    results.push({
      clientId: client.id,
      clientName: client.name,
      totalPaidInvoices: paidInvoices.length,
      averageDelayDays,
      reliabilityRating,
      unpaidInvoicesCount: unpaidInvoices.length,
      totalOutstandingMad: outstandingMadDec.toFixed(2),
      totalOutstandingEur: outstandingEurDec.toFixed(2),
    });
  }

  // Sort by highest outstanding amount
  return results.sort((a, b) =>
    new Decimal(b.totalOutstandingMad).minus(new Decimal(a.totalOutstandingMad)).toNumber()
  );
}

/**
 * Computes 30 / 60 / 90 Days Cash Flow Projections strictly using Decimal.js.
 */
export function computeCashFlowProjections(
  currentTransactions: TreasuryTransaction[],
  invoices: Invoice[],
  clientVelocities: ClientPaymentVelocity[],
  pipelineTrips: RawTripOrderWithRelations[] = []
): CashFlowHorizonProjection[] {
  // 1. Current Liquid Cash in MAD
  let liquidCashDec = new Decimal(0);
  const DEPOSIT_TYPES = ['capital_injection', 'trip_revenue', 'payment', 'deposit'];
  const WITHDRAWAL_TYPES = ['expense', 'salary', 'withdrawal'];

  for (const tx of currentTransactions) {
    const amountDec = new Decimal(tx.amount || 0);
    const curr = (tx.currency || 'MAD').toUpperCase();
    const madAmount = curr === 'EUR' ? amountDec.times(EUR_TO_MAD_RATE) : amountDec;

    if (DEPOSIT_TYPES.includes(tx.type)) {
      liquidCashDec = liquidCashDec.plus(madAmount);
    } else if (WITHDRAWAL_TYPES.includes(tx.type)) {
      liquidCashDec = liquidCashDec.minus(madAmount);
    }
  }

  const velocityMap = new Map(clientVelocities.map((v) => [String(v.clientId), v]));

  // Horizons: 30, 60, 90 days
  const horizons: Array<30 | 60 | 90> = [30, 60, 90];
  const now = new Date();

  return horizons.map((days) => {
    let projectedInboundDec = new Decimal(0);
    let inboundCount = 0;

    // A. Inbound Cash (Unpaid Invoices adjusted by client PVI)
    for (const inv of invoices) {
      if (inv.status === 'paid' || inv.status === 'settled' || inv.status === 'cancelled') {
        continue;
      }

      const totalDec = new Decimal(inv.total_amount || 0);
      const paidDec = new Decimal(inv.paid_amount || 0);
      const dueDec = totalDec.minus(paidDec);
      if (dueDec.lessThanOrEqualTo(0)) continue;

      const cVelocity = velocityMap.get(String(inv.client_id));
      const pviOffset = cVelocity ? cVelocity.averageDelayDays : 0;

      // Base date: due_date or created_at + 30 days
      const baseDate = inv.due_date
        ? new Date(inv.due_date)
        : new Date(new Date(inv.created_at || now).getTime() + 30 * 86400000);

      // Adjusted expected date = baseDate + PVI days
      const adjustedDate = new Date(baseDate.getTime() + pviOffset * 86400000);
      const daysFromNow = Math.round(
        (adjustedDate.getTime() - now.getTime()) / 86400000
      );

      // Falls within this horizon window
      if (daysFromNow <= days) {
        const curr = (inv.currency || 'MAD').toUpperCase();
        const madValue = curr === 'EUR' ? dueDec.times(EUR_TO_MAD_RATE) : dueDec;
        projectedInboundDec = projectedInboundDec.plus(madValue);
        inboundCount++;
      }
    }

    // B. Mandatory Outflows (Fuel, Ferries, Customs, Driver Per-diem)
    let mandatoryFuelDec = new Decimal(0);
    let mandatoryFerryAndCustomsDec = new Decimal(0);
    let driverAllowancesDec = new Decimal(0);

    // Estimate based on pipeline trips or active monthly fleet operational volume
    // Pipeline trips that fall within horizon days
    for (const trip of pipelineTrips) {
      const depDate = trip.departure_date ? new Date(trip.departure_date) : now;
      const tripDaysFromNow = Math.round(
        (depDate.getTime() - now.getTime()) / 86400000
      );

      if (tripDaysFromNow <= days) {
        const isEuro = trip.corridor_type === 'european_maritime';
        const roadDistDec = new Decimal(trip.road_distance_km || (isEuro ? 1850 : 2800));

        // Fuel: roadKm * (36 / 100) * 12.50 MAD
        const fuelLiters = roadDistDec.times(36).dividedBy(100);
        const fuelCost = fuelLiters.times(12.5);
        mandatoryFuelDec = mandatoryFuelDec.plus(fuelCost);

        // Ferry & Port / Customs
        if (isEuro) {
          const ferryCost = new Decimal(trip.ferry_cost || 4500)
            .plus(new Decimal(trip.triptik_cost || 500))
            .plus(new Decimal(trip.transit_almeria_cost || 1200))
            .plus(new Decimal(trip.marsa_maroc_cost || 800));
          mandatoryFerryAndCustomsDec = mandatoryFerryAndCustomsDec.plus(ferryCost);
          driverAllowancesDec = driverAllowancesDec.plus(new Decimal(3500));
        } else {
          // African route: Guerguerat (2,500) + Rosso (3,200) + Carte Brune (1,800)
          mandatoryFerryAndCustomsDec = mandatoryFerryAndCustomsDec.plus(new Decimal(7500));
          driverAllowancesDec = driverAllowancesDec.plus(new Decimal(6500));
        }
      }
    }

    // If pipeline trips is empty, provide minimum operational baseline (pro-rated by days)
    if (pipelineTrips.length === 0) {
      const proRate = new Decimal(days).dividedBy(30);
      mandatoryFuelDec = new Decimal(35000).times(proRate);
      mandatoryFerryAndCustomsDec = new Decimal(18000).times(proRate);
      driverAllowancesDec = new Decimal(22000).times(proRate);
    }

    const totalOutboundDec = mandatoryFuelDec
      .plus(mandatoryFerryAndCustomsDec)
      .plus(driverAllowancesDec);

    const projectedNetCashDec = liquidCashDec
      .plus(projectedInboundDec)
      .minus(totalOutboundDec);

    let liquidityStatus: 'surplus' | 'balanced' | 'deficit_warning' = 'balanced';
    if (projectedNetCashDec.lessThan(0)) {
      liquidityStatus = 'deficit_warning';
    } else if (projectedNetCashDec.greaterThan(200000)) {
      liquidityStatus = 'surplus';
    }

    return {
      horizonDays: days,
      labelAr: `خلال ${days} يوماً قادمة`,
      labelFr: `Sous ${days} jours`,
      labelEs: `En los próximos ${days} días`,
      currentLiquidCashMad: liquidCashDec.toFixed(2),
      projectedInboundMad: projectedInboundDec.toFixed(2),
      projectedOutboundMad: totalOutboundDec.toFixed(2),
      projectedNetCashMad: projectedNetCashDec.toFixed(2),
      liquidityStatus,
      breakdown: {
        inboundInvoicesCount: inboundCount,
        mandatoryFuelMad: mandatoryFuelDec.toFixed(2),
        mandatoryFerryAndCustomsMad: mandatoryFerryAndCustomsDec.toFixed(2),
        driverAllowancesAndSalariesMad: driverAllowancesDec.toFixed(2),
      },
    };
  });
}

