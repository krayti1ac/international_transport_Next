import Decimal from 'decimal.js';
type DecimalInstance = InstanceType<typeof Decimal>;

import type {
  CpkAnomaly,
  CpkBreakdown,
  CorridorPnlAnalyticsResult,
  CorridorPnlMetrics,
  CorridorTripPnlDetail,
  CurrencyRateMatrix,
} from '../types/corridor-pnl.types';
import type { InternationalCorridor, TripOrder, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawPnlTripOrder extends Partial<TripOrder> {
  id: number;
  road_distance_km?: number;
  ferry_distance_km?: number;
  currency?: string;
  weight?: number;
  cargo_weight?: number;
  trucks?: { id: number; plate_number: string; model?: string; fuel_consumption_rate?: number } | null;
  drivers?: { id: number; name: string; phone?: string } | null;
  trailers?: { id: number; plate_number: string } | null;
}

export interface RawPnlMaintenanceExpense {
  id: number;
  truck_id: number;
  trip_order_id?: number | null;
  cost: number;
  type: string;
  liters?: number;
  created_at: string;
}

export const DEFAULT_CURRENCY_RATES: CurrencyRateMatrix = {
  MAD: 1.0,
  EUR: 10.85,
  MRU: 0.25,
  XOF: 0.0165,
};

export const DEFAULT_FUEL_PRICE_MAD = new Decimal(12.5); // 12.50 MAD / L
export const DEFAULT_TRUCK_CONSUMPTION_RATE = new Decimal(36.0); // 36.0 L / 100km
export const DEFAULT_MAINTENANCE_RATE_PER_KM = new Decimal(1.4); // 1.40 MAD / km
export const DEFAULT_CARGO_TONS = new Decimal(24.0); // 24 tons standard reefer load

export function convertToMad(
  amount: number | string | DecimalInstance,
  currency: string = 'MAD',
  rates: CurrencyRateMatrix = DEFAULT_CURRENCY_RATES
): DecimalInstance {
  const decAmount = new Decimal(amount || 0);
  const curUpper = (currency || 'MAD').toUpperCase();

  switch (curUpper) {
    case 'EUR':
      return decAmount.times(new Decimal(rates.EUR));
    case 'MRU':
      return decAmount.times(new Decimal(rates.MRU));
    case 'XOF':
      return decAmount.times(new Decimal(rates.XOF));
    case 'MAD':
    default:
      return decAmount;
  }
}

export function resolveCorridor(trip: RawPnlTripOrder): InternationalCorridor {
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
    routeLower.includes('espana') ||
    routeLower.includes('france')
  ) {
    return 'european_maritime';
  }
  return 'african_overland';
}

interface MetricAccumulator {
  corridor: InternationalCorridor | 'all';
  totalTrips: number;
  totalRevenue: DecimalInstance;
  totalOperatingCosts: DecimalInstance;
  netProfit: DecimalInstance;
  directTripCosts: DecimalInstance; // For gross margin calculation
  totalKm: DecimalInstance;
  totalRoadKm: DecimalInstance;
  totalFerryKm: DecimalInstance;
  totalCargoTons: DecimalInstance;
  totalTonKm: DecimalInstance;
  fuelCost: DecimalInstance;
  maintenanceCost: DecimalInstance;
  ferryCost: DecimalInstance;
  customsCost: DecimalInstance;
  allowanceCost: DecimalInstance;
  otherCost: DecimalInstance;
}

function initAccumulator(corridor: InternationalCorridor | 'all'): MetricAccumulator {
  return {
    corridor,
    totalTrips: 0,
    totalRevenue: new Decimal(0),
    totalOperatingCosts: new Decimal(0),
    netProfit: new Decimal(0),
    directTripCosts: new Decimal(0),
    totalKm: new Decimal(0),
    totalRoadKm: new Decimal(0),
    totalFerryKm: new Decimal(0),
    totalCargoTons: new Decimal(0),
    totalTonKm: new Decimal(0),
    fuelCost: new Decimal(0),
    maintenanceCost: new Decimal(0),
    ferryCost: new Decimal(0),
    customsCost: new Decimal(0),
    allowanceCost: new Decimal(0),
    otherCost: new Decimal(0),
  };
}

