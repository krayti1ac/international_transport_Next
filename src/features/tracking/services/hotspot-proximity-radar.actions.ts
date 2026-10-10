'use server';

/**
 * Trans Bodanon TMS — Approaching Hotspot Driver Alert Server Actions
 * Enables simulation, manual trigger, and audit querying for reefer drivers approaching critical hubs.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { HotspotProximityRadarService } from './hotspot-proximity-radar.service';
import type {
  HotspotAlertDispatchResult,
  HotspotProximityEvaluationParams,
} from '../types/hotspot-alert.types';

/**
 * Manually evaluates proximity or simulates urgent WhatsApp alert dispatch for a specific vehicle
 */
export async function simulateApproachingHotspotAlertAction(
  params: HotspotProximityEvaluationParams
): Promise<HotspotAlertDispatchResult> {
  return HotspotProximityRadarService.evaluateApproachingHotspot({
    ...params,
    forceBypassCooldown: true, // Allow simulation to trigger immediately
  });
}

