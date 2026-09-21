import Decimal from 'decimal.js';
type DecimalInstance = InstanceType<typeof Decimal>;

import type {
  CorridorAnalyticsResult,
  CorridorFinancialSummary,
  CorridorTripDetail,
  FuelEfficiencyStatus,
  TruckFuelAnomaly,
} from '../types/corridor.types';
import type { InternationalCorridor, TripOrder, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawTripOrderWithRelations extends TripOrder {
  road_distance_km?: number;
  ferry_distance_km?: number;
  currency?: string;
  trucks?: { id: number; plate_number: string; model?: string; fuel_consumption_rate?: number } | null;
  drivers?: { id: number; name: string; phone?: string } | null;
  trailers?: { id: number; plate_number: string } | null;
}

export interface RawFuelExpense {
  id: number;
  truck_id: number;
  cost: number;
  liters?: number;
  created_at: string;
}

const DEFAULT_FUEL_PRICE_MAD = new Decimal(12.5); // 12.50 MAD per liter
const DEFAULT_TRUCK_CONSUMPTION_RATE = new Decimal(36.0); // 36.0 L/100km
const ANOMALY_THRESHOLD_RATE = new Decimal(38.0); // > 38 L/100km flags anomaly
const EFFICIENT_THRESHOLD_RATE = new Decimal(32.0); // < 32 L/100km

export function classifyFuelEfficiency(rate: DecimalInstance): FuelEfficiencyStatus {
  if (rate.lessThan(EFFICIENT_THRESHOLD_RATE)) {
    return 'efficient';
  }
  if (rate.greaterThan(ANOMALY_THRESHOLD_RATE)) {
    return 'high_risk';
  }
  return 'normal';
}

function resolveCorridorType(trip: RawTripOrderWithRelations): InternationalCorridor {
  if (trip.corridor_type) {
    return trip.corridor_type;
  }
  const routeLower = (trip.route || '').toLowerCase();
  if (
    routeLower.includes('dakar') ||
    routeLower.includes('nouadhibou') ||
    routeLower.includes('nouakchott') ||
    routeLower.includes('guerguerat') ||
    routeLower.includes('rosso') ||
    routeLower.includes('senegal') ||
    routeLower.includes('mauritania')
  ) {
    return 'african_overland';
  }
  if (
    routeLower.includes('algeciras') ||
    routeLower.includes('almeria') ||
    routeLower.includes('motril') ||
    routeLower.includes('valencia') ||
    routeLower.includes('barcelona') ||
    routeLower.includes('perpignan') ||
    routeLower.includes('spain') ||
    routeLower.includes('france')
  ) {
    return 'european_maritime';
  }
  return 'african_overland'; // Default international corridor
}

export function computeCorridorAnalytics(
  trips: RawTripOrderWithRelations[],
  fuelExpenses: RawFuelExpense[] = [],
  trucksCatalog: Truck[] = []
): CorridorAnalyticsResult {
  const euroSummaryAcc = createInitialSummary('european_maritime');
  const afrSummaryAcc = createInitialSummary('african_overland');

  const tripDetails: CorridorTripDetail[] = [];
  const truckAggregates = new Map<
    number,
    {
      plate: string;
      model: string;
      driverName: string;
      targetRate: DecimalInstance;
      totalRoadKm: DecimalInstance;
      totalFuelLiters: DecimalInstance;
      tripsCount: number;
      corridor: InternationalCorridor;
    }
  >();

  const truckTargetRateMap = new Map<number, DecimalInstance>();
  trucksCatalog.forEach((tr) => {
    truckTargetRateMap.set(
      tr.id,
      tr.fuel_consumption_rate
        ? new Decimal(tr.fuel_consumption_rate)
        : DEFAULT_TRUCK_CONSUMPTION_RATE
    );
  });

  for (const trip of trips) {
    const corridor = resolveCorridorType(trip);
    const isEuro = corridor === 'european_maritime';

    // 1. Revenue
    const priceDec = new Decimal(trip.price || 0);
    const priceExportDec = new Decimal(trip.price_export || 0);
    const priceImportDec = new Decimal(trip.price_import || 0);
    const totalRevDec = priceExportDec.plus(priceImportDec).greaterThan(0)
      ? priceExportDec.plus(priceImportDec)
      : priceDec;

    // 2. Distances
    const roadDistDec = new Decimal(
      trip.road_distance_km || (isEuro ? 1850 : 2800)
    );
    const ferryDistDec = new Decimal(
      trip.ferry_distance_km || (isEuro ? 220 : 0)
    );
    const totalDistDec = roadDistDec.plus(ferryDistDec);

    // 3. Fuel Calculation
    const truckRate = trip.truck_id && truckTargetRateMap.has(trip.truck_id)
      ? truckTargetRateMap.get(trip.truck_id)!
      : (trip.trucks?.fuel_consumption_rate
          ? new Decimal(trip.trucks.fuel_consumption_rate)
          : DEFAULT_TRUCK_CONSUMPTION_RATE);

    const tripFuelLitersDec = roadDistDec
      .dividedBy(100)
      .times(truckRate);
    const tripFuelCostDec = tripFuelLitersDec.times(DEFAULT_FUEL_PRICE_MAD);

    // 4. Corridor-specific direct expenses
    let directExpensesDec = new Decimal(0);
    let ferryOrTransitDec = new Decimal(0);
    let customsDec = new Decimal(0);
    let driverAllowanceDec = new Decimal(0);
    let otherExpDec = new Decimal(0);

    if (isEuro) {
      const ferryCost = new Decimal(trip.ferry_cost || 4500);
      const triptikCost = new Decimal(trip.triptik_cost || 500);
      const transitAlmeria = new Decimal(trip.transit_almeria_cost || 1200);
      const marsaMaroc = new Decimal(trip.marsa_maroc_cost || 800);
      ferryOrTransitDec = ferryCost.plus(triptikCost).plus(transitAlmeria).plus(marsaMaroc);
      driverAllowanceDec = new Decimal(3500); // Standard European trip allowance
      customsDec = new Decimal(0);
      otherExpDec = new Decimal(600); // Tolls / Port taxes

      directExpensesDec = tripFuelCostDec
        .plus(ferryOrTransitDec)
        .plus(driverAllowanceDec)
        .plus(otherExpDec);
    } else {
      // African Overland
      customsDec = new Decimal(2500); // Guerguerat customs & clearance
      const riverFerryCost = new Decimal(trip.ferry_cost || 3200); // Rosso river ferry
      const carteBruneInsurance = new Decimal(1800); // ECOWAS Carte Brune & cross-border insurance
      ferryOrTransitDec = riverFerryCost;
      driverAllowanceDec = new Decimal(6500); // International African mission per diem
      otherExpDec = carteBruneInsurance;

      directExpensesDec = tripFuelCostDec
        .plus(customsDec)
        .plus(ferryOrTransitDec)
        .plus(driverAllowanceDec)
        .plus(otherExpDec);
    }

    const netProfitDec = totalRevDec.minus(directExpensesDec);
    const marginPercentDec = totalRevDec.greaterThan(0)
      ? netProfitDec.dividedBy(totalRevDec).times(100)
      : new Decimal(0);

    // Accumulate to Corridor Summaries
    const targetSummary = isEuro ? euroSummaryAcc : afrSummaryAcc;
    targetSummary.totalTrips += 1;
    targetSummary.totalRevenue = targetSummary.totalRevenue.plus(totalRevDec);
    targetSummary.totalDirectExpenses = targetSummary.totalDirectExpenses.plus(directExpensesDec);
    targetSummary.netProfit = targetSummary.netProfit.plus(netProfitDec);
    targetSummary.totalRoadDistanceKm = targetSummary.totalRoadDistanceKm.plus(roadDistDec);
    targetSummary.totalFerryDistanceKm = targetSummary.totalFerryDistanceKm.plus(ferryDistDec);
    targetSummary.totalDistanceKm = targetSummary.totalDistanceKm.plus(totalDistDec);
    targetSummary.totalFuelLiters = targetSummary.totalFuelLiters.plus(tripFuelLitersDec);
    targetSummary.totalFuelCost = targetSummary.totalFuelCost.plus(tripFuelCostDec);
    targetSummary.ferryOrTransitCost = targetSummary.ferryOrTransitCost.plus(ferryOrTransitDec);
    targetSummary.customsCost = targetSummary.customsCost.plus(customsDec);
    targetSummary.driverAllowances = targetSummary.driverAllowances.plus(driverAllowanceDec);
    targetSummary.otherExpenses = targetSummary.otherExpenses.plus(otherExpDec);

    // Track detailed trip row
    tripDetails.push({
      id: trip.id,
      cmrNumber: trip.cmr_number || `CMR-2026-${String(trip.id).padStart(4, '0')}`,
      departureDate: trip.departure_date || new Date().toISOString().split('T')[0],
      corridor,
      route: trip.route || (isEuro ? 'Tanger Med ➔ Algeciras' : 'Agadir ➔ Dakar'),
      truckPlate: trip.trucks?.plate_number || `TRK-${trip.truck_id || 'UNK'}`,
      driverName: trip.drivers?.name || 'كابتن معتمد',
      revenue: parseFloat(totalRevDec.toFixed(2)),
      directExpenses: parseFloat(directExpensesDec.toFixed(2)),
      netProfit: parseFloat(netProfitDec.toFixed(2)),
      profitMarginPercent: parseFloat(marginPercentDec.toFixed(2)),
      roadDistanceKm: parseFloat(roadDistDec.toFixed(2)),
      fuelLiters: parseFloat(tripFuelLitersDec.toFixed(2)),
      fuelConsumptionRate: parseFloat(truckRate.toFixed(2)),
      currency: trip.currency || 'MAD',
      status: trip.status || 'completed',
    });

    // Track truck aggregate
    if (trip.truck_id) {
      const existing = truckAggregates.get(trip.truck_id) || {
        plate: trip.trucks?.plate_number || `TRK-${trip.truck_id}`,
        model: trip.trucks?.model || 'Volvo FH / Scania R',
        driverName: trip.drivers?.name || 'سائق دولي',
        targetRate: truckRate,
        totalRoadKm: new Decimal(0),
        totalFuelLiters: new Decimal(0),
        tripsCount: 0,
        corridor,
      };

      existing.totalRoadKm = existing.totalRoadKm.plus(roadDistDec);
      existing.totalFuelLiters = existing.totalFuelLiters.plus(tripFuelLitersDec);
      existing.tripsCount += 1;
      truckAggregates.set(trip.truck_id, existing);
    }
  }

  // Finalize summaries
  const euroFinal = finalizeSummary(euroSummaryAcc);
  const afrFinal = finalizeSummary(afrSummaryAcc);

  // Analyze fuel anomalies
  const fuelAnomalies: TruckFuelAnomaly[] = [];
  truckAggregates.forEach((agg, truckId) => {
    // Check if real fuel receipts exist for this truck
    const truckFuelRecs = fuelExpenses.filter((fe) => fe.truck_id === truckId);
    let effectiveLiters = agg.totalFuelLiters;
    if (truckFuelRecs.length > 0) {
      const recLitersTotal = truckFuelRecs.reduce((acc, curr) => {
        return acc.plus(curr.liters ? new Decimal(curr.liters) : new Decimal(curr.cost).dividedBy(DEFAULT_FUEL_PRICE_MAD));
      }, new Decimal(0));
      if (recLitersTotal.greaterThan(0)) {
        effectiveLiters = recLitersTotal;
      }
    }

    const actualRate = agg.totalRoadKm.greaterThan(0)
      ? effectiveLiters.dividedBy(agg.totalRoadKm).times(100)
      : agg.targetRate;

    const diff = actualRate.minus(agg.targetRate);
    const status = classifyFuelEfficiency(actualRate);

    fuelAnomalies.push({
      truckId,
      plateNumber: agg.plate,
      model: agg.model,
      driverName: agg.driverName,
      totalTrips: agg.tripsCount,
      totalRoadKm: parseFloat(agg.totalRoadKm.toFixed(2)),
      totalFuelLiters: parseFloat(effectiveLiters.toFixed(2)),
      actualConsumptionRate: parseFloat(actualRate.toFixed(2)),
      targetConsumptionRate: parseFloat(agg.targetRate.toFixed(2)),
      differenceL100km: parseFloat(diff.toFixed(2)),
      status,
      isAnomaly: actualRate.greaterThan(ANOMALY_THRESHOLD_RATE),
      corridor: agg.corridor,
    });
  });

  // Overall Global P&L
  const totalRevOverall = new Decimal(euroFinal.totalRevenue).plus(new Decimal(afrFinal.totalRevenue));
  const totalExpOverall = new Decimal(euroFinal.totalDirectExpenses).plus(new Decimal(afrFinal.totalDirectExpenses));
  const netProfitOverall = totalRevOverall.minus(totalExpOverall);
  const marginOverall = totalRevOverall.greaterThan(0)
    ? netProfitOverall.dividedBy(totalRevOverall).times(100)
    : new Decimal(0);
  const totalDistOverall = new Decimal(euroFinal.totalDistanceKm).plus(new Decimal(afrFinal.totalDistanceKm));
  const totalFuelLitersOverall = new Decimal(euroFinal.totalFuelLiters).plus(new Decimal(afrFinal.totalFuelLiters));
  const avgConsumptionOverall = euroFinal.totalRoadDistanceKm + afrFinal.totalRoadDistanceKm > 0
    ? totalFuelLitersOverall.dividedBy(new Decimal(euroFinal.totalRoadDistanceKm + afrFinal.totalRoadDistanceKm)).times(100)
    : DEFAULT_TRUCK_CONSUMPTION_RATE;

  return {
    overall: {
      totalRevenue: parseFloat(totalRevOverall.toFixed(2)),
      totalExpenses: parseFloat(totalExpOverall.toFixed(2)),
      netProfit: parseFloat(netProfitOverall.toFixed(2)),
      profitMarginPercent: parseFloat(marginOverall.toFixed(2)),
      totalTrips: euroFinal.totalTrips + afrFinal.totalTrips,
      totalDistanceKm: parseFloat(totalDistOverall.toFixed(2)),
      totalFuelLiters: parseFloat(totalFuelLitersOverall.toFixed(2)),
      averageConsumptionL100km: parseFloat(avgConsumptionOverall.toFixed(2)),
      currency: 'MAD',
    },
    europeanMaritime: euroFinal,
    africanOverland: afrFinal,
    fuelAnomalies: fuelAnomalies.sort((a, b) => b.actualConsumptionRate - a.actualConsumptionRate),
    trips: tripDetails.sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()),
  };
}

