import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. التحقق الأمني من Vercel
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    // 2. تحديث الفواتير المتأخرة آلياً (تجاوزت تاريخ الاستحقاق ولم تسدد)
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .lt('due_date', today)
      .in('status', ['unpaid', 'partially_paid'])
      .select('id, invoice_number');

    if (invError) throw invError;

    // 3. رصد وثائق الأسطول المنتهية أو التي ستنتهي خلال 14 يوماً
    const fourteenDaysFromNow = new Date();
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
    const alertDate = fourteenDaysFromNow.toISOString().split('T')[0];

    const { data: docs, error: docsError } = await supabase
      .from('fleet_documents')
      .select('id, document_type, expiry_date')
      .eq('is_archived', false)
      .lte('expiry_date', alertDate);

    if (docsError) throw docsError;

    // 4. تسجيل التنبيهات في سجل التدقيق (لتظهر في لوحة الإدارة)
    if (invoices && invoices.length > 0) {
      await recordAuditLog({
        entityType: 'cron_invoices',
        entityId: 'system',
        actionType: 'security_alert',
        reason: `تم تحويل ${invoices.length} فواتير إلى حالة "متأخرة" آلياً لتجاوزها تاريخ الاستحقاق.`,
      });
    }

    if (docs && docs.length > 0) {
      await recordAuditLog({
        entityType: 'cron_fleet_docs',
        entityId: 'system',
        actionType: 'security_alert',
        reason: `تنبيه آلي: يوجد ${docs.length} وثائق أسطول منتهية أو تقارب الانتهاء (خلال 14 يوماً).`,
      });
    }

    return NextResponse.json({ 
      success: true, 
      updatedInvoices: invoices?.length || 0,
      expiringDocuments: docs?.length || 0
    });

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Cron Alert Error:', error);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

