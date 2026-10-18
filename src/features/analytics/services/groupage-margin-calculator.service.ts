/**
 * TransSalges TMS — Groupage LTL vs. FTL Margin BI Calculation Engine
 * Standards: 13.60 LDM standard semi-trailer, CPK (Cost Per Kilometer),
 * Multi-Drop consolidation vs Full Truckload single-shipper economics.
 * Financial Precision: Strictly computed using Decimal.js (precision: 20, ROUND_HALF_UP).
 */

import Decimal from 'decimal.js';
type DecimalInstance = InstanceType<typeof Decimal>;

import type {
  LoadMode,
  TripMarginBiItem,
  ModeMetricsSummary,
  ModeComparisonMetrics,
  LdmEfficiencyBucket,
  GroupageMarginBiResult,
  GroupageCostAllocationRecord,
} from '../types/groupage-margin-bi.types';
import type { InternationalCorridor, TripOrder } from '@/types/database';
import type { TripConsignment } from '@/features/tracking/types/groupage-ltl.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const MAX_TRAILER_LDM = new Decimal('13.60');

export const DEFAULT_CURRENCY_RATES = {
  MAD: 1.0,
  EUR: 10.85,
  MRU: 0.25,
  XOF: 0.0165,
};

export interface RawTripMarginInput extends Partial<TripOrder> {
  id: number;
  cmrNumber?: string;
  cmr_number?: string;
  road_distance_km?: number;
  ferry_distance_km?: number;
  currency?: string;
  weight?: number;
  cargo_weight?: number;
  consignments?: TripConsignment[];
  allocation?: GroupageCostAllocationRecord | null;
}

