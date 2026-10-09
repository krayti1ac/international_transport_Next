/**
 * Trans Bodanon TMS — Reefer Public Verification Types
 * Public QR Code Cold Chain Verification Portal (EN 12830 / GDP / ATP)
 */

import type { ReeferCargoCategory } from './reefer-compliance.types';

export type PublicVerificationSecurityBadge = 'verified' | 'tampered' | 'unregistered';

export interface PublicReeferTelemetrySample {
  recordedAt: string;
  supplyAirTemp: number;
  returnAirTemp: number;
  setpointTemp: number;
  doorOpenSensor: boolean;
  compressorStatus: string;
}

export interface PublicReeferExcursionSummary {
  incidentType: string;
  severity: string;
  startedAt: string;
  durationMinutes: number;
  peakDeviationTemp: number;
}

export interface PublicReeferVerificationResult {
  isValid: boolean;
  isTamperEvident: boolean;
  securityBadge: PublicVerificationSecurityBadge;
  tamperReason?: string;
  issuedAt?: string;
  verificationHash: string;
  certificateNumber?: string;
  tripId?: string | number;
  atpClass?: string;
  cargoCategory?: ReeferCargoCategory;
  complianceStatus?: 'compliant' | 'warning' | 'breached';
  complianceScorePercent?: number;
  setpointTemp?: number;
  minTempThreshold?: number;
  maxTempThreshold?: number;
  avgReturnTemp?: number;
  avgSupplyTemp?: number;
  mktTemperatureCelsius?: number;
  totalExcursionMinutes?: number;
  doorBreachesCount?: number;
  coolingUnitBrand?: string;
  trailerPlate?: string;
  truckPlate?: string;
  cmrNumber?: string;
  routeName?: string;
  totalLogsCount?: number;
  logsSample?: PublicReeferTelemetrySample[];
  incidents?: PublicReeferExcursionSummary[];
  company?: {
    name: string;
    ice: string;
    address: string;
    phone: string;
    email: string;
  };
  error?: string;
}

