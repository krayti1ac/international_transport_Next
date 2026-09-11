'use server';

import { createClient } from '@/lib/supabase/server';
import { generateAiDiagnosticPrompt, sanitizePayload } from './ai-issue-prompt';
import { runGeminiDiagnostic } from './gemini-diagnostics';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import type {
  SystemScreenIssue,
  ScreenIssueType,
  ScreenIssueSeverity,
  ScreenIssueStatus,
} from '@/types/database';

export interface RecordScreenIssueInput {
  device_id: string;
  license_number?: string | null;
  device_type?: 'desktop' | 'mobile' | 'tablet' | string;
  device_info?: Record<string, unknown> | null;
  screen_route: string;
  screen_name: string;
  component_name?: string | null;
  field_name?: string | null;
  error_message: string;
  error_stack?: string | null;
  validation_errors?: Record<string, unknown> | null;
  input_payload?: Record<string, unknown> | null;
  user_description?: string | null;
  issue_type?: ScreenIssueType;
  severity?: ScreenIssueSeverity;
}

export interface ScreenIssueFilters {
  companyId?: number;
  status?: ScreenIssueStatus;
  severity?: ScreenIssueSeverity;
  issueType?: ScreenIssueType;
  search?: string;
}

export async function getScreenIssuesAction(filters?: ScreenIssueFilters): Promise<{
  success: boolean;
  data?: SystemScreenIssue[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('system_screen_issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.companyId) query = query.eq('company_id', filters.companyId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.issueType) query = query.eq('issue_type', filters.issueType);
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(
        `screen_name.ilike.%${q}%,screen_route.ilike.%${q}%,error_message.ilike.%${q}%,user_name.ilike.%${q}%,device_id.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist') || error.code === 'PGRST205') {
        return { success: true, data: [] };
      }
      throw error;
    }
    return { success: true, data: (data as SystemScreenIssue[]) || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب سجل المشاكل';
    return { success: false, error: message };
  }
}

export async function recordScreenIssueAction(input: RecordScreenIssueInput): Promise<{
  success: boolean;
  issueId?: string;
  aiPrompt?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let companyId: number | null = null;
    let companyName: string | null = null;
    let userName: string | null = null;
    let userEmail: string | null = user?.email || null;
    let userRole: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('name, email, role, company_id, company:companies(name)')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        userName = profile.name;
        userEmail = profile.email || userEmail;
        userRole = profile.role;
        companyId = profile.company_id || null;
        companyName = (profile.company as { name?: string })?.name || null;
      }
    }

    const cleanPayload = sanitizePayload(input.input_payload || {});
    const prompt = generateAiDiagnosticPrompt({
      ...input,
      user_id: user?.id || null,
      user_name: userName,
      user_email: userEmail,
      user_role: userRole,
      company_id: companyId,
      company_name: companyName,
      input_payload: cleanPayload as Record<string, unknown>,
    });

    const { data, error } = await supabase
      .from('system_screen_issues')
      .insert({
        company_id: companyId,
        company_name: companyName,
        user_id: user?.id || null,
        user_name: userName,
        user_email: userEmail,
        user_role: userRole,
        device_id: input.device_id,
        license_number: input.license_number,
        device_type: input.device_type || 'desktop',
        device_info: input.device_info || {},
        screen_route: input.screen_route,
        screen_name: input.screen_name,
        component_name: input.component_name,
        issue_type: input.issue_type || 'validation_error',
        severity: input.severity || 'medium',
        status: 'open',
        error_message: input.error_message,
        error_stack: input.error_stack,
        field_name: input.field_name,
        validation_errors: input.validation_errors || {},
        input_payload: cleanPayload,
        user_description: input.user_description,
        ai_diagnostic_prompt: prompt,
      })
      .select('id, ai_diagnostic_prompt')
      .single();

    if (error) throw error;

    // إذا كان مستوى الخطأ حرجاً (critical)، نقوم بإرسال تنبيه واتساب فوري وتشخيص آلي
    if (input.severity === 'critical') {
      try {
        const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '212694585307';
        const waMessage = `🚨 *[تنبيه خطأ حرج - Trans Bodanon TMS]*\n\n📌 *الشاشة:* ${input.screen_name} (${input.screen_route})\n⚠️ *الخطأ:* ${input.error_message}\n👤 *المستخدم:* ${userName || userEmail || 'غير محدد'}\n🏢 *الشركة:* ${companyName || 'عام'}\n📱 *الجهاز:* ${input.device_type || 'desktop'} (${input.device_id.slice(0, 10)})\n🕒 *الوقت:* ${new Date().toLocaleString('ar-MA')}\n\n🔍 معرّف السجل: #${data.id.slice(0, 8)}`;

        sendWhatsAppCloudMessage({
          to: adminPhone,
          message: waMessage,
        }).catch((err) => console.warn('WhatsApp critical alert send error:', err));

        // تشخيص فوري وحفظه تلقائياً
        runGeminiDiagnostic(prompt)
          .then(async (aiRes) => {
            if (aiRes.success && aiRes.rawText) {
              await supabase
                .from('system_screen_issues')
                .update({
                  ai_solution_notes: aiRes.rawText,
                  status: 'investigating',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', data.id);
            }
          })
          .catch((err) => console.warn('Auto Gemini diagnostic error:', err));
      } catch (critErr) {
        console.warn('Error triggering critical issue automated actions:', critErr);
      }
    }

    return {
      success: true,
      issueId: data.id,
      aiPrompt: data.ai_diagnostic_prompt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'تعذر تسجيل المشكلة';
    return { success: false, error: message };
  }
}

export async function updateScreenIssueStatusAction(
  id: string,
  status: ScreenIssueStatus,
  aiNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (aiNotes !== undefined) updatePayload.ai_solution_notes = aiNotes;
    if (status === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = user?.id || null;
    }

    const { error } = await supabase
      .from('system_screen_issues')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحديث حالة المشكلة';
    return { success: false, error: message };
  }
}

export async function deleteScreenIssueAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('system_screen_issues').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل الحذف';
    return { success: false, error: message };
  }
}

