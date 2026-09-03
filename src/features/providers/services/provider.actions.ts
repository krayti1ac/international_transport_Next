'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

type DecimalValue = InstanceType<typeof Decimal>;

interface RepairInvoiceRow {
  id: number;
  workshop_id?: number;
  total_amount: number;
  currency: string;
  date: string;
  repair_path: string;
  payment_method?: string;
  created_at: string;
  status: string;
  invoice_number: string;
  description?: string;
}

interface TruckMaintenanceRow {
  id: number;
  truck_id: number;
  amount: number;
  payment_method?: string;
  created_at: string;
  provider_name?: string;
  description?: string;
}

interface ProviderRow {
  id: number;
  name: string;
  created_at: string;
}

interface CashBoxRow {
  id: number;
  code: string;
  created_at: string;
}

interface LedgerEntry {
  id: number;
  source: 'repair_invoice' | 'truck_maintenance' | 'payment';
  date: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  runningBalance: number;
}

export async function getProviderLedger(providerId: number) {
  try {
    const supabase = await createClient();

    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, created_at')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) {
      return { success: false, error: 'المزود غير موجود' };
    }

    const providerName = (provider as ProviderRow).name;

    const { data: repairInvoices, error: repairError } = await supabase
      .from('repair_invoices')
      .select('id, workshop_id, total_amount, currency, date, repair_path, payment_method, created_at, status, invoice_number, description')
      .eq('workshop_id', providerId)
      .order('date', { ascending: true });

    if (repairError) throw repairError;

    const { data: truckMaintenance, error: maintenanceError } = await supabase
      .from('truck_maintenance')
      .select('id, truck_id, amount, payment_method, created_at, provider_name, description')
      .eq('provider_name', providerName)
      .order('created_at', { ascending: true });

    if (maintenanceError) throw maintenanceError;

    const entries: LedgerEntry[] = [];

    for (const inv of (repairInvoices as RepairInvoiceRow[]) || []) {
      entries.push({
        id: inv.id,
        source: 'repair_invoice',
        date: inv.date,
        description: inv.description || inv.invoice_number || `فاتورة صيانة #${inv.id}`,
        debit: inv.total_amount,
        credit: 0,
        currency: inv.currency,
        runningBalance: 0,
      });
    }

    for (const m of (truckMaintenance as TruckMaintenanceRow[]) || []) {
      entries.push({
        id: m.id,
        source: 'truck_maintenance',
        date: m.created_at,
        description: m.description || `صيانة شاحنة #${m.truck_id}`,
        debit: m.amount,
        credit: 0,
        currency: 'MAD',
        runningBalance: 0,
      });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('treasury_transactions')
      .select('id, amount, currency, created_at, description, type')
      .eq('type', 'provider_debt_settlement')
      .or(`description.ilike.%${providerName}%`)
      .order('created_at', { ascending: true });

    if (paymentsError) throw paymentsError;

    for (const p of (payments as { id: number; amount: number; currency: string; created_at: string; description?: string }[]) || []) {
      entries.push({
        id: p.id,
        source: 'truck_maintenance',
        date: p.created_at,
        description: p.description || `دفعة للمزود`,
        debit: 0,
        credit: p.amount,
        currency: p.currency || 'MAD',
        runningBalance: 0,
      });
    }

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const balances: Record<string, DecimalValue> = {};
    const calculatedEntries = entries.map((entry) => {
      const currency = entry.currency;
      if (!balances[currency]) {
        balances[currency] = new Decimal(0);
      }
      balances[currency] = balances[currency].plus(entry.debit).minus(entry.credit);
      return {
        ...entry,
        runningBalance: parseFloat(balances[currency].toFixed(2)),
      };
    });

    const totalDebt = Object.values(balances).reduce((sum, bal) => sum.plus(bal), new Decimal(0));
    const balancesRecord: Record<string, number> = {};
    for (const [curr, bal] of Object.entries(balances)) {
      balancesRecord[curr] = parseFloat(bal.toFixed(2));
    }

    return {
      success: true,
      data: {
        provider: { id: provider.id, name: provider.name },
        entries: calculatedEntries,
        totalDebt: parseFloat(totalDebt.toFixed(2)),
        balances: balancesRecord,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل في جلب دفتر الأستاذ';
    return { success: false, error: message };
  }
}

export async function recordProviderPayment(providerId: number, amount: number, cashBoxId: number) {
  try {
    const supabase = await createClient();

    if (amount <= 0) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من الصفر' };
    }

    const { data: cashBox, error: cashBoxError } = await supabase
      .from('cash_boxes')
      .select('id, code')
      .eq('id', cashBoxId)
      .single();

    if (cashBoxError || !cashBox) {
      return { success: false, error: 'الصندوق النقدي غير موجود' };
    }

    const cashBoxCode = (cashBox as CashBoxRow).code;
    if (cashBoxCode === 'secretary_cash') {
      return {
        success: false,
        error: 'غير مسموح باستخدام صندوق Secretary لدفعات المزودين. استخدم Owner Cash أو Bank فقط.',
      };
    }

    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) {
      return { success: false, error: 'المزود غير موجود' };
    }

    const amountDecimal = new Decimal(amount);

    const { error: treasuryError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: 'provider_debt_settlement',
        amount: parseFloat(amountDecimal.toFixed(2)),
        currency: 'MAD',
        cash_box_id: cashBoxId,
        description: `تسوية دين مع ${(provider as ProviderRow).name}`,
        reconciliation_status: 'pending',
      });

    if (treasuryError) {
      return { success: false, error: `فشل تسجيل المعاملة: ${treasuryError.message}` };
    }

    revalidatePath('/providers');
    revalidatePath('/treasury');
    revalidatePath('/maintenance');

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تسجيل الدفعة';
    return { success: false, error: message };
  }
}
