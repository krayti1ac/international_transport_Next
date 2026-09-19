import { NextRequest, NextResponse } from 'next/server';
import { getMaintenanceSchedules } from '@/features/fleet/services/maintenance-schedule.actions';
import { scanFleetMileageRadar, dispatchMaintenanceWhatsAppAlert } from '@/features/fleet/services/fleet-mileage-radar.actions';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { recordAuditLog } from '@/lib/audit.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify cron authorization secret if configured
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('غير مصرح', { status: 401 });
    }

    const res = await getMaintenanceSchedules();
    if (!res.success || !res.data) {
      return NextResponse.json({ success: false, error: res.error }, { status: 500 });
    }
    const adminPhone = process.env.ADMIN_ALERT_PHONE || '212694585307';

    const urgentItems = res.data.filter((s) => s.urgency === 'overdue' || s.urgency === 'due_soon');
    // 2. Scan calendar-based maintenance schedules
    const calendarRes = await getMaintenanceSchedules();
    const urgentCalendarItems = calendarRes.success && calendarRes.data
      ? calendarRes.data.filter((s) => s.urgency === 'overdue' || s.urgency === 'due_soon')
      : [];

    // 3. Scan cumulative GPS mileage-based predictive maintenance
    const mileageRadarReport = await scanFleetMileageRadar();
    const urgentMileageAlerts = mileageRadarReport.success ? mileageRadarReport.alerts : [];

    // 4. Dispatch WhatsApp alerts for calendar maintenance if needed
    if (urgentCalendarItems.length > 0 && (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY)) {
      const lines = [
        `⚠️ *تنبيه الصيانة الوقائية للأسطول - Trans Bodanon*`,
        `يوجد عدد (${urgentCalendarItems.length}) تنبيهات مواعيد مستحقة:`,
        `---------------------------`,
        ...urgentCalendarItems.slice(0, 5).map((item) => {
          const statusText = item.urgency === 'overdue' ? `متأخرة بـ ${Math.abs(item.daysRemaining)} يوم` : `خلال ${item.daysRemaining} يوم`;
          return `🚛 *${item.plateNumber}* | ${item.maintenance_type}\n⏰ الموعد: ${item.scheduled_date} (${statusText})`;
        }),
        urgentCalendarItems.length > 5 ? `\n...و ${urgentCalendarItems.length - 5} عناصر أخرى.` : '',
      ].filter(Boolean);

      await sendWhatsAppCloudMessage({
        to: adminPhone,
        message: lines.join('\n'),
      }).catch((wErr) => console.warn('Calendar Maintenance WhatsApp warning:', wErr));
    }

    // توثيق العملية في سجل التدقيق
    // 5. Dispatch WhatsApp alerts for mileage-based radar if needed
    if (urgentMileageAlerts.length > 0 && (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY)) {
      await dispatchMaintenanceWhatsAppAlert(adminPhone).catch((wErr) =>
        console.warn('Mileage Radar WhatsApp warning:', wErr)
      );
    }

    // 6. Record combined audit log
    await recordAuditLog({
      entityType: 'maintenance_cron_check',
      entityId: '0',
      actionType: 'security_alert',
      reason: `فحص الصيانة الوقائية والعدادات الدوري: تم رصد ${urgentCalendarItems.length} مواعيد تقويمية و ${urgentMileageAlerts.length} تنبيهات عداد كيلومترات`,
      newData: {
        calendarUrgentCount: urgentCalendarItems.length,
        mileageAlertsCount: urgentMileageAlerts.length,
        scannedTrucksCount: mileageRadarReport.trucksScanned,
      },
    });

    return NextResponse.json({
      success: true,
      urgentCount: urgentCalendarItems.length + urgentMileageAlerts.length,
      timestamp: new Date().toISOString(),
      calendar: {
        urgentCount: urgentCalendarItems.length,
        items: urgentCalendarItems,
      },
      mileageRadar: {
        trucksScanned: mileageRadarReport.trucksScanned,
        alertsCount: urgentMileageAlerts.length,
        alerts: urgentMileageAlerts,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تشغيل فحص الصيانة الدوري';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
