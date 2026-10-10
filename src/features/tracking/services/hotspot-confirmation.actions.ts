'use server';

/**
 * Trans Bodanon TMS — Driver PWA Hotspot Confirmation Server Actions
 * Handles driver pre-docking affirmations, dual telematics verification, and compliance status.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { createClient } from '@/lib/supabase/server';
import { HotspotComplianceVerifyService } from './hotspot-compliance-verify.service';
import {
  submitDriverConfirmationSchema,
  verifyTelematicsQuerySchema,
  type DriverHotspotConfirmationRecord,
  type SubmitDriverConfirmationInput,
  type TelematicsPreFlightVerification,
  type VerifyTelematicsQueryInput,
} from '../types/hotspot-confirmation.types';
import { HotspotProximityRadarService } from './hotspot-proximity-radar.service';

/**
 * Submits driver's affirmation for cooling protocols and cross-references live telematics
 */
export async function submitDriverHotspotConfirmationAction(
  input: SubmitDriverConfirmationInput
): Promise<{
  success: boolean;
  record?: DriverHotspotConfirmationRecord;
  error?: string;
}> {
  try {
    const validated = submitDriverConfirmationSchema.parse(input);
    const record = await HotspotComplianceVerifyService.processDriverConfirmation(validated);

    return {
      success: true,
      record,
    };
  } catch (error: any) {
    console.error('Error submitting driver hotspot confirmation:', error);
    return {
      success: false,
      error: error?.message || 'Failed to submit driver confirmation',
    };
  }
}

/**
 * Direct check of reefer telematics pre-flight status for a specific truck
 */
export async function verifyReeferTelematicsComplianceAction(
  query: VerifyTelematicsQueryInput
): Promise<{
  success: boolean;
  verification?: TelematicsPreFlightVerification;
  error?: string;
}> {
  try {
    const validated = verifyTelematicsQuerySchema.parse(query);
    const verification = await HotspotComplianceVerifyService.verifyReeferTelematics(validated);

    return {
      success: true,
      verification,
    };
  } catch (error: any) {
    console.error('Error checking reefer telematics compliance:', error);
    return {
      success: false,
      error: error?.message || 'Failed to verify reefer telematics',
    };
  }
}

/**
 * Checks if the driver's current active trip is in proximity of a critical hotspot requiring confirmation
 */
export async function getDriverApproachingHotspotStatusAction(
  truckId: number,
  driverId?: number | string
): Promise<{
  hasApproachingHotspot: boolean;
  hotspotData?: any;
  isConfirmed?: boolean;
  existingRecord?: DriverHotspotConfirmationRecord | null;
}> {
  try {
    const supabase = await createClient();

    // 1. Get latest location for truck
    const { data: latestLoc } = await supabase
      .from('truck_locations')
      .select('latitude, longitude, speed')
      .eq('truck_id', truckId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lat = latestLoc ? Number(latestLoc.latitude) : 40.33;
    const lng = latestLoc ? Number(latestLoc.longitude) : -3.65;
    const speed = latestLoc ? Number(latestLoc.speed || 45) : 45;

    // 2. Evaluate proximity
    const evalRes = await HotspotProximityRadarService.evaluateApproachingHotspot({
      truckId,
      latitude: lat,
      longitude: lng,
      speedKmh: speed,
      driverId,
      forceBypassCooldown: true, // For status polling
    });

    if (!evalRes.approachingHotspot || !evalRes.alertPayload) {
      return {
        hasApproachingHotspot: false,
      };
    }

    const payload = evalRes.alertPayload;
    const existing = HotspotComplianceVerifyService.getConfirmationStatus(
      payload.tripId,
      payload.dockId
    );

    return {
      hasApproachingHotspot: true,
      hotspotData: payload,
      isConfirmed: !!existing && existing.confirmationStatus === 'confirmed',
      existingRecord: existing,
    };
  } catch (error) {
    console.warn('Error checking approaching hotspot status:', error);
    return {
      hasApproachingHotspot: false,
    };
  }
}

