'use server';

import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendCriticalFleetAlertPushNotification } from '@/features/push/services/push-notifications.actions';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Operational thresholds
export const DRIFT_TEMP_THRESHOLD_CELSIUS = 2.0; // > 2°C excursion from target setpoint
export const DRIFT_DURATION_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes
export const DRIFT_ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes cooldown

export interface DriftTrackingState {
  truckId: number;
  tripId?: number;
  driverId?: number;
  targetTemp: number;
  lastRecordedTemp: number;
  driftStartTime: number; // timestamp in ms
  lastAlertTime?: number; // timestamp in ms
  isAlertTriggered: boolean;
}

// In-memory tracker for active temperature excursions across trucks
const activeDrifts = new Map<number, DriftTrackingState>();

export function resetColdChainDriftTracking(truckId?: number) {
  if (truckId !== undefined) {
    activeDrifts.delete(truckId);
  } else {
    activeDrifts.clear();
  }
}

export function getColdChainDriftState(truckId: number): DriftTrackingState | undefined {
  return activeDrifts.get(truckId);
}

/**
 * Monitors and evaluates cold chain temperature drift in real-time.
 * If temperature excursion exceeds 2.0°C for > 45 minutes, triggers critical alarms via Push & WhatsApp.
 */
export async function evaluateColdChainTemperatureDrift(params: {
  truckId: number;
  currentTemp: number;
  targetTemp?: number;
  timestampMs?: number;
  driverId?: number;
  tripId?: number;
  truckPlate?: string;
}): Promise<{
  isDrifting: boolean;
  driftDurationMinutes: number;
  alertDispatched: boolean;
  deviationCelsius: number;
  severity: 'normal' | 'warning' | 'critical';
}> {
  const { truckId, currentTemp } = params;
  const nowMs = params.timestampMs || Date.now();
  // Default target temperature for international transport: -18.0°C for frozen frigo, or +4.0°C for fresh produce
  const targetTemp = params.targetTemp !== undefined ? params.targetTemp : -18.0;

  // Calculate absolute deviation with Decimal.js
  const curDec = new Decimal(currentTemp);
  const targetDec = new Decimal(targetTemp);
  const diffDec = curDec.minus(targetDec).abs();
  const deviationCelsius = Number(diffDec.toFixed(2));

  // Case 1: Temperature is within safe boundary (<= 2°C deviation)
  if (diffDec.lessThanOrEqualTo(DRIFT_TEMP_THRESHOLD_CELSIUS)) {
    const existing = activeDrifts.get(truckId);
    if (existing && existing.isAlertTriggered) {
      // Temperature recovered back into safe bounds!
      try {
        await recordAuditLog({
          entityType: 'cold_chain',
          entityId: String(truckId),
          actionType: 'update',
          reason: `تعافي درجة حرارة سلسلة التبريد للشاحنة #${truckId} وعودتها للمجال الآمن (${currentTemp}°C)`,
          newData: {
            truckId,
            currentTemp,
            targetTemp,
            recoveredAt: new Date(nowMs).toISOString(),
          },
        });
      } catch {
        // Non-blocking
      }
    }
    activeDrifts.delete(truckId);
    return {
      isDrifting: false,
      driftDurationMinutes: 0,
      alertDispatched: false,
      deviationCelsius,
      severity: 'normal',
    };
  }

  // Case 2: Temperature is drifting (> 2°C excursion)
  let driftState = activeDrifts.get(truckId);

  if (!driftState) {
    // New drift detected: start timer
    driftState = {
      truckId,
      tripId: params.tripId,
      driverId: params.driverId,
      targetTemp,
      lastRecordedTemp: currentTemp,
      driftStartTime: nowMs,
      isAlertTriggered: false,
    };
    activeDrifts.set(truckId, driftState);
  } else {
    // Update tracking state
    driftState.lastRecordedTemp = currentTemp;
    if (params.tripId) driftState.tripId = params.tripId;
    if (params.driverId) driftState.driverId = params.driverId;
  }

  const driftDurationMs = Math.max(0, nowMs - driftState.driftStartTime);
  const driftDurationMinutes = Math.round(driftDurationMs / (60 * 1000));

  // If excursion is under 45 minutes: warning state, no alarm dispatched yet
  if (driftDurationMs < DRIFT_DURATION_THRESHOLD_MS) {
    return {
      isDrifting: true,
      driftDurationMinutes,
      alertDispatched: false,
      deviationCelsius,
      severity: 'warning',
    };
  }

  // Excursion reached or exceeded 45 minutes: CRITICAL STATE!
  const hasCooldownPassed =
    !driftState.lastAlertTime || nowMs - driftState.lastAlertTime >= DRIFT_ALERT_COOLDOWN_MS;

  if (!hasCooldownPassed) {
    return {
      isDrifting: true,
      driftDurationMinutes,
      alertDispatched: false,
      deviationCelsius,
      severity: 'critical',
    };
  }

  // Dispatch critical alerts
  let alertDispatched = false;
  const plateText = params.truckPlate || `#${truckId}`;
  const alertMsg = `⚠️ إنذار حرج: انحراف حرارة حاوية التبريد للشاحنة ${plateText} عن المعيار المستهدف (> 2°C) حيث بلغت ${currentTemp}°C (المستهدف ${targetTemp}°C) لمدة ${driftDurationMinutes} دقيقة متواصلة. يلزم فحص وحدة Frigo فوراً لحماية الشحنة.`;

  // 1. Web Push Notification to Driver
  if (params.driverId) {
    try {
      await sendCriticalFleetAlertPushNotification({
        driverId: params.driverId,
        alertType: 'frigo_drift',
        message: alertMsg,
      });
      alertDispatched = true;
    } catch (pushErr) {
      console.warn('Failed to send cold chain push notification:', pushErr);
    }
  }

  // 2. WhatsApp Notification to Operations / Dispatcher
  try {
    const adminPhone = process.env.ADMIN_ALERT_PHONE || '212694585307';
    await sendWhatsAppCloudMessage({
      to: adminPhone,
      message: `🚨 *إنذار طوارئ: انحراف حرارة سلسلة التبريد (Cold Chain Drift)*\n---------------------------\n🚛 الشاحنة: *${plateText}*\n❄️ الحرارة الحالية: *${currentTemp}°C*\n🎯 الحرارة المستهدفة: *${targetTemp}°C*\n⏱️ مدة الانحراف: *${driftDurationMinutes} دقيقة*\n${params.tripId ? `📦 الرحلة: #${params.tripId}\n` : ''}⚠️ *الإجراء المطلوب*: التواصل مع السائق فوراً وفحص تشغيل محرك Frigo وضغط الفريون.`,
    });
    alertDispatched = true;
  } catch (waErr) {
    console.warn('Failed to send cold chain WhatsApp message:', waErr);
  }

  // 3. Operational Audit Log
  try {
    await recordAuditLog({
      entityType: 'cold_chain',
      entityId: String(truckId),
      actionType: 'security_alert',
      reason: `انحراف حرارة حاوية التبريد (>2°C) للشاحنة ${plateText} لمدة ${driftDurationMinutes} دقيقة`,
      newData: {
        truckId,
        tripId: params.tripId,
        driverId: params.driverId,
        currentTemp,
        targetTemp,
        deviationCelsius,
        driftDurationMinutes,
        timestamp: new Date(nowMs).toISOString(),
      },
    });
  } catch (auditErr) {
    console.warn('Failed to record cold chain audit log:', auditErr);
  }

  driftState.lastAlertTime = nowMs;
  driftState.isAlertTriggered = true;

  return {
    isDrifting: true,
    driftDurationMinutes,
    alertDispatched,
    deviationCelsius,
    severity: 'critical',
  };
}

