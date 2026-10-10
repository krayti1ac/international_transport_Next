/**
 * Trans Bodanon TMS — Approaching Critical Hotspot Driver Proximity Radar Service
 * Automatically detects reefer vehicle approach to high-vulnerability unloading docks (DVI ≥ 60)
 * and dispatches urgent proactive cooling protocols to the driver via WhatsApp.
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  KNOWN_STRATEGIC_HUBS,
  DockThermalRiskService,
} from './dock-thermal-risk.service';
import { WhatsAppHotspotAlertTemplates } from '@/features/whatsapp/services/whatsapp-hotspot-alert-templates';
import type {
  DriverHotspotUrgentAlertPayload,
  HotspotAlertDispatchResult,
  HotspotProximityEvaluationParams,
  MandatoryDriverCoolingProtocols,
} from '../types/hotspot-alert.types';
import type { WhatsAppLocale } from '@/features/whatsapp/types/whatsapp.types';
import type { DockRiskCluster } from '../types/dock-heatmap.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
type DecimalInstance = InstanceType<typeof Decimal>;

// 2-hour cooldown per trip and dock to prevent alert flooding
const HOTSPOT_ALERT_CACHE = new Map<string, number>();
const HOTSPOT_ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const PROXIMITY_DISTANCE_THRESHOLD_KM = 15.0;
const PROXIMITY_ETA_THRESHOLD_MINUTES = 30.0;
const CRITICAL_DVI_THRESHOLD = 60.0;

export class HotspotProximityRadarService {
  /**
   * Resets cooldown cache (useful for automated test runs or manual operational resets)
   */
  public static resetAlertCooldown(key?: string): void {
    if (key) {
      HOTSPOT_ALERT_CACHE.delete(key);
    } else {
      HOTSPOT_ALERT_CACHE.clear();
    }
  }

  /**
   * Calculates Haversine distance in kilometers between two GPS points using strict Decimal.js operations
   */
  public static calculateHaversineDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): DecimalInstance {
    const rKm = new Decimal(6371.0);
    const toRad = (deg: number) => new Decimal(deg).times(Math.PI).dividedBy(180);

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lng2 - lng1);

    const sinHalfPhi = new Decimal(Math.sin(deltaPhi.dividedBy(2).toNumber()));
    const sinHalfLambda = new Decimal(Math.sin(deltaLambda.dividedBy(2).toNumber()));
    const cosPhi1 = new Decimal(Math.cos(phi1.toNumber()));
    const cosPhi2 = new Decimal(Math.cos(phi2.toNumber()));

    // a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
    const a = sinHalfPhi
      .times(sinHalfPhi)
      .plus(cosPhi1.times(cosPhi2).times(sinHalfLambda).times(sinHalfLambda));

    const aClamped = Decimal.min(1.0, Decimal.max(0.0, a));
    const sqrtA = new Decimal(Math.sqrt(aClamped.toNumber()));
    const sqrtOneMinusA = new Decimal(Math.sqrt(new Decimal(1.0).minus(aClamped).toNumber()));

    // c = 2 * atan2(√a, √(1-a))
    const c = new Decimal(2).times(Math.atan2(sqrtA.toNumber(), sqrtOneMinusA.toNumber()));

    return rKm.times(c).toDecimalPlaces(2);
  }

  /**
   * Calculates estimated time of arrival (ETA) in minutes using strict Decimal.js
   */
  public static calculateEtaMinutes(
    distanceKm: DecimalInstance,
    speedKmh: number = 45
  ): DecimalInstance {
    const effectiveSpeed = new Decimal(Math.max(15, speedKmh));
    // ETA = (distance / speed) * 60
    return distanceKm.dividedBy(effectiveSpeed).times(60).toDecimalPlaces(1);
  }

  /**
   * Evaluates if a moving truck is within proximity of a critical dock hotspot and sends urgent alerts
   */
  public static async evaluateApproachingHotspot(
    params: HotspotProximityEvaluationParams
  ): Promise<HotspotAlertDispatchResult> {
    const {
      truckId,
      latitude,
      longitude,
      speedKmh = 45,
      driverId,
      tripId,
      truckPlate = 'TRK-UNKNOWN',
      forceBypassCooldown = false,
    } = params;

    const supabase = await createClient();

    // 1. Resolve active trip and driver information if not supplied
    let resolvedTripId = tripId ? Number(tripId) : 0;
    let resolvedTripNumber = `TRIP-${resolvedTripId || 'ACT'}`;
    let resolvedDriverId = driverId ? String(driverId) : '';
    let driverName = 'سائق الأسطول الدولي (Conducteur)';
    let driverPhone = '+212600112233';
    let driverLocale: WhatsAppLocale = 'ar';
    let trailerPlate = 'MA-R-8821';

    if (!resolvedTripId || !resolvedDriverId) {
      try {
        const { data: activeTrip } = await supabase
          .from('trip_orders')
          .select('id, driver_id, status, drivers(id, full_name, phone_number, preferred_language), trucks(plate_number)')
          .eq('truck_id', truckId)
          .in('status', ['in_transit', 'loading', 'customs_export'])
          .order('departure_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeTrip) {
          resolvedTripId = activeTrip.id;
          resolvedTripNumber = `TRIP-${activeTrip.id}`;
          if (activeTrip.driver_id) resolvedDriverId = String(activeTrip.driver_id);
          const drv = activeTrip.drivers as any;
          if (drv?.full_name) driverName = drv.full_name;
          if (drv?.phone_number) driverPhone = drv.phone_number;
          if (drv?.preferred_language) {
            const lang = drv.preferred_language.toLowerCase();
            if (lang.includes('fr')) driverLocale = 'fr';
            else if (lang.includes('es')) driverLocale = 'es';
          }
          const trk = activeTrip.trucks as any;
          if (trk?.plate_number) trailerPlate = trk.plate_number;
        }
      } catch {
        // Fallback safely in testing environments
      }
    }

    // 2. Fetch known clusters or default critical hubs catalog
    const { clusters } = DockThermalRiskService.clusterDockArrivals([]);

    // 3. Find closest critical hotspot or monitored hub
    let closestCandidate: {
      dock: DockRiskCluster;
      distanceKm: DecimalInstance;
      etaMins: DecimalInstance;
    } | null = null;

    for (const dock of clusters) {
      const isCriticalOrWatch =
        dock.metrics.dviScore >= CRITICAL_DVI_THRESHOLD ||
        dock.watchStatus === 'blacklisted' ||
        dock.watchStatus === 'monitored';

      if (!isCriticalOrWatch) continue;

      const dist = this.calculateHaversineDistanceKm(
        latitude,
        longitude,
        dock.coordinates.lat,
        dock.coordinates.lng
      );
      const eta = this.calculateEtaMinutes(dist, speedKmh);

      if (!closestCandidate || dist.lessThan(closestCandidate.distanceKm)) {
        closestCandidate = { dock, distanceKm: dist, etaMins: eta };
      }
    }

    if (!closestCandidate) {
      return {
        evaluated: true,
        approachingHotspot: false,
        dispatched: false,
      };
    }

    const { dock, distanceKm, etaMins } = closestCandidate;
    const distNum = distanceKm.toNumber();
    const etaNum = etaMins.toNumber();

    // Check if within alert proximity horizon (<= 15 km or <= 30 mins)
    const isWithinProximity =
      distNum <= PROXIMITY_DISTANCE_THRESHOLD_KM || etaNum <= PROXIMITY_ETA_THRESHOLD_MINUTES;

    if (!isWithinProximity) {
      return {
        evaluated: true,
        approachingHotspot: false,
        dispatched: false,
      };
    }

    // 4. Cooldown and Idempotency Guard
    const idempotencyKey = `hotspot_alert_${resolvedTripId || truckId}_${dock.dockId}`;
    const now = Date.now();
    const lastAlertTime = HOTSPOT_ALERT_CACHE.get(idempotencyKey);

    if (!forceBypassCooldown && lastAlertTime && now - lastAlertTime < HOTSPOT_ALERT_COOLDOWN_MS) {
      return {
        evaluated: true,
        approachingHotspot: true,
        dispatched: false,
        cooldownActive: true,
      };
    }

    // 5. Construct Mandatory Driver Cooling Protocols
    const mandatoryProtocols: MandatoryDriverCoolingProtocols = {
      lockContinuousRunMode: true,
      disallowCycleSentry: true,
      preCoolingMandatory: true,
      curtainProtocol: true,
      keepDoorsSealedUntilDocked: true,
      targetTempVerification: true,
    };

    const alertPayload: DriverHotspotUrgentAlertPayload = {
      alertId: `alert-${now}-${dock.dockId}`,
      driverId: resolvedDriverId || 'unknown',
      driverName,
      driverPhone,
      tripId: resolvedTripId,
      tripNumber: resolvedTripNumber,
      truckPlate,
      trailerPlate,
      dockId: dock.dockId,
      dockName: dock.dockName,
      facilityOrPort: dock.facilityOrPort,
      city: dock.city,
      countryCode: dock.countryCode,
      dviScore: dock.metrics.dviScore,
      riskLevel: dock.riskLevel,
      watchStatus: dock.watchStatus,
      currentLat: latitude,
      currentLng: longitude,
      speedKmh,
      distanceKm: distNum,
      etaMinutes: etaNum,
      cargoCategories: ['deep_frozen', 'fresh_produce', 'pharma_cold'],
      mandatoryProtocols,
      localizedActions: WhatsAppHotspotAlertTemplates.getLocalizedActionPoints(driverLocale),
      alertTimestamp: new Date().toISOString(),
      idempotencyKey,
      locale: driverLocale,
    };

    // 6. Build Message Content & Dispatch
    const messageText = WhatsAppHotspotAlertTemplates.buildDriverAlertMessage(alertPayload);
    const isLiveDispatch = process.env.WHATSAPP_LIVE_DISPATCH === 'true';
    let messageId = `sim_${now}_${Math.random().toString(36).substring(2, 9)}`;
    let simulated = !isLiveDispatch;

    try {
      if (isLiveDispatch) {
        const { sendWhatsAppText } = await import('@/features/whatsapp/services/whatsapp-meta-client');
        const sendRes = await sendWhatsAppText({
          to: driverPhone,
          message: messageText,
          auditEntity: {
            type: 'dock_hotspot_alert',
            id: resolvedTripId || truckId,
          },
        });
        if (sendRes?.success) {
          messageId = (sendRes as any).messageId || `live_${now}`;
          simulated = false;
        }
      }
    } catch (sendErr) {
      console.warn('Live WhatsApp send error, keeping simulation mode:', sendErr);
      simulated = true;
    }

    // Update cooldown cache
    HOTSPOT_ALERT_CACHE.set(idempotencyKey, now);

    // 7. Security Audit Trail & Log
    try {
      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'dock_hotspot_alert',
        entityId: `${resolvedTripId}_${dock.dockId}`,
        reason: `تنبيه اقتراب استباقي للسائق من بؤرة حرجة: ${dock.dockName} (DVI: ${dock.metrics.dviScore}) على بعد ${distNum} كم`,
        newData: {
          truckId,
          driverPhone,
          dockId: dock.dockId,
          distanceKm: distNum,
          etaMinutes: etaNum,
          messageId,
          simulated,
        },
      });

      // Save into whatsapp_message_logs
      await supabase.from('whatsapp_message_logs').insert({
        phone_number: driverPhone,
        message_type: 'hotspot_urgent_alert',
        direction: 'outbound',
        status: simulated ? 'simulated' : 'sent',
        message_body: messageText,
        whatsapp_message_id: messageId,
        metadata: {
          alertPayload,
          simulated,
          cooldownMs: HOTSPOT_ALERT_COOLDOWN_MS,
        },
      });
    } catch {
      // Non-blocking log persistence
    }

    return {
      evaluated: true,
      approachingHotspot: true,
      dispatched: true,
      cooldownActive: false,
      alertPayload,
      messageId,
      simulated,
    };
  }
}

