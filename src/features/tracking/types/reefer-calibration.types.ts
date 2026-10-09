/**
 * Trans Bodanon TMS — Reefer Sensor Calibration & ATP Recertification Types
 * Standards: EN 12830 / ATP Treaty (FRC / FRA / FNA)
 */

import { z } from 'zod';

export type AtpClassType = 'FRC' | 'FRA' | 'FNA' | 'IR' | 'BNA';

export const recordAtpCertificationSchema = z.object({
  trailerId: z.coerce.number().positive(),
  certificateNumber: z.string().min(3),
  atpType: z.enum(['FRC', 'FRA', 'FNA', 'IR', 'BNA']),
  issueDate: z.string().min(8),
  expiryDate: z.string().min(8),
  kValue: z.coerce.number().positive().default(0.38),
  testingStation: z.string().default('Cematrans / CEMAFROID'),
  renewalCycleYears: z.coerce.number().int().default(3),
  documentUrl: z.string().optional().nullable(),
});

export type RecordAtpCertificationInput = z.infer<typeof recordAtpCertificationSchema>;

export const recordSensorCalibrationSchema = z.object({
  trailerId: z.coerce.number().positive(),
  sensorType: z.enum([
    'supply_air_probe',
    'return_air_probe',
    'cargo_probe_1',
    'cargo_probe_2',
    'data_logger',
  ]),
  deviceSerialNumber: z.string().optional(),
  calibratedAt: z.string().min(8),
  nextDueDate: z.string().min(8),
  referenceTemp: z.coerce.number(),
  measuredTemp: z.coerce.number(),
  calibratedBy: z.string().min(2),
  certificateReference: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordSensorCalibrationInput = z.infer<typeof recordSensorCalibrationSchema>;

export type AtpCertificationStatus = 'valid' | 'expiring_soon' | 'expired' | 'suspended';

export type ExpiryWarningLevel =
  | 'safe'
  | 'notice_60d'
  | 'urgent_30d'
  | 'critical_7d'
  | 'expired';

export type ReeferSensorType =
  | 'supply_air_probe'
  | 'return_air_probe'
  | 'cargo_probe_1'
  | 'cargo_probe_2'
  | 'data_logger';

export interface ReeferAtpCertification {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  certificateNumber: string;
  atpType: AtpClassType;
  issueDate: string;
  expiryDate: string;
  kValue: number; // Coefficient K (W/m²·K), must be < 0.40 for FRC
  testingStation: string;
  status: AtpCertificationStatus;
  warningLevel: ExpiryWarningLevel;
  daysRemaining: number;
  renewalCycleYears: number;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ReeferSensorCalibrationLog {
  id: string;
  companyId: number;
  trailerId: number;
  trailerPlate?: string;
  sensorType: ReeferSensorType;
  deviceSerialNumber?: string;
  calibratedAt: string;
  nextDueDate: string;
  referenceTemp: number; // Standard calibration reference e.g. 0.0°C or 4.0°C
  measuredTemp: number; // Temperature measured by unit under test
  driftDelta: number; // measuredTemp - referenceTemp (max ±0.5°C per EN 12830)
  isPassed: boolean;
  warningLevel: ExpiryWarningLevel;
  daysRemaining: number;
  calibratedBy: string;
  certificateReference?: string;
  notes?: string;
  createdAt: string;
}

export interface PreTripReeferComplianceCheck {
  trailerId: number;
  trailerPlate: string;
  isClearedForDispatch: boolean;
  atpStatus: AtpCertificationStatus;
  atpType?: AtpClassType;
  atpCertificateNumber?: string;
  atpDaysRemaining?: number;
  sensorCalibrationStatus: 'passed' | 'due' | 'overdue' | 'drift_fail';
  activeSensorsCount: number;
  blockingReasons: string[];
  warnings: string[];
}

export interface ReeferCalibrationRadarSummary {
  totalReeferTrailers: number;
  validAtpCount: number;
  expiring60dCount: number;
  expiring30dCount: number;
  expiredAtpCount: number;
  validSensorCalibrationsCount: number;
  dueSensorCalibrationsCount: number;
  groundedTrailersCount: number;
  fleetComplianceHealthRate: number; // 0 - 100%
}

