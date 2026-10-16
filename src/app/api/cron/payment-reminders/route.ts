import { NextResponse, type NextRequest } from 'next/server';
import { processAutomatedPaymentReminders } from '@/features/invoices/services/payment-reminders.service';
import { processMultiTenantSmartDunningCron } from '@/features/finance/services/smart-dunning-cron.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max duration of 60 seconds

export async function GET(request: NextRequest) {
  const authHeader =
    request.headers.get('Authorization') || request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify bearer authorization if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        success: false,
        error: 'غير مصرح بالوصول: مفتاح التفويض CRON_SECRET مفقود أو غير مطابق',
      },
      { status: 401 }
    );
  }

  try {
    const [legacyResult, multiTenantResult] = await Promise.all([
      processAutomatedPaymentReminders().catch(() => ({
        processedInvoices: 0,
        remindersSent: 0,
        escalationsCount: 0,
        skippedInvoices: 0,
        errors: [],
      })),
      processMultiTenantSmartDunningCron(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        processed:
          legacyResult.processedInvoices + multiTenantResult.totalReceivablesEvaluated,
        remindersSent:
          legacyResult.remindersSent + multiTenantResult.totalDunningDispatched,
        escalations:
          legacyResult.escalationsCount + multiTenantResult.totalLegalEscalations,
        skipped: legacyResult.skippedInvoices,
        errorsCount: legacyResult.errors.length + multiTenantResult.errors.length,
      },
      multiTenantDunning: multiTenantResult,
      errors: [...legacyResult.errors, ...multiTenantResult.errors],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'خطأ غير متوقع أثناء معالجة تذكيرات الفواتير المجدولة';
    console.error('[Payment Reminders Cron Error]:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
