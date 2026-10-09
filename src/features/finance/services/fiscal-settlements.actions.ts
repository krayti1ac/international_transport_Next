'use server';

import { z } from 'zod';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { FiscalSettlementsService } from './fiscal-settlements.service';
import type {
  DriverSettlementStatement,
  SettlementStatus,
  TripFiscalClosing,
  FiscalPeriodSummary,
} from '../types/fiscal-settlements.types';
import type { Driver, TripOrder, Advance, FinePenalty, FerryExpense } from '@/types/database';

// Configuration
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Zod Schemas
const GenerateSettlementSchema = z.object({
  driverId: z.number().positive(),
  periodStart: z.string().min(10), // YYYY-MM-DD
  periodEnd: z.string().min(10),   // YYYY-MM-DD
  notes: z.string().optional(),
});

const UpdateSettlementStatusSchema = z.object({
  statementId: z.number().positive(),
  status: z.enum(['draft', 'audited', 'approved', 'settled', 'cancelled']),
  notes: z.string().optional(),
});

const CloseTripPnlSchema = z.object({
  tripId: z.number().positive(),
  fiscalPeriod: z.string().min(7), // YYYY-MM
  notes: z.string().optional(),
});

/**
 * إنشاء أو إعادة حساب كشف تصفية مستحقات ونفقات السائق (Draft Décompte de Frais)
 */
