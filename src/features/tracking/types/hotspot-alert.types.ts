/**
 * Trans Bodanon TMS — Approaching Critical Hotspot Driver Alert Types
 * Regulatory Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { z } from 'zod';
import type { CargoCategory } from './multi-temp.types';
import type { DockRiskLevel, DockWatchStatus } from './dock-heatmap.types';
import type { WhatsAppLocale } from '@/features/whatsapp/types/whatsapp.types';

export interface MandatoryDriverCoolingProtocols {
  lockContinuousRunMode: boolean; // Disallow Cycle-Sentry / start-stop eco mode
  disallowCycleSentry: boolean;
  preCoolingMandatory: boolean;
  curtainProtocol: boolean; // Deploy movable thermal bulkhead curtain
  keepDoorsSealedUntilDocked: boolean;
  targetTempVerification: boolean;
}

export interface DriverHotspotUrgentAlertPayload {
  alertId: string;
  driverId: number | string;
  driverName: string;
  driverPhone: string;
  tripId: number;
  tripNumber: string;
  truckPlate: string;
  trailerPlate?: string;
  dockId: string;
  dockName: string;
  facilityOrPort: string;
  city: string;
  countryCode: string;
  dviScore: number;
  riskLevel: DockRiskLevel;
  watchStatus: DockWatchStatus;
  currentLat: number;
  currentLng: number;
  speedKmh: number;
  distanceKm: number; // calculated via Decimal.js Haversine
  etaMinutes: number; // calculated via Decimal.js
  cargoCategories: CargoCategory[];
  mandatoryProtocols: MandatoryDriverCoolingProtocols;
  localizedActions: string[];
  alertTimestamp: string;
  idempotencyKey: string;
  locale: WhatsAppLocale;
}

export interface HotspotProximityEvaluationParams {
  truckId: number;
  latitude: number;
  longitude: number;
  speedKmh?: number;
  timestamp?: string;
  driverId?: number | string;
  tripId?: number;
  truckPlate?: string;
  forceBypassCooldown?: boolean;
}

export interface HotspotAlertDispatchResult {
  evaluated: boolean;
  approachingHotspot: boolean;
  dispatched: boolean;
  cooldownActive?: boolean;
  alertPayload?: DriverHotspotUrgentAlertPayload;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export const hotspotAlertFilterSchema = z.object({
  proximityThresholdKm: z.number().min(1).max(100).default(15),
  etaThresholdMinutes: z.number().min(5).max(120).default(30),
  minDviScore: z.number().min(0).max(100).default(60),
});

export type HotspotAlertFilterConfig = z.infer<typeof hotspotAlertFilterSchema>;

