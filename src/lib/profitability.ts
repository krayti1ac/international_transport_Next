import type { TripOrder, Advance, TruckMaintenance, FinePenalty, FerryExpense } from '@/types/database';

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

  const priceExport = trip.price_export || 0;
  const priceImport = trip.price_import || 0;
  const revenue = (priceExport + priceImport > 0) ? (priceExport + priceImport) : (trip.price || 0);

  const tripAdvances = advances
    .filter((a) => a.cmr_number === trip.cmr_number || a.driver_id === trip.driver_id)
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  const fuelCost = fuelRecords
    .filter((f) => f.truck_id === trip.truck_id && f.type === 'fuel')
    .reduce((sum, f) => sum + (f.amount || 0), 0);

  const ferryCost = ferries
    .filter((fe) => fe.trip_order_id === trip.id)
    .reduce((sum, fe) => sum + (fe.amount || 0), 0);

  const finesCost = fines
    .filter((fn) => fn.trip_order_id === trip.id)
    .reduce((sum, fn) => sum + (fn.amount || 0), 0);

  const totalExpenses = tripAdvances + fuelCost + ferryCost + finesCost;
  const netProfit = revenue - totalExpenses;
  const profitMarginPercentage = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  let litersPer100Km: number | undefined;
  let fuelStatus: 'normal' | 'high' | 'efficient' | 'no_data' = 'no_data';

  if (distanceKm && distanceKm > 0 && fuelLiters && fuelLiters > 0) {
    litersPer100Km = (fuelLiters / distanceKm) * 100;
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
    revenue,
    priceExport,
    priceImport,
    fuelCost,
    advancesCost: tripAdvances,
    ferryCost,
    finesCost,
    totalExpenses,
    netProfit,
    profitMarginPercentage: parseFloat(profitMarginPercentage.toFixed(1)),
    fuelLiters,
    distanceKm,
    litersPer100Km: litersPer100Km ? parseFloat(litersPer100Km.toFixed(1)) : undefined,
    fuelStatus,
  };
}