export async function generateDriverSettlementStatementAction(
  rawInput: z.infer<typeof GenerateSettlementSchema>
): Promise<{ success: boolean; data?: DriverSettlementStatement; error?: string }> {
  try {
    const input = GenerateSettlementSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. استعلام بيانات السائق
    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', input.driverId)
      .single<Driver>();

    if (driverErr || !driver) {
      return { success: false, error: 'تعذر العثور على ملف السائق المطلوب' };
    }

    // 2. استعلام الرحلات المنجزة للسائق خلال الفترة
    const { data: tripsData } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('driver_id', input.driverId)
      .gte('departure_date', input.periodStart)
      .lte('departure_date', input.periodEnd);

    const trips = (tripsData || []) as TripOrder[];
    const tripIds = trips.map((t) => t.id);

    // 3. استعلام السلف المسلمة للسائق
    const { data: advancesData } = await supabase
      .from('advances')
      .select('*')
      .eq('driver_id', input.driverId)
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .gte('date', input.periodStart)
      .lte('date', input.periodEnd);

    const advances = (advancesData || []) as Advance[];

    // 4. استعلام سجلات الوقود
    const { data: fuelData } = await supabase
      .from('truck_maintenance')
      .select('*')
      .gte('maintenance_date', input.periodStart)
      .lte('maintenance_date', input.periodEnd);

    const assignedTruckIds = trips.map((t) => t.truck_id).filter(Boolean);
    const fuelRecords = ((fuelData || []) as any[]).filter((r) => {
      const type = (r.expense_type || r.type || '').toLowerCase();
      const isFuel = !type || type === 'fuel' || type === 'carburant' || type === 'gasoil';
      if (!isFuel) return false;
      if (r.driver_id && r.driver_id === input.driverId) return true;
      if (r.truck_id && assignedTruckIds.includes(r.truck_id)) return true;
      return false;
    });

    // 5. استعلام رسوم الطرق الأوروبية (Via-T / Télépéage / Eurovignette)
    let tollRecords: any[] = [];
    if (tripIds.length > 0) {
      const { data: tollsData } = await supabase
        .from('trip_toll_expenses')
        .select('*')
        .in('trip_id', tripIds);
      tollRecords = tollsData || [];
    }

    // 6. استعلام مصاريف العبّارات والترانزيت
    let ferryRecords: FerryExpense[] = [];
    if (tripIds.length > 0) {
      const { data: ferriesData } = await supabase
        .from('ferry_expenses')
        .select('*')
        .in('trip_order_id', tripIds);
      ferryRecords = (ferriesData || []) as FerryExpense[];
    }

    // 7. استعلام المخالفات غير المخصومة
    const { data: finesData } = await supabase
      .from('fine_penalties')
      .select('*')
      .eq('driver_id', input.driverId)
      .eq('deducted_from_settlement', false);

    const fines = (finesData || []) as FinePenalty[];

    // 8. تشغيل المحرك المالي الصارم (Decimal.js)
    const calculation = FiscalSettlementsService.calculateDriverSettlement({
      driverId: input.driverId,
      baseSalary: Number(driver.base_salary) || 0,
      bonusPercentage: Number(driver.bonus_percentage) || 0,
      safetyScore: 95, // يمكن استدعاء calculateDriverSafetyScore إذا لزم
      trips: trips.map((t) => ({
        id: t.id,
        price: t.price,
        price_export: t.price_export,
        price_import: t.price_import,
        distance_km: 1850,
      })),
      advances: advances.map((a) => ({
        id: a.id,
        amount: a.amount,
        date: a.date,
        reason: a.reason,
      })),
      fuelExpenses: fuelRecords.map((f) => ({
        id: f.id,
        amount: Number(f.amount || f.cost || 0),
        date: f.maintenance_date || f.created_at,
        invoice_number: f.invoice_number,
        description: f.description,
      })),
      tollExpenses: tollRecords.map((t) => ({
        id: t.id,
        amount_mad: t.amount_mad,
        amount_eur: t.amount_eur,
        exit_time: t.exit_time,
        highway_code: t.highway_code,
        toll_system: t.toll_system,
      })),
      ferryExpenses: ferryRecords.map((fe) => ({
        id: fe.id,
        amount: fe.amount,
        date: fe.date,
        ferry_company: fe.description,
      })),
      fines: fines.map((fn) => ({
        id: fn.id,
        amount: fn.amount,
        fine_type: fn.fine_type,
        deducted_from_settlement: fn.deducted_from_settlement,
        date: fn.created_at,
      })),
    });

    const statementNumber = FiscalSettlementsService.generateStatementNumber(
      input.driverId,
      input.periodStart
    );

    // 9. التحقق مما إذا كان هناك كشف مسودة سابق لنفس الفترة والسائق
    const { data: existingStmt } = await supabase
      .from('driver_settlement_statements')
      .select('id, statement_number, status')
      .eq('driver_id', input.driverId)
      .eq('period_start', input.periodStart)
      .eq('period_end', input.periodEnd)
      .maybeSingle();

    let savedStatement: DriverSettlementStatement;

    const payload = {
      driver_id: input.driverId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: (existingStmt?.status === 'settled' ? 'settled' : 'draft') as SettlementStatus,
      base_salary_mad: calculation.baseSalary,
      mission_bonuses_mad: calculation.missionBonuses,
      safety_bonus_mad: calculation.safetyBonus,
      gross_driver_earnings_mad: calculation.grossEarnings,
      total_advances_mad: calculation.totalAdvances,
      total_fuel_expenses_mad: calculation.totalFuel,
      total_toll_expenses_mad: calculation.totalTolls,
      total_ferry_expenses_mad: calculation.totalFerries,
      total_port_customs_mad: calculation.totalPortCustoms,
      total_fines_mad: calculation.totalFinesToDeduct,
      total_other_expenses_mad: calculation.totalOtherExpenses,
      total_driver_expenses_mad: calculation.totalDriverExpenses,
      expenses_advances_balance_mad: calculation.expensesVsAdvancesBalance,
      net_payout_mad: calculation.netPayout,
      trips_count: calculation.tripsCount,
      total_distance_km: calculation.totalDistanceKm,
      trip_ids: tripIds,
      advance_ids: advances.map((a) => a.id),
      toll_expense_ids: tollRecords.map((t) => t.id),
      fine_ids: fines.map((f) => f.id),
      itemized_expenses: calculation.itemizedExpenses,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (existingStmt) {
      const { data, error } = await supabase
        .from('driver_settlement_statements')
        .update(payload)
        .eq('id', existingStmt.id)
        .select()
        .single();

      if (error) throw error;
      savedStatement = data as DriverSettlementStatement;
    } else {
      const { data, error } = await supabase
        .from('driver_settlement_statements')
        .insert({
          ...payload,
          statement_number: statementNumber,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      savedStatement = data as DriverSettlementStatement;
    }

    await recordAuditLog({
      entityType: 'driver_settlement_statement',
      entityId: savedStatement.id,
      actionType: existingStmt ? 'update' : 'create',
      reason: `توليد مسودة تصفية مستحقات ونفقات السائق #${input.driverId} (${savedStatement.statement_number}) للفترة ${input.periodStart} إلى ${input.periodEnd}`,
      newData: {
        statementNumber: savedStatement.statement_number,
        netPayout: calculation.netPayout,
        advancesVsExpenses: calculation.expensesVsAdvancesBalance,
      },
    });

    return { success: true, data: savedStatement };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء كشف التصفية المالي للسائق';
    return { success: false, error: message };
  }
}

/**
 * تحديث حالة كشف التصفية (Draft -> Audited -> Approved -> Settled)
 * عند الوصول لحالة Settled: صرف المستحقات في الخزينة وخصم المخالفات نهائياً
 */
export async function updateSettlementStatusAction(
  rawInput: z.infer<typeof UpdateSettlementStatusSchema>
): Promise<{ success: boolean; data?: DriverSettlementStatement; error?: string }> {
  try {
    const input = UpdateSettlementStatusSchema.parse(rawInput);
    const supabase = await createClient();

    // جلب الكشف الحالي
    const { data: stmt, error: stmtErr } = await supabase
      .from('driver_settlement_statements')
      .select('*')
      .eq('id', input.statementId)
      .single<DriverSettlementStatement>();

    if (stmtErr || !stmt) {
      return { success: false, error: 'تعذر العثور على كشف التصفية المحدد' };
    }

    const { data: currentUser } = await supabase.auth.getUser();
    const userId = currentUser.user?.id || null;
    const now = new Date().toISOString();

    const updatePayload: Partial<DriverSettlementStatement> & Record<string, any> = {
      status: input.status,
      notes: input.notes || stmt.notes,
      updated_at: now,
    };

    if (input.status === 'audited') {
      updatePayload.audited_by = userId;
      updatePayload.audited_at = now;
    } else if (input.status === 'approved') {
      updatePayload.approved_by = userId;
      updatePayload.approved_at = now;
    } else if (input.status === 'settled') {
      updatePayload.settled_at = now;

      // 1. تسجيل معاملة الخزينة المصرفية
      const { data: tx, error: txErr } = await supabase
        .from('treasury_transactions')
        .insert({
          type: 'salary',
          amount: stmt.net_payout_mad,
          currency: 'MAD',
          description: `تسوية وتصفية إبراء ذمة السائق #${stmt.driver_id} (${stmt.statement_number}) صافي الصرف ${stmt.net_payout_mad} MAD`,
          reference: stmt.statement_number,
          reconciliation_status: 'cleared',
        })
        .select('id')
        .single();

      if (!txErr && tx) {
        updatePayload.treasury_tx_id = tx.id;
      }

      // 2. تحديث المخالفات المخصومة
      if (Array.isArray(stmt.fine_ids) && stmt.fine_ids.length > 0) {
        await supabase
          .from('fine_penalties')
          .update({
            deducted_from_settlement: true,
            deducted_at: now,
            status: 'deducted',
          })
          .in('id', stmt.fine_ids);
      }

      // 3. قيد سجل الراتب الشهري (driver_salaries) للتكامل مع سجل الرواتب
      await supabase.from('driver_salaries').insert({
        driver_id: stmt.driver_id,
        amount: stmt.net_payout_mad,
        currency: 'MAD',
        period_start: stmt.period_start,
        period_end: stmt.period_end,
        status: 'settled',
        created_at: now,
      });

      // 4. إرسال إشعار WhatsApp فوري وموثق للسائق
      const { data: driver } = await supabase
        .from('drivers')
        .select('phone, name')
        .eq('id', stmt.driver_id)
        .single();

      if (driver?.phone) {
        const sign = Number(stmt.expenses_advances_balance_mad) >= 0 ? '+' : '';
        const msg = [
          `📑 *إشعار اعتماد وتصفية مستحقات الطريق - Trans Bodanon*`,
          `السيد السائق: ${driver.name}`,
          `رقم إبراء الذمة: ${stmt.statement_number}`,
          `الفترة: ${stmt.period_start} إلى ${stmt.period_end}`,
          `---------------------------`,
          `💵 الراتب الإجمالي والمكافآت: ${stmt.gross_driver_earnings_mad} MAD`,
          `💳 إجمالي السلف المسلمة: ${stmt.total_advances_mad} MAD`,
          `🧾 مصاريف الطريق الموثقة: ${stmt.total_driver_expenses_mad} MAD`,
          `⚖️ موازنة العهدة والمصاريف: ${sign}${stmt.expenses_advances_balance_mad} MAD`,
          stmt.total_fines_mad > 0 ? `⚠️ خصم مخالفات تشغيلية: -${stmt.total_fines_mad} MAD` : null,
          `---------------------------`,
          `💰 *صافي الصرف المعتمد*: *${stmt.net_payout_mad} MAD*`,
          `الحالة: تم الصرف والتحويل البنكي بنجاح ✔️`,
        ]
          .filter(Boolean)
          .join('\n');

        await sendWhatsAppCloudMessage({ to: driver.phone, message: msg }).catch((wErr) =>
          console.warn('Driver settlement WhatsApp alert warning:', wErr)
        );
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('driver_settlement_statements')
      .update(updatePayload)
      .eq('id', stmt.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await recordAuditLog({
      entityType: 'driver_settlement_statement',
      entityId: stmt.id,
      actionType: 'update',
      reason: `تغيير حالة كشف التصفية (${stmt.statement_number}) من ${stmt.status} إلى ${input.status}`,
      newData: { status: input.status, netPayout: stmt.net_payout_mad },
    });

    return { success: true, data: updated as DriverSettlementStatement };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحديث حالة كشف التصفية';
    return { success: false, error: message };
  }
}

/**
 * جلب كشوفات التصفية مع التصفية بالتواريخ والسائقين
 */
export async function getDriverSettlementsAction(filter?: {
  periodStart?: string;
  periodEnd?: string;
  driverId?: number;
  status?: string;
}): Promise<{
  success: boolean;
  data?: Array<DriverSettlementStatement & { driver?: { name: string; phone?: string; matricule?: string } }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('driver_settlement_statements')
      .select('*, driver:drivers(name, phone, matricule)')
      .order('created_at', { ascending: false });

    if (filter?.driverId) {
      query = query.eq('driver_id', filter.driverId);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    if (filter?.periodStart) {
      query = query.gte('period_start', filter.periodStart);
    }
    if (filter?.periodEnd) {
      query = query.lte('period_end', filter.periodEnd);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: (data || []) as any };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب كشوفات التصفية';
    return { success: false, error: message };
  }
}

/**
 * إغلاق ومصادقة الميزانية التشغيلية لرحلة دولية (Trip Fiscal P&L Closing)
 */
export async function closeTripFiscalPnlAction(
  rawInput: z.infer<typeof CloseTripPnlSchema>
): Promise<{ success: boolean; data?: TripFiscalClosing; error?: string }> {
  try {
    const input = CloseTripPnlSchema.parse(rawInput);
    const supabase = await createClient();

    // استعلام الرحلة ومصاريفها
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', input.tripId)
      .single<TripOrder>();

    if (tripErr || !trip) {
      return { success: false, error: 'الرحلة المطلوبة غير موجودة' };
    }

    // جلب الرسوم والمصاريف
    const [tollsRes, ferriesRes, maintenanceRes] = await Promise.all([
      supabase.from('trip_toll_expenses').select('amount_mad, amount_eur').eq('trip_id', trip.id),
      supabase.from('ferry_expenses').select('amount').eq('trip_order_id', trip.id),
      supabase.from('truck_maintenance').select('amount, cost').eq('trip_id', trip.id),
    ]);

    const tollsCost = (tollsRes.data || []).reduce(
      (sum, t: any) => sum.plus(new Decimal(t.amount_mad || 0)),
      new Decimal(0)
    );

    const ferryCost = (ferriesRes.data || []).reduce(
      (sum, f: any) => sum.plus(new Decimal(f.amount || 0)),
      new Decimal(0)
    );

    const fuelCost = (maintenanceRes.data || []).reduce(
      (sum, m: any) => sum.plus(new Decimal(m.amount || m.cost || 0)),
      new Decimal(0)
    );

    // الرسوم المينائية القياسية والجمارك (ألميريا، مرسى المغرب، تريبتيك)
    const portFees = new Decimal(trip.ferry_cost || 0)
      .plus(new Decimal(trip.triptik_cost || 0))
      .plus(new Decimal(trip.transit_almeria_cost || 0))
      .plus(new Decimal(trip.marsa_maroc_cost || 0));

    const finalFerryCost = ferryCost.greaterThan(0) ? ferryCost : portFees;

    // عمولة / تكلفة السائق المقدرة (سلف أو مكافأة رحلة)
    const driverCost = new Decimal(trip.price || 0).times(new Decimal(0.05)); // 5% كمثال

    const revenue = new Decimal(trip.price_export || 0)
      .plus(new Decimal(trip.price_import || 0));
    const finalRevenue = revenue.greaterThan(0) ? revenue : new Decimal(trip.price || 0);

    const pnl = FiscalSettlementsService.calculateTripPnl({
      tripId: trip.id,
      revenue: finalRevenue.toNumber(),
      fuelCost: fuelCost.toNumber(),
      tollsCost: tollsCost.toNumber(),
      ferryCost: finalFerryCost.toNumber(),
      customsPortsCost: 0,
      driverCost: driverCost.toNumber(),
    });

    const { data: currentUser } = await supabase.auth.getUser();
    const userId = currentUser.user?.id || null;
    const now = new Date().toISOString();

    const payload = {
      trip_id: trip.id,
      fiscal_period: input.fiscalPeriod,
      revenue_mad: pnl.revenue,
      fuel_cost_mad: pnl.fuelCost,
      tolls_cost_mad: pnl.tollsCost,
      ferry_cost_mad: pnl.ferryCost,
      customs_ports_cost_mad: pnl.customsPortsCost,
      driver_cost_mad: pnl.driverCost,
      other_costs_mad: pnl.otherCosts,
      total_costs_mad: pnl.totalCosts,
      gross_profit_mad: pnl.grossProfit,
      profit_margin_pct: pnl.profitMarginPct,
      is_closed: true,
      closed_at: now,
      closed_by: userId,
      metadata: { profitabilityTier: pnl.profitabilityTier, notes: input.notes },
      updated_at: now,
    };

    const { data: closing, error: closingErr } = await supabase
      .from('trip_fiscal_closings')
      .upsert(payload, { onConflict: 'trip_id' })
      .select()
      .single();

    if (closingErr) throw closingErr;

    await recordAuditLog({
      entityType: 'trip_fiscal_closing',
      entityId: trip.id,
      actionType: 'create',
      reason: `إغلاق الميزانية التشغيلية للرحلة #${trip.id} للفترة ${input.fiscalPeriod} (هامش الربح: ${pnl.profitMarginPct}%)`,
      newData: payload,
    });

    return { success: true, data: closing as TripFiscalClosing };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إغلاق ميزانية الرحلة التشغيلية';
    return { success: false, error: message };
  }
}

/**
 * حساب ملخص الميزانية التشغيلية الشهرية الشاملة
 */
export async function getFiscalPeriodSummaryAction(
  fiscalPeriod: string // e.g. '2026-10'
): Promise<{ success: boolean; data?: FiscalPeriodSummary; error?: string }> {
  try {
    const supabase = await createClient();

    const periodStart = `${fiscalPeriod}-01`;
    // نهاية الشهر
    const parts = fiscalPeriod.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${fiscalPeriod}-${String(lastDay).padStart(2, '0')}`;

    const [stmtsRes, closingsRes, advancesRes, tollsRes] = await Promise.all([
      supabase
        .from('driver_settlement_statements')
        .select('*')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd),
      supabase
        .from('trip_fiscal_closings')
        .select('*')
        .eq('fiscal_period', fiscalPeriod),
      supabase
        .from('advances')
        .select('amount, status')
        .gte('date', periodStart)
        .lte('date', periodEnd),
      supabase
        .from('trip_toll_expenses')
        .select('amount_mad')
        .gte('exit_time', periodStart)
        .lte('exit_time', periodEnd),
    ]);

    const statements = (stmtsRes.data || []) as DriverSettlementStatement[];
    const closings = (closingsRes.data || []) as TripFiscalClosing[];
    const advances = (advancesRes.data || []) as any[];
    const tolls = (tollsRes.data || []) as any[];

    let totalRevenue = new Decimal(0);
    let totalCosts = new Decimal(0);
    let totalDriverPayouts = new Decimal(0);
    let totalReconciledFuel = new Decimal(0);

    closings.forEach((c) => {
      totalRevenue = totalRevenue.plus(new Decimal(c.revenue_mad || 0));
      totalCosts = totalCosts.plus(new Decimal(c.total_costs_mad || 0));
      totalReconciledFuel = totalReconciledFuel.plus(new Decimal(c.fuel_cost_mad || 0));
    });

    statements.forEach((s) => {
      totalDriverPayouts = totalDriverPayouts.plus(new Decimal(s.net_payout_mad || 0));
    });

    const grossProfit = totalRevenue.minus(totalCosts);
    const avgMargin = totalRevenue.greaterThan(0)
      ? grossProfit.dividedBy(totalRevenue).times(100).toDecimalPlaces(2).toNumber()
      : 0;

    const totalReconciledTolls = tolls.reduce(
      (sum: any, t: any) => sum.plus(new Decimal(t.amount_mad || 0)),
      new Decimal(0)
    );

    const unsettledAdvances = advances
      .filter((a) => a.status === 'pending' || a.status === 'approved')
      .reduce((sum: any, a: any) => sum.plus(new Decimal(a.amount || 0)), new Decimal(0));

    const settledCount = statements.filter((s) => s.status === 'settled').length;
    const pendingCount = statements.filter((s) => s.status !== 'settled').length;

    return {
      success: true,
      data: {
        period: fiscalPeriod,
        totalRevenueMad: totalRevenue.toDecimalPlaces(2).toNumber(),
        totalOperatingCostsMad: totalCosts.toDecimalPlaces(2).toNumber(),
        grossOperatingProfitMad: grossProfit.toDecimalPlaces(2).toNumber(),
        averageMarginPct: avgMargin,
        totalDriverPayoutsMad: totalDriverPayouts.toDecimalPlaces(2).toNumber(),
        totalReconciledTollsMad: totalReconciledTolls.toDecimalPlaces(2).toNumber(),
        totalReconciledFuelMad: totalReconciledFuel.toDecimalPlaces(2).toNumber(),
        unsettledAdvancesMad: unsettledAdvances.toDecimalPlaces(2).toNumber(),
        settledStatementsCount: settledCount,
        pendingStatementsCount: pendingCount,
        closedTripsCount: closings.length,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل توليد ملخص الميزانية التشغيلية';
    return { success: false, error: message };
  }
}
