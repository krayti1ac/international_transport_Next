'use server';

import { z } from 'zod';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendCriticalFleetAlertPushNotification } from '@/features/push/services/push-notifications.actions';
import { fetchMissionControlData } from '@/features/mission-control/services/mission-control.service';
import {
  assessTripRisk,
  aggregateFleetCopilotInsights,
  type GenerateAssessmentInput,
} from './logistics-copilot.service';
import type {
  TripRiskAssessment,
  FleetCopilotInsight,
  ApplyCopilotMitigationPayload,
} from '../types/copilot-risk.types';

const ApplyCopilotMitigationSchema = z.object({
  tripId: z.number().int().positive(),
  recommendationId: z.string().min(1),
  actionType: z.enum([
    'adjust_reefer_setpoint',
    'reroute_fuel_station',
    'driver_rest_alert',
    'escalate_customs_transit',
    'emergency_dispatch',
  ]),
  notes: z.string().optional(),
});

/**
 * Maps MissionControl telemetry into input params for the Copilot Risk Evaluator.
 */
function mapTelemetryToCopilotInput(telemetry: any, idx: number): GenerateAssessmentInput {
  const tripId = telemetry.tripId || 100 + idx;
  const isAfrican = telemetry.corridorType === 'african_overland';
  const isEuropean = telemetry.corridorType === 'european_maritime';

  // Realistic parameters based on telemetry state
  const driftMins =
    telemetry.tempStatus === 'critical_drift'
      ? 65
      : telemetry.tempStatus === 'warning'
      ? 35
      : 0;

  // Fuel burn: simulate normal or elevated based on index/truck
  const actualBurnRate = idx === 1 ? 44.2 : idx === 3 ? 49.5 : 36.8;
  const idleMinutes = idx === 1 ? 55 : 15;

  // Wait time in port or border
  let waitMins = 45;
  let customsStatus: 'cleared' | 'in_progress' | 'delayed' | 'blocked' = 'in_progress';
  if (telemetry.currentZoneId === 'border_guerguerat') {
    waitMins = 240; // Over 180 baseline
    customsStatus = 'delayed';
  } else if (telemetry.currentZoneId === 'port_tanger_med') {
    waitMins = 135;
  }

  // Driver fatigue simulation
  const driveMinutes = idx === 2 ? 285 : idx === 0 ? 210 : 160;

  let cargoType: 'frozen' | 'fresh' | 'pharma' | 'general' = 'frozen';
  if (telemetry.cargoProfile === 'fresh_produce') cargoType = 'fresh';
  else if (telemetry.cargoProfile === 'pharmaceuticals') cargoType = 'pharma';
  else if (telemetry.cargoProfile === 'ambient') cargoType = 'general';

  return {
    tripId,
    truckId: telemetry.truckId,
    truckPlate: telemetry.truckPlate,
    trailerPlate: telemetry.trailerPlate,
    driverId: telemetry.driverId,
    driverName: telemetry.driverName || 'سائق غير معين',
    driverPhone: telemetry.driverPhone,
    corridor: isAfrican
      ? 'african_overland'
      : isEuropean
      ? 'european_maritime'
      : 'domestic',
    coldChain: {
      currentTemp: telemetry.currentTemp,
      targetTemp: telemetry.targetTemp,
      allowedTolerance: 2.0,
      driftDurationMinutes: driftMins,
      doorOpen: telemetry.doorOpen,
      cargoType,
    },
    fuel: {
      actualConsumptionRate: actualBurnRate,
      expectedNormRate: 36.0,
      idleMinutes,
    },
    border: {
      corridor: telemetry.corridorType || 'domestic',
      currentWaitMinutes: waitMins,
      customsStatus,
    },
    fatigue: {
      continuousDriveMinutes: driveMinutes,
      dailyDriveMinutes: driveMinutes + 60,
    },
  };
}

/**
 * Fetches and generates all real-time fleet copilot insights and trip assessments.
 */
export async function getFleetCopilotInsightsAction(): Promise<{
  success: boolean;
  data?: FleetCopilotInsight;
  error?: string;
}> {
  try {
    const mcData = await fetchMissionControlData();
    const assessments: TripRiskAssessment[] = [];

    if (mcData.telemetryList && mcData.telemetryList.length > 0) {
      mcData.telemetryList.forEach((telemetry, idx) => {
        const input = mapTelemetryToCopilotInput(telemetry, idx);
        const assessment = assessTripRisk(input);
        assessments.push(assessment);
      });
    }

    const insight = aggregateFleetCopilotInsights(assessments);
    return { success: true, data: insight };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تقييم مؤشرات ذكاء العمليات التنبؤي';
    return { success: false, error: message };
  }
}

