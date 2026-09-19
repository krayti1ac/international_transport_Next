import Decimal from 'decimal.js';
import type { TripOrder, Advance, TruckMaintenance, FinePenalty, FerryExpense } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface PortFeesBreakdown {
  ferry: number;
  triptik: number;
  transitAlmeria: number;
  marsaMaroc: number;
  total: number;
}

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
  portFeesBreakdown: PortFeesBreakdown;
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
  advances?: Advance[];
  fuelRecords?: TruckMaintenance[];
  fines?: FinePenalty[];
  ferries?: FerryExpense[];
  driverName?: string;
  truckPlate?: string;
  distanceKm?: number;
  fuelLiters?: number;
}): TripFinancialSummary {
  const {
    trip,
    advances = [],
    fuelRecords = [],
    fines = [],
    ferries = [],
    driverName,
    truckPlate,
    distanceKm,
    fuelLiters,
  } = params;

  // 1. حساب إيراد الرحلة (ذهاب + عودة) بدقة Decimal.js
  const priceExportDec = new Decimal(trip.price_export || 0);
  const priceImportDec = new Decimal(trip.price_import || 0);
  const roundTripPrice = priceExportDec.plus(priceImportDec);
  const revenueDec = roundTripPrice.greaterThan(0) ? roundTripPrice : new Decimal(trip.price || 0);

  // 2. حساب السلف ومصروفات السائق المرتبطة بالرحلة
  const tripAdvancesDec = (advances || [])
    .filter((a) => {
      if (trip.cmr_number && a.cmr_number === trip.cmr_number) return true;
      if (trip.cmr_export_number && a.cmr_number === trip.cmr_export_number) return true;
      if (trip.driver_id && a.driver_id === trip.driver_id) return true;
      return false;
    })
    .reduce((sum, a) => sum.plus(new Decimal(a.amount || 0)), new Decimal(0));

  // 3. حساب مصاريف الوقود (سجلات الصيانة أو تكلفة الوقود المقدرة بالرحلة)
  const fuelCostRecordsDec = (fuelRecords || [])
    .filter((f) => {
      if (trip.truck_id && f.truck_id && f.truck_id !== trip.truck_id) return false;
      const type = ((f as unknown as { expense_type?: string; type?: string }).expense_type || f.type || '').toLowerCase();
      return !type || type === 'fuel' || type === 'carburant' || type === 'gasoil';
    })
    .reduce((sum, f) => sum.plus(new Decimal(f.amount || 0)), new Decimal(0));

  const fuelCostDec = fuelCostRecordsDec.greaterThan(0)
    ? fuelCostRecordsDec
    : new Decimal((trip as unknown as { fuel_cost?: number }).fuel_cost || 0);

  // 4. مصاريف العبّارة والترانزيت البحري والموانئ القياسية الأربعة
  // باخرة (4,500) + تريبتيك (500) + ترانزيت ألميريا (1,200) + مرسى المغرب (800) = 7,000 درهم
  const ferryPortCostDec = new Decimal(
    trip.ferry_cost !== undefined && trip.ferry_cost !== null ? trip.ferry_cost : 4500
  );
  const triptikCostDec = new Decimal(
    trip.triptik_cost !== undefined && trip.triptik_cost !== null ? trip.triptik_cost : 500
  );
  const transitAlmeriaCostDec = new Decimal(
    trip.transit_almeria_cost !== undefined && trip.transit_almeria_cost !== null ? trip.transit_almeria_cost : 1200
  );
  const marsaMarocCostDec = new Decimal(
    trip.marsa_maroc_cost !== undefined && trip.marsa_maroc_cost !== null ? trip.marsa_maroc_cost : 800
  );

  const portFeesFromTrip = ferryPortCostDec
    .plus(triptikCostDec)
    .plus(transitAlmeriaCostDec)
    .plus(marsaMarocCostDec);

  const ferryExpensesDec = (ferries || [])
    .filter((fe) => fe.trip_order_id === trip.id)
    .reduce((sum, fe) => sum.plus(new Decimal(fe.amount || 0)), new Decimal(0));

  const ferryCostDec = ferryExpensesDec.greaterThan(0) ? ferryExpensesDec : portFeesFromTrip;

  // 5. الغرامات والمخالفات
  const finesCostDec = (fines || [])
    .filter((fn) => fn.trip_order_id === trip.id)
    .reduce((sum, fn) => sum.plus(new Decimal(fn.amount || 0)), new Decimal(0));

  // 6. إجمالي المصروفات وصافي الربح وهامش الربحية
  const totalExpensesDec = tripAdvancesDec
    .plus(fuelCostDec)
    .plus(ferryCostDec)
    .plus(finesCostDec);

  const netProfitDec = revenueDec.minus(totalExpensesDec);
  const profitMarginDec = revenueDec.greaterThan(0)
    ? netProfitDec.dividedBy(revenueDec).times(100)
    : new Decimal(0);

  // 7. تحليل استهلاك الوقود (لتر لكل 100 كم)
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
      fuelStatus = 'high';
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
    portFeesBreakdown: {
      ferry: ferryPortCostDec.toNumber(),
      triptik: triptikCostDec.toNumber(),
      transitAlmeria: transitAlmeriaCostDec.toNumber(),
      marsaMaroc: marsaMarocCostDec.toNumber(),
      total: ferryCostDec.toNumber(),
    },
    totalExpenses: totalExpensesDec.toNumber(),
    netProfit: netProfitDec.toNumber(),
    profitMarginPercentage: profitMarginDec.toDecimalPlaces(1).toNumber(),
    fuelLiters,
    distanceKm,
    litersPer100Km,
    fuelStatus,
  };
}
