/**
 * Trans Bodanon TMS — Green Freight & ESG Carbon Footprint Service
 * Computes emissions according to GLEC Framework v3.0 & ISO 14083.
 * Strictly adheres to Decimal.js financial and mathematical precision rules.
 */

import Decimal from 'decimal.js';
import crypto from 'crypto';
import {
  GLEC_V3_FACTORS,
  type CarbonCalculationInput,
  type CarbonFootprintResult,
  type CarbonEfficiencyRating,
  type GreenFreightCertificate,
} from '../types/esg-carbon.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DEFAULT_ESG_SIGNING_SECRET =
  process.env.ESG_CERTIFICATE_SECRET || 'trans-bodanon-glec-esg-audit-secret-2026';

/**
 * Resolves European Logistics Efficiency Rating based on carbon intensity (gCO2e / t-km)
 */
export function resolveEfficiencyRating(intensityGPerTkm: InstanceType<typeof Decimal>): {
  rating: CarbonEfficiencyRating;
  description: string;
} {
  if (intensityGPerTkm.lessThanOrEqualTo(65)) {
    return {
      rating: 'A+',
      description: 'كفاءة بيئية استثنائية (Superior Eco-Efficiency - High Multimodal Ro-Ro Share)',
    };
  }
  if (intensityGPerTkm.lessThanOrEqualTo(80)) {
    return {
      rating: 'A',
      description: 'كفاءة بيئية متقدمة (Excellent Eco-Efficiency - Euro 6 Standard)',
    };
  }
  if (intensityGPerTkm.lessThanOrEqualTo(95)) {
    return {
      rating: 'B',
      description: 'كفاءة متوسطة متوافقة (Good Compliance - GLEC Industry Average)',
    };
  }
  if (intensityGPerTkm.lessThanOrEqualTo(110)) {
    return {
      rating: 'C',
      description: 'كفاءة مقبولة (Acceptable Baseline - Euro 5 or Heavy Load)',
    };
  }
  if (intensityGPerTkm.lessThanOrEqualTo(130)) {
    return {
      rating: 'D',
      description: 'كثافة كربونية مرتفعة (Elevated Carbon Intensity - High Reefer Load)',
    };
  }
  return {
    rating: 'E',
    description: 'كثافة كربونية حرجة (Critical Carbon Intensity - Low Optimization)',
  };
}

/**
 * 1. Computes Full Life-Cycle Trip Carbon Footprint (WTW & TTW) with Decimal.js
 */
