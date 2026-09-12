'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { mapKanbanStageToDbStatus } from '@/lib/utils/trip-status';
import type { TreasuryTransaction } from '@/types/database';
import { sendCompanyEmail } from '@/lib/email';
import { recordAuditLog } from '@/lib/audit.server';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RecordPettyCashExpenseInput {
  amount: number;
  description: string;
  category?: 'office_expense' | 'trip_expense';
  reference?: string;
}

/**
 * Record a petty cash expense directly out of the Secretary Cash Box ('secretary_cash')
 * Enforces Decimal.js precision for financial values.
 */
export async function recordSecretaryPettyCashExpense(
  input: RecordPettyCashExpenseInput
): Promise<{ success: boolean; data?: TreasuryTransaction; error?: string }> {
  try {
    const supabase = await createClient();

    const amountDec = new Decimal(input.amount || 0);
    if (amountDec.lessThanOrEqualTo(0)) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من الصفر' };
    }

    if (!input.description?.trim()) {
      return { success: false, error: 'يرجى توضيح سبب المصروف' };
    }

    // Locate secretary cash box
    const { data: cashBox, error: cashBoxError } = await supabase
      .from('cash_boxes')
      .select('id, currency')
      .eq('code', 'secretary_cash')
      .maybeSingle();

    if (cashBoxError || !cashBox) {
      return { success: false, error: 'صندوق السكرتيرة غير معرف في النظام' };
    }

    const expenseType = input.category || 'office_expense';

    const { data: transaction, error: insertError } = await supabase
      .from('treasury_transactions')
      .insert({
        type: expenseType,
        amount: parseFloat(amountDec.toFixed(2)),
        currency: cashBox.currency || 'MAD',
        cash_box_id: cashBox.id,
        description: input.description.trim(),
        reference: input.reference?.trim() || null,
        reconciliation_status: 'cleared',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting secretary petty cash expense:', insertError);
      return { success: false, error: insertError.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/treasury');

    return { success: true, data: transaction as TreasuryTransaction };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل المصروف';
    return { success: false, error: message };
  }
}

/**
 * Quick stage advance for trip orders in the secretary operations pipeline
 */
export async function advanceTripStageAction(
  tripId: number,
  nextStage: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const dbStatus = mapKanbanStageToDbStatus(nextStage);
    if (!dbStatus) {
      return { success: false, error: `مرحلة غير صالحة: ${nextStage}` };
    }

    const { error } = await supabase
      .from('trip_orders')
      .update({ status: dbStatus })
      .eq('id', tripId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/trips');

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث مرحلة الرحلة';
    return { success: false, error: message };
  }
}

export interface SendTripNotificationResult {
  success: boolean;
  error?: string;
  clientName?: string;
  clientEmail?: string;
  safeRedirected?: boolean;
}

/**
 * Send Trip Tracking Email Notification from Secretary or Management to Client
 * Automatically respects the Safety Safeguard (redirecting to admin email in dev/test)
 * and records an immutable audit log.
 */
export async function sendTripNotificationBySecretaryAction(
  tripId: number
): Promise<SendTripNotificationResult> {
  try {
    const supabase = await createClient();

    // 1. التحقق من صلاحية السكرتيرة أو الإدارة
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'غير مصرح - يرجى تسجيل الدخول أولاً' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAuthorized =
      userProfile?.role === 'admin' ||
      userProfile?.role === 'secretary' ||
      userProfile?.role === 'super_admin';

    if (!isAuthorized) {
      return { success: false, error: 'غير مصرح لك بإرسال إشعارات التتبع للعملاء' };
    }

    // 2. جلب بيانات الرحلة والعميل المرتبط بها
    const { data: trip, error: tripError } = await supabase
      .from('trip_orders')
      .select(`
        id,
        cmr_number,
        route,
        departure_date,
        status,
        client:clients (
          id,
          name,
          email
        )
      `)
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return { success: false, error: 'تعذر العثور على بيانات أمر النقل' };
    }

    const client = (Array.isArray(trip.client) ? trip.client[0] : trip.client) as {
      id: number;
      name: string;
      email: string;
    } | null;

    if (!client || !client.email) {
      return {
        success: false,
        error: 'بيانات العميل أو عنوان بريده الإلكتروني غير متوفرة في النظام',
      };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';
    const trackingUrl = `${appUrl}/track/${trip.id}`;

    // 3. بناء قالب البريد بتصميم احترافي متجاوب
    const formattedDeparture = trip.departure_date
      ? new Date(trip.departure_date).toLocaleDateString('ar-MA', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'قيد الانطلاق اليوم';

    const cmrDisplay = trip.cmr_number
      ? `#${trip.cmr_number}`
      : `#TB-2026-${String(trip.id).padStart(3, '0')}`;

    const emailHtml = `
      <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; padding: 40px 15px; color: #1e293b; line-height: 1.6;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #090a0f 0%, #0f766e 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Trans Bodanon International Transport</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #99f6e4; font-weight: 500;">شريككم الموثوق في النقل الدولي واللوجستيات عبر الحدود</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 16px; margin: 0 0 16px 0;">مرحباً <strong>${client.name}</strong>،</p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px 0;">
                يسر قسم العمليات في شركة <strong>Trans Bodanon</strong> إبلاغكم بأن شحنتكم قد انطلقت وهي الآن في طريقها نحو الوجهة المحددة:
              </p>

              <!-- Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" style="font-size: 13px; color: #334155;">
                      <tr>
                        <td style="padding: 6px 0; font-weight: 700; color: #0f766e; width: 35%;">رقم الرحلة / الـ CMR:</td>
                        <td style="padding: 6px 0; font-family: monospace; font-weight: 700;">${cmrDisplay}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 700; color: #0f766e;">مسار النقل:</td>
                        <td style="padding: 6px 0; font-weight: 600;">${trip.route || 'خط سير دولي مباشر'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 700; color: #0f766e;">تاريخ الانطلاق:</td>
                        <td style="padding: 6px 0;">${formattedDeparture}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-weight: 700; color: #0f766e;">حالة الشحنة:</td>
                        <td style="padding: 6px 0;"><span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px;">في الطريق (In Transit)</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <div style="text-align: center; margin-bottom: 28px;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 14px;">
                  يمكنكم متابعة مسار الشاحنة ولحظة العبور الجمركي ورؤية مستند e-CMR مباشرة ودون الحاجة لتسجيل دخول عبر الرابط التالي:
                </p>
                <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(15, 118, 110, 0.2);">
                  📍 متابعة الشاحنة حياً على الخريطة (Live Tracking & e-CMR)
                </a>
              </div>

              <!-- Footer note -->
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                صدر هذا الإشعار آلياً عبر قسم السكرتارية والعمليات — Trans Bodanon TMS.<br />
                في حال وجود أي استفسار عاجل، يرجى التواصل مع مسؤول العمليات.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const subject = `إشعار انطلاق الرحلة (${cmrDisplay}) - Trans Bodanon`;

    // 4. إرسال البريد عبر المحرك وصمام الأمان
    const result = await sendCompanyEmail({
      to: client.email,
      subject,
      html: emailHtml,
    });

    // 5. توثيق الإجراء في سجل التدقيق الأمني (Audit Log)
    if (result.success) {
      await recordAuditLog({
        entityType: 'trip_orders',
        entityId: trip.id,
        actionType: 'security_alert',
        reason: `قامت السكرتارية (${user.email}) بإرسال إشعار التتبع للعميل (${client.name})`,
        newData: {
          trackingUrl,
          clientEmail: client.email,
          safeRedirected: result.safeRedirected,
        },
      });
    }

    return {
      success: result.success,
      error: result.error,
      clientName: client.name,
      clientEmail: client.email,
      safeRedirected: result.safeRedirected,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال إشعار التتبع';
    console.error('Error sending trip notification:', err);
    return { success: false, error: message };
  }
}


