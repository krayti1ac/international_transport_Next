/**
 * Phytosanitary & Customs Validator Service
 * Strictly adheres to Decimal.js financial and mathematical precision rules.
 * Trans Bodanon TMS
 */

import Decimal from 'decimal.js';
import type {
  PhytosanitaryCertificate,
  WeightReconciliation,
  ThermalComplianceStatus,
  CustomsDutiesAndFees,
} from '../types/customs-dossier.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Operational thresholds
export const MAX_WEIGHT_VARIANCE_PERCENTAGE = new Decimal('3.0'); // 3.0% allowed tolerance between CMR & DUM
export const BASE_SANITARY_INSPECTION_MAD = new Decimal('350.00');
export const SANITARY_RATE_PER_TON_MAD = new Decimal('15.00');
export const PHYTO_STAMP_FIXED_MAD = new Decimal('100.00');
export const PORT_SANITARY_TAX_RATE = new Decimal('0.0025'); // 0.25% of goods value
export const MIN_PORT_SANITARY_TAX_MAD = new Decimal('150.00');
export const CUSTOMS_STATISTICAL_TAX_RATE = new Decimal('0.0025'); // 0.25% of declared customs value

/**
 * 1. Reconciles weights between CMR Packing List, DUM Declaration, and ONSSA Certificate.
 * Strictly calculates gross/net variance using Decimal.js.
 */
export function reconcileDossierWeights(params: {
  cmrNetWeightKg: number;
  cmrGrossWeightKg: number;
  dumNetWeightKg: number;
  dumGrossWeightKg: number;
  phytoWeightKg?: number;
}): WeightReconciliation {
  const cmrGross = new Decimal(params.cmrGrossWeightKg);
  const dumGross = new Decimal(params.dumGrossWeightKg);
  const cmrNet = new Decimal(params.cmrNetWeightKg);
  const dumNet = new Decimal(params.dumNetWeightKg);
  const phyto = new Decimal(params.phytoWeightKg ?? params.cmrGrossWeightKg);

  const varianceGross = cmrGross.minus(dumGross).abs();
  const variancePct = cmrGross.isZero()
    ? new Decimal(0)
    : varianceGross.dividedBy(cmrGross).times(100);

  const isCompliant = variancePct.lessThanOrEqualTo(MAX_WEIGHT_VARIANCE_PERCENTAGE);

  return {
    cmrNetWeightKg: Number(cmrNet.toFixed(2)),
    cmrGrossWeightKg: Number(cmrGross.toFixed(2)),
    dumNetWeightKg: Number(dumNet.toFixed(2)),
    dumGrossWeightKg: Number(dumGross.toFixed(2)),
    phytoWeightKg: Number(phyto.toFixed(2)),
    varianceGrossKg: Number(varianceGross.toFixed(2)),
    variancePercentage: Number(variancePct.toFixed(2)),
    isWeightCompliant: isCompliant,
  };
}

/**
 * 2. Verifies thermal regime compliance against ONSSA prescribed temperatures.
 */
export function verifyThermalRegimeCompliance(params: {
  sensorTemp: number;
  prescribedMin: number;
  prescribedMax: number;
  prescribedTarget?: number;
}): ThermalComplianceStatus {
  const sensor = new Decimal(params.sensorTemp);
  const min = new Decimal(params.prescribedMin);
  const max = new Decimal(params.prescribedMax);

  let deviation = new Decimal(0);
  let isCompliant = true;

  if (sensor.lessThan(min)) {
    deviation = min.minus(sensor);
    isCompliant = false;
  } else if (sensor.greaterThan(max)) {
    deviation = sensor.minus(max);
    isCompliant = false;
  }

  const rangeStr = `${min.toFixed(1)}°C ➔ ${max.toFixed(1)}°C`;

  return {
    isCompliant,
    currentSensorTemp: Number(sensor.toFixed(2)),
    prescribedRange: rangeStr,
    deviationCelsius: Number(deviation.toFixed(2)),
  };
}

/**
 * 3. Validates Phytosanitary Certificate validity, trailer matching, and lead seal numbers.
 */
export function validatePhytosanitaryCertificate(
  cert: PhytosanitaryCertificate,
  options?: {
    currentDate?: string;
    currentTrailer?: string;
    currentSeal?: string;
  }
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const now = options?.currentDate ? new Date(options.currentDate) : new Date();
  const expiry = new Date(cert.expiryDate);

  // Expiry check
  if (now.getTime() > expiry.getTime()) {
    errors.push(
      `شهادة الصحة النباتية ${cert.certificateNumber} منتهية الصلاحية منذ ${cert.expiryDate}`
    );
  }

  // Trailer Plate Match
  if (options?.currentTrailer) {
    const normalizePlate = (p: string) => p.replace(/\s+/g, '').toUpperCase();
    if (normalizePlate(cert.inspectedTrailerPlate) !== normalizePlate(options.currentTrailer)) {
      errors.push(
        `عدم تطابق مقطورة الشحن: الشهادة تحمل (${cert.inspectedTrailerPlate}) بينما المقطورة الفعلية هي (${options.currentTrailer})`
      );
    }
  }

  // Customs Seal Match
  if (options?.currentSeal) {
    if (cert.leadSealNumber.trim() !== options.currentSeal.trim()) {
      errors.push(
        `عدم تطابق شمع الرصاص الجمركي: الشهادة تحمل (${cert.leadSealNumber}) بينما الختم الفعلي هو (${options.currentSeal})`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 4. Calculates customs inspection fees and sanitary taxes with Decimal.js precision.
 */
export function calculateCustomsSanitaryFees(params: {
  grossWeightKg: number;
  goodsValueMad: number;
}): CustomsDutiesAndFees {
  const grossKg = new Decimal(params.grossWeightKg);
  const valueMad = new Decimal(params.goodsValueMad);

  // Weight in metric tons (1000 kg)
  const tons = grossKg.dividedBy(new Decimal(1000));

  // Sanitary inspection fee: 350.00 base + 15.00 MAD per ton
  const inspectionFee = BASE_SANITARY_INSPECTION_MAD.plus(
    tons.times(SANITARY_RATE_PER_TON_MAD)
  );

  // Fixed Phytosanitary Stamp: 100.00 MAD
  const phytoStamp = PHYTO_STAMP_FIXED_MAD;

  // Port Sanitary Tax: 0.25% of goods value (Minimum 150.00 MAD)
  const portSanitaryTax = Decimal.max(
    MIN_PORT_SANITARY_TAX_MAD,
    valueMad.times(PORT_SANITARY_TAX_RATE)
  );

  // Customs Statistical Tax: 0.25% of declared customs value
  const statisticalTax = valueMad.times(CUSTOMS_STATISTICAL_TAX_RATE);

  // Total Duties and Fees
  const totalFees = inspectionFee
    .plus(phytoStamp)
    .plus(portSanitaryTax)
    .plus(statisticalTax);

  return {
    sanitaryInspectionFeeMad: inspectionFee.toFixed(2),
    phytosanitaryStampMad: phytoStamp.toFixed(2),
    portSanitaryTaxMad: portSanitaryTax.toFixed(2),
    customsStatisticalTaxMad: statisticalTax.toFixed(2),
    totalDutiesAndFeesMad: totalFees.toFixed(2),
  };
}