export function computeCorridorPnl(
  trips: RawPnlTripOrder[],
  maintenanceExpenses: RawPnlMaintenanceExpense[] = [],
  truckCatalog: Truck[] = [],
  customRates: Partial<CurrencyRateMatrix> = {}
): CorridorPnlAnalyticsResult {
  const rates: CurrencyRateMatrix = { ...DEFAULT_CURRENCY_RATES, ...customRates };

  const truckRateMap = new Map<number, DecimalInstance>();
  truckCatalog.forEach((tr) => {
    truckRateMap.set(
      tr.id,
      tr.fuel_consumption_rate
        ? new Decimal(tr.fuel_consumption_rate)
        : DEFAULT_TRUCK_CONSUMPTION_RATE
    );
  });

  const euroAcc = initAccumulator('european_maritime');
  const afrAcc = initAccumulator('african_overland');
  const tripPnlDetails: CorridorTripPnlDetail[] = [];

  for (const trip of trips) {
    const corridor = resolveCorridor(trip);
    const isEuro = corridor === 'european_maritime';

    // 1. Revenue with Currency Normalization
    const rawRev = trip.price_export || trip.price_import
      ? new Decimal(trip.price_export || 0).plus(new Decimal(trip.price_import || 0))
      : new Decimal(trip.price || 0);

    const tripRevenueMad = convertToMad(rawRev, trip.currency || 'MAD', rates);

    // 2. Distances & Tonnage
    const roadKmDec = trip.road_distance_km !== undefined && trip.road_distance_km !== null
      ? new Decimal(trip.road_distance_km)
      : new Decimal(isEuro ? 1850 : 2800);
    const ferryKmDec = trip.ferry_distance_km !== undefined && trip.ferry_distance_km !== null
      ? new Decimal(trip.ferry_distance_km)
      : new Decimal(isEuro ? 220 : 0);
    const totalKmDec = roadKmDec.plus(ferryKmDec);

    const tonsDec = trip.weight
      ? new Decimal(trip.weight).dividedBy(1000)
      : (trip.cargo_weight ? new Decimal(trip.cargo_weight) : DEFAULT_CARGO_TONS);

    const tonKmDec = tonsDec.times(roadKmDec);

    // 3. Fuel Cost
    const truckRate = trip.truck_id && truckRateMap.has(trip.truck_id)
      ? truckRateMap.get(trip.truck_id)!
      : (trip.trucks?.fuel_consumption_rate
          ? new Decimal(trip.trucks.fuel_consumption_rate)
          : DEFAULT_TRUCK_CONSUMPTION_RATE);

    const fuelLitersDec = totalKmDec.isZero()
      ? new Decimal(0)
      : roadKmDec.dividedBy(100).times(truckRate);
    const fuelCostMad = fuelLitersDec.times(DEFAULT_FUEL_PRICE_MAD);

    // 4. Maintenance Cost
    // Find maintenance records mapped to this specific trip order or allocate wear
    const tripMaintenance = maintenanceExpenses.filter(
      (m) => m.trip_order_id === trip.id && !['fuel', 'carburant', 'gasoil'].includes(m.type)
    );
    const actualMaintCost = tripMaintenance.reduce(
      (sum, m) => sum.plus(new Decimal(m.cost)),
      new Decimal(0)
    );
    const maintenanceCostMad = actualMaintCost.greaterThan(0)
      ? actualMaintCost
      : (totalKmDec.isZero() ? new Decimal(0) : roadKmDec.times(DEFAULT_MAINTENANCE_RATE_PER_KM));

    // 5. Ferry / Maritime / Transit Costs
    let ferryCostMad = new Decimal(0);
    let customsCostMad = new Decimal(0);
    let allowanceCostMad = new Decimal(0);
    let otherCostMad = new Decimal(0);

    if (!totalKmDec.isZero()) {
      if (isEuro) {
        const ferryTicket = new Decimal(trip.ferry_cost || 4500);
        const triptik = new Decimal(trip.triptik_cost || 500);
        const transitAlmeria = new Decimal(trip.transit_almeria_cost || 1200);
        const marsaMaroc = new Decimal(trip.marsa_maroc_cost || 800);
        ferryCostMad = ferryTicket.plus(triptik).plus(transitAlmeria).plus(marsaMaroc);
        customsCostMad = new Decimal(600); // Port charges & customs stamp
        allowanceCostMad = new Decimal(3500); // European route driver allowance
        otherCostMad = new Decimal(600); // European highway tolls
      } else {
        // African Overland
        const riverFerryRosso = new Decimal(trip.ferry_cost || 3200);
        ferryCostMad = riverFerryRosso;
        customsCostMad = new Decimal(2500); // Guerguerat customs clearance & transit bond
        allowanceCostMad = new Decimal(6500); // Long-haul African overland driver mission allowance
        otherCostMad = new Decimal(1800); // ECOWAS Carte Brune & international frontier permit
      }
    }

    const totalCostMad = fuelCostMad
      .plus(maintenanceCostMad)
      .plus(ferryCostMad)
      .plus(customsCostMad)
      .plus(allowanceCostMad)
      .plus(otherCostMad);

    const netProfitMad = tripRevenueMad.minus(totalCostMad);
    const directTripCosts = fuelCostMad.plus(ferryCostMad).plus(customsCostMad);

    const netMarginPercent = tripRevenueMad.greaterThan(0)
      ? netProfitMad.dividedBy(tripRevenueMad).times(100)
      : new Decimal(0);

    const tripCpkMad = totalKmDec.greaterThan(0)
      ? totalCostMad.dividedBy(totalKmDec)
      : new Decimal(0);

    const tripRpkMad = totalKmDec.greaterThan(0)
      ? tripRevenueMad.dividedBy(totalKmDec)
      : new Decimal(0);

    // Accumulate into target corridor
    const targetAcc = isEuro ? euroAcc : afrAcc;
    targetAcc.totalTrips += 1;
    targetAcc.totalRevenue = targetAcc.totalRevenue.plus(tripRevenueMad);
    targetAcc.totalOperatingCosts = targetAcc.totalOperatingCosts.plus(totalCostMad);
    targetAcc.netProfit = targetAcc.netProfit.plus(netProfitMad);
    targetAcc.directTripCosts = targetAcc.directTripCosts.plus(directTripCosts);
    targetAcc.totalKm = targetAcc.totalKm.plus(totalKmDec);
    targetAcc.totalRoadKm = targetAcc.totalRoadKm.plus(roadKmDec);
    targetAcc.totalFerryKm = targetAcc.totalFerryKm.plus(ferryKmDec);
    targetAcc.totalCargoTons = targetAcc.totalCargoTons.plus(tonsDec);
    targetAcc.totalTonKm = targetAcc.totalTonKm.plus(tonKmDec);

    targetAcc.fuelCost = targetAcc.fuelCost.plus(fuelCostMad);
    targetAcc.maintenanceCost = targetAcc.maintenanceCost.plus(maintenanceCostMad);
    targetAcc.ferryCost = targetAcc.ferryCost.plus(ferryCostMad);
    targetAcc.customsCost = targetAcc.customsCost.plus(customsCostMad);
    targetAcc.allowanceCost = targetAcc.allowanceCost.plus(allowanceCostMad);
    targetAcc.otherCost = targetAcc.otherCost.plus(otherCostMad);

    // Check if this is the flagship Trip #272
    const isBenchmarkTrip = trip.id === 272 || (trip.cmr_number && trip.cmr_number.includes('CMR-BK-2026-0042'));

    tripPnlDetails.push({
      id: trip.id,
      cmrNumber: trip.cmr_number || `CMR-2026-${String(trip.id).padStart(4, '0')}`,
      departureDate: trip.departure_date || new Date().toISOString().split('T')[0],
      corridor,
      route: trip.route || (isEuro ? 'Tanger Med ➔ Algeciras' : 'Agadir ➔ Dakar'),
      truckPlate: trip.trucks?.plate_number || `TRK-${trip.truck_id || 'UNK'}`,
      driverName: trip.drivers?.name || 'كابتن معتمد',
      cargoWeightTons: parseFloat(tonsDec.toFixed(2)),
      roadDistanceKm: parseFloat(roadKmDec.toFixed(2)),
      ferryDistanceKm: parseFloat(ferryKmDec.toFixed(2)),
      totalDistanceKm: parseFloat(totalKmDec.toFixed(2)),
      tonKm: parseFloat(tonKmDec.toFixed(2)),
      revenueMad: parseFloat(tripRevenueMad.toFixed(2)),
      totalCostMad: parseFloat(totalCostMad.toFixed(2)),
      netProfitMad: parseFloat(netProfitMad.toFixed(2)),
      netMarginPercent: parseFloat(netMarginPercent.toFixed(2)),
      cpkMad: parseFloat(tripCpkMad.toFixed(2)),
      rpkMad: parseFloat(tripRpkMad.toFixed(2)),
      costBreakdown: {
        fuelMad: parseFloat(fuelCostMad.toFixed(2)),
        maintenanceMad: parseFloat(maintenanceCostMad.toFixed(2)),
        ferryMad: parseFloat(ferryCostMad.toFixed(2)),
        customsMad: parseFloat(customsCostMad.toFixed(2)),
        allowancesMad: parseFloat(allowanceCostMad.toFixed(2)),
        otherMad: parseFloat(otherCostMad.toFixed(2)),
      },
      currency: trip.currency || 'MAD',
      isBenchmarkTrip: Boolean(isBenchmarkTrip),
    });
  }

  // Finalize Metrics for each corridor
  const euroMetrics = finalizeCorridorMetrics(euroAcc, 'الممر البحري الأوروبي', 'Corridor Maritime Européen', 'Corredor Marítimo Europeo');
  const afrMetrics = finalizeCorridorMetrics(afrAcc, 'الممر البري الإفريقي', 'Corridor Terrestre Africain', 'Corredor Terrestre Africano');

  // Overall Combined Metrics
  const combinedAcc = initAccumulator('all');
  combinedAcc.totalTrips = euroAcc.totalTrips + afrAcc.totalTrips;
  combinedAcc.totalRevenue = euroAcc.totalRevenue.plus(afrAcc.totalRevenue);
  combinedAcc.totalOperatingCosts = euroAcc.totalOperatingCosts.plus(afrAcc.totalOperatingCosts);
  combinedAcc.netProfit = euroAcc.netProfit.plus(afrAcc.netProfit);
  combinedAcc.directTripCosts = euroAcc.directTripCosts.plus(afrAcc.directTripCosts);
  combinedAcc.totalKm = euroAcc.totalKm.plus(afrAcc.totalKm);
  combinedAcc.totalRoadKm = euroAcc.totalRoadKm.plus(afrAcc.totalRoadKm);
  combinedAcc.totalFerryKm = euroAcc.totalFerryKm.plus(afrAcc.totalFerryKm);
  combinedAcc.totalCargoTons = euroAcc.totalCargoTons.plus(afrAcc.totalCargoTons);
  combinedAcc.totalTonKm = euroAcc.totalTonKm.plus(afrAcc.totalTonKm);
  combinedAcc.fuelCost = euroAcc.fuelCost.plus(afrAcc.fuelCost);
  combinedAcc.maintenanceCost = euroAcc.maintenanceCost.plus(afrAcc.maintenanceCost);
  combinedAcc.ferryCost = euroAcc.ferryCost.plus(afrAcc.ferryCost);
  combinedAcc.customsCost = euroAcc.customsCost.plus(afrAcc.customsCost);
  combinedAcc.allowanceCost = euroAcc.allowanceCost.plus(afrAcc.allowanceCost);
  combinedAcc.otherCost = euroAcc.otherCost.plus(afrAcc.otherCost);

  const overallMetrics = finalizeCorridorMetrics(combinedAcc, 'الأسطول الموحد (كافة الممرات)', 'Flotte Globale (Tous Corridors)', 'Flota Global (Todos los Corredores)');

  // 6. Detect CPK Variance Anomalies
  const anomalies: CpkAnomaly[] = [];

  tripPnlDetails.forEach((trip) => {
    const baselineMetrics = trip.corridor === 'european_maritime' ? euroMetrics : afrMetrics;
    const baselineCpk = baselineMetrics.costPerKmMad;

    if (baselineCpk > 0) {
      const tripCpkDec = new Decimal(trip.cpkMad);
      const baselineCpkDec = new Decimal(baselineCpk);
      const variancePercentDec = tripCpkDec.minus(baselineCpkDec).dividedBy(baselineCpkDec).times(100);
      const varianceVal = parseFloat(variancePercentDec.toFixed(2));

      if (varianceVal > 15) {
        // Find dominant cost driver
        const cb = trip.costBreakdown;
        let dominantDriver: CpkAnomaly['primaryCostDriver'] = 'fuel';
        let dominantVal = cb.fuelMad;

        if (cb.maintenanceMad > dominantVal) {
          dominantDriver = 'maintenance';
          dominantVal = cb.maintenanceMad;
        }
        if (cb.customsMad > dominantVal) {
          dominantDriver = 'customs';
          dominantVal = cb.customsMad;
        }
        if (cb.ferryMad > dominantVal) {
          dominantDriver = 'ferry';
          dominantVal = cb.ferryMad;
        }
        if (cb.allowancesMad > dominantVal) {
          dominantDriver = 'allowances';
          dominantVal = cb.allowancesMad;
        }

        const driverLabels = {
          fuel: { ar: 'استهلاك المحروقات', fr: 'Consommation carburant', es: 'Consumo de combustible' },
          maintenance: { ar: 'تكاليف الصيانة والقطع', fr: 'Maintenance et pièces', es: 'Mantenimiento y piezas' },
          customs: { ar: 'رسوم المعابر والجمارك', fr: 'Frais de passage et douane', es: 'Tasas de paso y aduanas' },
          ferry: { ar: 'تذاكر العبّارات النهرية/البحرية', fr: 'Billets de ferry / transit', es: 'Billetes de ferry / tránsito' },
          allowances: { ar: 'بدلات إقامة ومهمة السائق', fr: 'Indemnités de mission chauffeur', es: 'Dietas de misión del conductor' },
          other: { ar: 'مصاريف تشغيلية أخرى', fr: 'Autres frais opérationnels', es: 'Otros gastos operativos' },
        };

        anomalies.push({
          tripId: trip.id,
          cmrNumber: trip.cmrNumber,
          truckPlate: trip.truckPlate,
          driverName: trip.driverName,
          corridor: trip.corridor,
          tripCpkMad: trip.cpkMad,
          baselineCpkMad: baselineCpk,
          variancePercent: varianceVal,
          primaryCostDriver: dominantDriver,
          primaryCostDriverLabelAr: driverLabels[dominantDriver].ar,
          primaryCostDriverLabelFr: driverLabels[dominantDriver].fr,
          primaryCostDriverLabelEs: driverLabels[dominantDriver].es,
          severity: varianceVal > 30 ? 'critical' : 'warning',
        });
      }
    }
  });

  const benchmarkTrip272 = tripPnlDetails.find((t) => t.isBenchmarkTrip);

  return {
    overall: overallMetrics,
    africanOverland: afrMetrics,
    europeanMaritime: euroMetrics,
    anomalies: anomalies.sort((a, b) => b.variancePercent - a.variancePercent),
    trips: tripPnlDetails.sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()),
    currencyRates: rates,
    benchmarkTrip272,
  };
}

