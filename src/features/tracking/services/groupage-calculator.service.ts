/**
 * Trans Bodanon TMS — Groupage & LTL Loading Meter (LDM) & Metric Calculator
 * Standards: Euro-Pallet (0.4 LDM), Industrial Pallet (0.5 LDM), Max Trailer (13.60 LDM, 24,000 Kg)
 * Precision: Strict Decimal.js calculations for volumetric weight and utilization rates.
 */

import Decimal from 'decimal.js';
import {
  LTL_TRAILER_STANDARDS,
  type PalletType,
  type TrailerCapacityUtilization,
  type TripConsignment,
} from '../types/groupage-ltl.types';

export interface ConsignmentMetricInput {
  palletType: PalletType;
  palletCount: number;
  isStackable: boolean;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  grossWeightKg: number;
}

export interface ConsignmentMetricOutput {
  ldmMeters: number;
  volumeM3: number;
  chargeableWeightKg: number;
}

/**
 * Computes Loading Meters (LDM), Volume (m³), and Chargeable Weight (Kg)
 */
export function calculateConsignmentMetrics(
  input: ConsignmentMetricInput
): ConsignmentMetricOutput {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  const palletCountDec = new Decimal(Math.max(1, input.palletCount));
  const grossWeightDec = new Decimal(Math.max(0, input.grossWeightKg));

  // 1. Calculate Base LDM per item
  let baseLdmPerItem = new Decimal(0.4);

  if (input.palletType === 'euro') {
    baseLdmPerItem = new Decimal(LTL_TRAILER_STANDARDS.EURO_PALLET_LDM); // 0.4
  } else if (input.palletType === 'industrial') {
    baseLdmPerItem = new Decimal(LTL_TRAILER_STANDARDS.INDUSTRIAL_PALLET_LDM); // 0.5
  } else if (input.lengthCm && input.widthCm && input.lengthCm > 0 && input.widthCm > 0) {
    // Formula: (Length in m * Width in m) / 2.4m trailer width
    const lengthM = new Decimal(input.lengthCm).dividedBy(100);
    const widthM = new Decimal(input.widthCm).dividedBy(100);
    baseLdmPerItem = lengthM.times(widthM).dividedBy(new Decimal(2.4));
  } else {
    // Default fallback
    baseLdmPerItem = new Decimal(0.4);
  }

  // 2. Adjust for stackable goods (gerbable factor: 2 tiers)
  let totalLdmDec = baseLdmPerItem.times(palletCountDec);
  if (input.isStackable) {
    // Two pallets occupy one floor space
    totalLdmDec = totalLdmDec.dividedBy(2);
  }

  // 3. Calculate Volume (m³)
  let volumeDec = new Decimal(0);
  if (
    input.lengthCm &&
    input.widthCm &&
    input.heightCm &&
    input.lengthCm > 0 &&
    input.widthCm > 0 &&
    input.heightCm > 0
  ) {
    const lM = new Decimal(input.lengthCm).dividedBy(100);
    const wM = new Decimal(input.widthCm).dividedBy(100);
    const hM = new Decimal(input.heightCm).dividedBy(100);
    volumeDec = lM.times(wM).times(hM).times(palletCountDec);
  } else {
    // Standard default euro pallet loaded volume (~1.5 m³)
    const defaultPalletVol = input.palletType === 'industrial' ? 1.8 : 1.44; // 1.2 x 0.8 x 1.5m
    volumeDec = new Decimal(defaultPalletVol).times(palletCountDec);
  }

  // 4. Calculate Chargeable Weight (European Road Freight standard)
  // Max of:
  // a) Actual Gross Weight
  // b) Volume (m³) * 333 Kg/m³
  // c) LDM * 1850 Kg/LDM
  const volWeight = volumeDec.times(LTL_TRAILER_STANDARDS.VOLUMETRIC_RATIO_KG_PER_M3);
  const ldmWeight = totalLdmDec.times(LTL_TRAILER_STANDARDS.LDM_EQUIVALENT_KG);

  const chargeableWeightDec = Decimal.max(grossWeightDec, volWeight, ldmWeight);

  return {
    ldmMeters: Number(totalLdmDec.toFixed(2)),
    volumeM3: Number(volumeDec.toFixed(2)),
    chargeableWeightKg: Number(chargeableWeightDec.toFixed(2)),
  };
}

/**
 * Aggregates all consignments on a trip and computes trailer capacity utilization KPIs
 */
export function calculateTrailerUtilization(
  consignments: TripConsignment[]
): TrailerCapacityUtilization {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

  let totalLdmDec = new Decimal(0);
  let totalWeightDec = new Decimal(0);
  let totalVolumeDec = new Decimal(0);
  let totalRevenueDec = new Decimal(0);
  let totalPallets = 0;
  const currency = consignments[0]?.currency || 'MAD';

  for (const c of consignments) {
    totalLdmDec = totalLdmDec.plus(new Decimal(c.ldmMeters));
    totalWeightDec = totalWeightDec.plus(new Decimal(c.grossWeightKg));
    totalVolumeDec = totalVolumeDec.plus(new Decimal(c.volumeM3));
    totalRevenueDec = totalRevenueDec.plus(new Decimal(c.freightPrice));
    totalPallets += c.palletCount;
  }

  const maxLdm = LTL_TRAILER_STANDARDS.MAX_TRAILER_LDM;
  const maxWeight = LTL_TRAILER_STANDARDS.MAX_PAYLOAD_KG;
  const maxVolume = LTL_TRAILER_STANDARDS.MAX_VOLUME_M3;

  const ldmUtilPct = totalLdmDec.dividedBy(maxLdm).times(100);
  const weightUtilPct = totalWeightDec.dividedBy(maxWeight).times(100);
  const volumeUtilPct = totalVolumeDec.dividedBy(maxVolume).times(100);

  return {
    totalLdm: Number(totalLdmDec.toFixed(2)),
    maxLdm,
    ldmUtilizationPct: Math.min(100, Number(ldmUtilPct.toFixed(1))),
    totalGrossWeightKg: Number(totalWeightDec.toFixed(2)),
    maxWeightKg: maxWeight,
    weightUtilizationPct: Math.min(100, Number(weightUtilPct.toFixed(1))),
    totalVolumeM3: Number(totalVolumeDec.toFixed(2)),
    maxVolumeM3: maxVolume,
    volumeUtilizationPct: Math.min(100, Number(volumeUtilPct.toFixed(1))),
    totalPallets,
    totalFreightRevenue: Number(totalRevenueDec.toFixed(2)),
    currency,
    isOverloaded: totalWeightDec.greaterThan(maxWeight),
    isOverLdm: totalLdmDec.greaterThan(maxLdm),
    consignmentsCount: consignments.length,
  };
}