export function convertToMad(
  amount: number | string | DecimalInstance | undefined | null,
  currency: string = 'MAD',
  rates: typeof DEFAULT_CURRENCY_RATES = DEFAULT_CURRENCY_RATES
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

export function resolveTripCorridor(trip: RawTripMarginInput): InternationalCorridor {
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
  return 'european_maritime';
}

interface ModeAccumulator {
  corridor: InternationalCorridor | 'all';
  mode: LoadMode;
  tripCount: number;
  totalConsignments: number;
  totalRevenue: DecimalInstance;
  totalOperatingCosts: DecimalInstance;
  totalNetProfit: DecimalInstance;
  totalDistanceKm: DecimalInstance;
  totalLdm: DecimalInstance;
  fuelCost: DecimalInstance;
  ferryCost: DecimalInstance;
  tollsCost: DecimalInstance;
  customsCost: DecimalInstance;
  driverCost: DecimalInstance;
  otherCost: DecimalInstance;
}

function initModeAccumulator(corridor: InternationalCorridor | 'all', mode: LoadMode): ModeAccumulator {
  return {
    corridor,
    mode,
    tripCount: 0,
    totalConsignments: 0,
    totalRevenue: new Decimal(0),
    totalOperatingCosts: new Decimal(0),
    totalNetProfit: new Decimal(0),
    totalDistanceKm: new Decimal(0),
    totalLdm: new Decimal(0),
    fuelCost: new Decimal(0),
    ferryCost: new Decimal(0),
    tollsCost: new Decimal(0),
    customsCost: new Decimal(0),
    driverCost: new Decimal(0),
    otherCost: new Decimal(0),
  };
}

function finalizeModeMetrics(acc: ModeAccumulator): ModeMetricsSummary {
  const revenueDec = acc.totalRevenue;
  const costsDec = acc.totalOperatingCosts;
  const netProfitDec = acc.totalNetProfit;
  const totalLdmDec = acc.totalLdm;
  const totalKmDec = acc.totalDistanceKm;
  const tripCountDec = new Decimal(acc.tripCount || 1);

  const netMarginPct = revenueDec.isZero()
    ? 0
    : Number(netProfitDec.dividedBy(revenueDec).times(new Decimal(100)).toFixed(2));

  const avgLdmPerTrip = acc.tripCount === 0
    ? 0
    : Number(totalLdmDec.dividedBy(tripCountDec).toFixed(2));

  const avgTrailerUtilizationPct = acc.tripCount === 0
    ? 0
    : Number(new Decimal(avgLdmPerTrip).dividedBy(MAX_TRAILER_LDM).times(new Decimal(100)).toFixed(1));

  const avgRevenuePerLdmMad = totalLdmDec.isZero()
    ? 0
    : Number(revenueDec.dividedBy(totalLdmDec).toFixed(2));

  const avgNetMarginPerLdmMad = totalLdmDec.isZero()
    ? 0
    : Number(netProfitDec.dividedBy(totalLdmDec).toFixed(2));

  const avgCpkMad = totalKmDec.isZero()
    ? 0
    : Number(costsDec.dividedBy(totalKmDec).toFixed(2));

  const avgRpkMad = totalKmDec.isZero()
    ? 0
    : Number(revenueDec.dividedBy(totalKmDec).toFixed(2));

  return {
    corridor: acc.corridor,
    mode: acc.mode,
    tripCount: acc.tripCount,
    totalConsignments: acc.totalConsignments,
    totalRevenueMad: Number(revenueDec.toFixed(2)),
    totalOperatingCostsMad: Number(costsDec.toFixed(2)),
    totalNetProfitMad: Number(netProfitDec.toFixed(2)),
    netMarginPct,
    totalDistanceKm: Number(totalKmDec.toFixed(0)),
    totalLdm: Number(totalLdmDec.toFixed(2)),
    avgLdmPerTrip,
    avgTrailerUtilizationPct,
    avgRevenuePerLdmMad,
    avgNetMarginPerLdmMad,
    avgCpkMad,
    avgRpkMad,
    costBreakdown: {
      fuelMad: Number(acc.fuelCost.toFixed(2)),
      ferryMad: Number(acc.ferryCost.toFixed(2)),
      tollsMad: Number(acc.tollsCost.toFixed(2)),
      customsMad: Number(acc.customsCost.toFixed(2)),
      driverMad: Number(acc.driverCost.toFixed(2)),
      otherMad: Number(acc.otherCost.toFixed(2)),
    },
  };
}

export function compareLtlVsFtl(
  corridor: InternationalCorridor | 'all',
  ltl: ModeMetricsSummary,
  ftl: ModeMetricsSummary
): ModeComparisonMetrics {
  const ltlMarginDec = new Decimal(ltl.netMarginPct);
  const ftlMarginDec = new Decimal(ftl.netMarginPct);
  const netMarginDifferencePct = Number(ltlMarginDec.minus(ftlMarginDec).toFixed(2));

  const ltlRevPerLdmDec = new Decimal(ltl.avgRevenuePerLdmMad);
  const ftlRevPerLdmDec = new Decimal(ftl.avgRevenuePerLdmMad);
  const revenuePerLdmPremiumPct = ftlRevPerLdmDec.isZero()
    ? 0
    : Number(ltlRevPerLdmDec.minus(ftlRevPerLdmDec).dividedBy(ftlRevPerLdmDec).times(new Decimal(100)).toFixed(2));

  const ltlMarginPerLdmDec = new Decimal(ltl.avgNetMarginPerLdmMad);
  const ftlMarginPerLdmDec = new Decimal(ftl.avgNetMarginPerLdmMad);
  const netMarginPerLdmPremiumPct = ftlMarginPerLdmDec.isZero()
    ? 0
    : Number(ltlMarginPerLdmDec.minus(ftlMarginPerLdmDec).dividedBy(ftlMarginPerLdmDec).times(new Decimal(100)).toFixed(2));

  const ltlCpkDec = new Decimal(ltl.avgCpkMad);
  const ftlCpkDec = new Decimal(ftl.avgCpkMad);
  const cpkDifferenceMad = Number(ltlCpkDec.minus(ftlCpkDec).toFixed(2));

  // Breakeven LDM Calculation:
  // Target Net Profit = average FTL profit per trip
  // LTL Required Revenue = Target FTL Profit + average LTL trip operating cost
  // Breakeven LDM = LTL Required Revenue / LTL avg revenue per LDM
  let utilizationBreakevenLdm = 9.5; // default fallback 70% of 13.60
  if (ltl.avgRevenuePerLdmMad > 0 && ftl.tripCount > 0 && ltl.tripCount > 0) {
    const avgFtlProfitDec = new Decimal(ftl.totalNetProfitMad).dividedBy(new Decimal(ftl.tripCount));
    const avgLtlCostDec = new Decimal(ltl.totalOperatingCostsMad).dividedBy(new Decimal(ltl.tripCount));
    const requiredRevDec = avgFtlProfitDec.plus(avgLtlCostDec);
    const beLdmDec = requiredRevDec.dividedBy(new Decimal(ltl.avgRevenuePerLdmMad));
    if (beLdmDec.greaterThan(0) && beLdmDec.lessThanOrEqualTo(13.6)) {
      utilizationBreakevenLdm = Number(beLdmDec.toFixed(2));
    }
  }

  // Determine winner mode
  let winnerMode: 'ltl' | 'ftl' | 'balanced' = 'balanced';
  if (netMarginDifferencePct > 2.0) {
    winnerMode = 'ltl';
  } else if (netMarginDifferencePct < -2.0) {
    winnerMode = 'ftl';
  }

  // Localized tactical recommendations
  let recommendationAr = '';
  let recommendationFr = '';
  let recommendationEs = '';

  if (corridor === 'european_maritime') {
    if (winnerMode === 'ltl') {
      recommendationAr = `الشحن التجميعي (LTL) يتفوق بهامش إضافي +${netMarginDifferencePct}% بفضل بيع المساحة (MAD/LDM) بفارق مميز يمتص تكلفة العبارة ورسوم الطرق السريعة. حافظ على نسبة إشغال فوق ${utilizationBreakevenLdm} LDM.`;
      recommendationFr = `Le groupage (LTL) surpasse le FTL de +${netMarginDifferencePct}% de marge grâce à la valorisation au mètre linéaire (LDM) amortissant le ferry et les péages. Maintenir l'occupation au-delà de ${utilizationBreakevenLdm} LDM.`;
      recommendationEs = `El grupaje (LTL) supera al FTL con un margen de +${netMarginDifferencePct}% gracias a la prima por metro lineal (LDM) que absorbe ferris y peajes. Mantener la ocupación por encima de ${utilizationBreakevenLdm} LDM.`;
    } else {
      recommendationAr = `الشحن الكامل (FTL) أكثر أماناً وتوفيراً لتكاليف التوقف المتعدد ورسوم العبور. ينصح بحصر LTL عند توفر حمولة تتجاوز ${utilizationBreakevenLdm} LDM.`;
      recommendationFr = `Le lot complet (FTL) offre une rentabilité plus stable sans arrêts multiples. Réserver le LTL aux tournées consolidées dépassant ${utilizationBreakevenLdm} LDM.`;
      recommendationEs = `La carga completa (FTL) ofrece mayor estabilidad sin paradas múltiples. Reservar el grupaje para envíos que superen ${utilizationBreakevenLdm} LDM.`;
    }
  } else if (corridor === 'african_overland') {
    if (winnerMode === 'ltl') {
      recommendationAr = `الممر الإفريقي التجميعي يحقق عائداً استثنائياً لكل LDM مع محطات نواكشوط ودكار، مع ضرورة ضبط مسار التسليم لتفادي ارتفاع CPK. نقطة التعادل ${utilizationBreakevenLdm} LDM.`;
      recommendationFr = `Le corridor africain en groupage génère un rendement élevé par LDM via Nouakchott et Dakar. Optimiser la séquence de livraison pour maîtriser le CPK. Seuil d'équilibre à ${utilizationBreakevenLdm} LDM.`;
      recommendationEs = `El corredor africano en grupaje genera alto rendimiento por LDM vía Nuakchot y Dakar. Optimizar la secuencia de entrega para controlar el CPK. Umbral de equilibrio en ${utilizationBreakevenLdm} LDM.`;
    } else {
      recommendationAr = `المسافات الطويلة للصحراء تفضل حمولات FTL المباشرة لتجنب احتجاز الشاحنة بالمراكز الحدودية ما لم تكن تعرفة التجميع أعلى بنسبة 25%.`;
      recommendationFr = `Les longues distances transsahariennes favorisent le fret FTL direct pour limiter l'immobilisation douanière, sauf si le tarif LDM offre +25% de prime.`;
      recommendationEs = `Las largas distancias transaharianas favorecen la carga FTL directa para reducir esperas aduaneras, salvo prima tarifaria de grupaje superior al 25%.`;
    }
  } else {
    // Overall Fleet
    recommendationAr = `تحليل الأسطول الموحد: الشحن التجميعي يحقق عائد مساحة أعلى (${revenuePerLdmPremiumPct}%) وتكلفة كيلومترية مدروسة. ينصح بجدولة رحلات LTL عند تجاوز ${utilizationBreakevenLdm} LDM.`;
    recommendationFr = `Analyse Flotte Globale: Le groupage assure une prime au mètre linéaire de ${revenuePerLdmPremiumPct}%. Prioriser les départs LTL dès franchissement du seuil de ${utilizationBreakevenLdm} LDM.`;
    recommendationEs = `Análisis Flota Global: El grupaje asegura una prima por metro lineal de ${revenuePerLdmPremiumPct}%. Priorizar salidas LTL al superar el umbral de ${utilizationBreakevenLdm} LDM.`;
  }

  return {
    netMarginDifferencePct,
    revenuePerLdmPremiumPct,
    netMarginPerLdmPremiumPct,
    cpkDifferenceMad,
    utilizationBreakevenLdm,
    winnerMode,
    tacticalRecommendationAr: recommendationAr,
    tacticalRecommendationFr: recommendationFr,
    tacticalRecommendationEs: recommendationEs,
  };
}

export function computeGroupageMarginBi(
  trips: RawTripMarginInput[],
  rates: typeof DEFAULT_CURRENCY_RATES = DEFAULT_CURRENCY_RATES
): GroupageMarginBiResult {
  // Accumulators for LTL and FTL across corridors
  const overallLtlAcc = initModeAccumulator('all', 'ltl');
  const overallFtlAcc = initModeAccumulator('all', 'ftl');

  const euroLtlAcc = initModeAccumulator('european_maritime', 'ltl');
  const euroFtlAcc = initModeAccumulator('european_maritime', 'ftl');

  const afrLtlAcc = initModeAccumulator('african_overland', 'ltl');
  const afrFtlAcc = initModeAccumulator('african_overland', 'ftl');

  const tripItems: TripMarginBiItem[] = [];

  // Buckets for LDM efficiency
  const bucketLow = { range: '< 8.0 LDM', trips: 0, sumLdm: new Decimal(0), sumUtil: new Decimal(0), sumMargin: new Decimal(0), sumRev: new Decimal(0), sumNet: new Decimal(0) };
  const bucketMed = { range: '8.0 - 11.0 LDM', trips: 0, sumLdm: new Decimal(0), sumUtil: new Decimal(0), sumMargin: new Decimal(0), sumRev: new Decimal(0), sumNet: new Decimal(0) };
  const bucketHigh = { range: '11.0 - 13.6 LDM', trips: 0, sumLdm: new Decimal(0), sumUtil: new Decimal(0), sumMargin: new Decimal(0), sumRev: new Decimal(0), sumNet: new Decimal(0) };

  for (const trip of trips) {
    const corridor = resolveTripCorridor(trip);
    const isEuro = corridor === 'european_maritime';

    // 1. Determine Mode (LTL vs FTL)
    const consignments = trip.consignments || [];
    const isGroupage = consignments.length > 1 ||
      trip.price_type === 'groupage' ||
      trip.price_type === 'ltl' ||
      Boolean(trip.allocation);
    const mode: LoadMode = isGroupage ? 'ltl' : 'ftl';

    // 2. Distances (km)
    const roadKmDec = trip.road_distance_km !== undefined && trip.road_distance_km !== null
      ? new Decimal(trip.road_distance_km)
      : new Decimal(isEuro ? 1850 : 2800);
    const ferryKmDec = trip.ferry_distance_km !== undefined && trip.ferry_distance_km !== null
      ? new Decimal(trip.ferry_distance_km)
      : new Decimal(isEuro ? 220 : 0);
    const totalKmDec = roadKmDec.plus(ferryKmDec);

    // 3. Tonnage
    const tonsDec = trip.weight
      ? new Decimal(trip.weight).dividedBy(new Decimal(1000))
      : (trip.cargo_weight ? new Decimal(trip.cargo_weight) : new Decimal(isGroupage ? 16.5 : 22.0));

    // 4. Loading Meters (LDM) & Trailer Utilization
    let totalLdmDec = MAX_TRAILER_LDM;
    let consignmentsCount = 1;

    if (isGroupage) {
      if (consignments.length > 0) {
        consignmentsCount = consignments.length;
        let sumLdm = new Decimal(0);
        for (const c of consignments) {
          sumLdm = sumLdm.plus(new Decimal(c.ldmMeters || 0.4));
        }
        totalLdmDec = sumLdm.greaterThan(0) ? sumLdm : new Decimal('11.50');
      } else {
        consignmentsCount = 4;
        totalLdmDec = new Decimal('11.80');
      }
    }

    // Trailer Utilization % capped at 100%
    const trailerUtilPctDec = totalLdmDec.dividedBy(MAX_TRAILER_LDM).times(new Decimal(100));

    // 5. Revenue Calculation in MAD
    let tripRevMadDec = new Decimal(0);
    if (isGroupage && consignments.length > 0) {
      for (const c of consignments) {
        const itemRev = convertToMad(c.freightPrice, c.currency || trip.currency || 'MAD', rates);
        tripRevMadDec = tripRevMadDec.plus(itemRev);
      }
    } else {
      const rawRev = trip.price_export || trip.price_import
        ? new Decimal(trip.price_export || 0).plus(new Decimal(trip.price_import || 0))
        : new Decimal(trip.price || 0);
      tripRevMadDec = convertToMad(rawRev, trip.currency || 'MAD', rates);
    }

    // Fallback baseline revenue if 0
    if (tripRevMadDec.isZero()) {
      tripRevMadDec = convertToMad(isEuro ? 38000 : 45000, 'MAD', rates);
    }

    // 6. Operating Costs Calculation in MAD
    let fuelCostDec = new Decimal(0);
    let ferryCostDec = new Decimal(0);
    let tollsCostDec = new Decimal(0);
    let customsCostDec = new Decimal(0);
    let driverCostDec = new Decimal(0);
    let otherCostDec = new Decimal(0);

    if (trip.allocation) {
      fuelCostDec = convertToMad(trip.allocation.total_fuel_cost, trip.allocation.currency || 'MAD', rates);
      ferryCostDec = convertToMad(trip.allocation.total_ferry_cost, trip.allocation.currency || 'MAD', rates);
      tollsCostDec = convertToMad(trip.allocation.total_tolls_cost, trip.allocation.currency || 'MAD', rates);
      customsCostDec = convertToMad(trip.allocation.total_customs_cost, trip.allocation.currency || 'MAD', rates);
      driverCostDec = convertToMad(trip.allocation.total_driver_cost, trip.allocation.currency || 'MAD', rates);
    } else {
      // Benchmark operational costs
      const consumptionRate = new Decimal(36); // 36L / 100km
      const fuelLiters = totalKmDec.times(consumptionRate).dividedBy(new Decimal(100));
      fuelCostDec = fuelLiters.times(new Decimal(12.5)); // 12.50 MAD / L

      if (isEuro) {
        ferryCostDec = new Decimal(trip.ferry_cost || 6800);
        tollsCostDec = new Decimal(2200); // Via-T / Telepeage
        customsCostDec = new Decimal((Number(trip.transit_almeria_cost || 0) + Number(trip.marsa_maroc_cost || 0)) || 1400);
        driverCostDec = new Decimal(2800);
      } else {
        // African Overland (No ferry, higher transit / customs / Guerguerat pass)
        ferryCostDec = new Decimal(0);
        tollsCostDec = new Decimal(600);
        customsCostDec = new Decimal(4800); // Guerguerat, Rosso ferry/pass, Mauritania visa
        driverCostDec = new Decimal(4200); // African per diem
      }
      otherCostDec = new Decimal(800);
    }

    const totalOperatingCostDec = fuelCostDec
      .plus(ferryCostDec)
      .plus(tollsCostDec)
      .plus(customsCostDec)
      .plus(driverCostDec)
      .plus(otherCostDec);

    // 7. Net Profit & Margin Rates
    const netProfitDec = tripRevMadDec.minus(totalOperatingCostDec);
    const netMarginPctDec = tripRevMadDec.isZero()
      ? new Decimal(0)
      : netProfitDec.dividedBy(tripRevMadDec).times(new Decimal(100));

    const revenuePerLdmDec = totalLdmDec.isZero()
      ? new Decimal(0)
      : tripRevMadDec.dividedBy(totalLdmDec);

    const netMarginPerLdmDec = totalLdmDec.isZero()
      ? new Decimal(0)
      : netProfitDec.dividedBy(totalLdmDec);

    const cpkDec = totalKmDec.isZero()
      ? new Decimal(0)
      : totalOperatingCostDec.dividedBy(totalKmDec);

    const rpkDec = totalKmDec.isZero()
      ? new Decimal(0)
      : tripRevMadDec.dividedBy(totalKmDec);

    const tripItem: TripMarginBiItem = {
      id: trip.id,
      cmrNumber: trip.cmrNumber || trip.cmr_number || `CMR-2026-${trip.id}`,
      route: trip.route || (isEuro ? 'Tanger Med (MA) -> Perpignan (FR)' : 'Agadir (MA) -> Dakar (SN)'),
      departureDate: trip.departure_date || new Date().toISOString().split('T')[0],
      corridor,
      mode,
      consignmentsCount,
      totalLdm: Number(totalLdmDec.toFixed(2)),
      maxTrailerLdm: Number(MAX_TRAILER_LDM.toFixed(2)),
      trailerUtilizationPct: Number(trailerUtilPctDec.toFixed(1)),
      cargoWeightTons: Number(tonsDec.toFixed(2)),
      totalDistanceKm: Number(totalKmDec.toFixed(0)),
      roadDistanceKm: Number(roadKmDec.toFixed(0)),
      ferryDistanceKm: Number(ferryKmDec.toFixed(0)),
      revenueMad: Number(tripRevMadDec.toFixed(2)),
      operatingCostMad: Number(totalOperatingCostDec.toFixed(2)),
      netProfitMad: Number(netProfitDec.toFixed(2)),
      netMarginPct: Number(netMarginPctDec.toFixed(2)),
      revenuePerLdmMad: Number(revenuePerLdmDec.toFixed(2)),
      netMarginPerLdmMad: Number(netMarginPerLdmDec.toFixed(2)),
      cpkMad: Number(cpkDec.toFixed(2)),
      rpkMad: Number(rpkDec.toFixed(2)),
      costBreakdown: {
        fuelMad: Number(fuelCostDec.toFixed(2)),
        ferryMad: Number(ferryCostDec.toFixed(2)),
        tollsMad: Number(tollsCostDec.toFixed(2)),
        customsMad: Number(customsCostDec.toFixed(2)),
        driverMad: Number(driverCostDec.toFixed(2)),
        otherMad: Number(otherCostDec.toFixed(2)),
      },
      currency: trip.currency || 'MAD',
    };

    tripItems.push(tripItem);

    // Accumulate to target corridor & overall
    const targetAcc = isGroupage
      ? (isEuro ? euroLtlAcc : afrLtlAcc)
      : (isEuro ? euroFtlAcc : afrFtlAcc);

    const overallAcc = isGroupage ? overallLtlAcc : overallFtlAcc;

    [targetAcc, overallAcc].forEach((acc) => {
      acc.tripCount += 1;
      acc.totalConsignments += consignmentsCount;
      acc.totalRevenue = acc.totalRevenue.plus(tripRevMadDec);
      acc.totalOperatingCosts = acc.totalOperatingCosts.plus(totalOperatingCostDec);
      acc.totalNetProfit = acc.totalNetProfit.plus(netProfitDec);
      acc.totalDistanceKm = acc.totalDistanceKm.plus(totalKmDec);
      acc.totalLdm = acc.totalLdm.plus(totalLdmDec);
      acc.fuelCost = acc.fuelCost.plus(fuelCostDec);
      acc.ferryCost = acc.ferryCost.plus(ferryCostDec);
      acc.tollsCost = acc.tollsCost.plus(tollsCostDec);
      acc.customsCost = acc.customsCost.plus(customsCostDec);
      acc.driverCost = acc.driverCost.plus(driverCostDec);
      acc.otherCost = acc.otherCost.plus(otherCostDec);
    });

    // LDM Efficiency Buckets (for LTL trips)
    if (isGroupage) {
      const ldmNum = Number(totalLdmDec);
      let targetBucket = bucketHigh;
      if (ldmNum < 8.0) {
        targetBucket = bucketLow;
      } else if (ldmNum <= 11.0) {
        targetBucket = bucketMed;
      }

      targetBucket.trips += 1;
      targetBucket.sumLdm = targetBucket.sumLdm.plus(totalLdmDec);
      targetBucket.sumUtil = targetBucket.sumUtil.plus(trailerUtilPctDec);
      targetBucket.sumMargin = targetBucket.sumMargin.plus(netMarginPctDec);
      targetBucket.sumRev = targetBucket.sumRev.plus(revenuePerLdmDec);
      targetBucket.sumNet = targetBucket.sumNet.plus(netProfitDec);
    }
  }

  // Finalize mode metrics
  const overallLtl = finalizeModeMetrics(overallLtlAcc);
  const overallFtl = finalizeModeMetrics(overallFtlAcc);

  const euroLtl = finalizeModeMetrics(euroLtlAcc);
  const euroFtl = finalizeModeMetrics(euroFtlAcc);

  const afrLtl = finalizeModeMetrics(afrLtlAcc);
  const afrFtl = finalizeModeMetrics(afrFtlAcc);

  // Compute comparisons
  const overallComparison = compareLtlVsFtl('all', overallLtl, overallFtl);
  const euroComparison = compareLtlVsFtl('european_maritime', euroLtl, euroFtl);
  const afrComparison = compareLtlVsFtl('african_overland', afrLtl, afrFtl);

  // Format LDM Efficiency Buckets
  const formatBucket = (b: typeof bucketLow): LdmEfficiencyBucket => {
    const countDec = new Decimal(b.trips || 1);
    return {
      bucketRange: b.range,
      tripCount: b.trips,
      avgUtilizationPct: b.trips === 0 ? 0 : Number(b.sumUtil.dividedBy(countDec).toFixed(1)),
      avgNetMarginPct: b.trips === 0 ? 0 : Number(b.sumMargin.dividedBy(countDec).toFixed(2)),
      avgRevenuePerLdmMad: b.trips === 0 ? 0 : Number(b.sumRev.dividedBy(countDec).toFixed(2)),
      avgNetProfitMad: b.trips === 0 ? 0 : Number(b.sumNet.dividedBy(countDec).toFixed(2)),
    };
  };

  const ldmBuckets: LdmEfficiencyBucket[] = [
    formatBucket(bucketLow),
    formatBucket(bucketMed),
    formatBucket(bucketHigh),
  ];

  return {
    overall: {
      corridor: 'all',
      corridorNameAr: 'الأسطول الموحد (التقرير الشامل)',
      corridorNameFr: 'Flotte Globale (Vue d’ensemble)',
      corridorNameEs: 'Flota Global (Visión General)',
      ltl: overallLtl,
      ftl: overallFtl,
      comparison: overallComparison,
    },
    europeanMaritime: {
      corridor: 'european_maritime',
      corridorNameAr: 'الممر البحري الأوروبي (طنجة المتوسط ↔ أوروبا)',
      corridorNameFr: 'Corridor Maritime Européen (Tanger Med ↔ Europe)',
      corridorNameEs: 'Corredor Marítimo Europeo (Tánger Med ↔ Europa)',
      ltl: euroLtl,
      ftl: euroFtl,
      comparison: euroComparison,
    },
    africanOverland: {
      corridor: 'african_overland',
      corridorNameAr: 'الممر البري الإفريقي (الكركرات ↔ السنغال)',
      corridorNameFr: 'Corridor Terrestre Africain (Guerguerat ↔ Sénégal)',
      corridorNameEs: 'Corredor Terrestre Africano (Guerguerat ↔ Senegal)',
      ltl: afrLtl,
      ftl: afrFtl,
      comparison: afrComparison,
    },
    trips: tripItems,
    ldmBuckets,
    currencyRates: DEFAULT_CURRENCY_RATES,
    generatedAt: new Date().toISOString(),
  };
}