interface SummaryAccumulator {
  corridor: InternationalCorridor;
  totalTrips: number;
  totalRevenue: DecimalInstance;
  totalDirectExpenses: DecimalInstance;
  netProfit: DecimalInstance;
  totalRoadDistanceKm: DecimalInstance;
  totalFerryDistanceKm: DecimalInstance;
  totalDistanceKm: DecimalInstance;
  totalFuelLiters: DecimalInstance;
  totalFuelCost: DecimalInstance;
  ferryOrTransitCost: DecimalInstance;
  customsCost: DecimalInstance;
  driverAllowances: DecimalInstance;
  otherExpenses: DecimalInstance;
}

function createInitialSummary(corridor: InternationalCorridor): SummaryAccumulator {
  return {
    corridor,
    totalTrips: 0,
    totalRevenue: new Decimal(0),
    totalDirectExpenses: new Decimal(0),
    netProfit: new Decimal(0),
    totalRoadDistanceKm: new Decimal(0),
    totalFerryDistanceKm: new Decimal(0),
    totalDistanceKm: new Decimal(0),
    totalFuelLiters: new Decimal(0),
    totalFuelCost: new Decimal(0),
    ferryOrTransitCost: new Decimal(0),
    customsCost: new Decimal(0),
    driverAllowances: new Decimal(0),
    otherExpenses: new Decimal(0),
  };
}

