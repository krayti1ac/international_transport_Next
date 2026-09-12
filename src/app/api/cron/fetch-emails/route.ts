import { NextResponse } from 'next/server';
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for Vercel Cron

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface CompanyImapRecord {
  id: number;
  name: string;
  email_domain?: string | null;
  mail_provider?: string | null;
  imap_host?: string | null;
  imap_port?: number | null;
  email_user?: string | null;
  email_password?: string | null;
  is_active?: boolean;
}

interface TenantCronSummary {
  companyId: number;
  companyName: string;
  status: 'success' | 'skipped' | 'error';
  found?: number;
  processed?: number;
  error?: string;
  reason?: string;
}

export async function GET(request: Request) {
  try {
    // 1. التحقق الأمني من سر Vercel Cron
    const authHeader =
      request.headers.get('Authorization') || request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database service role client not available' },
        { status: 500 }
      );
    }

    // 2. جلب جميع الشركات النشطة للبدء في حلقة الفحص المتعدد (Multi-Tenant Loop)
    const { data: rawCompanies, error: compErr } = await supabaseAdmin
      .from('companies')
      .select('id, name, email_domain, mail_provider, imap_host, imap_port, email_user, email_password, is_active')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (compErr) {
      console.error('Error fetching companies for IMAP cron:', compErr);
      return NextResponse.json({ error: compErr.message }, { status: 500 });
    }

    const companies: CompanyImapRecord[] = rawCompanies || [];
    const tenantSummaries: TenantCronSummary[] = [];
    let totalMessagesProcessed = 0;

    // 3. التكرار عبر كل شركة وفحص صندوق الوارد بشكل معزول
    for (const company of companies) {
      const companyDomain = (company.email_domain || '').replace(/^@+/, '').trim().toLowerCase();

      // Resolve IMAP credentials with fallback to env vars for Company #1 (transbodanon)
      const user =
        company.email_user ||
        (company.id === 1 ? process.env.SMTP_USER : null) ||
        (companyDomain ? `operations@${companyDomain}` : null);

      const password =
        company.email_password ||
        (company.id === 1 ? process.env.SMTP_PASS : null);

      let host = company.imap_host;
      if (!host) {
        if (company.mail_provider === 'hostinger') {
          host = 'imap.hostinger.com';
        } else if (company.mail_provider === 'ovh') {
          host = 'ssl0.ovh.net';
        } else if (companyDomain) {
          host = `mail.${companyDomain}`;
        } else if (company.id === 1) {
          host = process.env.IMAP_HOST || process.env.SMTP_HOST || 'mail.transbodanon.com';
        }
      }

      const port = company.imap_port || Number(process.env.IMAP_PORT) || 993;

      // تخطي الشركات التي تنقصها بيانات الاعتماد
      if (!user || !password || !host) {
        tenantSummaries.push({
          companyId: company.id,
          companyName: company.name,
          status: 'skipped',
          reason: 'بيانات اعتماد IMAP غير مكتملة (المستخدم أو كلمة المرور أو الخادم مفقود)',
        });
        continue;
      }

      const isTls = port === 993 || process.env.IMAP_TLS !== 'false';

      const config: imaps.ImapSimpleOptions = {
        imap: {
          user,
          password,
          host,
          port,
          tls: isTls,
          authTimeout: 10000,
          tlsOptions: {
            rejectUnauthorized: process.env.NODE_ENV === 'production',
          },
        },
      };

      let connection: imaps.ImapSimple | null = null;
      try {
        connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // البحث عن الرسائل غير المقروءة فقط
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT', ''], markSeen: true };
        const messages = await connection.search(searchCriteria, fetchOptions);

        let companyProcessedCount = 0;

        for (const item of messages) {
          const allParts = item.parts.find((part) => part.which === '');
          const uid = item.attributes.uid;
          const idHeader = `Imap-Id: ${uid}\r\n`;
          const rawBody = allParts ? idHeader + (allParts.body || '') : '';

          const mail = await simpleParser(rawBody);

          // استخراج رقم الرسالة الفريد لتفادي التكرار
          const messageId =
            mail.messageId ||
            `imap-${company.id}-${uid}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          // التحقق مما إذا كانت الرسالة مخزنة مسبقاً
          const { data: existing } = await supabaseAdmin
            .from('email_messages')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle();

          if (existing) {
            continue;
          }

          // استخراج رقم الرحلة الذكي (#89 أو CMR#123 أو رحلة #45)
          let matchedTripId: number | null = null;
          if (mail.subject) {
            const tripNumMatch = mail.subject.match(/(?:#|CMR|رحلة|طلب)\s*#?(\d+)/i) || mail.subject.match(/#(\d+)/);
            if (tripNumMatch && tripNumMatch[1]) {
              const parsedNum = parseInt(tripNumMatch[1], 10);
              // التأكد من أن الرحلة تابعة لنفس الشركة لضمان العزل التام للمستأجرين
              const { data: trip } = await supabaseAdmin
                .from('trip_orders')
                .select('id')
                .eq('id', parsedNum)
                .eq('company_id', company.id)
                .maybeSingle();

              if (trip) {
                matchedTripId = trip.id;
              }
            }
          }

          // معالجة بيانات المرفقات إن وجدت
          const attachmentsMeta =
            mail.attachments?.map((att) => ({
              filename: att.filename || 'attachment',
              contentType: att.contentType,
              size: att.size,
            })) || [];

          // استخراج بيانات المرسل والمحتوى
          const senderEmail = mail.from?.value[0]?.address || 'unknown@domain.com';
          const senderName = mail.from?.value[0]?.name || senderEmail.split('@')[0];
          const recipientAddr =
            (Array.isArray(mail.to) ? mail.to[0]?.value[0]?.address : mail.to?.value[0]?.address) ||
            user;
          const bodyHtml = mail.html || (typeof mail.textAsHtml === 'string' ? mail.textAsHtml : '');
          const bodyText = mail.text || '';

          // حفظ الرسالة في Supabase كـ Inbound تابعة لـ company.id حصراً
          const { error: insertError } = await supabaseAdmin.from('email_messages').insert({
            company_id: company.id,
            trip_id: matchedTripId,
            message_id: messageId,
            sender_email: senderEmail,
            sender_name: senderName,
            recipient_email: recipientAddr,
            subject: mail.subject || '(بدون عنوان)',
            body_text: bodyText,
            body_html: bodyHtml,
            attachments: attachmentsMeta,
            direction: 'inbound',
            is_read: false,
          });

          if (!insertError) {
            companyProcessedCount++;
            totalMessagesProcessed++;
          } else {
            console.error(`Error inserting inbound email for company ${company.name}:`, insertError);
          }
        }

        connection.end();

        tenantSummaries.push({
          companyId: company.id,
          companyName: company.name,
          status: 'success',
          found: messages.length,
          processed: companyProcessedCount,
        });
      } catch (companyError: unknown) {
        if (connection) {
          try {
            connection.end();
          } catch {
            // ignore connection close error
          }
        }
        const errMsg = companyError instanceof Error ? companyError.message : String(companyError);
        console.warn(`⚠️ تعذر جلب البريد للشركة (${company.name} - ID #${company.id}):`, errMsg);

        tenantSummaries.push({
          companyId: company.id,
          companyName: company.name,
          status: 'error',
          error: errMsg,
        });
        // مبدأ العزل: خطأ في إحدى الشركات لا يعطل فحص بقية الشركات
      }
    }

    return NextResponse.json({
      success: true,
      totalCompanies: companies.length,
      totalMessagesProcessed,
      companies: tenantSummaries,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Fatal IMAP Multi-Tenant Fetch Cron Error:', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
