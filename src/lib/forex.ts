import Decimal from 'decimal.js';
import type { SupabaseClient } from '@supabase/supabase-js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CurrencyTotal {
  currency: string;
  total: number;
}

export interface ForexEntryInput {
  tripId?: number | null;
  invoiceId?: number | null;
  originalAmount: number | string;
  originalCurrency?: string;
  originalRate: number | string;
  settlementRate: number | string;
  notes?: string;
}

export interface ForexEntryResult {
  success: boolean;
  id?: number;
  amount: number;
  type: 'gain' | 'loss' | 'neutral';
  recorded: boolean;
  error?: string;
}

// أسعار الصرف المعيارية والافتراضية للعملات الإقليمية والممرات الدولية
export const STANDARD_FOREX_RATES = {
  EUR_TO_MAD: new Decimal('10.90'),
  MAD_TO_EUR: new Decimal('0.09174'),
  MAD_TO_MRU: new Decimal('3.98'), // 1 درهم مغربي ≈ 3.98 أوقية موريتانية
  MRU_TO_MAD: new Decimal('0.25125'),
  EUR_TO_MRU: new Decimal('43.40'),
  MAD_TO_XOF: new Decimal('65.20'), // 1 درهم مغربي ≈ 65.20 فرنك سيفا غرب إفريقيا
  XOF_TO_MAD: new Decimal('0.01533'),
  EUR_TO_XOF: new Decimal('655.957'), // الربط الثابت لفرنك سيفا باليورو
} as const;

/**
 * تحويل المبالغ المالية بدقة Decimal.js الصارمة بين مختلف عملات الممرات الدولية
 */
export function convertCurrency(
  amount: number | string | InstanceType<typeof Decimal>,
  fromCurrency: string,
  toCurrency: string,
  customRate?: number | string | InstanceType<typeof Decimal>
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return new Decimal(amount || 0).toNumber();
  }

  const amtDec = new Decimal(amount || 0);

  if (customRate) {
    return amtDec.times(new Decimal(customRate)).toNumber();
  }

  // تحويل إلى MAD كعملة أساسية مركزية إذا لم يكن تحويلاً مباشراً
  let amountInMad = amtDec;
  if (from === 'EUR') {
    amountInMad = amtDec.times(STANDARD_FOREX_RATES.EUR_TO_MAD);
  } else if (from === 'MRU') {
    amountInMad = amtDec.times(STANDARD_FOREX_RATES.MRU_TO_MAD);
  } else if (from === 'XOF') {
    amountInMad = amtDec.times(STANDARD_FOREX_RATES.XOF_TO_MAD);
  }

  // تحويل من MAD إلى العملة الهدف
  if (to === 'MAD') {
    return parseFloat(amountInMad.toFixed(2));
  } else if (to === 'EUR') {
    return parseFloat(amountInMad.times(STANDARD_FOREX_RATES.MAD_TO_EUR).toFixed(2));
  } else if (to === 'MRU') {
    return parseFloat(amountInMad.times(STANDARD_FOREX_RATES.MAD_TO_MRU).toFixed(2));
  } else if (to === 'XOF') {
    return parseFloat(amountInMad.times(STANDARD_FOREX_RATES.MAD_TO_XOF).toFixed(0));
  }

  return parseFloat(amountInMad.toFixed(2));
}

// تنسيق المبالغ المالية مع رمز العملة (بالمعيار المغربي/الفرنسي/الإفريقي)
export function formatCurrency(
  amount?: number | string | InstanceType<typeof Decimal> | null,
  currency: string = 'MAD'
): string {
  const num = new Decimal(amount || 0).toNumber();
  const curr = currency.toUpperCase();
  const fractionDigits = curr === 'XOF' ? 0 : 2;
  return `${num.toLocaleString('fr-MA', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })} ${curr}`;
}

