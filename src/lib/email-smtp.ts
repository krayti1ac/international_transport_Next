import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

export interface DomainEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tripId?: number | null;
  companyId?: number | null;
  senderName?: string;
  fromUser?: {
    name: string;
    role?: string;
  } | null;
  attachments?: EmailAttachment[];
}

export interface DomainEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  safeRedirected?: boolean;
}

export interface CompanyEmailConfig {
  id: number;
  name: string;
  email_domain?: string | null;
  mail_provider?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  imap_host?: string | null;
  imap_port?: number | null;
  email_user?: string | null;
  email_password?: string | null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Maps system user role to Arabic display title for email From header
 */
function getRoleArabicTitle(role?: string | null): string {
  if (!role) return '';
  switch (role) {
    case 'super_admin':
      return 'الإدارة العامة';
    case 'admin':
      return 'الإدارة';
    case 'secretary':
      return 'السكرتارية';
    case 'driver':
      return 'السائق';
    default:
      return role;
  }
}

/**
 * Retrieves the email settings for a given company from public.companies.
 * Falls back to active user's company or company #1, then environment variables.
 */
export async function getCompanyEmailConfig(
  companyId?: number | null
): Promise<CompanyEmailConfig | null> {
  const adminClient = getSupabaseAdmin();
  let targetCompanyId = companyId;

  // If no companyId specified, attempt to derive from current authenticated session
  if (!targetCompanyId) {
    try {
      const serverSupabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await serverSupabase.auth.getUser();
      if (user) {
        const { data: userData } = await serverSupabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .maybeSingle();
        if (userData?.company_id) {
          targetCompanyId = userData.company_id;
        }
      }
    } catch {
      // Session not available in this context (e.g. cron or webhook)
    }
  }

  // 1. Fetch from Database using service role admin client
  if (adminClient) {
    try {
      let query = adminClient
        .from('companies')
        .select('id, name, email_domain, mail_provider, smtp_host, smtp_port, imap_host, imap_port, email_user, email_password')
        .limit(1);

      if (targetCompanyId) {
        query = query.eq('id', targetCompanyId);
      } else {
        query = query.eq('is_active', true).order('id', { ascending: true });
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const domain = (data.email_domain || 'transbodanon.com').replace(/^@+/, '').trim().toLowerCase();
        return {
          id: data.id,
          name: data.name || 'Trans Bodanon',
          email_domain: domain,
          mail_provider: data.mail_provider || 'cpanel',
          smtp_host: data.smtp_host || (data.mail_provider === 'hostinger' ? 'smtp.hostinger.com' : data.mail_provider === 'ovh' ? 'ssl0.ovh.net' : `mail.${domain}`),
          smtp_port: data.smtp_port || 465,
          imap_host: data.imap_host || (data.mail_provider === 'hostinger' ? 'imap.hostinger.com' : data.mail_provider === 'ovh' ? 'ssl0.ovh.net' : `mail.${domain}`),
          imap_port: data.imap_port || 993,
          email_user: data.email_user || `operations@${domain}`,
          email_password: data.email_password || (data.id === 1 ? process.env.SMTP_PASS : undefined) || null,
        };
      }
    } catch (dbErr) {
      console.warn('Could not query company email settings from database:', dbErr);
    }
  }

  // 2. Zero-Config Environment Fallback (Default Company #1)
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  if (envUser || envPass) {
    const domain = envUser ? envUser.split('@')[1] || 'transbodanon.com' : 'transbodanon.com';
    return {
      id: targetCompanyId || 1,
      name: 'Trans Bodanon International Transport',
      email_domain: domain,
      mail_provider: 'cpanel',
      smtp_host: process.env.SMTP_HOST || `mail.${domain}`,
      smtp_port: Number(process.env.SMTP_PORT) || 465,
      imap_host: process.env.IMAP_HOST || process.env.SMTP_HOST || `mail.${domain}`,
      imap_port: Number(process.env.IMAP_PORT) || 993,
      email_user: envUser || `operations@${domain}`,
      email_password: envPass || null,
    };
  }

  return null;
}

/**
 * Creates a dynamic nodemailer transporter configured with company-specific SMTP settings
 */
export function createCompanySmtpTransporter(config: CompanyEmailConfig): Transporter | null {
  const host = config.smtp_host;
  const port = config.smtp_port || 465;
  const user = config.email_user;
  const pass = config.email_password;

  if (!host || !user || !pass) {
    return null;
  }

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

/**
 * Backward-compatible transporter creator using default config or env vars
 */
export function createSmtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST || 'mail.transbodanon.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const isSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

/**
 * Sends transactional and operational emails dynamically via the company's dedicated SMTP server.
 * Completely tenant-isolated: derives credentials from companies table.
 * Automatically formats the 'From' header: "Trans Bodanon - إيمان (السكرتارية)" <operations@transbodanon.com>
 * Graceful degradation: never crashes caller if SMTP fails or is unconfigured.
 */
export async function sendDomainEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  tripId,
  companyId,
  senderName,
  fromUser,
  attachments = [],
}: DomainEmailOptions): Promise<DomainEmailResult> {
  // 1. Fetch company email configuration
  const companyConfig = await getCompanyEmailConfig(companyId);
  const targetCompanyId = companyConfig?.id || companyId || 1;
  const companyName = companyConfig?.name || 'Trans Bodanon';
  const fromAddress = companyConfig?.email_user || process.env.SMTP_USER || 'operations@transbodanon.com';

  // 2. Determine executing user info for dynamic From header
  let senderPersonName = fromUser?.name;
  let senderPersonRole = fromUser?.role;

  if (!senderPersonName) {
    try {
      const serverSupabase = await createServerSupabaseClient();
      const {
        data: { user: authUser },
      } = await serverSupabase.auth.getUser();
      if (authUser) {
        const { data: dbUser } = await serverSupabase
          .from('users')
          .select('name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        if (dbUser) {
          senderPersonName = dbUser.name;
          senderPersonRole = dbUser.role;
        }
      }
    } catch {
      // Background or unauthenticated action
    }
  }

  // Build From header: e.g. "Trans Bodanon - إيمان (السكرتارية)" <operations@transbodanon.com>
  let formattedDisplayName = senderName || companyName;
  if (senderPersonName) {
    const roleArabic = getRoleArabicTitle(senderPersonRole);
    formattedDisplayName = roleArabic
      ? `${companyName} - ${senderPersonName} (${roleArabic})`
      : `${companyName} - ${senderPersonName}`;
  }
  const fromFormatted = `"${formattedDisplayName}" <${fromAddress}>`;

  // 🛑 صمام الأمان (Safety Safeguard)
  const SAFE_ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'hisaltan@gmail.com';
  const isSafetyMode =
    process.env.NODE_ENV !== 'production' || process.env.EMAIL_SAFETY_MODE === 'true';

  const targetEmail = isSafetyMode ? SAFE_ADMIN_EMAIL : to;
  const finalSubject =
    isSafetyMode && to !== SAFE_ADMIN_EMAIL
      ? `[وضع التجربة 🧪 | موجهة إلى: ${to}] ${subject}`
      : subject;

  const transporter = companyConfig
    ? createCompanySmtpTransporter(companyConfig)
    : createSmtpTransporter();

  // 3. Graceful degradation if SMTP credentials are missing
  if (!transporter) {
    console.warn(`⚠️ لم يتم تكوين بيانات SMTP للشركة (${companyName} - ID #${targetCompanyId}). تم تسجيل الرسالة في السجلات:`, {
      from: fromFormatted,
      to: targetEmail,
      originalRecipient: to,
      subject: finalSubject,
      tripId,
    });

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin.from('email_messages').insert({
        company_id: targetCompanyId,
        trip_id: tripId || null,
        message_id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        sender_email: fromAddress,
        sender_name: formattedDisplayName,
        recipient_email: targetEmail,
        subject: finalSubject,
        body_text: text || '',
        body_html: html,
        direction: 'outbound',
        is_read: true,
        attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.contentType })),
      });
    }

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
      safeRedirected: isSafetyMode,
    };
  }

  // 4. Send email via SMTP
  try {
    const info = await transporter.sendMail({
      from: fromFormatted,
      to: targetEmail,
      replyTo: replyTo || fromAddress,
      subject: finalSubject,
      html,
      ...(text ? { text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    // Record outbound email in database
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      await supabaseAdmin.from('email_messages').insert({
        company_id: targetCompanyId,
        trip_id: tripId || null,
        message_id: info.messageId,
        sender_email: fromAddress,
        sender_name: formattedDisplayName,
        recipient_email: targetEmail,
        subject: finalSubject,
        body_text: text || '',
        body_html: html,
        direction: 'outbound',
        is_read: true,
        attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.contentType })),
      });
    }

    return {
      success: true,
      messageId: info.messageId,
      safeRedirected: isSafetyMode,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ فشل إرسال البريد عبر خادم SMTP للشركة (${companyName}):`, errorMsg);

    // Record attempted message in database for audit even upon error
    try {
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        await supabaseAdmin.from('email_messages').insert({
          company_id: targetCompanyId,
          trip_id: tripId || null,
          message_id: `failed-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          sender_email: fromAddress,
          sender_name: formattedDisplayName,
          recipient_email: targetEmail,
          subject: `[فشل الإرسال] ${finalSubject}`,
          body_text: `خطأ الإرسال: ${errorMsg}\n\n${text || ''}`,
          body_html: html,
          direction: 'outbound',
          is_read: true,
          attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.contentType })),
        });
      }
    } catch {
      // ignore logging failure
    }

    // Graceful degradation: return error details without crashing caller
    return {
      success: false,
      error: errorMsg,
      safeRedirected: isSafetyMode,
    };
  }
}
