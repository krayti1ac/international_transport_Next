import { NextResponse } from 'next/server';
import { getOverdueInvoiceReminders } from '@/features/invoices/services/whatsapp_reminders.actions';

export async function GET() {
  try {
    const result = await getOverdueInvoiceReminders();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const links = (result.reminders || []).map((reminder) => ({
      invoiceId: reminder.invoice.id,
      invoiceNumber: reminder.invoice.invoice_number || `#${reminder.invoice.id}`,
      clientId: reminder.client.id,
      clientName: reminder.client.name,
      clientPhone: reminder.client.phone,
      amount: reminder.invoice.ttc_amount || reminder.invoice.total_amount || '0',
      currency: reminder.invoice.currency,
      dueDate: reminder.invoice.due_date,
      message: reminder.message,
      waMeLink: reminder.whatsappLink,
      daysOverdue: reminder.daysOverdue,
    }));

    return NextResponse.json(links);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await getOverdueInvoiceReminders();
    return NextResponse.json({
      count: result.reminders?.length || 0,
      reminders: result.reminders,
      success: result.success,
      error: result.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