// تجميع الأرصدة مالياً حسب العملة بشكل منفصل لتفادي خلط MAD مع EUR و MRU و XOF
export function groupBalancesByCurrency(
  items: Array<{ current_balance?: number | string | null; currency?: string | null; amount?: number | string | null }>
): Record<string, number> {
  return items.reduce((acc, item) => {
    const curr = (item.currency || 'MAD').toUpperCase();
    const balance = new Decimal(item.current_balance ?? item.amount ?? 0);
    acc[curr] = new Decimal(acc[curr] || 0).plus(balance).toNumber();
    return acc;
  }, {} as Record<string, number>);
}

/**
 * حساب الفارق المالي بين سعر الصرف المعتمد عند الفوترة وسعر الصرف الفعلي عند التحصيل
 * Delta = Amount_EUR * (R_settlement - R_initial)
 * إذا كان Delta > 0.01: ربح صرف (gain)
 * إذا كان Delta < -0.01: خسارة صرف (loss)
 * غير ذلك: حياد (neutral)
 */
export function calculateForexGainLoss(
  invoiceAmount: number | string,
  initialRate: number | string,
  settlementRate: number | string
): { amount: number; type: 'gain' | 'loss' | 'neutral'; delta: number } {
  Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  const amountDec = new Decimal(invoiceAmount || 0);
  const initialRateDec = new Decimal(initialRate || 0);
  const settlementRateDec = new Decimal(settlementRate || 0);

  // Delta = Amount_EUR * (R_settlement - R_initial)
  const rateDiff = settlementRateDec.minus(initialRateDec);
  const delta = amountDec.times(rateDiff);
  const deltaNumber = parseFloat(delta.toFixed(2));

  if (delta.gt(0.01)) {
    return { amount: parseFloat(delta.toFixed(2)), type: 'gain', delta: deltaNumber };
  } else if (delta.lt(-0.01)) {
    return { amount: parseFloat(delta.abs().toFixed(2)), type: 'loss', delta: deltaNumber };
  }
  return { amount: 0, type: 'neutral', delta: deltaNumber };
}

/**
 * تسجيل قيد فروق أسعار الصرف المحققة في جدول forex_gain_loss_entries
 */
export async function recordForexGainLossEntry(
  supabase: SupabaseClient,
  input: ForexEntryInput
): Promise<ForexEntryResult> {
  try {
    const calc = calculateForexGainLoss(
      input.originalAmount,
      input.originalRate,
      input.settlementRate
    );

    // إذا كان الفرق ضمن العتبة المحايدة (<= 0.01 درهم)، لا يُسجل قيد
    if (calc.type === 'neutral' || calc.amount === 0) {
      return {
        success: true,
        amount: 0,
        type: 'neutral',
        recorded: false,
      };
    }

    const { data, error } = await supabase
      .from('forex_gain_loss_entries')
      .insert({
        trip_id: input.tripId || null,
        invoice_id: input.invoiceId || null,
        original_amount: new Decimal(input.originalAmount).toNumber(),
        original_currency: input.originalCurrency || 'EUR',
        original_rate: new Decimal(input.originalRate).toNumber(),
        settlement_rate: new Decimal(input.settlementRate).toNumber(),
        realized_gain_loss: calc.amount,
        entry_type: calc.type,
        notes:
          input.notes ||
          `فرق صرف محقق (${calc.type === 'gain' ? 'أرباح صرف' : 'خسائر صرف'}) - الفاتورة #${input.invoiceId || 'N/A'}`,
      })
      .select('id')
      .single();

    if (error) throw error;

    return {
      success: true,
      id: data?.id,
      amount: calc.amount,
      type: calc.type,
      recorded: true,
    };
  } catch (err: unknown) {
    console.error('فشل تسجيل قيد فروق أسعار الصرف:', err);
    const message = err instanceof Error ? err.message : 'فشل حفظ قيد فروق الصرف';
    return {
      success: false,
      amount: 0,
      type: 'neutral',
      recorded: false,
      error: message,
    };
  }
}
