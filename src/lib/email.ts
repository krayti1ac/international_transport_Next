import { sendDomainEmail, type EmailAttachment } from './email-smtp';

export interface SendEmailOptions {
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

export interface SendEmailResult {
  success: boolean;
  data?: { id: string } | unknown;
  error?: string;
  safeRedirected?: boolean;
}

/**
 * Sends transactional and notification emails via the company domain's self-hosted SMTP server.
 * Dynamic Multi-Tenant: routes through the specific company's database settings.
 * In development or when EMAIL_SAFETY_MODE is active, emails are safely redirected to ADMIN_NOTIFICATION_EMAIL.
 */
export async function sendCompanyEmail({
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
}: SendEmailOptions): Promise<SendEmailResult> {
  const result = await sendDomainEmail({
    to,
    subject,
    html,
    text,
    replyTo,
    tripId,
    companyId,
    senderName,
    fromUser,
    attachments,
  });

  return {
    success: result.success,
    data: result.messageId ? { id: result.messageId } : undefined,
    error: result.error,
    safeRedirected: result.safeRedirected,
  };
}
