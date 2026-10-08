/**
 * Smart Transit Customs & Phytosanitary Dossier Engine — Type Definitions
 * Trans Bodanon TMS
 */

import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

export type CustomsDossierStatus =
  | 'draft'
  | 'inspection_pending'
  | 'cleared_bae'
  | 'blocked';

export type InspectionChannel = 'GREEN' | 'ORANGE' | 'RED';

export type DossierDocumentType =
  | 'DUM'
  | 'PHYTO_ONSSA'
  | 'TIR_CARNET'
  | 'EUR1'
  | 'VETERINARY_HEALTH'
  | 'CMR_PACKING_LIST'
  | 'BAE_RELEASE';

export interface PhytosanitaryCertificate {
  certificateNumber: string; // e.g. "ONSSA-PHYTO-2026-MA-88412"
  issueDate: string;
  expiryDate: string;
  issuingAuthority: 'ONSSA' | 'SANITARY_SENEGAL' | 'EU_TRACES';
  productCategory: 'fresh_produce' | 'frozen_fish' | 'processed_food' | 'plants';
  botanicalName?: string;
  originCountry: string; // "MA"
  destinationCountry: string; // "ES", "FR", "SN", "MR"
  inspectedTrailerPlate: string;
  containerNumber?: string;
  leadSealNumber: string; // Numéro de scellé douane / ONSSA
  prescribedTempCelsius: {
    min: number;
    max: number;
    target: number;
  };
  chemicalTreatment?: {
    substance: string;
    concentration: string;
    date: string;
  };
  status: 'valid' | 'expired' | 'revoked' | 'pending_inspection';
}

export interface DossierDocument {
  id: string;
  type: DossierDocumentType;
  documentNumber: string;
  status: 'draft' | 'attached' | 'verified' | 'rejected';
  fileUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface WeightReconciliation {
  cmrNetWeightKg: number;
  cmrGrossWeightKg: number;
  dumNetWeightKg: number;
  dumGrossWeightKg: number;
  phytoWeightKg: number;
  varianceGrossKg: number;
  variancePercentage: number;
  isWeightCompliant: boolean; // tolerance <= 3.0%
}

export interface CustomsDutiesAndFees {
  sanitaryInspectionFeeMad: string; // Decimal.js
  phytosanitaryStampMad: string; // Decimal.js
  portSanitaryTaxMad: string; // Decimal.js
  customsStatisticalTaxMad: string; // Decimal.js
  totalDutiesAndFeesMad: string; // Decimal.js
}

export interface ThermalComplianceStatus {
  isCompliant: boolean;
  currentSensorTemp: number;
  prescribedRange: string;
  deviationCelsius: number;
}

export interface ConsolidatedCustomsDossier {
  id: string;
  tripId: number;
  dossierReference: string; // e.g. "DOS-2026-TNG-9014"
  corridorType: InternationalCorridor | 'domestic';
  truckPlate: string;
  trailerPlate: string;
  sealNumber: string;
  status: CustomsDossierStatus;
  channel: InspectionChannel;
  phytosanitary: PhytosanitaryCertificate;
  documents: DossierDocument[];
  weightReconciliation: WeightReconciliation;
  fees: CustomsDutiesAndFees;
  thermalCompliance: ThermalComplianceStatus;
  qrVerificationHash: string;
  updatedAt: string;
}