export async function simulateTestIssueAction(scenario: 'fuel' | 'trip' | 'invoice'): Promise<{
  success: boolean;
  issueId?: string;
  error?: string;
}> {
  const scenarios: Record<string, RecordScreenIssueInput> = {
    fuel: {
      device_id: 'dev_sim_phone_android_99',
      license_number: 'TB-1-M99',
      device_type: 'mobile',
      screen_route: '/fuel-receipt',
      screen_name: 'تسجيل وصل وقود (OCR)',
      component_name: 'FuelReceiptUploadForm',
      field_name: 'amount',
      error_message: 'قيمة الحقل "amount" غير مطابقة لشروط الأرقام العشرية. القيمة المقروءة: 1250,50 DH',
      issue_type: 'input_format_mismatch',
      severity: 'medium',
      validation_errors: { amount: 'الفاصلة العشرية يجب أن تكون نقطة (.) وليس فاصلة (,)' },
      input_payload: { rawText: 'Station Winxo... Total: 1250,50 DH Litres: 95.5L', station: 'Winxo', liters: 95.5 },
      user_description: 'قمت بمسح الوصل بالكاميرا وظهر هذا الخطأ عند محاولة الحفظ',
      device_info: { os: 'Android 14', browser: 'Chrome Mobile 128.0', screenResolution: '412x915', language: 'ar-MA' },
    },
    trip: {
      device_id: 'dev_sim_pc_chrome_win',
      license_number: 'TB-1-PC01',
      device_type: 'desktop',
      screen_route: '/trips',
      screen_name: 'إدارة الرحلات الدولية',
      component_name: 'TripFormModal',
      field_name: 'cmr_export_number',
      error_message: 'تعارض في قيد التكرار: رقم الـ CMR مسجل مسبقاً في رحلة أخرى',
      issue_type: 'db_constraint_rejection',
      severity: 'high',
      validation_errors: { cmr_export_number: 'رقم CMR-2026-9081 مستخدم بالفعل في الرحلة رقم #1002' },
      input_payload: { route: 'طنجة -> فالنسيا', client_id: 101, cmr_export_number: 'CMR-2026-9081', price: 34000 },
      user_description: 'كنت أحاول نسخ رحلة مكررة لنفس العميل',
      device_info: { os: 'Windows 11', browser: 'Google Chrome 128.0', screenResolution: '1920x1080', language: 'ar' },
    },
    invoice: {
      device_id: 'dev_sim_ipad_safari',
      license_number: 'TB-1-T12',
      device_type: 'tablet',
      screen_route: '/invoices',
      screen_name: 'إنشاء ومتابعة الفواتير',
      component_name: 'InvoiceCalculationEngine',
      field_name: 'ttc_amount',
      error_message: 'فشل التحقق الحسابي: مجموع HT + TVA لا يطابق إجمالي TTC المدخل',
      issue_type: 'calculation_anomaly',
      severity: 'critical',
      validation_errors: { ttc_amount: 'المجموع المحسوب 18,000.00 لا يطابق TTC المدخل 17,500.00' },
      input_payload: { ht_amount: '15000', tva_rate: '20', tva_amount: '3000', ttc_amount: '17500' },
      user_description: 'أدخلت التخفيض في الإجمالي ولكن النظام لم يقبل النموذج',
      device_info: { os: 'iOS / iPadOS 17.5', browser: 'Apple Safari', screenResolution: '820x1180', language: 'fr-FR' },
    },
  };

  return await recordScreenIssueAction(scenarios[scenario] || scenarios.fuel);
}

