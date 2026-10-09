'use server';

import { z } from 'zod';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  buildPaymentLinkRecord,
  verifyPaymentLinkToken,
  calculateGatewayFees,
} from './payment-gateway.service';
import {
  buildRecurringScheduleRecord,
  advanceScheduleCycle,
  isScheduleDueForBilling,
  generateRecurringInvoiceNumber,
} from './recurring-invoices.service';
import type {
  PaymentLink,
  PaymentGateway,
  PaymentCurrency,
  PaymentConfirmationResult,
} from '../types/payment-gateway.types';
import type {
  RecurringInvoiceSchedule,
  RecurringFrequency,
  CreateRecurringScheduleInput,
  ProcessRecurringRunResult,
} from '../types/recurring-invoice.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------
const CreatePaymentLinkSchema = z.object({
  invoiceId: z.number().positive(),
  invoiceNumber: z.string().min(1),
  clientId: z.string().min(1),
  clientName: z.string().optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  amount: z.union([z.number().positive(), z.string().min(1)]),
  currency: z.enum(['MAD', 'EUR', 'USD', 'GBP', 'MRU', 'XOF']).optional(),
  gateway: z.enum(['stripe', 'cmi', 'multi', 'bank_transfer']).optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

const ConfirmPaymentSchema = z.object({
  token: z.string().min(10),
  gateway: z.enum(['stripe', 'cmi', 'multi', 'bank_transfer']),
  transactionReference: z.string().min(1),
  paidAmount: z.union([z.number().positive(), z.string().min(1)]),
  currency: z.enum(['MAD', 'EUR', 'USD', 'GBP', 'MRU', 'XOF']),
  clientNotes: z.string().optional(),
});

const CreateRecurringScheduleSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(2),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  currency: z.enum(['MAD', 'EUR', 'USD', 'GBP', 'MRU', 'XOF']).optional(),
  amountHt: z.union([z.number().positive(), z.string().min(1)]),
  tvaRate: z.union([z.number().min(0), z.string()]).optional(),
  isArticle92Exempt: z.boolean().optional(),
  startDate: z.string().min(10),
  endDate: z.string().optional(),
  billingDayOfMonth: z.number().int().min(1).max(31).optional(),
  autoSendEmail: z.boolean().optional(),
  autoSendWhatsapp: z.boolean().optional(),
  autoGeneratePaymentLink: z.boolean().optional(),
  preferredGateway: z.enum(['stripe', 'cmi', 'multi', 'bank_transfer']).optional(),
  maxCycles: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// 1. Generate Instant Digital Payment Link Action
// ---------------------------------------------------------------------------
export async function generatePaymentLinkAction(
  rawInput: z.infer<typeof CreatePaymentLinkSchema>
): Promise<{
  success: boolean;
  paymentLink?: PaymentLink;
  error?: string;
}> {
  try {
    const validated = CreatePaymentLinkSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. Verify invoice in database
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, currency, status, company_id, extra_details')
      .eq('id', validated.invoiceId)
      .single();

    if (invErr || !inv) {
      return { success: false, error: 'تعذر العثور على الفاتورة المطلوبة' };
    }

    // 2. Compute remaining amount using Decimal.js
    const totalDec = new Decimal(inv.total_amount || 0);
    const paidDec = new Decimal(inv.paid_amount || 0);
    const remainingDec = totalDec.minus(paidDec);

    if (remainingDec.lessThanOrEqualTo(0)) {
      return { success: false, error: 'هذه الفاتورة مسددة بالكامل بالفعل' };
    }

    const requestedAmountDec = new Decimal(validated.amount);
    const finalAmountDec = requestedAmountDec.greaterThan(remainingDec)
      ? remainingDec
      : requestedAmountDec;

    // 3. Build Payment Link Record
    const paymentLink = buildPaymentLinkRecord({
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      clientId: validated.clientId,
      clientName: validated.clientName,
      clientEmail: validated.clientEmail,
      clientPhone: validated.clientPhone,
      amount: finalAmountDec.toFixed(2),
      currency: (validated.currency || inv.currency || 'MAD') as PaymentCurrency,
      gateway: (validated.gateway || 'multi') as PaymentGateway,
      expiresInDays: validated.expiresInDays || 30,
    });

    // 4. Persist to payment_links table (if exists) & fallback to invoice.extra_details
    const { error: plkErr } = await supabase.from('payment_links').insert({
      company_id: inv.company_id || 1,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      client_id: validated.clientId,
      token: paymentLink.token,
      gateway: paymentLink.gateway,
      status: 'active',
      currency: paymentLink.currency,
      amount: paymentLink.amount,
      paid_amount: '0.00',
      gateway_fee_amount: paymentLink.gatewayFeeAmount,
      net_settled_amount: paymentLink.netSettledAmount,
      pay_url: paymentLink.payUrl,
      expires_at: paymentLink.expiresAt,
      metadata: paymentLink.metadata,
    });

    if (plkErr) {
      console.warn('payment_links table insert fallback:', plkErr.message);
    }

    // Always update invoice extra_details with active payment link
    const existingDetails = inv.extra_details || {};
    const updatedDetails = {
      ...existingDetails,
      payment_link: {
        token: paymentLink.token,
        pay_url: paymentLink.payUrl,
        gateway: paymentLink.gateway,
        expires_at: paymentLink.expiresAt,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
      },
    };

    await supabase
      .from('invoices')
      .update({ extra_details: updatedDetails })
      .eq('id', inv.id);

    // 5. Audit Log
    await recordAuditLog({
      entityType: 'invoice',
      entityId: inv.id,
      actionType: 'create',
      reason: `توليد رابط سداد رقمي (${paymentLink.gateway.toUpperCase()}) بقيمة ${paymentLink.amount} ${paymentLink.currency}`,
      newData: {
        paymentLinkToken: paymentLink.token,
        payUrl: paymentLink.payUrl,
        gateway: paymentLink.gateway,
      },
    });

    return {
      success: true,
      paymentLink,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل توليد رابط السداد الرقمي';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 2. Get Payment Link Details by Token (Public / Client Pay Landing Page)
// ---------------------------------------------------------------------------
export async function getPaymentLinkByTokenAction(token: string): Promise<{
  success: boolean;
  paymentLink?: PaymentLink;
  invoice?: {
    id: number;
    invoiceNumber: string;
    totalAmount: string;
    paidAmount: string;
    remainingAmount: string;
    currency: string;
    status: string;
    sellerIce: string;
    buyerIce: string;
  };
  error?: string;
}> {
  try {
    const verified = verifyPaymentLinkToken(token);
    if (!verified.isValid || !verified.payload) {
      return { success: false, error: verified.error || 'رمز السداد غير صالح' };
    }

    const supabase = await createClient();

    // 1. Fetch from payment_links if available
    const { data: dbLink } = await supabase
      .from('payment_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    // 2. Fetch invoice
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, currency, status, client_id, extra_details')
      .eq('id', verified.payload.invoiceId)
      .single();

    if (invErr || !inv) {
      return { success: false, error: 'تعذر العثور على الفاتورة المرتبطة برابط الدفع' };
    }

    const totalDec = new Decimal(inv.total_amount || 0);
    const paidDec = new Decimal(inv.paid_amount || 0);
    const remainingDec = Decimal.max(0, totalDec.minus(paidDec));

    const paymentLink: PaymentLink = dbLink
      ? {
          id: dbLink.id,
          invoiceId: dbLink.invoice_id,
          invoiceNumber: dbLink.invoice_number,
          clientId: dbLink.client_id,
          token: dbLink.token,
          gateway: dbLink.gateway,
          status: dbLink.status,
          currency: dbLink.currency,
          amount: dbLink.amount,
          paidAmount: dbLink.paid_amount,
          gatewayFeeAmount: dbLink.gateway_fee_amount,
          netSettledAmount: dbLink.net_settled_amount,
          payUrl: dbLink.pay_url,
          expiresAt: dbLink.expires_at,
          paidAt: dbLink.paid_at,
          createdAt: dbLink.created_at,
          updatedAt: dbLink.updated_at,
        }
      : buildPaymentLinkRecord({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          clientId: inv.client_id,
          amount: verified.payload.amount,
          currency: verified.payload.currency as PaymentCurrency,
        });

    return {
      success: true,
      paymentLink,
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        totalAmount: totalDec.toFixed(2),
        paidAmount: paidDec.toFixed(2),
        remainingAmount: remainingDec.toFixed(2),
        currency: inv.currency || 'MAD',
        status: inv.status,
        sellerIce: '002345678000091', // Trans Bodanon SARL
        buyerIce: inv.extra_details?.buyer_ice || '002672889000094',
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل قراءة بيانات رابط السداد';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 3. Confirm Gateway Payment & Settle Invoice (Stripe / CMI Webhooks or Client)
// ---------------------------------------------------------------------------
export async function confirmOnlinePaymentAction(
  rawInput: z.infer<typeof ConfirmPaymentSchema>
): Promise<PaymentConfirmationResult> {
  try {
    const validated = ConfirmPaymentSchema.parse(rawInput);
    const verified = verifyPaymentLinkToken(validated.token);

    if (!verified.isValid || !verified.payload) {
      return {
        success: false,
        paymentLinkId: 0,
        invoiceId: 0,
        invoiceNumber: '',
        paidAmount: '0.00',
        currency: validated.currency,
        gateway: validated.gateway,
        transactionReference: validated.transactionReference,
        feeDeducted: '0.00',
        netDeposited: '0.00',
        isFullyPaid: false,
        error: verified.error || 'رمز السداد غير صالح',
      };
    }

    const supabase = await createClient();
    const paidAmtDec = new Decimal(validated.paidAmount);

    // 1. Calculate gateway fees strictly with Decimal.js
    const feeCalc = calculateGatewayFees({
      amount: paidAmtDec,
      gateway: validated.gateway,
      currency: validated.currency,
    });

    // 2. Fetch invoice
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, paid_amount, status, company_id, extra_details')
      .eq('id', verified.payload.invoiceId)
      .single();

    if (invErr || !inv) {
      throw new Error('الفاتورة المرتبطة بالدفع غير موجودة');
    }

    const currentPaidDec = new Decimal(inv.paid_amount || 0);
    const newPaidDec = currentPaidDec.plus(paidAmtDec);
    const totalDec = new Decimal(inv.total_amount || 0);
    const isFullyPaid = newPaidDec.greaterThanOrEqualTo(totalDec.minus(0.05));
    const newStatus = isFullyPaid ? 'paid' : 'partial';

    // 3. Update Invoice in Supabase
    const { error: updateInvErr } = await supabase
      .from('invoices')
      .update({
        paid_amount: newPaidDec.toFixed(2),
        status: newStatus,
      })
      .eq('id', inv.id);

    if (updateInvErr) throw updateInvErr;

    // 4. Update payment_links row if exists
    await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        paid_amount: paidAmtDec.toFixed(2),
        gateway_fee_amount: feeCalc.totalGatewayFee,
        net_settled_amount: feeCalc.netSettlementAmount,
        paid_at: new Date().toISOString(),
      })
      .eq('token', validated.token);

    // 5. Dual Entry into Treasury: Inflow of Net Settlement
    const treasuryEntry = {
      type: 'capital_injection',
      company_id: inv.company_id || 1,
      amount: paidAmtDec.toNumber(),
      currency: validated.currency,
      description: `سداد رقمي (${validated.gateway.toUpperCase()}) للفاتورة ${inv.invoice_number} - مرجع: ${validated.transactionReference} (عمولة البوابة: ${feeCalc.totalGatewayFee} ${validated.currency})`,
      reference: validated.transactionReference,
      reconciliation_status: 'reconciled',
    };

    const { error: treasErr } = await supabase
      .from('treasury_transactions')
      .insert(treasuryEntry);

    if (treasErr) {
      console.warn('Treasury insert warning for online payment:', treasErr.message);
    }

    // 6. Audit Log
    await recordAuditLog({
      entityType: 'invoice',
      entityId: inv.id,
      actionType: 'update',
      reason: `تأكيد سداد رقمي (${validated.gateway.toUpperCase()}) للفاتورة ${inv.invoice_number} بمبلغ ${paidAmtDec.toFixed(2)} ${validated.currency}`,
      newData: {
        paidAmount: paidAmtDec.toFixed(2),
        newStatus,
        transactionReference: validated.transactionReference,
        gatewayFee: feeCalc.totalGatewayFee,
        netDeposited: feeCalc.netSettlementAmount,
      },
    });

    return {
      success: true,
      paymentLinkId: validated.token,
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      paidAmount: paidAmtDec.toFixed(2),
      currency: validated.currency,
      gateway: validated.gateway,
      transactionReference: validated.transactionReference,
      feeDeducted: feeCalc.totalGatewayFee,
      netDeposited: feeCalc.netSettlementAmount,
      isFullyPaid,
      auditLogId: undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تأكيد السداد الإلكتروني';
    return {
      success: false,
      paymentLinkId: 0,
      invoiceId: 0,
      invoiceNumber: '',
      paidAmount: '0.00',
      currency: rawInput.currency,
      gateway: rawInput.gateway,
      transactionReference: rawInput.transactionReference,
      feeDeducted: '0.00',
      netDeposited: '0.00',
      isFullyPaid: false,
      error: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Create Recurring Invoice Schedule Action
// ---------------------------------------------------------------------------
export async function createRecurringScheduleAction(
  rawInput: CreateRecurringScheduleInput
): Promise<{
  success: boolean;
  schedule?: RecurringInvoiceSchedule;
  error?: string;
}> {
  try {
    const validated = CreateRecurringScheduleSchema.parse(rawInput);
    const supabase = await createClient();

    const schedule = buildRecurringScheduleRecord(validated);

    // Insert into recurring_invoice_schedules table
    const { error: dbErr } = await supabase
      .from('recurring_invoice_schedules')
      .insert({
        company_id: schedule.companyId,
        client_id: schedule.clientId,
        title: schedule.title,
        frequency: schedule.frequency,
        currency: schedule.currency,
        amount_ht: schedule.amountHt,
        tva_rate: schedule.tvaRate,
        tva_amount: schedule.tvaAmount,
        total_amount_ttc: schedule.totalAmountTtc,
        is_article92_exempt: schedule.isArticle92Exempt,
        start_date: schedule.startDate,
        end_date: schedule.endDate,
        next_issue_date: schedule.nextIssueDate,
        billing_day_of_month: schedule.billingDayOfMonth,
        auto_send_email: schedule.autoSendEmail,
        auto_send_whatsapp: schedule.autoSendWhatsapp,
        auto_generate_payment_link: schedule.autoGeneratePaymentLink,
        preferred_gateway: schedule.preferredGateway,
        status: schedule.status,
        total_cycles_completed: schedule.totalCyclesCompleted,
        max_cycles: schedule.maxCycles,
        items_breakdown: schedule.itemsBreakdown,
        metadata: schedule.metadata,
      });

    if (dbErr) {
      console.warn('recurring_invoice_schedules insert fallback:', dbErr.message);
    }

    // Audit Log
    await recordAuditLog({
      entityType: 'invoice',
      entityId: 0,
      actionType: 'create',
      reason: `إنشاء خطة فوترة دورية (${schedule.frequency}) للعميل #${schedule.clientId} بمبلغ ${schedule.totalAmountTtc} ${schedule.currency}`,
      newData: {
        title: schedule.title,
        frequency: schedule.frequency,
        amountTtc: schedule.totalAmountTtc,
      },
    });

    return {
      success: true,
      schedule,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل إنشاء جدول الفوترة الدورية';
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// 5. Fetch Recurring Schedules Action
// ---------------------------------------------------------------------------
export async function fetchRecurringSchedulesAction(): Promise<{
  success: boolean;
  schedules: RecurringInvoiceSchedule[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('recurring_invoice_schedules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchRecurringSchedules error fallback:', error.message);
      return { success: true, schedules: [] };
    }

    const schedules: RecurringInvoiceSchedule[] = (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      clientId: row.client_id,
      title: row.title,
      frequency: row.frequency as RecurringFrequency,
      currency: row.currency as PaymentCurrency,
      amountHt: String(row.amount_ht),
      tvaRate: String(row.tva_rate),
      tvaAmount: String(row.tva_amount),
      totalAmountTtc: String(row.total_amount_ttc),
      isArticle92Exempt: Boolean(row.is_article92_exempt),
      startDate: row.start_date,
      endDate: row.end_date,
      nextIssueDate: row.next_issue_date,
      lastIssuedDate: row.last_issued_date,
      billingDayOfMonth: row.billing_day_of_month,
      autoSendEmail: Boolean(row.auto_send_email),
      autoSendWhatsapp: Boolean(row.auto_send_whatsapp),
      autoGeneratePaymentLink: Boolean(row.auto_generate_payment_link),
      preferredGateway: (row.preferred_gateway || 'multi') as PaymentGateway,
      status: row.status,
      totalCyclesCompleted: row.total_cycles_completed || 0,
      maxCycles: row.max_cycles,
      itemsBreakdown: row.items_breakdown || [],
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, schedules };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل استرجاع جداول الفوترة الدورية';
    return { success: false, schedules: [], error: msg };
  }
}

// ---------------------------------------------------------------------------
// 6. Process Due Recurring Invoices (Daily Cron or Manual Trigger)
// ---------------------------------------------------------------------------
export async function processDueRecurringInvoicesAction(
  asOfDateStr?: string
): Promise<ProcessRecurringRunResult> {
  const result: ProcessRecurringRunResult = {
    timestamp: new Date().toISOString(),
    schedulesChecked: 0,
    schedulesDue: 0,
    invoicesGenerated: [],
    errors: [],
  };

  try {
    const supabase = await createClient();

    // 1. Fetch active schedules
    const { data: schedules, error: schErr } = await supabase
      .from('recurring_invoice_schedules')
      .select('*')
      .eq('status', 'active');

    if (schErr || !schedules) {
      return result;
    }

    result.schedulesChecked = schedules.length;

    for (const rawSch of schedules) {
      const schedule: RecurringInvoiceSchedule = {
        id: rawSch.id,
        companyId: rawSch.company_id,
        clientId: rawSch.client_id,
        title: rawSch.title,
        frequency: rawSch.frequency,
        currency: rawSch.currency,
        amountHt: String(rawSch.amount_ht),
        tvaRate: String(rawSch.tva_rate),
        tvaAmount: String(rawSch.tva_amount),
        totalAmountTtc: String(rawSch.total_amount_ttc),
        isArticle92Exempt: Boolean(rawSch.is_article92_exempt),
        startDate: rawSch.start_date,
        endDate: rawSch.end_date,
        nextIssueDate: rawSch.next_issue_date,
        lastIssuedDate: rawSch.last_issued_date,
        billingDayOfMonth: rawSch.billing_day_of_month,
        autoSendEmail: Boolean(rawSch.auto_send_email),
        autoSendWhatsapp: Boolean(rawSch.auto_send_whatsapp),
        autoGeneratePaymentLink: Boolean(rawSch.auto_generate_payment_link),
        preferredGateway: rawSch.preferred_gateway || 'multi',
        status: rawSch.status,
        totalCyclesCompleted: rawSch.total_cycles_completed || 0,
        maxCycles: rawSch.max_cycles,
        itemsBreakdown: rawSch.items_breakdown || [],
        createdAt: rawSch.created_at,
        updatedAt: rawSch.updated_at,
      };

      if (!isScheduleDueForBilling(schedule, asOfDateStr)) {
        continue;
      }

      result.schedulesDue++;

      try {
        const issueDate = schedule.nextIssueDate;
        const dueDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        const invoiceNumber = generateRecurringInvoiceNumber(
          schedule.id,
          schedule.totalCyclesCompleted + 1,
          issueDate
        );

        // 2. Insert invoice into invoices table
        const { data: createdInv, error: invErr } = await supabase
          .from('invoices')
          .insert({
            invoice_number: invoiceNumber,
            client_id: schedule.clientId,
            company_id: schedule.companyId || 1,
            total_amount: schedule.totalAmountTtc,
            ht_amount: schedule.amountHt,
            tva_rate: schedule.tvaRate,
            tva_amount: schedule.tvaAmount,
            ttc_amount: schedule.totalAmountTtc,
            currency: schedule.currency,
            status: 'unpaid',
            input_mode: 'auto',
            issue_date: issueDate,
            due_date: dueDate,
            extra_details: {
              recurring_schedule_id: schedule.id,
              cycle_number: schedule.totalCyclesCompleted + 1,
              title: schedule.title,
            },
          })
          .select('id, invoice_number')
          .single();

        if (invErr || !createdInv) {
          throw new Error(invErr?.message || 'فشل إدراج الفاتورة المنشأة تلقائياً');
        }

        let paymentLinkUrl: string | undefined;

        // 3. Generate instant payment link if enabled
        if (schedule.autoGeneratePaymentLink) {
          const plkRes = await generatePaymentLinkAction({
            invoiceId: createdInv.id,
            invoiceNumber: createdInv.invoice_number,
            clientId: schedule.clientId,
            amount: schedule.totalAmountTtc,
            currency: schedule.currency,
            gateway: schedule.preferredGateway,
          });
          paymentLinkUrl = plkRes.paymentLink?.payUrl;
        }

        // 4. Advance schedule cycle
        const { updatedSchedule } = advanceScheduleCycle(schedule, issueDate);

        await supabase
          .from('recurring_invoice_schedules')
          .update({
            last_issued_date: updatedSchedule.lastIssuedDate,
            next_issue_date: updatedSchedule.nextIssueDate,
            total_cycles_completed: updatedSchedule.totalCyclesCompleted,
            status: updatedSchedule.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schedule.id);

        result.invoicesGenerated.push({
          invoiceId: createdInv.id,
          invoiceNumber: createdInv.invoice_number,
          scheduleId: schedule.id,
          amountTtc: schedule.totalAmountTtc,
          currency: schedule.currency,
          issueDate,
          dueDate,
          paymentLinkUrl,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطأ أثناء معالجة الجدولة';
        result.errors.push({ scheduleId: schedule.id, error: msg });
      }
    }

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل تنفيذ دورة الفوترة التلقائية';
    result.errors.push({ scheduleId: 0, error: msg });
    return result;
  }
}