function finalizeSummary(acc: SummaryAccumulator): CorridorFinancialSummary {
  const marginDec = acc.totalRevenue.greaterThan(0)
    ? acc.netProfit.dividedBy(acc.totalRevenue).times(100)
    : new Decimal(0);

  const avgConsDec = acc.totalRoadDistanceKm.greaterThan(0)
    ? acc.totalFuelLiters.dividedBy(acc.totalRoadDistanceKm).times(100)
    : new Decimal(0);

  const revPerKm = acc.totalDistanceKm.greaterThan(0)
    ? acc.totalRevenue.dividedBy(acc.totalDistanceKm)
    : new Decimal(0);

  const expPerKm = acc.totalDistanceKm.greaterThan(0)
    ? acc.totalDirectExpenses.dividedBy(acc.totalDistanceKm)
    : new Decimal(0);

  const netPerKm = acc.totalDistanceKm.greaterThan(0)
    ? acc.netProfit.dividedBy(acc.totalDistanceKm)
    : new Decimal(0);

  return {
    corridor: acc.corridor,
    totalTrips: acc.totalTrips,
    totalRevenue: parseFloat(acc.totalRevenue.toFixed(2)),
    totalDirectExpenses: parseFloat(acc.totalDirectExpenses.toFixed(2)),
    netProfit: parseFloat(acc.netProfit.toFixed(2)),
    profitMarginPercent: parseFloat(marginDec.toFixed(2)),
    totalRoadDistanceKm: parseFloat(acc.totalRoadDistanceKm.toFixed(2)),
    totalFerryDistanceKm: parseFloat(acc.totalFerryDistanceKm.toFixed(2)),
    totalDistanceKm: parseFloat(acc.totalDistanceKm.toFixed(2)),
    totalFuelLiters: parseFloat(acc.totalFuelLiters.toFixed(2)),
    totalFuelCost: parseFloat(acc.totalFuelCost.toFixed(2)),
    averageConsumptionL100km: parseFloat(avgConsDec.toFixed(2)),
    revenuePerKm: parseFloat(revPerKm.toFixed(2)),
    expensesPerKm: parseFloat(expPerKm.toFixed(2)),
    netProfitPerKm: parseFloat(netPerKm.toFixed(2)),
    ferryOrTransitCost: parseFloat(acc.ferryOrTransitCost.toFixed(2)),
    customsCost: parseFloat(acc.customsCost.toFixed(2)),
    driverAllowances: parseFloat(acc.driverAllowances.toFixed(2)),
    otherExpenses: parseFloat(acc.otherExpenses.toFixed(2)),
  };
}
