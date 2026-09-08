import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. فحص وتحويل الفواتير المتأخرة
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .lt('due_date', today)
      .in('status', ['unpaid', 'partially_paid'])
      .select('id, invoice_number, total_amount, currency, client_id');

    // 2. فحص وثائق الأسطول التي تنتهي خلال 15 يوماً
    const fifteenDaysLater = new Date();
    fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);
    const targetExpiry = fifteenDaysLater.toISOString().split('T')[0];

    const { data: expiringDocs } = await supabase
      .from('fleet_documents')
      .select('id, document_type, expiry_date, entity_type, entity_id')
      .eq('is_archived', false)
      .lte('expiry_date', targetExpiry)
      .gte('expiry_date', today);

    let notificationsSent = 0;

    // 3. توثيق الفواتير المتأخرة في سجل التدقيق
    if (overdueInvoices && overdueInvoices.length > 0) {
      for (const inv of overdueInvoices) {
        await recordAuditLog({
          entityType: 'invoices',
          entityId: inv.id,
          actionType: 'security_alert',
          reason: `تحويل الفاتورة رقم ${inv.invoice_number} إلى حالة متأخرة آلياً بواسطة الـ Cron.`,
        });
      }
    }

    // 4. توثيق وثائق الأسطول المشرفة على الانتهاء
    if (expiringDocs && expiringDocs.length > 0) {
      for (const doc of expiringDocs) {
        await recordAuditLog({
          entityType: 'fleet_documents',
          entityId: doc.id,
          actionType: 'security_alert',
          reason: `تنبيه قرب انتهاء صلاحية وثيقة الأسطول (${doc.document_type}) بتاريخ ${doc.expiry_date}.`,
        });
        notificationsSent++;
      }
    }

    // 5. إرسال تنبيه مجمع للإدارة عبر WhatsApp عند توفر التوكن
    if (process.env.WHATSAPP_API_TOKEN && (overdueInvoices?.length || expiringDocs?.length)) {
      const summaryMsg = `⚠️ *تقرير التنبيهات الصباحية - Trans Bodanon*\n` +
        `• فواتير متأخرة جديدة: ${overdueInvoices?.length || 0}\n` +
        `• وثائق أسطول تشارف على الانتهاء: ${expiringDocs?.length || 0}\n` +
        `يرجى مراجعة لوحة التحكم التنفيذية لاتخاذ الإجراء الفوري.`;
      await sendWhatsAppCloudMessage({
        to: '212694585307',
        message: summaryMsg,
      }).catch((wErr) => console.warn('Cron WhatsApp warning:', wErr));
    }

    return NextResponse.json({
      success: true,
      processedOverdueInvoices: overdueInvoices?.length || 0,
      processedExpiringDocs: expiringDocs?.length || 0,
      notificationsTriggered: notificationsSent,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Daily Reminders Cron Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
