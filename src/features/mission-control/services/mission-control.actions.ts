'use server';

import { fetchMissionControlData } from './mission-control.service';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendCriticalFleetAlertPushNotification } from '@/features/push/services/push-notifications.actions';
import { recordAuditLog } from '@/lib/audit.server';
import type { MissionControlDashboardData } from '../types';

export async function getMissionControlDataAction(): Promise<{
  success: boolean;
  data?: MissionControlDashboardData;
  error?: string;
}> {
  try {
    const data = await fetchMissionControlData();
    return { success: true, data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل جلب بيانات غرفة العمليات الميدانية';
    return { success: false, error: errorMsg };
  }
}

export async function dispatchIncidentEmergencyAlertAction(params: {
  alertId: string;
  truckPlate: string;
  driverId?: number;
  driverPhone?: string;
  alertType: string;
  message: string;
}): Promise<{
  success: boolean;
  whatsappDispatched?: boolean;
  pushDispatched?: boolean;
  error?: string;
}> {
  try {
    const { truckPlate, driverPhone, driverId, message, alertId, alertType } = params;
    let whatsappDispatched = false;
    let pushDispatched = false;

    // 1. WhatsApp Dispatch to Driver or Dispatcher Alert Phone
    const targetPhone = driverPhone || process.env.ADMIN_ALERT_PHONE || '212694585307';
    if (targetPhone) {
      try {
        const waMsg =
          `🚨 *إنذار طوارئ غرفة العمليات — Trans Bodanon TMS*\n` +
          `-----------------------------------\n` +
          `🚛 الشاحنة: *${truckPlate}*\n` +
          `⚠️ طبيعة الإنذار: *${alertType}*\n` +
          `📋 التفاصيل: ${message}\n\n` +
          `⏱️ *مطلوب التدخل الفوري*: التحقق من إغلاق الحاوية أو ضبط تشغيل وحدة التبريد Frigo.`;

        await sendWhatsAppCloudMessage({
          to: targetPhone,
          message: waMsg,
          auditEntity: {
            type: 'mission_control_incidents',
            id: alertId,
          },
        });
        whatsappDispatched = true;
      } catch (waErr) {
        console.warn('Failed to send Mission Control emergency WhatsApp alert:', waErr);
      }
    }

    // 2. Web Push Notification to Driver App
    if (driverId) {
      try {
        await sendCriticalFleetAlertPushNotification({
          driverId,
          alertType: 'frigo_drift',
          message: `🚨 إنذار طوارئ للشاحنة ${truckPlate}: ${message}`,
        });
        pushDispatched = true;
      } catch (pushErr) {
        console.warn('Failed to send Mission Control Push notification:', pushErr);
      }
    }

    // 3. Security Audit Log
    try {
      await recordAuditLog({
        entityType: 'mission_control',
        entityId: alertId,
        actionType: 'security_alert',
        reason: `بث إنذار طوارئ ميداني للشاحنة [${truckPlate}] عبر غرفة العمليات`,
        newData: {
          alertId,
          truckPlate,
          alertType,
          targetPhone,
          driverId,
          message,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record Mission Control audit log:', auditErr);
    }

    return {
      success: true,
      whatsappDispatched,
      pushDispatched,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل بث إنذار الطوارئ';
    return { success: false, error: errorMsg };
  }
}

export async function acknowledgeIncidentAlertAction(
  alertId: string,
  truckPlate: string,
  resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await recordAuditLog({
      entityType: 'mission_control',
      entityId: alertId,
      actionType: 'update',
      reason: `تأكيد ومعالجة الإنذار الميداني [${alertId}] للشاحنة [${truckPlate}]`,
      newData: {
        alertId,
        truckPlate,
        resolutionNotes: resolutionNotes || 'تم التحقق والمعالجة من قبل مشغل غرفة العمليات',
        acknowledgedAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل تأكيد الإنذار';
    return { success: false, error: errorMsg };
  }
}

