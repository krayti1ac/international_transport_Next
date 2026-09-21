import { createClient } from '@supabase/supabase-js';
import Decimal from 'decimal.js';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendDomainEmail } from '@/lib/email-smtp';
import { recordAuditLog } from '@/lib/audit.server';
import { formatCurrency } from '@/lib/forex';
import type { Invoice, Client } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type ReminderStage = 'upcoming_3d' | 'due_today' | 'overdue_7d' | 'escalation_15d';

export interface ReminderExecutionResult {
  processedInvoices: number;
  remindersSent: number;
  escalationsCount: number;
  skippedInvoices: number;
  errors: Array<{ invoiceId: number; error: string }>;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolves the appropriate reminder stage based on days difference (today - due_date).
 * Negative diffDays = days before due date.
 * Positive diffDays = days after due date.
 */
export function resolveReminderStage(diffDays: number): ReminderStage | null {
  if (diffDays === -3) {
    return 'upcoming_3d';
  }
  if (diffDays === 0) {
    return 'due_today';
  }
  if (diffDays === 7) {
    return 'overdue_7d';
  }
  if (diffDays >= 15 && diffDays % 7 === 0) {
    return 'escalation_15d';
  }
  return null;
}

/**
 * Builds the official WhatsApp & Email notification content for a given reminder stage.
 */
export function buildReminderMessages(
  stage: ReminderStage,
  invoice: Invoice,
  client: Client,
  formattedAmount: string,
  diffDays: number
) {
  let waMessage = '';
  let emailSubject = '';

  const clientName = client.name || 'العميل المحترم';
  const invNumber = invoice.invoice_number;
  const dueDate = invoice.due_date || '';

  if (stage === 'upcoming_3d') {
    emailSubject = `تذكير بموعد استحقاق الفاتورة رقم ${invNumber} - Trans Bodanon`;
    waMessage = `تحية طيبة من شركة Trans Bodanon اللوجستية.\nنود تذكيركم بأن موعد سداد الفاتورة رقم *${invNumber}* بقيمة *${formattedAmount}* يحل بعد 3 أيام (${dueDate}).\nشاكرين لكم حسن تعاونكم الدائم.`;
  } else if (stage === 'due_today') {
    emailSubject = `إشعار استحقاق الفاتورة رقم ${invNumber} اليوم - Trans Bodanon`;
    waMessage = `تحية طيبة ${clientName}.\nيحل اليوم موعد استحقاق الفاتورة رقم *${invNumber}* بقيمة *${formattedAmount}*.\nيرجى التكرم بتأكيد التحويل البنكي وإرسال إشعار السداد.\nالحسابات المعتمدة: Attijariwafa Bank / Banque Populaire.`;
  } else if (stage === 'overdue_7d') {
    emailSubject = `[مستعجل] تأخر سداد الفاتورة رقم ${invNumber} - Trans Bodanon`;
    waMessage = `تنبيه سداد متأخر ⚠️\nالفاتورة رقم *${invNumber}* بمبلغ *${formattedAmount}* تجاوزت تاريخ الاستحقاق بـ 7 أيام.\nنرجو منكم تسوية الرصيد المتبقي لتفادي تأثر جدولة الشحنات القادمة.`;
  } else if (stage === 'escalation_15d') {
    emailSubject = `[إنذار مالي ومطالبة فورية] الفاتورة رقم ${invNumber} متأخرة منذ ${diffDays} يوماً`;
    waMessage = `إشعار تأخير مالي وإيقاف حجوزات ⛔\nالسادة ${clientName}، الفاتورة رقم *${invNumber}* بقيمة *${formattedAmount}* متأخرة منذ ${diffDays} يوماً.\nتم تحويل الملف لقسم الشؤون المالية والقانونية وتجميد الحجوزات المؤتمتة لحين التسوية الكاملة.`;
  }

  return { waMessage, emailSubject };
}

/**
 * Core engine processing automated payment reminders across all open invoices.
 */
export async function processAutomatedPaymentReminders(): Promise<ReminderExecutionResult> {
  const supabase = getSupabaseAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: ReminderExecutionResult = {
    processedInvoices: 0,
    remindersSent: 0,
    escalationsCount: 0,
    skippedInvoices: 0,
    errors: [],
  };

  // 1. استرجاع الفواتير غير المسددة وبيانات العملاء
  const [invoicesRes, clientsRes] = await Promise.all([
    supabase
      .from('invoices')
      .select('*')
      .in('status', ['unpaid', 'partially_paid', 'overdue', 'pending', 'sent']),
    supabase.from('clients').select('id, name, phone, email, ice'),
  ]);

  if (invoicesRes.error) {
    throw new Error(`فشل استرجاع الفواتير: ${invoicesRes.error.message}`);
  }

  const invoices = (invoicesRes.data || []) as Invoice[];
  const clientsMap = new Map(
    ((clientsRes.data || []) as Client[]).map((c) => [String(c.id), c])
  );

  for (const inv of invoices) {
    result.processedInvoices++;
    try {
      if (!inv.due_date || !inv.client_id) {
        result.skippedInvoices++;
        continue;
      }

      const client = clientsMap.get(String(inv.client_id));
      if (!client) {
        result.skippedInvoices++;
        continue;
      }

      const dueDate = new Date(inv.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // حساب المبلغ المتبقي بدقة Decimal.js
      const totalDec = new Decimal(inv.total_amount || 0);
      const paidDec = new Decimal(inv.paid_amount || 0);
      const remainingDec = totalDec.minus(paidDec);

      if (remainingDec.lessThanOrEqualTo(0)) {
        result.skippedInvoices++;
        continue;
      }

      const stage = resolveReminderStage(diffDays);
      if (!stage) {
        result.skippedInvoices++;
        continue;
      }

      const formattedAmount = formatCurrency(remainingDec.toNumber(), inv.currency || 'MAD');
      const { waMessage, emailSubject } = buildReminderMessages(
        stage,
        inv,
        client,
        formattedAmount,
        diffDays
      );

      // إذا كانت الفاتورة متأخرة لأول مرة (7 أيام)، نحدّث حالتها رسمياً في قاعدة البيانات
      if (stage === 'overdue_7d' && inv.status !== 'overdue') {
        await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .eq('id', inv.id);
      }

      // مرحلة التصعيد (15 يوماً فأكثر): إشعار الإدارة العامة داخلياً
      if (stage === 'escalation_15d') {
        result.escalationsCount++;
        await sendWhatsAppCloudMessage({
          to: process.env.ADMIN_PHONE || '212661245589',
          message: `🚨 تنبيه تصعيد تحصيل (فئة C):\nالعميل: ${client.name}\nالفاتورة: ${inv.invoice_number}\nالمبلغ المتبقي: ${formattedAmount}\nأيام التأخير: ${diffDays} يوم.`,
          auditEntity: { type: 'invoices', id: inv.id },
        });
      }

      // 2. إرسال الإشعار للعميل عبر WhatsApp
      if (client.phone) {
        await sendWhatsAppCloudMessage({
          to: client.phone,
          message: waMessage,
          auditEntity: { type: 'invoices', id: inv.id },
        });
      }

      // 3. إرسال بريد إلكتروني رسمي
      if (client.email) {
        const emailBody = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
            <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h2 style="color: #0f172a; margin-top: 0;">شركة ترانس بودانون للنقل الدولي (Trans Bodanon TMS)</h2>
              <p>السادة الشركاء / <strong>${client.name}</strong> المحترمون،</p>
              <p style="font-size: 14px; line-height: 1.6;">${waMessage.replace(/\n/g, '<br/>')}</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr style="background: #f1f5f9;">
                  <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: start;">رقم الفاتورة</th>
                  <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">المبلغ المتبقي</th>
                  <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">تاريخ الاستحقاق</th>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">${inv.invoice_number}</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b91c1c;">${formattedAmount}</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">${inv.due_date}</td>
                </tr>
              </table>
              <div style="margin-top: 24px; padding: 12px; background-color: #f8fafc; border-right: 4px solid #0284c7; font-size: 13px;">
                <strong>بيانات الحسابات البنكية المعتمدة للتحويل:</strong><br/>
                • التجاري وفا بنك (Attijariwafa Bank): RIB 007 780 0001234567890123 45<br/>
                • البنك الشعبي (Banque Populaire): RIB 211 110 0009876543210987 65
              </div>
              <p style="margin-top: 20px; font-size: 11px; color: #64748b;">هذا إشعار مؤتمت صادر عن نظام الإدارة والتحصيل الإلكتروني لشركة Trans Bodanon.</p>
            </div>
          </div>
        `;

        await sendDomainEmail({
          to: client.email,
          subject: emailSubject,
          html: emailBody,
          companyId: inv.company_id || 1,
        });
      }

      // 4. توثيق العملية في سجل التدقيق الأمني
      await recordAuditLog({
        entityType: 'invoices',
        entityId: inv.id,
        actionType: 'whatsapp_notification',
        reason: `تذكير تحصيل مجدول (${stage}) للعميل ${client.name}`,
        newData: {
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          stage,
          daysDiff: diffDays,
          remainingAmount: remainingDec.toNumber(),
          currency: inv.currency,
        },
      });

      result.remindersSent++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ invoiceId: inv.id, error: errMsg });
    }
  }

  return result;
}

