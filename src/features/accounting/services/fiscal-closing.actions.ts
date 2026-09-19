'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedCompanyId } from '@/lib/rbac.server';
import { recordAuditLog } from '@/lib/audit.server';
import type { FiscalYear } from '@/types/database';
import type {
  PreClosingAuditResult,
  FiscalYearClosingParams,
  FiscalYearClosingResult,
} from '../types';
import { revalidatePath } from 'next/cache';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * جلب كافة السنوات المالية الخاصة بالشركة المستأجرة الحالية
 */
export async function getFiscalYears(): Promise<FiscalYear[]> {
  const companyId = await getAuthenticatedCompanyId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', companyId)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[Fiscal] خطأ في جلب السنوات المالية:', error.message);
    return [];
  }

  return (data || []) as FiscalYear[];
}

/**
 * جلب السنة المالية الحالية أو تهيئتها تلقائياً إن لم تكن موجودة
 */
export async function getCurrentFiscalYear(): Promise<FiscalYear | null> {
  const companyId = await getAuthenticatedCompanyId();
  const supabase = await createClient();

  const { data: currentYear, error } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_current', true)
    .maybeSingle<FiscalYear>();

  if (currentYear) return currentYear;

  // في حال عدم وجود سنة محددة كحالية، البحث عن أحدث سنة غير مغلقة
  const { data: openYear } = await supabase
    .from('fiscal_years')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_closed', false)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle<FiscalYear>();

  if (openYear) return openYear;

  // إذا لم تكن هناك أي سنوات مسجلة للشركة، نقوم بإنشاء السنة الحالية تلقائياً (Zero-Config Init)
  const currentCalendarYear = new Date().getFullYear();
  const defaultPayload = {
    company_id: companyId,
    name: `السنة المالية ${currentCalendarYear}`,
    start_date: `${currentCalendarYear}-01-01`,
    end_date: `${currentCalendarYear}-12-31`,
    is_current: true,
    is_closed: false,
    opening_balance_mad: 0.0,
    opening_balance_eur: 0.0,
  };

  const { data: createdYear, error: initError } = await supabase
    .from('fiscal_years')
    .insert(defaultPayload)
    .select('*')
    .single<FiscalYear>();

  if (initError) {
    console.error('[Fiscal] فشل تهيئة السنة المالية الأولية:', initError.message);
    return null;
  }

  return createdYear;
}

/**
 * فحص وتدقيق جاهزية السنة للإقفال وحساب الأرصدة الختامية بدقة متناهية (Decimal.js)
 */
