'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import type { MaintenanceSchedule, Truck, Trailer } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface EnrichedMaintenanceSchedule extends MaintenanceSchedule {
  plateNumber: string;
  model: string;
  daysRemaining: number;
  urgency: 'overdue' | 'due_soon' | 'scheduled';
}

export async function getMaintenanceSchedules(): Promise<{
  success: boolean;
  data?: EnrichedMaintenanceSchedule[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const [schedulesRes, trucksRes, trailersRes] = await Promise.all([
      supabase
        .from('maintenance_schedules')
        .select('*')
        .eq('is_active', true)
        .order('scheduled_date', { ascending: true }),
      supabase.from('trucks').select('id, plate_number, model'),
      supabase.from('trailers').select('id, plate_number, model'),
    ]);

    if (schedulesRes.error) throw schedulesRes.error;

    const trucksMap = new Map<number, Truck>((trucksRes.data || []).map((t) => [t.id, t as Truck]));
    const trailersMap = new Map<number, Trailer>((trailersRes.data || []).map((tr) => [tr.id, tr as Trailer]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched: EnrichedMaintenanceSchedule[] = (schedulesRes.data || []).map((item) => {
      const isTruck = item.vehicle_type === 'truck';
      const vehicle = isTruck ? trucksMap.get(item.vehicle_id) : trailersMap.get(item.vehicle_id);

      const targetDate = new Date(item.scheduled_date);
      targetDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let urgency: 'overdue' | 'due_soon' | 'scheduled' = 'scheduled';
      if (diffDays < 0) {
        urgency = 'overdue';
      } else if (diffDays <= 14) {
        urgency = 'due_soon';
      }

      return {
        ...item,
        plateNumber: vehicle?.plate_number || `مركبة #${item.vehicle_id}`,
        model: vehicle?.model || 'غير محدد',
        daysRemaining: diffDays,
        urgency,
      };
    });

    return { success: true, data: enriched };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب جدول الصيانة الوقائية';
    return { success: false, error: message };
  }
}

export async function createMaintenanceSchedule(input: {
  vehicleType: 'truck' | 'trailer';
  vehicleId: number;
  maintenanceType: string;
  scheduledDate: string;
  amountEstimate?: number;
  currency?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: MaintenanceSchedule; error?: string }> {
  try {
    const supabase = await createClient();

    const payload = {
      vehicle_type: input.vehicleType,
      vehicle_id: input.vehicleId,
      maintenance_type: input.maintenanceType,
      scheduled_date: input.scheduledDate,
      amount_estimate: input.amountEstimate ? new Decimal(input.amountEstimate).toNumber() : 0,
      currency: input.currency || 'MAD',
      notes: input.notes || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('maintenance_schedules')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await recordAuditLog({
      entityType: 'maintenance_schedule',
      entityId: data.id,
      actionType: 'create',
      reason: `إضافة موعد صيانة وقائية (${input.maintenanceType}) للمركبة #${input.vehicleId}`,
      newData: payload,
    });

    return { success: true, data: data as MaintenanceSchedule };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تسجيل موعد الصيانة';
    return { success: false, error: message };
  }
}

export async function completeMaintenanceSchedule(input: {
  scheduleId: number;
  actualCost: number;
  actualDate?: string;
  repeatMonths?: number;
  providerName?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: schedule, error: fetchErr } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('id', input.scheduleId)
      .single<MaintenanceSchedule>();

    if (fetchErr || !schedule) {
      return { success: false, error: 'الموعد المجدول غير موجود' };
    }

    const execDate = input.actualDate || new Date().toISOString().split('T')[0];
    const cost = new Decimal(input.actualCost || 0).toNumber();

    if (schedule.vehicle_type === 'truck') {
      await supabase.from('truck_maintenance').insert({
        truck_id: schedule.vehicle_id,
        type: 'maintenance',
        expense_type: schedule.maintenance_type,
        amount: cost,
        currency: schedule.currency || 'MAD',
        maintenance_date: execDate,
        provider_name: input.providerName || 'ورشة معتمدة',
        description: `صيانة وقائية دورية: ${schedule.maintenance_type}${input.notes ? ` - ${input.notes}` : ''}`,
        payment_method: 'cash',
      });
    } else {
      await supabase.from('trailer_maintenance').insert({
        trailer_id: schedule.vehicle_id,
        type: schedule.maintenance_type,
        amount: cost,
        currency: schedule.currency || 'MAD',
        date: execDate,
        notes: `صيانة مقطورة دورية: ${schedule.maintenance_type}${input.notes ? ` - ${input.notes}` : ''}`,
        payment_method: 'cash',
      });
    }

    await supabase.from('treasury_transactions').insert({
      type: 'expense',
      amount: cost,
      currency: schedule.currency || 'MAD',
      description: `صيانة وقائية (${schedule.maintenance_type}) للمركبة #${schedule.vehicle_id}`,
      reference: `MAINT-SCHED-${schedule.id}`,
      reconciliation_status: 'cleared',
    });

    if (input.repeatMonths && input.repeatMonths > 0) {
      const nextDate = new Date(execDate);
      nextDate.setMonth(nextDate.getMonth() + input.repeatMonths);

      await supabase
        .from('maintenance_schedules')
        .update({
          scheduled_date: nextDate.toISOString().split('T')[0],
          parent_record_id: schedule.id,
        })
        .eq('id', schedule.id);
    } else {
      await supabase
        .from('maintenance_schedules')
        .update({ is_active: false })
        .eq('id', schedule.id);
    }

    await recordAuditLog({
      entityType: 'maintenance_schedule',
      entityId: schedule.id,
      actionType: 'update',
      reason: `إتمام الصيانة الوقائية (${schedule.maintenance_type}) بتكلفة ${cost} ${schedule.currency}`,
      newData: { actualCost: cost, completedDate: execDate },
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل إتمام الصيانة الوقائية';
    return { success: false, error: message };
  }
}

export async function deleteMaintenanceSchedule(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('maintenance_schedules').delete().eq('id', id);
    if (error) throw error;

    await recordAuditLog({
      entityType: 'maintenance_schedule',
      entityId: id,
      actionType: 'soft_delete',
      reason: `حذف موعد الصيانة المجدول #${id}`,
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل حذف موعد الصيانة';
    return { success: false, error: message };
  }
}