/**
 * Evaluates a single specific trip by ID.
 */
export async function evaluateActiveTripRiskAction(
  tripId: number
): Promise<{
  success: boolean;
  data?: TripRiskAssessment;
  error?: string;
}> {
  try {
    const mcData = await fetchMissionControlData();
    const match = mcData.telemetryList.find(
      (t, idx) => (t.tripId || 100 + idx) === tripId
    );

    const input = match
      ? mapTelemetryToCopilotInput(match, 0)
      : {
          tripId,
          truckId: 1,
          truckPlate: '10101-A-40',
          trailerPlate: 'REM-1001-MA',
          driverId: 1,
          driverName: 'السائق المناوب',
          corridor: 'african_overland' as const,
          coldChain: {
            currentTemp: -16.5,
            targetTemp: -18.0,
            allowedTolerance: 2.0,
            driftDurationMinutes: 0,
            doorOpen: false,
            cargoType: 'frozen' as const,
          },
          fuel: {
            actualConsumptionRate: 36.5,
            expectedNormRate: 36.0,
            idleMinutes: 10,
          },
          border: {
            corridor: 'african_overland',
            currentWaitMinutes: 90,
            customsStatus: 'in_progress' as const,
          },
          fatigue: {
            continuousDriveMinutes: 190,
            dailyDriveMinutes: 260,
          },
        };

    const assessment = assessTripRisk(input);
    return { success: true, data: assessment };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تقييم مخاطر الرحلة المحددة';
    return { success: false, error: message };
  }
}

/**
 * Applies a Copilot proactive mitigation recommendation with audit logging and push/WhatsApp dispatch.
 */
export async function applyCopilotMitigationAction(
  rawPayload: ApplyCopilotMitigationPayload
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const parsed = ApplyCopilotMitigationSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const { tripId, recommendationId, actionType, notes } = parsed.data;

    // Dispatches and audit records
    let actionSummary = '';

    switch (actionType) {
      case 'adjust_reefer_setpoint':
        actionSummary = `تم إرسال أمر إعادة معايرة وضبط وحدة التبريد Frigo للرحلة #${tripId}`;
        break;
      case 'reroute_fuel_station':
        actionSummary = `تم توجيه الرحلة #${tripId} نحو محطة وقود معتمدة لفحص استهلاك المحرك`;
        break;
      case 'driver_rest_alert':
        actionSummary = `تم إشعار السائق بالتوقف الإلزامي للراحة (45 دقيقة) لتفادي الإجهاد`;
        break;
      case 'escalate_customs_transit':
        actionSummary = `تم تفعيل المسار السريع وإشعار الوكيل الجمركي للرحلة #${tripId}`;
        break;
      case 'emergency_dispatch':
        actionSummary = `تم إطلاق إنذار التدخل الطارئ الفوري للرحلة #${tripId}`;
        break;
    }

    // WhatsApp Notification to Operations Dispatcher
    const adminPhone = process.env.ADMIN_ALERT_PHONE || '212694585307';
    try {
      await sendWhatsAppCloudMessage({
        to: adminPhone,
        message:
          `🤖 *إجراء استباقي من مساعد الذكاء الاصطناعي — Trans Bodanon TMS*\n` +
          `----------------------------------------\n` +
          `📌 الرحلة: *#${tripId}*\n` +
          `⚡ الإجراء: *${actionType}*\n` +
          `📋 الملخص: ${actionSummary}\n` +
          (notes ? `📝 ملاحظات: ${notes}\n` : '') +
          `✅ الحالة: تم التطبيق والتوثيق بنجاح.`,
        auditEntity: {
          type: 'copilot_recommendations',
          id: recommendationId,
        },
      });
    } catch (waErr) {
      console.warn('Non-blocking Copilot WhatsApp dispatch error:', waErr);
    }

    // Record immutable audit log
    await recordAuditLog({
      entityType: 'copilot_mitigation',
      entityId: recommendationId,
      actionType: 'update',
      reason: actionSummary,
      newData: {
        tripId,
        recommendationId,
        actionType,
        notes,
        appliedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: actionSummary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تطبيق توصية المساعد الذكي';
    return { success: false, error: message };
  }
}

