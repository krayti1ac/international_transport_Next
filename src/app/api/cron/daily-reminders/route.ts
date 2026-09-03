import { NextResponse } from 'next/server';
import { sendOverdueInvoiceReminders } from '@/features/invoices/services/whatsapp_reminders.actions';
import { AppLogger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    // 1. تأمين المسار: التحقق من أن الطلب قادم فعلياً من Vercel Cron
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      AppLogger.warning('محاولة غير مصرح بها للوصول إلى Cron Job الفواتير المتأخرة.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. تشغيل الأتمتة: إرسال الإشعارات عبر WhatsApp
    AppLogger.info('بدء المهمة المجدولة: فحص الفواتير المتأخرة...');
    const result = await sendOverdueInvoiceReminders();

    if (!result.success) {
      throw new Error(result.error || 'فشل في تنفيذ خدمة الإشعارات');
    }

    AppLogger.info(`نجاح المهمة المجدولة: تم إرسال ${result.sentCount} إشعار واتساب.`);

    return NextResponse.json({
      success: true,
      message: `Daily reminder cron completed. Sent ${result.sentCount} messages.`,
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'digest' in error) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    AppLogger.error('خطأ أثناء تشغيل Cron Job الفواتير:', error);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

