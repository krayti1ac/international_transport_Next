'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendDomainEmail } from '@/lib/email-smtp';
import { recordAuditLog } from '@/lib/audit.server';
import {
  sendSecretaryEmailSchema,
  markEmailReadSchema,
  linkEmailTripSchema,
  type SendSecretaryEmailInput,
} from '../schemas/email.schema';
import type { EmailMessage, EmailFilterParams } from '../types/email.types';

/**
 * Fetch email messages with filtering and trip relations
 */
export async function getEmailMessagesAction(
  filters?: EmailFilterParams
): Promise<{ success: boolean; data?: EmailMessage[]; error?: string }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('email_messages')
      .select(`
        id,
        company_id,
        trip_id,
        message_id,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        body_text,
        body_html,
        attachments,
        is_read,
        direction,
        created_at,
        trip:trip_orders (
          id,
          cmr_number,
          route
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.direction && filters.direction !== 'all') {
      query = query.eq('direction', filters.direction);
    }

    if (filters?.tripId) {
      query = query.eq('trip_id', filters.tripId);
    }

    if (filters?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching email messages:', error);
      return { success: false, error: error.message };
    }

    // Filter by search string if provided
    let results = (data || []) as unknown as EmailMessage[];
    if (filters?.search?.trim()) {
      const s = filters.search.toLowerCase().trim();
      results = results.filter(
        (m) =>
          m.subject?.toLowerCase().includes(s) ||
          m.sender_email?.toLowerCase().includes(s) ||
          m.sender_name?.toLowerCase().includes(s) ||
          m.recipient_email?.toLowerCase().includes(s) ||
          m.body_text?.toLowerCase().includes(s) ||
          (m.trip?.cmr_number && m.trip.cmr_number.toLowerCase().includes(s))
      );
    }

    return { success: true, data: results };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في جلب رسائل البريد';
    return { success: false, error: message };
  }
}

/**
 * Send an email from secretary/operations via domain SMTP and log to email_messages
 */
export async function sendSecretaryEmailAction(
  input: SendSecretaryEmailInput
): Promise<{ success: boolean; error?: string; messageId?: string; safeRedirected?: boolean }> {
  try {
    const parsed = sendSecretaryEmailSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'بيانات البريد غير صحيحة' };
    }

    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'غير مصرح - يرجى تسجيل الدخول' };
    }

    // Convert newlines to simple HTML paragraphs if plain text
    const htmlContent = `
      <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 15px;">
        ${parsed.data.body.replace(/\n/g, '<br/>')}
      </div>
    `;

    const result = await sendDomainEmail({
      to: parsed.data.to,
      subject: parsed.data.subject,
      html: htmlContent,
      text: parsed.data.body,
      tripId: parsed.data.tripId,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'فشل إرسال البريد الإلكتروني عبر خادم الدومين' };
    }

    // Audit log
    await recordAuditLog({
      entityType: 'email_messages',
      entityId: result.messageId || 'outbound',
      actionType: 'security_alert',
      reason: `قامت السكرتارية (${user.email}) بإرسال بريد صادر إلى (${parsed.data.to}) بعنوان: "${parsed.data.subject}"`,
      newData: {
        to: parsed.data.to,
        subject: parsed.data.subject,
        tripId: parsed.data.tripId,
        safeRedirected: result.safeRedirected,
      },
    });

    revalidatePath('/dashboard');
    return {
      success: true,
      messageId: result.messageId,
      safeRedirected: result.safeRedirected,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال البريد';
    return { success: false, error: message };
  }
}

/**
 * Mark email as read or unread
 */
export async function markEmailAsReadAction(
  id: number,
  isRead: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = markEmailReadSchema.safeParse({ id, isRead });
    if (!parsed.success) {
      return { success: false, error: 'معرف البريد غير صالح' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('email_messages')
      .update({ is_read: isRead })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في تحديث حالة القراءة';
    return { success: false, error: message };
  }
}

/**
 * Manually link or unlink an email to a trip order
 */
export async function linkEmailToTripAction(
  emailId: number,
  tripId: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = linkEmailTripSchema.safeParse({ emailId, tripId });
    if (!parsed.success) {
      return { success: false, error: 'البيانات المدخلة غير صالحة' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('email_messages')
      .update({ trip_id: tripId })
      .eq('id', emailId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في ربط البريد بالرحلة';
    return { success: false, error: message };
  }
}

/**
 * Delete an email message
 */
export async function deleteEmailMessageAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from('email_messages').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في حذف الرسالة';
    return { success: false, error: message };
  }
}