export async function runPreClosingAudit(fiscalYearId?: number): Promise<PreClosingAuditResult> {
  const companyId = await getAuthenticatedCompanyId();
  const supabase = await createClient();

  let targetYear: FiscalYear | null = null;

  if (fiscalYearId) {
    const { data } = await supabase
      .from('fiscal_years')
      .select('*')
      .eq('id', fiscalYearId)
      .eq('company_id', companyId)
      .single<FiscalYear>();
    targetYear = data;
  } else {
    targetYear = await getCurrentFiscalYear();
  }

  if (!targetYear) {
    throw new Error('السنة المالية المستهدفة غير موجودة');
  }

  const { start_date: startDate, end_date: endDate } = targetYear;

  // 1. فحص الفواتير غير المسددة أو المعلقة ضمن فترة السنة
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total_amount, paid_amount, status')
    .gte('issue_date', startDate)
    .lte('issue_date', endDate)
    .in('status', ['unpaid', 'partially_paid', 'overdue']);

  let unpaidTotalMAD = new Decimal(0);
  (invoices || []).forEach((inv) => {
    const total = new Decimal(inv.total_amount || 0);
    const paid = new Decimal(inv.paid_amount || 0);
    unpaidTotalMAD = unpaidTotalMAD.plus(total.minus(paid));
  });

  // 2. فحص الرحلات النشطة غير المكتملة في نفس الفترة
  const { count: activeTripsCount } = await supabase
    .from('trip_orders')
    .select('*', { count: 'exact', head: true })
    .gte('departure_date', startDate)
    .lte('departure_date', endDate)
    .not('status', 'in', '("completed","cancelled")');

  // 3. فحص المعاملات البنكية غير المطابقة
  const { count: unreconciledCount } = await supabase
    .from('treasury_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`)
    .eq('reconciliation_status', 'pending');

  // 4. احتساب الأرصدة الختامية للخزينة بدقة Decimal.js الصارمة
  let netMAD = new Decimal(targetYear.opening_balance_mad || 0);
  let netEUR = new Decimal(targetYear.opening_balance_eur || 0);

  const { data: transactions } = await supabase
    .from('treasury_transactions')
    .select('amount, currency, type')
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lte('created_at', `${endDate}T23:59:59.999Z`);

  (transactions || []).forEach((tx) => {
    const amt = new Decimal(tx.amount || 0);
    const isOutflow = ['expense', 'withdrawal', 'driver_advance'].includes(tx.type);
    const signedAmt = isOutflow ? amt.negated() : amt;

    if (tx.currency === 'EUR') {
      netEUR = netEUR.plus(signedAmt);
    } else {
      netMAD = netMAD.plus(signedAmt);
    }
  });

  return {
    canClose: (activeTripsCount || 0) === 0,
    fiscalYearId: targetYear.id,
    fiscalYearName: targetYear.name,
    startDate,
    endDate,
    unpaidInvoicesCount: invoices?.length || 0,
    unpaidInvoicesTotalMAD: unpaidTotalMAD.toNumber(),
    activeTripsCount: activeTripsCount || 0,
    unreconciledTransactionsCount: unreconciledCount || 0,
    closingBalanceMAD: netMAD.toNumber(),
    closingBalanceEUR: netEUR.toNumber(),
  };
}

/**
 * تنفيذ الإقفال الرسمي للسنة المالية وترحيل الأرصدة الافتتاحية للسنة التالية
 */
export async function executeFiscalYearClosing(
  params: FiscalYearClosingParams
): Promise<FiscalYearClosingResult> {
  try {
    const companyId = await getAuthenticatedCompanyId();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // تشغيل التدقيق المسبق لاحتساب الأرصدة الختامية النهائية بدقة
    const audit = await runPreClosingAudit(params.fiscalYearId);

    // 1. تجميد السنة المالية الحالية
    const { error: closeErr } = await supabase
      .from('fiscal_years')
      .update({
        is_closed: true,
        is_current: false,
        closed_at: new Date().toISOString(),
        closed_by: user?.id || null,
      })
      .eq('id', params.fiscalYearId)
      .eq('company_id', companyId);

    if (closeErr) {
      throw new Error(`فشل تجميد السنة المالية: ${closeErr.message}`);
    }

    // 2. إلغاء تحديد أي سنة أخرى كـ "حالية" لضمان تفرد السنة النشطة
    await supabase
      .from('fiscal_years')
      .update({ is_current: false })
      .eq('company_id', companyId)
      .neq('id', params.fiscalYearId);

    // 3. إنشاء السنة المالية الجديدة وترحيل الأرصدة الافتتاحية
    const { data: newYear, error: createErr } = await supabase
      .from('fiscal_years')
      .insert({
        company_id: companyId,
        name: params.nextYearName,
        start_date: params.nextStartDate,
        end_date: params.nextEndDate,
        is_current: true,
        is_closed: false,
        opening_balance_mad: audit.closingBalanceMAD,
        opening_balance_eur: audit.closingBalanceEUR,
      })
      .select('id')
      .single<{ id: number }>();

    if (createErr || !newYear) {
      throw new Error(`فشل فتح السنة المالية الجديدة: ${createErr?.message || 'خطأ غير معروف'}`);
    }

    // 4. توثيق العملية في سجل التدقيق الأمني
    await recordAuditLog({
      entityType: 'fiscal_year',
      entityId: params.fiscalYearId,
      actionType: 'update',
      reason: `إقفال السنة المالية #${params.fiscalYearId} وترحيل الأرصدة الافتتاحية للسنة #${newYear.id}`,
      newData: {
        closedYearId: params.fiscalYearId,
        nextYearId: newYear.id,
        openingMAD: audit.closingBalanceMAD,
        openingEUR: audit.closingBalanceEUR,
      },
    });

    revalidatePath('/treasury');
    revalidatePath('/invoices');

    return {
      success: true,
      nextFiscalYearId: newYear.id,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'فشل تنفيذ الإقفال السنوي';
    console.error('[Fiscal Closing Action Error]:', msg);
    return {
      success: false,
      error: msg,
    };
  }
}

