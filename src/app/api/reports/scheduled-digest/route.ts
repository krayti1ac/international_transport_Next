import { NextRequest, NextResponse } from 'next/server';
import { getExecutiveKpis } from '@/features/analytics/services/executive-metrics.actions';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/forex';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('غير مصرح', { status: 401 });
    }

    const reportRes = await getExecutiveKpis();
    if (!reportRes.success || !reportRes.data) {
      return NextResponse.json({ success: false, error: reportRes.error }, { status: 500 });
    }

    const kpi = reportRes.data;

    await recordAuditLog({
      entityType: 'monthly_scheduled_report',
      entityId: new Date().getMonth() + 1,
      actionType: 'create',
      reason: `توليد التقرير التنفيذي الدوري لشهر ${new Date().toLocaleDateString('ar-MA', { month: 'long', year: 'numeric' })}`,
      newData: kpi as unknown as Record<string, unknown>,
    });

    const supabase = await createClient();
    const { data: adminUser } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    const recipientPhone = process.env.ADMIN_ALERT_PHONE;
    if (recipientPhone && process.env.WHATSAPP_API_TOKEN) {
      const message = [
        `📊 *التقرير التنفيذي الشهري - Trans Bodanon*`,
        `📅 الفترة: من ${kpi.periodStart} إلى ${kpi.periodEnd}`,
        `---------------------------`,
        `💰 الإيراد (MAD): ${formatCurrency(kpi.totalRevenueMAD, 'MAD')}`,
        `💶 الإيراد (EUR): ${formatCurrency(kpi.totalRevenueEUR, 'EUR')}`,
        `📈 صافي الأرباح: ${formatCurrency(kpi.netProfitMAD, 'MAD')} (هامش ${kpi.profitMarginPercent}%)`,
        `🚚 إجمالي الرحلات: ${kpi.totalTripsCount} (المنفذة: ${kpi.completedTripsCount})`,
        `⚠️ ديون العملاء المعلقة: ${formatCurrency(kpi.totalOverdueDebtMAD, 'MAD')} (${kpi.unpaidInvoicesCount} فاتورة)`,
        `🚛 نسبة تشغيل الأسطول: ${kpi.fleetUtilizationRate}%`,
        `⛽ معدل استهلاك الوقود: ${kpi.fleetAverageLitersPer100Km} L/100 km`,
        `---------------------------`,
        `تم التوليد آلياً من نظام Trans Bodanon ERP.`,
      ].join('\n');

      await sendWhatsAppCloudMessage({
        to: recipientPhone,
        message,
      }).catch((err) => console.warn('WhatsApp scheduled dispatch warning:', err));
    }

    return NextResponse.json({
      success: true,
      data: kpi,
      generatedFor: adminUser?.email || 'admin',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تشغيل التقرير المجدول';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