export async function diagnoseIssueWithGeminiAction(id: string): Promise<{
  success: boolean;
  notes?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // جلب سجل المشكلة والبرومبت المجهز
    const { data: issue, error: fetchErr } = await supabase
      .from('system_screen_issues')
      .select('id, ai_diagnostic_prompt, error_message, status')
      .eq('id', id)
      .single();

    if (fetchErr || !issue) {
      return { success: false, error: 'تعذر العثور على سجل المشكلة.' };
    }

    const prompt = issue.ai_diagnostic_prompt || issue.error_message;
    const aiResult = await runGeminiDiagnostic(prompt);

    if (!aiResult.success || !aiResult.rawText) {
      return { success: false, error: aiResult.error || 'فشل توليد رد الذكاء الاصطناعي.' };
    }

    // حفظ رد الذكاء الاصطناعي وتحديث الحالة إلى 'investigating' إن كانت 'open'
    const newStatus = issue.status === 'open' ? 'investigating' : issue.status;
    const { error: updateErr } = await supabase
      .from('system_screen_issues')
      .update({
        ai_solution_notes: aiResult.rawText,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    return { success: true, notes: aiResult.rawText };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تنفيذ التشخيص الذكي';
    return { success: false, error: message };
  }
}

export async function sendIssueWhatsAppAlertAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: issue, error: fetchErr } = await supabase
      .from('system_screen_issues')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !issue) {
      return { success: false, error: 'تعذر العثور على سجل المشكلة.' };
    }

    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '212694585307';
    const message = `🚨 *[تنبيه خطأ شاشة - Trans Bodanon TMS]*\n\n📌 *الشاشة:* ${issue.screen_name} (${issue.screen_route})\n⚠️ *الخطأ:* ${issue.error_message}\n📊 *الأهمية:* ${issue.severity}\n👤 *المستخدم:* ${issue.user_name || issue.user_email || 'غير محدد'}\n🏢 *الشركة:* ${issue.company_name || 'عام'}\n📱 *الجهاز:* ${issue.device_type} (${issue.device_id?.slice(0, 10)})\n🕒 *الوقت:* ${new Date(issue.created_at).toLocaleString('ar-MA')}\n\n🔍 معرّف السجل: #${issue.id.slice(0, 8)}`;

    const res = await sendWhatsAppCloudMessage({
      to: adminPhone,
      message,
    });

    if (!res.success && res.reason === 'Missing API Keys') {
      return {
        success: false,
        error: 'مفاتيح خدمة الواتساب (WHATSAPP_API_TOKEN أو CALLMEBOT_API_KEY) غير معينة في السيرفر.',
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إرسال التنبيه عبر الواتساب';
    return { success: false, error: message };
  }
}

export async function bulkUpdateScreenIssuesStatusAction(
  ids: string[],
  status: ScreenIssueStatus
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = user?.id || null;
    }

    const { error } = await supabase
      .from('system_screen_issues')
      .update(updatePayload)
      .in('id', ids);

    if (error) throw error;
    return { success: true, count: ids.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل التحديث المجمع للحالات';
    return { success: false, error: message };
  }
}

export async function bulkDeleteScreenIssuesAction(
  ids: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    const supabase = await createClient();
    const { error } = await supabase
      .from('system_screen_issues')
      .delete()
      .in('id', ids);

    if (error) throw error;
    return { success: true, count: ids.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل الحذف المجمع للسجلات';
    return { success: false, error: message };
  }
}