function finalizeCorridorMetrics(
  acc: MetricAccumulator,
  nameAr: string,
  nameFr: string,
  nameEs: string
): CorridorPnlMetrics {
  const grossMarginDec = acc.totalRevenue.greaterThan(0)
    ? acc.totalRevenue.minus(acc.directTripCosts).dividedBy(acc.totalRevenue).times(100)
    : new Decimal(0);

  const netMarginDec = acc.totalRevenue.greaterThan(0)
    ? acc.netProfit.dividedBy(acc.totalRevenue).times(100)
    : new Decimal(0);

  const rpkDec = acc.totalKm.greaterThan(0)
    ? acc.totalRevenue.dividedBy(acc.totalKm)
    : new Decimal(0);

  const cpkDec = acc.totalKm.greaterThan(0)
    ? acc.totalOperatingCosts.dividedBy(acc.totalKm)
    : new Decimal(0);

  const ppkDec = acc.totalKm.greaterThan(0)
    ? acc.netProfit.dividedBy(acc.totalKm)
    : new Decimal(0);

  const cpkBreakdown: CpkBreakdown = {
    fuelCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.fuelCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    maintenanceCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.maintenanceCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    ferryTransitCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.ferryCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    customsCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.customsCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    driverAllowanceCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.allowanceCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    otherCpk: acc.totalKm.greaterThan(0) ? parseFloat(acc.otherCost.dividedBy(acc.totalKm).toFixed(2)) : 0,
    totalCpk: parseFloat(cpkDec.toFixed(2)),
  };

  const costPerTonKmDec = acc.totalTonKm.greaterThan(0)
    ? acc.totalOperatingCosts.dividedBy(acc.totalTonKm)
    : new Decimal(0);

  const revPerTonKmDec = acc.totalTonKm.greaterThan(0)
    ? acc.totalRevenue.dividedBy(acc.totalTonKm)
    : new Decimal(0);

  return {
    corridor: acc.corridor,
    corridorNameAr: nameAr,
    corridorNameFr: nameFr,
    corridorNameEs: nameEs,
    totalTrips: acc.totalTrips,
    totalRevenueMad: parseFloat(acc.totalRevenue.toFixed(2)),
    totalOperatingCostsMad: parseFloat(acc.totalOperatingCosts.toFixed(2)),
    netProfitMad: parseFloat(acc.netProfit.toFixed(2)),
    grossMarginPercent: parseFloat(grossMarginDec.toFixed(2)),
    netMarginPercent: parseFloat(netMarginDec.toFixed(2)),
    totalKm: parseFloat(acc.totalKm.toFixed(2)),
    totalRoadKm: parseFloat(acc.totalRoadKm.toFixed(2)),
    totalFerryKm: parseFloat(acc.totalFerryKm.toFixed(2)),
    revenuePerKmMad: parseFloat(rpkDec.toFixed(2)),
    costPerKmMad: parseFloat(cpkDec.toFixed(2)),
    netProfitPerKmMad: parseFloat(ppkDec.toFixed(2)),
    cpkBreakdown,
    totalCargoTons: parseFloat(acc.totalCargoTons.toFixed(2)),
    totalTonKm: parseFloat(acc.totalTonKm.toFixed(2)),
    costPerTonKmMad: parseFloat(costPerTonKmDec.toFixed(2)),
    revenuePerTonKmMad: parseFloat(revPerTonKmDec.toFixed(2)),
  };
}
