import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendTelegramAlert } from '@/lib/telegram';
import { sendDomainEmail } from '@/lib/email-smtp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get('Authorization') ||
      request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing for Cron execution');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date().toISOString().split('T')[0];
    const fifteenDaysLater = new Date();
    fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);
    const targetExpiry = fifteenDaysLater.toISOString().split('T')[0];
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

    // 1. جلب كافة الشركات النشطة لمعالجة كل شركة بمعزل تام (Multi-Tenant Loop)
    const { data: activeCompanies, error: compErr } = await supabase
      .from('companies')
      .select('id, name, alert_phone, alert_email, telegram_chat_id, email_user')
      .eq('is_active', true);

    if (compErr) {
      throw new Error(`Failed to fetch active companies: ${compErr.message}`);
    }

    const companiesList =
      activeCompanies && activeCompanies.length > 0
        ? activeCompanies
        : [
            {
              id: 1,
              name: 'Trans Bodanon International',
              alert_phone: '212694585307',
              alert_email: 'direction@transbodanon.ma',
              telegram_chat_id: '-100192837465',
              email_user: null,
            },
          ];

    const tenantReports: Array<{
      companyId: number;
      companyName: string;
      overdueInvoicesCount: number;
      expiringDocsCount: number;
      channelsDispatched: string[];
    }> = [];

    let totalOverdueInvoices = 0;
    let totalExpiringDocs = 0;
    let notificationsSent = 0;

    // 2. حلقة المعالجة المعزولة لكل شركة مستأجرة
    for (const company of companiesList) {
      // أ. تحويل الفواتير المتأخرة الخاصة بهذه الشركة فقط
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('company_id', company.id)
        .lt('due_date', today)
        .in('status', ['unpaid', 'partially_paid'])
        .select('id, invoice_number, total_amount, currency, client_id');

      // ب. فحص وثائق الأسطول المشرفة على الانتهاء الخاصة بهذه الشركة فقط
      const { data: expiringDocs } = await supabase
        .from('fleet_documents')
        .select('id, document_type, expiry_date, entity_type, entity_id')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .lte('expiry_date', targetExpiry)
        .gte('expiry_date', today);

      const overdueCount = overdueInvoices?.length || 0;
      const expiringCount = expiringDocs?.length || 0;
      totalOverdueInvoices += overdueCount;
      totalExpiringDocs += expiringCount;

      if (overdueCount === 0 && expiringCount === 0) {
        continue;
      }

      // ج. تسجيل حركات التدقيق الأمني
      if (overdueInvoices) {
        for (const inv of overdueInvoices) {
          await recordAuditLog({
            entityType: 'invoices',
            entityId: inv.id,
            actionType: 'security_alert',
            reason: `[${company.name}] تحويل الفاتورة رقم ${inv.invoice_number} إلى حالة متأخرة آلياً.`,
          });
        }
      }

      if (expiringDocs) {
        for (const doc of expiringDocs) {
          await recordAuditLog({
            entityType: 'fleet_documents',
            entityId: doc.id,
            actionType: 'security_alert',
            reason: `[${company.name}] تنبيه قرب انتهاء وثيقة (${doc.document_type}) بتاريخ ${doc.expiry_date}.`,
          });
          notificationsSent++;
        }
      }

      const channelsDispatched: string[] = [];

      // د. قناة 1: إرسال تنبيه WhatsApp لرقم إدارة الشركة
      const targetPhone = company.alert_phone || '212694585307';
      if (
        targetPhone &&
        (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY)
      ) {
        const waMsg =
          `⚠️ *تقرير التنبيهات الصباحية — ${company.name}*\n\n` +
          `• فواتير متأخرة جديدة: *${overdueCount}*\n` +
          `• وثائق أسطول تشارف على الانتهاء (15 يوماً): *${expiringCount}*\n\n` +
          `يرجى مراجعة لوحة التحكم التنفيذية لاتخاذ الإجراء اللازم.`;

        const waRes = await sendWhatsAppCloudMessage({
          to: targetPhone,
          message: waMsg,
          auditEntity: { type: 'company_cron', id: company.id },
        });
        if (waRes.success) channelsDispatched.push('whatsapp');
      }

      // هـ. قناة 2: إرسال تنبيه Telegram فوري لجروب عمليات الشركة مع زر تفاعلي
      const targetTelegramChat =
        company.telegram_chat_id || process.env.TELEGRAM_DEFAULT_CHAT_ID;
      if (targetTelegramChat && process.env.TELEGRAM_BOT_TOKEN) {
        const tgHtml =
          `🚨 <b>تقرير التنبيهات الصباحية | ${company.name}</b>\n\n` +
          `💳 <b>فواتير مستحقة متأخرة:</b> ${overdueCount} فاتورة\n` +
          `🚛 <b>وثائق أسطول تنتهي خلال 15 يوماً:</b> ${expiringCount} وثيقة\n\n` +
          `<i>تم الفحص الآلي بواسطة محرك المراقبة المركزي</i>`;

        const tgRes = await sendTelegramAlert({
          chatId: targetTelegramChat,
          message: tgHtml,
          inlineButtons: [
            [
              {
                text: '📊 فتح لوحة التحكم التنفيذية',
                url: `${siteUrl}/dashboard`,
              },
            ],
          ],
          auditEntity: { type: 'company_cron', id: company.id },
        });
        if (tgRes.success) channelsDispatched.push('telegram');
      }

      // و. قناة 3: إرسال بريد إلكتروني رسمي لإدارة الشركة عبر SMTP الخاص بها
      const targetEmail = company.alert_email || company.email_user;
      if (targetEmail) {
        const emailHtml = `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>⚠️ تقرير التنبيهات الصباحية — ${company.name}</h2>
            <ul>
              <li><strong>فواتير متأخرة جديدة:</strong> ${overdueCount}</li>
              <li><strong>وثائق أسطول تنتهي خلال 15 يوماً:</strong> ${expiringCount}</li>
            </ul>
            <p><a href="${siteUrl}/dashboard">اضغط هنا للدخول إلى لوحة التحكم التنفيذية</a></p>
          </div>
        `;
        const emailRes = await sendDomainEmail({
          companyId: company.id,
          to: targetEmail,
          subject: `⚠️ التنبيهات الصباحية للأسطول والمالية — ${company.name}`,
          html: emailHtml,
        }).catch(() => ({ success: false }));
        if (emailRes.success) channelsDispatched.push('email');
      }

      tenantReports.push({
        companyId: company.id,
        companyName: company.name,
        overdueInvoicesCount: overdueCount,
        expiringDocsCount: expiringCount,
        channelsDispatched,
      });
    }

    return NextResponse.json({
      success: true,
      processedOverdueInvoices: totalOverdueInvoices,
      processedExpiringDocs: totalExpiringDocs,
      notificationsTriggered: notificationsSent,
      tenantsProcessed: tenantReports.length,
      tenantReports,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily Reminders Multi-Tenant Cron Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
