'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { auditFuelReceipt, type FuelAuditInput, type FuelAuditResult } from './fuel-fraud-detector.actions';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { recordAuditLog } from '@/lib/audit.server';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FuelAuditTriggerResponse {
  success: boolean;
  isFlagged: boolean;
  score: number;
  anomaliesCount: number;
  auditResult?: FuelAuditResult;
  alertDispatched?: boolean;
  error?: string;
}

/**
 * Triggers automated cross-audit of a fuel receipt against live GPS locations and corridor stations
 */
export async function triggerFuelReceiptAudit(
  input: FuelAuditInput,
  options?: { notifyWhatsAppPhone?: string }
): Promise<FuelAuditTriggerResponse> {
  try {
    const supabase = await createClient();

    // 1. Fetch truck metadata
    const { data: truck } = await supabase
      .from('trucks')
      .select('id, plate_number, model')
      .eq('id', input.truckId)
      .maybeSingle();

    const plateNumber = truck?.plate_number || `شاحنة #${input.truckId}`;

    // 2. Run the audit engine
    const auditResult = await auditFuelReceipt(input);

    const isFlagged = !auditResult.isClean || auditResult.trustScore < 70;
    let alertDispatched = false;

    // 3. If suspicious anomalies are found, record security log and send WhatsApp alert
    if (isFlagged) {
      const topAnomalies = auditResult.anomalies.map((a) => a.titleAr).join('، ');

      await recordAuditLog({
        actionType: 'security_alert',
        entityType: 'fuel_receipt_fraud_detector',
        entityId: input.receiptId ? input.receiptId.toString() : input.truckId.toString(),
        reason: `FUEL_ANOMALY: Score ${auditResult.trustScore}/100, Anomalies: ${topAnomalies}`,
        newData: {
          truckId: input.truckId,
          plateNumber,
          liters: input.liters,
          amount: input.amount,
          date: input.date,
          trustScore: auditResult.trustScore,
          anomalies: auditResult.anomalies,
        },
      });

      // Dispatch WhatsApp notification if phone provided or available in env
      const targetPhone = options?.notifyWhatsAppPhone || process.env.FLEET_ALERT_WHATSAPP_PHONE;
      if (targetPhone) {
        const message =
          `⚠️ اشتباه تلاعب بالوقود - Trans Bodanon TMS\n` +
          `الشاحنة: ${plateNumber}\n` +
          `التاريخ: ${input.date}\n` +
          `الكمية: ${input.liters} لتر | المبلغ: ${input.amount} ${input.currency || 'MAD'}\n` +
          `مؤشر الثقة: ${auditResult.trustScore} / 100\n\n` +
          `المخالفات المرصودة:\n` +
          auditResult.anomalies.map((a, idx) => `${idx + 1}. ${a.titleAr}: ${a.descriptionAr}`).join('\n') +
          `\n\nيرجى مراجعة وصل المحروقات وتدقيق المسار الجغرافي للشاحنة.`;

        await sendWhatsAppCloudMessage({
          to: targetPhone,
          message,
        });

        alertDispatched = true;
      }
    }

    return {
      success: true,
      isFlagged,
      score: auditResult.trustScore,
      anomaliesCount: auditResult.anomalies.length,
      auditResult,
      alertDispatched,
    };
  } catch (error) {
    console.error('Error in triggerFuelReceiptAudit:', error);
    return {
      success: false,
      isFlagged: false,
      score: 0,
      anomaliesCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
