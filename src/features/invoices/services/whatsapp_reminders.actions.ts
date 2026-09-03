'use server';

import { createClient } from '@/lib/supabase/server';
import { generateWhatsAppLink } from '@/lib/utils/whatsapp-links';
import type { Invoice, Client } from '@/types/database';

export interface OverdueInvoiceReminder {
  invoice: Invoice;
  client: Client;
  daysOverdue: number;
  whatsappLink: string;
  message: string;
}

export type WhatsAppReminderLink = OverdueInvoiceReminder;

export async function getOverdueInvoiceReminders(): Promise<{
  success: boolean;
  reminders?: OverdueInvoiceReminder[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: overdueInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('status', 'overdue')
      .order('due_date', { ascending: true });

    if (invoicesError) throw invoicesError;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return { success: true, reminders: [] };
    }

    const clientIds = [...new Set(overdueInvoices.map(inv => inv.client_id))];
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('id', clientIds);

    if (clientsError) throw clientsError;

    const clientsMap = new Map((clients || []).map(c => [c.id, c]));

    const reminders: OverdueInvoiceReminder[] = [];

    for (const invoice of overdueInvoices) {
      const client = clientsMap.get(invoice.client_id);
      if (!client) continue;

      const dueDate = new Date(invoice.due_date || invoice.issue_date || new Date());
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) continue;

      const amount = invoice.ttc_amount || invoice.total_amount || '0';
      const clientName = client.name || 'Client';
      const invoiceNum = invoice.invoice_number || 'N/A';
      const currency = invoice.currency || 'MAD';
      const reminderMessage = `Dear ${clientName}, your invoice #${invoiceNum} for ${amount} ${currency} is overdue by ${daysOverdue} days. Please settle it.`;

      const whatsappLink = generateWhatsAppLink(client.phone, 'overdue_invoice', {
        truck_plate: invoiceNum,
        trailer_plate: `${daysOverdue} days overdue`,
      });

      reminders.push({
        invoice,
        client,
        daysOverdue,
        whatsappLink,
        message: reminderMessage,
      });
    }

    return { success: true, reminders };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch overdue invoice reminders';
    return { success: false, error: message };
  }
}

export async function sendOverdueInvoiceReminders(): Promise<{
  success: boolean;
  sentCount: number;
  error?: string;
}> {
  try {
    const remindersResult = await getOverdueInvoiceReminders();

    if (!remindersResult.success || !remindersResult.reminders) {
      return { success: false, sentCount: 0, error: remindersResult.error || 'No reminders found' };
    }

    let sentCount = 0;

    for (const reminder of remindersResult.reminders) {
      try {
        if (!reminder.client?.phone) {
          console.warn(`Skipping reminder: no phone number for client ${reminder.client?.name || reminder.client?.id || 'unknown'}`);
          continue;
        }
        const { sendWhatsAppCloudMessage } = await import('@/lib/whatsapp');
        await sendWhatsAppCloudMessage({
          to: reminder.client.phone,
          message: reminder.message,
        });
        sentCount++;
      } catch (sendErr) {
        console.error(`Failed to send reminder for invoice ${reminder.invoice.id}:`, sendErr);
      }
    }

    return { success: true, sentCount };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send overdue reminders';
    return { success: false, sentCount: 0, error: message };
  }
}
