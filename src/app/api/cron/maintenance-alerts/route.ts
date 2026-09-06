import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceSchedules } from '@/features/fleet/services/maintenance-schedule.actions';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { recordAuditLog } from '@/lib/audit.server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('غير مصرح', { status: 401 });
    }

    const res = await getMaintenanceSchedules();
    if (!res.success || !res.data) {
      return NextResponse.json({ success: false, error: res.error }, { status: 500 });
    }

    const urgentItems = res.data.filter((s) => s.urgency === 'overdue' || s.urgency === 'due_soon');

    if (urgentItems.length > 0 && process.env.ADMIN_ALERT_PHONE && process.env.WHATSAPP_API_TOKEN) {
      const lines = [
        `⚠️ *تنبيه الصيانة الوقائية للأسطول - Trans Bodanon*`,
        `يوجد عدد (${urgentItems.length}) عمليات صيانة مستحقة أو قريبة الاستحقاق:`,
        `---------------------------`,
        ...urgentItems.slice(0, 5).map((item) => {
          const statusText = item.urgency === 'overdue' ? `متأخرة بـ ${Math.abs(item.daysRemaining)} يوم` : `خلال ${item.daysRemaining} يوم`;
          return `🚛 *${item.plateNumber}* | ${item.maintenance_type}\n⏰ الموعد: ${item.scheduled_date} (${statusText})`;
        }),
        `---------------------------`,
        `يرجى مراجعة قسم الصيانة لاتخاذ الإجراءات الفنية.`,
      ];

      await sendWhatsAppCloudMessage({
        to: process.env.ADMIN_ALERT_PHONE,
        message: lines.join('\n'),
      }).catch((wErr) => console.warn('Maintenance WhatsApp warning:', wErr));
    }

    await recordAuditLog({
      entityType: 'maintenance_cron_check',
      entityId: 0,
      actionType: 'security_alert',
      reason: `فحص الصيانة الوقائية الدوري: تم رصد ${urgentItems.length} مواعيد عاجلة`,
      newData: { urgentCount: urgentItems.length },
    });

    return NextResponse.json({
      success: true,
      urgentCount: urgentItems.length,
      items: urgentItems,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تشغيل فحص الصيانة';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
