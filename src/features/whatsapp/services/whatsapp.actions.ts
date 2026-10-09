'use server';

/**
 * Trans Bodanon TMS — WhatsApp Server Actions
 * Mutations for interactive messaging, automated trip alerts,
 * payment link reminders, and console testing.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  sendInteractiveButtonsSchema,
  triggerAutomatedTripDispatchSchema,
  triggerAutomatedInvoiceReminderSchema,
  simulateWebhookEventSchema,
} from '../schemas/whatsapp.schemas';
import {
  sendWhatsAppInteractiveButtons,
  sendWhatsAppText,
} from './whatsapp-meta-client';
import {
  dispatchTripDepartureInteractive,
  dispatchInteractiveInvoiceReminder,
} from './whatsapp-automated-dispatch.service';
import { processInboundWhatsAppMessage } from './whatsapp-bot.service';
import type { MetaWebhookMessage } from '../types/whatsapp.types';

/**
 * 1. Sends an interactive quick-reply message via WhatsApp Cloud API
 */
export async function sendInteractiveButtonsAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'يجب تسجيل الدخول لإجراء هذه العملية' };
    }

    const validated = sendInteractiveButtonsSchema.parse(rawInput);
    const result = await sendWhatsAppInteractiveButtons({
      to: validated.to,
      body: validated.body,
      headerText: validated.headerText,
      footerText: validated.footerText,
      buttons: validated.buttons,
    });

    revalidatePath('/whatsapp-notifications');
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: error.message || 'فشل إرسال الرسالة التفاعلية' };
  }
}

/**
 * 2. Triggers interactive trip departure notification with e-CMR and tracking buttons
 */
export async function triggerTripDepartureInteractiveAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح' };
    }

    const { tripId } = triggerAutomatedTripDispatchSchema.parse(rawInput);
    const result = await dispatchTripDepartureInteractive(tripId);

    revalidatePath('/whatsapp-notifications');
    revalidatePath('/trips');
    return { ...result };
  } catch (error: any) {
    return { success: false, error: error.message || 'فشل إطلاق إشعار انطلاق الشحنة' };
  }
}

/**
 * 3. Triggers interactive invoice payment reminder with instant payment link
 */
export async function triggerInvoicePaymentReminderInteractiveAction(rawInput: unknown) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح' };
    }

    const { invoiceId } = triggerAutomatedInvoiceReminderSchema.parse(rawInput);
    const result = await dispatchInteractiveInvoiceReminder(invoiceId);

    revalidatePath('/whatsapp-notifications');
    revalidatePath('/whatsapp-reminders');
    revalidatePath('/invoices');
    return { ...result };
  } catch (error: any) {
    return { success: false, error: error.message || 'فشل إرسال تذكير الفاتورة' };
  }
}

/**
 * 4. Simulates an inbound WhatsApp webhook message/button click (for test lab and QA)
 */
export async function simulateInboundMessageAction(rawInput: unknown) {
  try {
    const validated = simulateWebhookEventSchema.parse(rawInput);

    const simulatedMessage: MetaWebhookMessage = {
      from: validated.fromPhone,
      id: `sim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type:
        validated.messageType === 'interactive_button'
          ? 'interactive'
          : validated.messageType === 'location'
            ? 'location'
            : 'text',
    };

    if (validated.messageType === 'interactive_button') {
      simulatedMessage.interactive = {
        type: 'button_reply',
        button_reply: {
          id: validated.buttonId || 'btn_track_501',
          title: validated.buttonTitle || '📍 تتبع الشحنة',
        },
      };
    } else if (validated.messageType === 'location') {
      simulatedMessage.location = {
        latitude: validated.latitude || 30.4278,
        longitude: validated.longitude || -9.5981,
        name: 'Agadir Port Hub',
      };
    } else {
      simulatedMessage.text = {
        body: validated.textBody || 'تتبع 501',
      };
    }

    const botResult = await processInboundWhatsAppMessage(simulatedMessage);

    revalidatePath('/whatsapp-notifications');
    return { success: true, botResult };
  } catch (error: any) {
    return { success: false, error: error.message || 'فشل محاكاة الرسالة' };
  }
}

/**
 * 5. Fetches recent WhatsApp message logs from database
 */
export async function getWhatsAppMessageLogsAction(limit: number = 20) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('whatsapp_message_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Table might not exist in non-migrated environment, return fallback
      return { success: true, logs: [] };
    }

    return { success: true, logs: data || [] };
  } catch (err: any) {
    return { success: true, logs: [] };
  }
}

