/**
 * Consolidated Customs Dossier Builder Service
 * Assembles unified clearance dossiers and generates cryptographic QR verification stamps.
 * Trans Bodanon TMS
 */

import crypto from 'crypto';
import Decimal from 'decimal.js';
import type {
  ConsolidatedCustomsDossier,
  PhytosanitaryCertificate,
  DossierDocument,
  InspectionChannel,
  CustomsDossierStatus,
} from '../types/customs-dossier.types';
import {
  reconcileDossierWeights,
  verifyThermalRegimeCompliance,
  validatePhytosanitaryCertificate,
  calculateCustomsSanitaryFees,
} from './phytosanitary-validator.service';
import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface BuildDossierInput {
  tripId: number;
  corridorType?: InternationalCorridor | 'domestic';
  truckPlate: string;
  trailerPlate: string;
  sealNumber: string;
  goodsValueMad: number;
  cmrNetWeightKg: number;
  cmrGrossWeightKg: number;
  dumNetWeightKg: number;
  dumGrossWeightKg: number;
  currentSensorTemp: number;
  phytosanitary: PhytosanitaryCertificate;
  documents?: DossierDocument[];
}

/**
 * Generates SHA-256 cryptographic QR verification hash for customs checkpoint scanning.
 */
export function generateCustomsQrVerificationHash(params: {
  dossierReference: string;
  tripId: number;
  trailerPlate: string;
  sealNumber: string;
  phytoCertNumber: string;
  grossWeightKg: number;
  timestamp: string;
}): string {
  const payload = [
    params.dossierReference,
    params.tripId,
    params.trailerPlate.replace(/\s+/g, '').toUpperCase(),
    params.sealNumber.trim(),
    params.phytoCertNumber.trim(),
    params.grossWeightKg.toFixed(2),
    params.timestamp,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Determines customs inspection channel (GREEN, ORANGE, RED).
 */
export function resolveInspectionChannel(params: {
  isWeightCompliant: boolean;
  isPhytoValid: boolean;
  isThermalCompliant: boolean;
  allDocsVerified: boolean;
}): { channel: InspectionChannel; status: CustomsDossierStatus } {
  // If weight discrepancy exceeds 3% or Phyto certificate is invalid/expired -> RED channel (Physical check)
  if (!params.isWeightCompliant || !params.isPhytoValid) {
    return {
      channel: 'RED',
      status: 'inspection_pending',
    };
  }

  // If thermal regime drifted or documents are still pending verification -> ORANGE channel (Document check)
  if (!params.isThermalCompliant || !params.allDocsVerified) {
    return {
      channel: 'ORANGE',
      status: 'inspection_pending',
    };
  }

  // Everything verified and within strict tolerances -> GREEN channel (Circuit Vert / Fast-track BAE)
  return {
    channel: 'GREEN',
    status: 'cleared_bae',
  };
}

/**
 * Assembles and builds a comprehensive consolidated customs and phytosanitary clearance dossier.
 */
export function buildConsolidatedCustomsDossier(
  input: BuildDossierInput
): ConsolidatedCustomsDossier {
  const timestamp = new Date().toISOString();
  const corridorPrefix =
    input.corridorType === 'african_overland' ? 'GUR' : 'TNG';
  const dossierReference = `DOS-2026-${corridorPrefix}-${String(input.tripId).padStart(5, '0')}`;

  // 1. Reconcile Weights
  const weightReconciliation = reconcileDossierWeights({
    cmrNetWeightKg: input.cmrNetWeightKg,
    cmrGrossWeightKg: input.cmrGrossWeightKg,
    dumNetWeightKg: input.dumNetWeightKg,
    dumGrossWeightKg: input.dumGrossWeightKg,
  });

  // 2. Thermal Regime Verification
  const thermalCompliance = verifyThermalRegimeCompliance({
    sensorTemp: input.currentSensorTemp,
    prescribedMin: input.phytosanitary.prescribedTempCelsius.min,
    prescribedMax: input.phytosanitary.prescribedTempCelsius.max,
    prescribedTarget: input.phytosanitary.prescribedTempCelsius.target,
  });

  // 3. Phytosanitary Certificate Validity
  const phytoValidation = validatePhytosanitaryCertificate(
    input.phytosanitary,
    {
      currentDate: timestamp,
      currentTrailer: input.trailerPlate,
      currentSeal: input.sealNumber,
    }
  );

  // 4. Calculate Duties and Taxes
  const fees = calculateCustomsSanitaryFees({
    grossWeightKg: input.cmrGrossWeightKg,
    goodsValueMad: input.goodsValueMad,
  });

  // 5. Documents list
  const defaultDocs: DossierDocument[] = [
    {
      id: `doc-dum-${input.tripId}`,
      type: 'DUM',
      documentNumber: `DUM-2026-${input.tripId}`,
      status: 'verified',
      verifiedAt: timestamp,
    },
    {
      id: `doc-phyto-${input.tripId}`,
      type: 'PHYTO_ONSSA',
      documentNumber: input.phytosanitary.certificateNumber,
      status: phytoValidation.isValid ? 'verified' : 'rejected',
      verifiedAt: phytoValidation.isValid ? timestamp : undefined,
    },
    {
      id: `doc-cmr-${input.tripId}`,
      type: 'CMR_PACKING_LIST',
      documentNumber: `CMR-${input.tripId}`,
      status: 'verified',
      verifiedAt: timestamp,
    },
    {
      id: `doc-eur1-${input.tripId}`,
      type: 'EUR1',
      documentNumber: `EUR1-MA-2026-${input.tripId}`,
      status: 'verified',
      verifiedAt: timestamp,
    },
  ];

  const documents = input.documents || defaultDocs;
  const allDocsVerified = documents.every((d) => d.status === 'verified');

  // 6. Channel and Status Resolution
  const { channel, status } = resolveInspectionChannel({
    isWeightCompliant: weightReconciliation.isWeightCompliant,
    isPhytoValid: phytoValidation.isValid,
    isThermalCompliant: thermalCompliance.isCompliant,
    allDocsVerified,
  });

  // 7. QR Verification Hash
  const qrVerificationHash = generateCustomsQrVerificationHash({
    dossierReference,
    tripId: input.tripId,
    trailerPlate: input.trailerPlate,
    sealNumber: input.sealNumber,
    phytoCertNumber: input.phytosanitary.certificateNumber,
    grossWeightKg: input.cmrGrossWeightKg,
    timestamp,
  });

  return {
    id: `cdos-${input.tripId}`,
    tripId: input.tripId,
    dossierReference,
    corridorType: input.corridorType || 'european_maritime',
    truckPlate: input.truckPlate,
    trailerPlate: input.trailerPlate,
    sealNumber: input.sealNumber,
    status,
    channel,
    phytosanitary: input.phytosanitary,
    documents,
    weightReconciliation,
    fees,
    thermalCompliance,
    qrVerificationHash,
    updatedAt: timestamp,
  };
}

