import Decimal from 'decimal.js';
import type { TripOrder, Advance, TruckMaintenance, FinePenalty, FerryExpense } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface TripFinancialSummary {
  tripId: number;
  route: string;
  routeExport?: string;
  routeImport?: string;
  cmrNumber?: string;
  departureDate: string;
  driverName?: string;
  truckPlate?: string;
  revenue: number;
  priceExport?: number;
  priceImport?: number;
  fuelCost: number;
  advancesCost: number;
  ferryCost: number;
  finesCost: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercentage: number;
  fuelLiters?: number;
  distanceKm?: number;
  litersPer100Km?: number;
  fuelStatus: 'normal' | 'high' | 'efficient' | 'no_data';
}

export function calculateTripFinancials(params: {
  trip: TripOrder;
  advances: Advance[];
  fuelRecords: TruckMaintenance[];
  fines: FinePenalty[];
  ferries: FerryExpense[];
  driverName?: string;
  truckPlate?: string;
  distanceKm?: number;
  fuelLiters?: number;
}): TripFinancialSummary {
  const { trip, advances, fuelRecords, fines, ferries, driverName, truckPlate, distanceKm, fuelLiters } = params;

  const priceExportDec = new Decimal(trip.price_export || 0);
  const priceImportDec = new Decimal(trip.price_import || 0);
  const roundTripPrice = priceExportDec.plus(priceImportDec);
  const revenueDec = roundTripPrice.greaterThan(0) ? roundTripPrice : new Decimal(trip.price || 0);

  // 1. حساب السلف ومصروفات السائق المرتبطة بالرحلة (دقة عالية عبر Decimal.js)
  const tripAdvancesDec = advances
    .filter((a) => a.cmr_number === trip.cmr_number || a.driver_id === trip.driver_id)
    .reduce((sum, a) => sum.plus(new Decimal(a.amount || 0)), new Decimal(0));

  // 2. حساب مصاريف الوقود
  const fuelCostDec = fuelRecords
    .filter((f) => f.truck_id === trip.truck_id && f.type === 'fuel')
    .reduce((sum, f) => sum.plus(new Decimal(f.amount || 0)), new Decimal(0));

  // 3. مصاريف العبّارة والترانزيت البحري
  const ferryCostDec = ferries
    .filter((fe) => fe.trip_order_id === trip.id)
    .reduce((sum, fe) => sum.plus(new Decimal(fe.amount || 0)), new Decimal(0));

  // 4. الغرامات والمخالفات
  const finesCostDec = fines
    .filter((fn) => fn.trip_order_id === trip.id)
    .reduce((sum, fn) => sum.plus(new Decimal(fn.amount || 0)), new Decimal(0));

  // إجمالي المصروفات وصافي الربح
  const totalExpensesDec = tripAdvancesDec.plus(fuelCostDec).plus(ferryCostDec).plus(finesCostDec);
  const netProfitDec = revenueDec.minus(totalExpensesDec);
  const profitMarginPercentage = revenueDec.greaterThan(0)
    ? netProfitDec.dividedBy(revenueDec).times(100).toNumber()
    : 0;

  // 5. تحليل استهلاك الوقود (لتر لكل 100 كم)
  let litersPer100Km: number | undefined;
  let fuelStatus: 'normal' | 'high' | 'efficient' | 'no_data' = 'no_data';

  if (distanceKm && distanceKm > 0 && fuelLiters && fuelLiters > 0) {
    const consumption = new Decimal(fuelLiters).dividedBy(new Decimal(distanceKm)).times(100);
    litersPer100Km = consumption.toDecimalPlaces(1).toNumber();
    if (litersPer100Km < 30) {
      fuelStatus = 'efficient';
    } else if (litersPer100Km <= 35) {
      fuelStatus = 'normal';
    } else {
      fuelStatus = 'high'; // تنبيه استهلاك زائد
    }
  }

  return {
    tripId: trip.id,
    route: trip.route,
    routeExport: trip.route_export,
    routeImport: trip.route_import,
    cmrNumber: trip.cmr_export_number || trip.cmr_number,
    departureDate: trip.departure_date,
    driverName,
    truckPlate,
    revenue: revenueDec.toNumber(),
    priceExport: priceExportDec.toNumber(),
    priceImport: priceImportDec.toNumber(),
    fuelCost: fuelCostDec.toNumber(),
    advancesCost: tripAdvancesDec.toNumber(),
    ferryCost: ferryCostDec.toNumber(),
    finesCost: finesCostDec.toNumber(),
    totalExpenses: totalExpensesDec.toNumber(),
    netProfit: netProfitDec.toNumber(),
    profitMarginPercentage: new Decimal(profitMarginPercentage).toDecimalPlaces(1).toNumber(),
    fuelLiters,
    distanceKm,
    litersPer100Km,
    fuelStatus,
  };
}
