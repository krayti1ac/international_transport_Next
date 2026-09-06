'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import type { FinePenalty, Driver } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface DriverRiskProfile {
  driverId: number;
  driverName: string;
  safetyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalFinesCount: number;
  pendingDeductionAmountMAD: number;
  totalFinesAmountMAD: number;
  fines: FinePenalty[];
}

export async function createFinePenalty(input: {
  driverId: number;
  driverName: string;
  tripOrderId?: number | null;
  amount: number;
  currency: string;
  fineType: string;
  description?: string;
}): Promise<{ success: boolean; data?: FinePenalty; error?: string }> {
  try {
    const supabase = await createClient();

    const payload = {
      driver_id: input.driverId,
      driver_name: input.driverName,
      trip_order_id: input.tripOrderId || null,
      amount: new Decimal(input.amount).toNumber(),
      currency: input.currency || 'MAD',
      fine_type: input.fineType,
      description: input.description || null,
      status: 'confirmed',
      deducted_from_settlement: false,
      created_at: new Date().toISOString(),
    };

    const { data: fine, error } = await supabase
      .from('fine_penalties')
      .insert(payload)
      .select()
      .single<FinePenalty>();

    if (error || !fine) throw error;

    await recordAuditLog({
      entityType: 'fine_penalty',
      entityId: fine.id,
      actionType: 'create',
      reason: `تسجيل مخالفة (${input.fineType}) بمبلغ ${input.amount} ${input.currency} على السائق ${input.driverName}`,
      newData: payload,
    });

    const { data: driver } = await supabase
      .from('drivers')
      .select('phone')
      .eq('id', input.driverId)
      .single<Driver>();

    if (driver?.phone && process.env.WHATSAPP_API_TOKEN) {
      const msg = [
        `⚠️ *إشعار تسجيل مخالفة تشغيلية - Trans Bodanon*`,
        `السيد السائق: ${input.driverName}`,
        `---------------------------`,
        `📌 نوع المخالفة: ${input.fineType}`,
        `💰 القيمة المقيدة: ${input.amount} ${input.currency}`,
        input.tripOrderId ? `🚚 الرحلة رقم: #${input.tripOrderId}` : null,
        input.description ? `📝 التفاصيل: ${input.description}` : null,
        `---------------------------`,
        `تنبيه: سيتم إدراج هذه القيمة ضمن بنود الخصم في كشف التسوية الشهرية القادم.`,
      ]
        .filter(Boolean)
        .join('\n');

      await sendWhatsAppCloudMessage({ to: driver.phone, message: msg }).catch((wErr) =>
        console.warn('Driver fine WhatsApp alert warning:', wErr)
      );
    }

    return { success: true, data: fine };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تسجيل المخالفة';
    return { success: false, error: message };
  }
}

export async function getDriverRiskProfile(driverId: number): Promise<{
  success: boolean;
  data?: DriverRiskProfile;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const [driverRes, finesRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('id', driverId).single<Driver>(),
      supabase
        .from('fine_penalties')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false }),
    ]);

    if (driverRes.error || !driverRes.data) {
      return { success: false, error: 'تعذر العثور على بيانات السائق' };
    }

    const driver = driverRes.data;
    const fines = (finesRes.data || []) as FinePenalty[];

    let safetyScore = 100;
    let pendingDeduction = new Decimal(0);
    let totalFines = new Decimal(0);

    fines.forEach((f) => {
      const amt = new Decimal(f.amount || 0);
      totalFines = totalFines.plus(amt);

      if (!f.deducted_from_settlement) {
        pendingDeduction = pendingDeduction.plus(amt);
      }

      switch (f.fine_type) {
        case 'speeding':
          safetyScore -= 10;
          break;
        case 'overload':
          safetyScore -= 15;
          break;
        case 'tachograph':
          safetyScore -= 12;
          break;
        case 'customs':
          safetyScore -= 20;
          break;
        default:
          safetyScore -= 5;
      }
    });

    safetyScore = Math.max(10, Math.min(100, safetyScore));

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (safetyScore < 40) riskLevel = 'critical';
    else if (safetyScore < 65) riskLevel = 'high';
    else if (safetyScore < 85) riskLevel = 'medium';

    return {
      success: true,
      data: {
        driverId,
        driverName: driver.name,
        safetyScore,
        riskLevel,
        totalFinesCount: fines.length,
        pendingDeductionAmountMAD: pendingDeduction.toNumber(),
        totalFinesAmountMAD: totalFines.toNumber(),
        fines,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تقييم ملف مخاطر السائق';
    return { success: false, error: message };
  }
}

export async function processDriverSettlementPayout(input: {
  driverId: number;
  baseSalary: number;
  bonusAmount: number;
  advancesToDeduct: number;
  fineIdsToDeduct: number[];
  finesAmountToDeduct: number;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}): Promise<{ success: boolean; netPayout?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const base = new Decimal(input.baseSalary || 0);
    const bonus = new Decimal(input.bonusAmount || 0);
    const advances = new Decimal(input.advancesToDeduct || 0);
    const fines = new Decimal(input.finesAmountToDeduct || 0);

    const netPayout = base.plus(bonus).minus(advances).minus(fines);

    const now = new Date().toISOString();

    const { data: salaryRecord, error: salaryErr } = await supabase
      .from('driver_salaries')
      .insert({
        driver_id: input.driverId,
        amount: netPayout.toNumber(),
        currency: 'MAD',
        period_start: input.periodStart,
        period_end: input.periodEnd,
        status: 'paid',
        created_at: now,
      })
      .select()
      .single();

    if (salaryErr) throw salaryErr;

    if (input.fineIdsToDeduct.length > 0) {
      await supabase
        .from('fine_penalties')
        .update({
          deducted_from_settlement: true,
          deducted_at: now,
          status: 'deducted',
        })
        .in('id', input.fineIdsToDeduct);
    }

    await supabase.from('treasury_transactions').insert({
      type: 'salary',
      amount: netPayout.toNumber(),
      currency: 'MAD',
      description: input.notes || `صرف راتب وتسوية مستحقات السائق #${input.driverId} للفترة (${input.periodStart} إلى ${input.periodEnd}) - مخصوم منها سلف ومخالفات`,
      reference: `SAL-DRV-${input.driverId}-${Date.now().toString().slice(-4)}`,
      reconciliation_status: 'cleared',
    });

    await recordAuditLog({
      entityType: 'driver_salary_settlement',
      entityId: salaryRecord.id,
      actionType: 'create',
      reason: `اعتماد تسوية وراتب السائق #${input.driverId}: صافي الصرف ${netPayout.toNumber()} MAD (خصم مخالفات: ${fines.toNumber()} MAD)`,
      newData: { ...input, netPayout: netPayout.toNumber() },
    });

    return { success: true, netPayout: netPayout.toNumber() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تنفيذ تسوية الراتب';
    return { success: false, error: message };
  }
}
