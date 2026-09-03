'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import type { Driver, TripOrder, Advance, FinePenalty, DriverSalary, CashBox } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface PayrollCalculationResult {
  driver: Driver;
  baseSalary: any;
  bonusPercentage: number;
  trips: TripOrder[];
  totalTripsRevenue: any;
  totalBonus: any;
  advances: Advance[];
  totalAdvances: any;
  fines: FinePenalty[];
  totalFines: any;
  netPay: any;
  periodStart: string;
  periodEnd: string;
}

export interface PaySalaryInput {
  driverId: number;
  netPay: number | string | any;
  cashBoxId: number;
  month: number;
  year: number;
  details?: string;
}

export async function calculateDriverPayroll(
  driverId: number,
  month: number,
  year: number
): Promise<{ success: boolean; data?: PayrollCalculationResult; error?: string }> {
  try {
    const supabase = await createClient();

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single<Driver>();

    if (driverError || !driver) {
      return { success: false, error: 'السائق غير موجود' };
    }

    const { data: trips, error: tripsError } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['completed', 'settled'])
      .gte('departure_date', periodStart)
      .lte('departure_date', periodEnd)
      .order('departure_date', { ascending: true });

    if (tripsError) {
      return { success: false, error: tripsError.message };
    }

    const { data: advances, error: advancesError } = await supabase
      .from('advances')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (advancesError) {
      return { success: false, error: advancesError.message };
    }

    const { data: fines, error: finesError } = await supabase
      .from('fine_penalties')
      .select('*')
      .eq('driver_id', driverId)
      .eq('deducted_from_settlement', false);

    if (finesError) {
      return { success: false, error: finesError.message };
    }

    const baseSalary = parseFloat(new Decimal(driver.base_salary || 0).toFixed(2));
    const bonusPercentage = driver.bonus_percentage || 0;
    const totalTripsRevenue = parseFloat(
      (trips || []).reduce(
        (sum, t) => sum.plus(new Decimal(t.price || 0)),
        new Decimal(0)
      ).toFixed(2)
    );
    const totalBonus = parseFloat(new Decimal(totalTripsRevenue).times(new Decimal(bonusPercentage)).div(100).toFixed(2));
    const totalAdvances = parseFloat(
      (advances || []).reduce(
        (sum, a) => sum.plus(new Decimal(a.amount || 0)),
        new Decimal(0)
      ).toFixed(2)
    );
    const totalFines = parseFloat(
      (fines || []).reduce(
        (sum, f) => sum.plus(new Decimal(f.amount || 0)),
        new Decimal(0)
      ).toFixed(2)
    );
    const netPay = parseFloat(new Decimal(baseSalary).plus(totalBonus).minus(totalAdvances).minus(totalFines).toFixed(2));

    return {
      success: true,
      data: {
        driver,
        baseSalary,
        bonusPercentage,
        trips: trips || [],
        totalTripsRevenue,
        totalBonus,
        advances: advances || [],
        totalAdvances,
        fines: fines || [],
        totalFines,
        netPay,
        periodStart,
        periodEnd,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء احتساب الراتب';
    return { success: false, error: message };
  }
}

export async function payDriverSalary(input: PaySalaryInput): Promise<{ success: boolean; salaryId?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { driverId, netPay, cashBoxId, month, year } = input;

    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      return { success: false, error: 'يجب تسجيل الدخول لإتمام هذه العملية' };
    }

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: cashBox, error: cashBoxError } = await supabase
      .from('cash_boxes')
      .select('id, currency, name')
      .eq('id', cashBoxId)
      .single<CashBox>();

    if (cashBoxError || !cashBox) {
      return { success: false, error: 'الصندوق النقدي غير موجود' };
    }

    const netPayDecimal = new Decimal(netPay);
    const netPayValue = parseFloat(netPayDecimal.toFixed(2));

    const { data: salaryRecord, error: salaryError } = await supabase
      .from('driver_salaries')
      .insert({
        driver_id: driverId,
        amount: netPayValue,
        currency: cashBox.currency,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'settled',
        created_by: data.user.id,
      })
      .select('id')
      .single<DriverSalary>();

    if (salaryError || !salaryRecord) {
      return { success: false, error: salaryError?.message || 'فشل إنشاء سجل الراتب' };
    }

    const { error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'salary',
        amount: netPayValue,
        currency: cashBox.currency,
        cash_box_id: cashBoxId,
        description: input.details || `Salary ${month}/${year} - Driver #${driverId} - ${cashBox.name}`,
        reference: `SAL-${driverId}-${year}${String(month).padStart(2, '0')}`,
        created_by: data.user.id,
        reconciliation_status: 'reconciled',
      });

    if (treasuryError) {
      console.error('Failed to insert treasury transaction:', treasuryError);
    }

    const { data: finesToUpdate, error: finesFetchError } = await supabase
      .from('fine_penalties')
      .select('id')
      .eq('driver_id', driverId)
      .eq('deducted_from_settlement', false);

    if (!finesFetchError && finesToUpdate && finesToUpdate.length > 0) {
      const fineIds = finesToUpdate.map((f) => f.id);
      await supabase
        .from('fine_penalties')
        .update({ deducted_from_settlement: true, deducted_at: new Date().toISOString() })
        .in('id', fineIds);
    }

    return {
      success: true,
      salaryId: salaryRecord.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء صرف الراتب';
    return { success: false, error: message };
  }
}