export function calculateTripCarbonFootprint(
  input: CarbonCalculationInput
): CarbonFootprintResult {
  const factors = {
    ...GLEC_V3_FACTORS,
    ...input.customFactors,
  };

  const weight = new Decimal(input.cargoWeightTons || 0);
  const roadKm = new Decimal(input.roadDistanceKm || 0);
  const ferryKm = new Decimal(input.ferryDistanceKm || 0);
  const totalKm = roadKm.plus(ferryKm);

  // 1. Ton-Kilometers (t-km)
  const roadTonKm = weight.times(roadKm);
  const ferryTonKm = weight.times(ferryKm);
  const totalTonKm = weight.times(totalKm);

  // 2. Road Emission Factor according to Euro Class
  let roadFactorG = new Decimal(factors.roadWtwEuro6);
  if (input.truckEuroClass === 'euro_5') {
    roadFactorG = new Decimal(factors.roadWtwEuro5);
  } else if (input.truckEuroClass === 'electric_hybrid') {
    roadFactorG = new Decimal(factors.roadWtwElectricHybrid);
  }

  const ferryFactorG = new Decimal(factors.ferryWtwRoRo);

  // 3. Road & Ferry WTW Emissions (g -> kg: / 1000)
  const roadWtwKg = roadTonKm.times(roadFactorG).dividedBy(1000);
  const ferryWtwKg = ferryTonKm.times(ferryFactorG).dividedBy(1000);

  // 4. Reefer Auxiliary Unit Emissions
  let reeferWtwKg = new Decimal(0);
  let reeferTtwKg = new Decimal(0);

  if (input.isReefer !== false && input.reeferHours) {
    const hours = new Decimal(input.reeferHours);
    if (hours.greaterThan(0)) {
      const fuelPerHour = new Decimal(factors.reeferLitersPerHour);
      const totalFuelLiters = hours.times(fuelPerHour);

      reeferWtwKg = totalFuelLiters.times(new Decimal(factors.dieselWtwKgPerLiter));
      reeferTtwKg = totalFuelLiters.times(new Decimal(factors.dieselTtwKgPerLiter));
    }
  }

  // 5. Total Well-to-Wheel (WTW) & Tank-to-Wheel (TTW)
  const totalWtwKg = roadWtwKg.plus(ferryWtwKg).plus(reeferWtwKg);

  const ttwRatio = new Decimal(factors.roadTtwRatio);
  const roadTtwKg = roadWtwKg.times(ttwRatio);
  const ferryTtwKg = ferryWtwKg.times(ttwRatio);
  const totalTtwKg = roadTtwKg.plus(ferryTtwKg).plus(reeferTtwKg);

  // 6. Emissions Intensity (gCO2e / t-km)
  const intensityGPerTkm = totalTonKm.greaterThan(0)
    ? totalWtwKg.times(1000).dividedBy(totalTonKm)
    : new Decimal(0);

  // 7. Counterfactual Baseline (All-Road overland option without Ferry)
  // Ferry distance overland equivalent detour factor is approx 1.25
  const baselineRoadDistance = roadKm.plus(ferryKm.times(1.25));
  const baselineTonKm = weight.times(baselineRoadDistance);
  const baselineAllRoadKg = baselineTonKm.times(roadFactorG).dividedBy(1000).plus(reeferWtwKg);

  const emissionsSavedKg = Decimal.max(0, baselineAllRoadKg.minus(totalWtwKg));
  const emissionsSavingsPct = baselineAllRoadKg.greaterThan(0)
    ? emissionsSavedKg.dividedBy(baselineAllRoadKg).times(100)
    : new Decimal(0);

  const efficiency = resolveEfficiencyRating(intensityGPerTkm);

  return {
    cargoWeightTons: weight.toFixed(3),
    roadDistanceKm: roadKm.toFixed(2),
    ferryDistanceKm: ferryKm.toFixed(2),
    totalDistanceKm: totalKm.toFixed(2),
    tonKilometers: totalTonKm.toFixed(2),

    roadWtwEmissionsKg: roadWtwKg.toFixed(3),
    ferryWtwEmissionsKg: ferryWtwKg.toFixed(3),
    reeferWtwEmissionsKg: reeferWtwKg.toFixed(3),
    totalWtwEmissionsKg: totalWtwKg.toFixed(3),
    totalTtwEmissionsKg: totalTtwKg.toFixed(3),

    emissionsIntensityGPerTkm: intensityGPerTkm.toFixed(2),
    baselineAllRoadEmissionsKg: baselineAllRoadKg.toFixed(3),
    emissionsSavedKg: emissionsSavedKg.toFixed(3),
    emissionsSavingsPercentage: emissionsSavingsPct.toFixed(2),

    efficiencyRating: efficiency.rating,
    ratingDescription: efficiency.description,
    glecFrameworkVersion: 'v3.0',
  };
}

/**
 * 2. Generates Cryptographic Forensic Seal (HMAC-SHA256) for Certificate Authenticity
 */
export function generateCertificateSeal(params: {
  tripId: number;
  results: CarbonFootprintResult;
  issuedAt: string;
  secretKey?: string;
}): string {
  const secret = params.secretKey || DEFAULT_ESG_SIGNING_SECRET;
  const canonicalString = [
    `TRIP:${params.tripId}`,
    `WTW_KG:${params.results.totalWtwEmissionsKg}`,
    `TTW_KG:${params.results.totalTtwEmissionsKg}`,
    `INTENSITY:${params.results.emissionsIntensityGPerTkm}`,
    `SAVED_KG:${params.results.emissionsSavedKg}`,
    `ISSUED:${params.issuedAt}`,
    `GLEC:v3.0`,
  ].join('|');

  return crypto
    .createHmac('sha256', secret)
    .update(canonicalString)
    .digest('hex');
}

/**
 * 3. Builds Complete Official Green Freight Certificate Object
 */
export function buildGreenFreightCertificate(params: {
  tripId: number;
  cmrNumber?: string;
  route: string;
  clientName?: string;
  clientCountry?: string;
  vehiclePlate?: string;
  calculationInput: CarbonCalculationInput;
  secretKey?: string;
}): GreenFreightCertificate {
  const results = calculateTripCarbonFootprint(params.calculationInput);
  const issuedAt = new Date().toISOString();
  const certificateId = `GFC-MA-${params.tripId}-${Date.now().toString(36).toUpperCase()}`;

  const certificateHash = generateCertificateSeal({
    tripId: params.tripId,
    results,
    issuedAt,
    secretKey: params.secretKey,
  });

  return {
    certificateId,
    certificateHash,
    issuedAt,
    tripId: params.tripId,
    cmrNumber: params.cmrNumber,
    route: params.route,
    clientName: params.clientName,
    clientCountry: params.clientCountry,
    vehiclePlate: params.vehiclePlate,
    results,
    standardsCompliance: {
      glecVersion: 'v3.0',
      iso14083Compliant: true,
      euCbamAligned: true,
      ghgProtocolScope: 'Scope 3 (Category 4 / Upstream Transport & Distribution)',
    },
  };
}
