/**
 * Trans Bodanon TMS — Driver PWA Hotspot Confirmation & Telematics Verification Types
 * Regulatory Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { z } from 'zod';
import type { CargoCategory } from './multi-temp.types';
import type { DockRiskLevel, DockWatchStatus } from './dock-heatmap.types';

export type DriverConfirmationStatus =
  | 'pending'
  | 'confirmed'
  | 'discrepancy_warning'
  | 'non_compliant';

export type TelematicsVerifyStatus =
  | 'verified_compliant'
  | 'discrepancy_warning'
  | 'failed';

export interface CompartmentTelematicsCheck {
  compartment: 'C1' | 'C2' | 'C3';
  actualTempC: number;
  setpointTempC: number;
  deviationC: number;
  inTolerance: boolean;
}

export interface TelematicsPreFlightVerification {
  truckId: number;
  tripId?: number;
  compressorRunning: boolean;
  continuousRunActive: boolean;
  cycleSentryDisallowed: boolean;
  doorsClosed: boolean;
  compartments: CompartmentTelematicsCheck[];
  preDockingScore: number; // 0 to 100 via Decimal.js
  status: TelematicsVerifyStatus;
  telematicsTimestamp: string;
  source: 'telematics_iot' | 'simulated_sensor';
}

export interface DriverHotspotConfirmationRecord {
  confirmationId: string;
  tripId: number;
  tripNumber: string;
  truckId: number;
  truckPlate: string;
  driverId: string | number;
  driverName: string;
  dockId: string;
  dockName: string;
  facilityOrPort: string;
  dviScore: number;
  riskLevel: DockRiskLevel;
  distanceKmAtConfirm: number;
  continuousRunChecked: boolean;
  doorsSealedChecked: boolean;
  curtainsDeployedChecked: boolean;
  confirmationStatus: DriverConfirmationStatus;
  telematicsVerify: TelematicsPreFlightVerification;
  discrepancyDetected: boolean;
  discrepancyNote?: string | null;
  signatureHash: string; // HMAC-SHA256 signature
  confirmedAt: string;
  offlineQueued?: boolean;
}

export const submitDriverConfirmationSchema = z.object({
  tripId: z.number().int().positive(),
  tripNumber: z.string().min(1),
  truckId: z.number().int().positive(),
  truckPlate: z.string().min(1),
  driverId: z.union([z.string(), z.number()]),
  driverName: z.string().min(1),
  dockId: z.string().min(1),
  dockName: z.string().min(1),
  facilityOrPort: z.string().min(1),
  dviScore: z.number().min(0).max(100),
  riskLevel: z.enum(['safe', 'monitored', 'critical']).default('critical'),
  distanceKm: z.number().min(0).default(5),
  continuousRunChecked: z.boolean().refine((val) => val === true, {
    message: 'Continuous run mode confirmation is mandatory',
  }),
  doorsSealedChecked: z.boolean().refine((val) => val === true, {
    message: 'Door seal integrity confirmation is mandatory',
  }),
  curtainsDeployedChecked: z.boolean().default(true),
  offlineQueued: z.boolean().optional(),
});

export type SubmitDriverConfirmationInput = z.infer<typeof submitDriverConfirmationSchema>;
export type DriverHotspotConfirmationPayload = SubmitDriverConfirmationInput;

export const verifyTelematicsQuerySchema = z.object({
  truckId: z.number().int().positive(),
  tripId: z.number().int().positive().optional(),
  dockId: z.string().optional(),
});

export type VerifyTelematicsQueryInput = z.infer<typeof verifyTelematicsQuerySchema>;

