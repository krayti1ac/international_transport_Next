'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { DEFAULT_USERS } from '@/lib/default-data';
import {
  createUserSchema,
  updateUserSchema,
  signupDriverSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type SignupDriverInput,
} from '../schemas/user.schema';
import type { User } from '@/types/database';
import { generateLicenseNumber } from '@/lib/license';
import { requirePermission } from '@/lib/rbac.server';
import { sendDomainEmail } from '@/lib/email-smtp';
import { signSession } from '@/lib/session';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isUuid(val: string | null | undefined): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

async function getCurrentUserContext(supabase: any, adminClient: any) {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  let currentCompanyId: number | null = null;
  let currentUserRole: string | null = null;

  if (currentUser) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (userProfile) {
      currentCompanyId = userProfile.company_id;
      currentUserRole = userProfile.role;
    } else if (adminClient) {
      const { data: adminProfile } = await adminClient
        .from('users')
        .select('company_id, role')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (adminProfile) {
        currentCompanyId = adminProfile.company_id;
        currentUserRole = adminProfile.role;
      }
    }
  }

  return {
    currentUser,
    currentCompanyId,
    currentUserRole,
    isSuperAdmin: currentUserRole === 'super_admin',
  };
}

function isMissingColumnError(error: any, columnName: string): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const col = columnName.toLowerCase();
  return (
    msg.includes(col) ||
    msg.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  );
}

function getRoleLabelArabic(role?: string): string {
  switch (role) {
    case 'super_admin':
      return 'المدير العام';
    case 'admin':
      return 'مدير النظام';
    case 'secretary':
      return 'سكرتارية وإدارة';
    case 'accountant':
      return 'محاسب / مدقق مالي';
    case 'fleet_manager':
      return 'مدير الأسطول والصيانة';
    case 'driver':
      return 'سائق';
    default:
      return role || 'مستخدم';
  }
}

/**
 * Check if the target email or username prefix is already in use by another user
 * within the specified company domain or across the system, regardless of role.
 */
async function checkUsernameOrEmailConflict(
  supabase: any,
  adminClient: any,
  emailToCheck: string,
  companyId: number | null,
  excludeUserId?: string
): Promise<{ hasConflict: boolean; error?: string }> {
  const normalizedEmail = emailToCheck.trim().toLowerCase();
  const targetUsername = normalizedEmail.split('@')[0].trim().toLowerCase();
  const client = adminClient || supabase;

  try {
    const map = new Map<string, any>();

    // 1. Fetch users belonging to this company if companyId is present
    if (companyId) {
      const { data: compUsers } = await client
        .from('users')
        .select('id, name, email, role, company_id')
        .eq('company_id', companyId);
      (compUsers || []).forEach((u: any) => map.set(u.id, u));
    }

    // 2. Fetch users matching exact email globally
    const { data: emailUsers } = await client
      .from('users')
      .select('id, name, email, role, company_id')
      .ilike('email', normalizedEmail);
    (emailUsers || []).forEach((u: any) => map.set(u.id, u));

    // Also consult adminClient if available and not already used
    if (client !== adminClient && adminClient) {
      if (companyId) {
        const { data: adminCompUsers } = await adminClient
          .from('users')
          .select('id, name, email, role, company_id')
          .eq('company_id', companyId);
        (adminCompUsers || []).forEach((u: any) => map.set(u.id, u));
      }
      const { data: adminEmailUsers } = await adminClient
        .from('users')
        .select('id, name, email, role, company_id')
        .ilike('email', normalizedEmail);
      (adminEmailUsers || []).forEach((u: any) => map.set(u.id, u));
    }

    for (const candidate of Array.from(map.values())) {
      if (excludeUserId && candidate.id === excludeUserId) continue;
      const candEmail = (candidate.email || '').trim().toLowerCase();
      const candUsername = candEmail.split('@')[0].trim().toLowerCase();

      // Conflict 1: Exact full email matches another account
      if (candEmail === normalizedEmail) {
        const roleLabel = getRoleLabelArabic(candidate.role);
        return {
          hasConflict: true,
          error: `اسم المستخدم أو البريد الإلكتروني محجوز بالفعل للحساب "${candidate.name}" (${roleLabel}). لا يمكن تكراره حتى وإن اختلفت الصلاحية.`,
        };
      }

      // Conflict 2: Same username prefix within the same company (even if roles differ)
      if (companyId && candidate.company_id === companyId && candUsername === targetUsername) {
        const roleLabel = getRoleLabelArabic(candidate.role);
        return {
          hasConflict: true,
          error: `اسم المستخدم "${targetUsername}" مستخدم بالفعل في هذه الشركة للحساب "${candidate.name}" (${roleLabel}). لا يمكن تكرار اسم المستخدم لنفس نطاق الشركة حتى وإن اختلفت الصلاحية.`,
        };
      }
    }
  } catch (err) {
    console.warn('Conflict check warning:', err);
  }

  return { hasConflict: false };
}

export async function getUsersAction(): Promise<{ success: boolean; data?: User[]; error?: string }> {
  try {
    try {
      await requirePermission('users:manage');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'غير مصرح لك بالوصول';
      return { success: false, error: message };
    }

    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentCompanyId, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isSuperAdmin) {
      if (currentCompanyId) {
        query = query.eq('company_id', currentCompanyId);
      }
      query = query.neq('role', 'super_admin');
    }

    const { data, error } = await query;

    if (error) {
      // If RLS denies or table issue, check if adminClient can read
      if (adminClient) {
        let adminQuery = adminClient
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isSuperAdmin) {
          if (currentCompanyId) {
            adminQuery = adminQuery.eq('company_id', currentCompanyId);
          }
          adminQuery = adminQuery.neq('role', 'super_admin');
        }

        const { data: adminData, error: adminError } = await adminQuery;
        if (!adminError && adminData) {
          const finalAdminData = isSuperAdmin
            ? (adminData as User[])
            : (adminData as User[]).filter((u) => u.role !== 'super_admin');
          return { success: true, data: finalAdminData };
        }
      }
      return { success: false, error: error.message };
    }

    const finalData = isSuperAdmin
      ? ((data || []) as User[])
      : ((data || []) as User[]).filter((u) => u.role !== 'super_admin');

    return { success: true, data: finalData };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر جلب بيانات المستخدمين' };
  }
}

export async function createUserAction(rawInput: CreateUserInput): Promise<{
  success: boolean;
  data?: User;
  error?: string;
  emailSent?: boolean;
  emailRecipient?: string;
}> {
  try {
    try {
      await requirePermission('users:manage');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'غير مصرح لك بالوصول';
      return { success: false, error: message };
    }

    const input = createUserSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentCompanyId, currentUserRole, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Prevent non-super-admins from creating super_admin accounts
    if (input.role === 'super_admin' && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بإنشاء حساب بصلاحية المدير العام' };
    }

    // Prevent secretary from creating admin or super_admin accounts; new accounts default to driver
    if (currentUserRole === 'secretary') {
      input.role = 'driver';
    }

    // Determine tenant company_id
    let companyIdToAssign: number | null = input.company_id ?? null;
    if (input.role === 'super_admin') {
      companyIdToAssign = null;
    } else if (!companyIdToAssign) {
      companyIdToAssign = currentCompanyId || 1;
    }

    // Determine and enforce company email domain
    let companyEmailDomain: string | null = null;
    let companyDisplayName: string = 'Trans Bodanon';
    if (companyIdToAssign) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, email_domain')
          .eq('id', companyIdToAssign)
          .maybeSingle();

        if (comp?.name) {
          companyDisplayName = comp.name;
        }

        if (comp?.email_domain) {
          companyEmailDomain = comp.email_domain.replace(/^@+/, '').trim().toLowerCase();
        } else if (companyIdToAssign === 1) {
          companyEmailDomain = 'transbodanon.com';
        }
      } catch {
        if (companyIdToAssign === 1) {
          companyEmailDomain = 'transbodanon.com';
        }
      }
    }

    let finalEmail = input.email.trim().toLowerCase();

    if (companyEmailDomain) {
      // If user provided only username (e.g. "hamza"), append company domain
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}@${companyEmailDomain}`;
      } else {
        // Enforce that email domain matches companyEmailDomain
        const emailParts = finalEmail.split('@');
        const userDomain = emailParts[1]?.toLowerCase();
        if (userDomain !== companyEmailDomain) {
          return {
            success: false,
            error: `يجب أن ينتهي البريد الإلكتروني بنطاق الشركة المعتمد (@${companyEmailDomain})`,
          };
        }
      }
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
      return { success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
    }

    // Check for username or email conflict across all user roles in this company
    const conflictCheck = await checkUsernameOrEmailConflict(
      supabase,
      adminClient,
      finalEmail,
      companyIdToAssign
    );
    if (conflictCheck.hasConflict) {
      return { success: false, error: conflictCheck.error };
    }

    let authUserId: string | null = null;

    // 1. Try creating user in Supabase Auth via Admin Client
    if (adminClient) {
      try {
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email: finalEmail,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name,
            role: input.role,
            phone: input.phone || null,
            personal_email: input.personal_email || null,
            company_id: companyIdToAssign,
          },
        });

        if (!authError && authUser?.user) {
          authUserId = authUser.user.id;
        } else if (authError && authError.message?.includes('already been registered')) {
          return { success: false, error: 'هذا البريد الإلكتروني مسجل بالفعل في المنظومة' };
        }
      } catch (authException) {
        console.warn('Admin auth user creation fallback:', authException);
      }
    }

    // Fallback ID if admin auth didn't return an ID
    if (!authUserId) {
      authUserId = crypto.randomUUID();
    }

    // 2. Insert record into public.users table
    const payload: Partial<User> = {
      id: authUserId,
      name: input.name,
      email: finalEmail,
      role: input.role,
      phone: input.phone || null,
      personal_email: input.personal_email || null,
      preferred_language: input.preferred_language || 'ar',
      company_id: companyIdToAssign,
      avatar_url: input.avatar_url || null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select()
      .single();

    // If preferred_language, avatar_url, or is_active column doesn't exist in Supabase schema cache, retry without it
    // If preferred_language, avatar_url, phone, personal_email, or is_active column doesn't exist in Supabase schema cache, retry without it
    if (
      error &&
      (isMissingColumnError(error, 'preferred_language') ||
        isMissingColumnError(error, 'avatar_url') ||
        isMissingColumnError(error, 'phone') ||
        isMissingColumnError(error, 'personal_email') ||
        isMissingColumnError(error, 'is_active'))
    ) {
      if (isMissingColumnError(error, 'preferred_language')) delete payload.preferred_language;
      if (isMissingColumnError(error, 'avatar_url')) delete payload.avatar_url;
      if (isMissingColumnError(error, 'phone')) delete payload.phone;
      if (isMissingColumnError(error, 'personal_email')) delete payload.personal_email;
      if (isMissingColumnError(error, 'is_active')) delete payload.is_active;
      const retry = await supabase
        .from('users')
        .insert(payload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    // If RLS blocked user insertion on normal client, attempt with adminClient
    if (error && adminClient) {
      let adminInsert = await adminClient
        .from('users')
        .insert(payload)
        .select()
        .single();

      if (
        adminInsert.error &&
        (isMissingColumnError(adminInsert.error, 'preferred_language') ||
          isMissingColumnError(adminInsert.error, 'avatar_url') ||
          isMissingColumnError(adminInsert.error, 'phone') ||
          isMissingColumnError(adminInsert.error, 'personal_email'))
      ) {
        if (isMissingColumnError(adminInsert.error, 'preferred_language')) delete payload.preferred_language;
        if (isMissingColumnError(adminInsert.error, 'avatar_url')) delete payload.avatar_url;
        if (isMissingColumnError(adminInsert.error, 'phone')) delete payload.phone;
        if (isMissingColumnError(adminInsert.error, 'personal_email')) delete payload.personal_email;
        adminInsert = await adminClient
          .from('users')
          .insert(payload)
          .select()
          .single();
      }

      if (!adminInsert.error) {
        data = adminInsert.data;
        error = null;
      }
    }

    if (error) {
      if (
        (error as any).code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('unique') ||
        error.message?.includes('idx_users_')
      ) {
        return {
          success: false,
          error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل لنطاق هذه الشركة، لا يمكن تكراره حتى وإن اختلفت الصلاحية.',
        };
      }
      return { success: false, error: error.message };
    }

    if (data && input.preferred_language && !data.preferred_language) {
      data.preferred_language = input.preferred_language;
    }

    // 3. Send welcome & private credentials email to user's phone / email
    const targetEmailRecipient = input.personal_email?.trim() || finalEmail;
    let emailSent = false;

    if (targetEmailRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmailRecipient)) {
      try {
        const roleTitle = getRoleLabelArabic(input.role);
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
        const loginUrl = `${portalUrl}/login`;
        const formattedPhone = input.phone?.trim() || 'غير مسجل';

        const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>بيانات حسابك الجديد</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; direction: rtl;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700;">منظومة إدارة النقل الدولي</h1>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">${companyDisplayName}</p>
    </div>
    
    <div style="padding: 28px 24px; text-align: right;">
      <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #e0f2fe; color: #0284c7; margin-bottom: 16px;">
        🔐 بيانات الدخول والمعلومات الخاصة
      </div>
      
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
        مرحباً بك <strong>${input.name}</strong>،<br>
        يسرنا إعلامك بأنه تم إنشاء وتفعيل حسابك بنجاح في منظومة <strong>${companyDisplayName}</strong>. تجد أدناه المعلومات الخاصة وبيانات الاعتماد الرسمية لتسجيل الدخول إلى حسابك:
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">الاسم الكامل:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: left; direction: rtl;">${input.name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">الدور والصلاحية:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: left; direction: rtl;">${roleTitle}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">اسم المستخدم / البريد المعتمد:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #0284c7; font-family: monospace; text-align: left; direction: ltr;">${finalEmail}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">كلمة المرور:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #dc2626; background: #fee2e2; padding-left: 8px; padding-right: 8px; border-radius: 6px; font-family: monospace; text-align: left; direction: ltr; display: inline-block;">${input.password}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">رقم الهاتف الشخصي:</td>
            <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: left; direction: ltr;">${formattedPhone}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
          تسجيل الدخول إلى المنظومة
        </a>
      </div>

      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 16px; font-size: 12px; color: #92400e; line-height: 1.6;">
        ⚠️ <strong>توصيات أمان هامة:</strong><br>
        • هذه الرسالة سرية وتحتوي على معلومات اعتماد شخصية، يرجى عدم مشاركتها مع أي طرف.<br>
        • يُنصح بتغيير كلمة المرور فور أول تسجيل دخول من خلال شاشة إعدادات الحساب الشخصي.
      </div>
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #94a3b8;">
      تم إرسال هذا البريد تلقائياً من منظومة ${companyDisplayName}.<br>
      © ${new Date().getFullYear()} ${companyDisplayName}. جميع الحقوق محفوظة.
    </div>
  </div>
</body>
</html>
        `;

        const sendRes = await sendDomainEmail({
          to: targetEmailRecipient,
          subject: `🔐 بيانات حسابك الجديد في منظومة ${companyDisplayName} (${input.name})`,
          html: emailHtml,
          companyId: companyIdToAssign,
          senderName: `${companyDisplayName} - إدارة المنظومة`,
        });

        if (sendRes.success) {
          emailSent = true;
        }
      } catch (mailErr) {
        console.warn('Welcome credentials email sending failed:', mailErr);
      }
    }

    revalidatePath('/users');
    revalidatePath('/settings');
    return {
      success: true,
      data: data as User,
      emailSent,
      emailRecipient: targetEmailRecipient,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل إضافة المستخدم' };
  }
}

export async function updateUserAction(rawInput: UpdateUserInput): Promise<{
  success: boolean;
  data?: User;
  error?: string;
  emailSent?: boolean;
  emailRecipient?: string;
}> {
  try {
    const input = updateUserSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentCompanyId, currentUserRole, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Fetch existing user to verify permissions
    const isInputUuid = isUuid(input.id);
    const clientToQuery = adminClient || supabase;
    let existingUser: User | null = null;

    if (isInputUuid) {
      const { data: existingData } = await clientToQuery
        .from('users')
        .select('id, email, role, company_id')
        .eq('id', input.id)
        .maybeSingle();
      existingUser = existingData as User | null;
    } else {
      // If input.id is an email (or non-UUID), search by email directly (never id=email!)
      const { data: existingData } = await clientToQuery
        .from('users')
        .select('id, email, role, company_id')
        .ilike('email', input.id.trim())
        .maybeSingle();
      existingUser = existingData as User | null;
    }

    if (!existingUser && input.email) {
      const { data: byFinalEmail } = await clientToQuery
        .from('users')
        .select('id, email, role, company_id')
        .ilike('email', input.email.trim())
        .maybeSingle();
      if (byFinalEmail) {
        existingUser = byFinalEmail as User | null;
      }
    }

    // If target is super_admin or attempting to elevate to super_admin, require isSuperAdmin
    if ((existingUser?.role === 'super_admin' || input.role === 'super_admin') && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بتعديل أو تعيين صلاحية المدير العام' };
    }

    // If caller is secretary, cannot edit admin or super_admin, nor promote anyone to admin/super_admin
    if (currentUserRole === 'secretary') {
      if (existingUser?.role === 'admin' || existingUser?.role === 'super_admin') {
        return { success: false, error: 'غير مصرح للسكرتارية بالوصول إلى بيانات حساب المدير أو تعديلها' };
      }
      if (input.role === 'admin' || input.role === 'super_admin') {
        return { success: false, error: 'غير مصرح للسكرتارية بتغيير أي دور إلى مدير النظام' };
      }
    }

    const updatePayload: Record<string, any> = {
      name: input.name,
      role: input.role,
    };

    if (input.avatar_url !== undefined) {
      updatePayload.avatar_url = input.avatar_url;
    }

    if (input.phone !== undefined) {
      updatePayload.phone = input.phone;
    }

    if (input.personal_email !== undefined) {
      updatePayload.personal_email = input.personal_email;
    }

    if (input.is_active !== undefined) {
      updatePayload.is_active = input.is_active;
    }

    const targetCompanyId = input.company_id ?? existingUser?.company_id ?? currentCompanyId;

    // If email is provided, validate and enforce domain
    let finalEmail: string | undefined = undefined;
    if (input.email) {
      const trimmedEmail = input.email.trim().toLowerCase();
      let companyEmailDomain: string | null = null;

      if (targetCompanyId && input.role !== 'super_admin') {
        try {
          const { data: comp } = await supabase
            .from('companies')
            .select('email_domain')
            .eq('id', targetCompanyId)
            .maybeSingle();

          if (comp?.email_domain) {
            companyEmailDomain = comp.email_domain.replace(/^@+/, '').trim().toLowerCase();
          } else if (targetCompanyId === 1) {
            companyEmailDomain = 'transbodanon.com';
          }
        } catch {
          if (targetCompanyId === 1) {
            companyEmailDomain = 'transbodanon.com';
          }
        }
      }

      if (companyEmailDomain) {
        if (!trimmedEmail.includes('@')) {
          finalEmail = `${trimmedEmail}@${companyEmailDomain}`;
        } else {
          const emailParts = trimmedEmail.split('@');
          const userDomain = emailParts[1]?.toLowerCase();
          if (userDomain !== companyEmailDomain) {
            return {
              success: false,
              error: `يجب أن ينتهي البريد الإلكتروني بنطاق الشركة المعتمد (@${companyEmailDomain})`,
            };
          }
          finalEmail = trimmedEmail;
        }
      } else {
        finalEmail = trimmedEmail;
      }

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
        return { success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
      }

      // Check if email or username is already taken by another account in this company
      if (finalEmail !== existingUser?.email?.toLowerCase()) {
        const conflictCheck = await checkUsernameOrEmailConflict(
          supabase,
          adminClient,
          finalEmail,
          targetCompanyId,
          input.id
        );
        if (conflictCheck.hasConflict) {
          return { success: false, error: conflictCheck.error };
        }
        updatePayload.email = finalEmail;
      }
    }

    if (input.preferred_language) {
      updatePayload.preferred_language = input.preferred_language;
    }
    if (input.company_id !== undefined) {
      updatePayload.company_id = input.role === 'super_admin' ? null : input.company_id;
    }

    // Resolve target user ID (must be a valid UUID for id column)
    let targetUserId: string | null = null;
    if (existingUser?.id && isUuid(existingUser.id)) {
      targetUserId = existingUser.id;
    } else if (isInputUuid) {
      targetUserId = input.id;
    }

    const clientToMutate = adminClient || supabase;

    if (!targetUserId && finalEmail) {
      try {
        const { data: matched } = await clientToMutate
          .from('users')
          .select('id, email, company_id')
          .ilike('email', finalEmail)
          .maybeSingle();
        if (matched?.id && isUuid(matched.id)) {
          targetUserId = matched.id;
        }
      } catch {}
    }

    // Helper to perform update with missing column fallback
    const performUpdate = async (filterCol: 'id' | 'email', filterVal: string) => {
      let res = await clientToMutate
        .from('users')
        .update(updatePayload)
        .eq(filterCol, filterVal)
        .select()
        .maybeSingle();

      if (
        res.error &&
        (isMissingColumnError(res.error, 'preferred_language') ||
          isMissingColumnError(res.error, 'avatar_url') ||
          isMissingColumnError(res.error, 'phone') ||
          isMissingColumnError(res.error, 'personal_email') ||
          isMissingColumnError(res.error, 'is_active'))
      ) {
        if (isMissingColumnError(res.error, 'preferred_language')) delete updatePayload.preferred_language;
        if (isMissingColumnError(res.error, 'avatar_url')) delete updatePayload.avatar_url;
        if (isMissingColumnError(res.error, 'phone')) delete updatePayload.phone;
        if (isMissingColumnError(res.error, 'personal_email')) delete updatePayload.personal_email;
        if (isMissingColumnError(res.error, 'is_active')) delete updatePayload.is_active;

        res = await clientToMutate
          .from('users')
          .update(updatePayload)
          .eq(filterCol, filterVal)
          .select()
          .maybeSingle();
      }

      return res;
    };

    let data: any = null;
    let error: any = null;

    if (targetUserId) {
      // Safe update by valid UUID
      const res = await performUpdate('id', targetUserId);
      data = res.data;
      error = res.error;
    } else if (finalEmail || existingUser?.email) {
      // Safe update by email (never id=email!)
      const emailFilter = (finalEmail || existingUser?.email || '').trim();
      const res = await performUpdate('email', emailFilter);
      data = res.data;
      error = res.error;
      if (data?.id && isUuid(data.id)) {
        targetUserId = data.id;
      }
    }

    // If still no row in database, upsert it
    if (!data && !error) {
      if (!targetUserId || !isUuid(targetUserId)) {
        targetUserId = crypto.randomUUID();
      }
      const upsertPayload: Record<string, any> = {
        id: targetUserId,
        name: input.name,
        email: finalEmail || existingUser?.email || '',
        role: input.role,
        preferred_language: input.preferred_language || 'ar',
        company_id: targetCompanyId || 1,
        created_at: new Date().toISOString(),
      };
      if (input.avatar_url) upsertPayload.avatar_url = input.avatar_url;
      if (input.phone) upsertPayload.phone = input.phone;
      if (input.personal_email) upsertPayload.personal_email = input.personal_email;

      let upsertRes = await clientToMutate
        .from('users')
        .upsert(upsertPayload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (
        upsertRes.error &&
        (isMissingColumnError(upsertRes.error, 'phone') ||
          isMissingColumnError(upsertRes.error, 'personal_email') ||
          isMissingColumnError(upsertRes.error, 'preferred_language') ||
          isMissingColumnError(upsertRes.error, 'avatar_url'))
      ) {
        if (isMissingColumnError(upsertRes.error, 'phone')) delete upsertPayload.phone;
        if (isMissingColumnError(upsertRes.error, 'personal_email')) delete upsertPayload.personal_email;
        if (isMissingColumnError(upsertRes.error, 'preferred_language')) delete upsertPayload.preferred_language;
        if (isMissingColumnError(upsertRes.error, 'avatar_url')) delete upsertPayload.avatar_url;

        upsertRes = await clientToMutate
          .from('users')
          .upsert(upsertPayload, { onConflict: 'id' })
          .select()
          .maybeSingle();
      }

      if (upsertRes.data) {
        data = upsertRes.data;
      }
    }

    // Always construct valid User object to return if update succeeded without error
    if (!data && !error) {
      data = {
        id: targetUserId,
        name: input.name,
        email: finalEmail || existingUser?.email || '',
        role: input.role,
        preferred_language: input.preferred_language || 'ar',
        avatar_url: input.avatar_url || null,
        company_id: targetCompanyId || 1,
        created_at: new Date().toISOString(),
      } as User;
    }

    if (error) {
      if (
        (error as any).code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('unique') ||
        error.message?.includes('idx_users_')
      ) {
        return {
          success: false,
          error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل لنطاق هذه الشركة، لا يمكن تكراره حتى وإن اختلفت الصلاحية.',
        };
      }
      return { success: false, error: error.message };
    }

    // Always ensure returned data has preferred_language set for UI consistency
    if (data && input.preferred_language && !data.preferred_language) {
      data.preferred_language = input.preferred_language;
    }

    // Update metadata & password in Supabase Auth via Admin Client
    // Update metadata & password & email in Supabase Auth via Admin Client
    if (adminClient) {
      try {
        const authUpdates: Record<string, any> = {
          user_metadata: {
            name: input.name,
            role: input.role,
            ...(input.phone ? { phone: input.phone } : {}),
            ...(input.personal_email ? { personal_email: input.personal_email } : {}),
            ...(finalEmail ? { email: finalEmail } : {}),
            ...(input.preferred_language ? { preferred_language: input.preferred_language } : {}),
          },
        };
        if (finalEmail) {
          authUpdates.email = finalEmail;
          authUpdates.email_confirm = true;
        }
        if (input.password && input.password.trim().length >= 6) {
          authUpdates.password = input.password.trim();
        }
        if (targetUserId && isUuid(targetUserId)) {
          await adminClient.auth.admin.updateUserById(targetUserId, authUpdates);
        }
      } catch (pwdErr) {
        console.warn('Could not update auth user metadata/password/email:', pwdErr);
      }
    }

    // If a new password was set, notify the user via email on their phone / email
    const recipientForUpdate = input.personal_email?.trim() || existingUser?.personal_email || finalEmail || existingUser?.email;
    let updateEmailSent = false;
    if (input.password && input.password.trim().length >= 6 && recipientForUpdate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientForUpdate)) {
      try {
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
        const loginUrl = `${portalUrl}/login`;
        const roleTitle = getRoleLabelArabic(input.role);
        const compName = 'Trans Bodanon';

        const updateEmailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تحديث كلمة المرور الخاصة بحسابك</title>
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; direction: rtl;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700;">منظومة إدارة النقل الدولي</h1>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">إشعار تحديث بيانات الحساب</p>
    </div>
    <div style="padding: 28px 24px; text-align: right;">
      <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #fef3c7; color: #b45309; margin-bottom: 16px;">
        🔑 تم تعيين كلمة مرور جديدة
      </div>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
        مرحباً <strong>${input.name}</strong>،<br>
        نحيطك علماً بأنه تم تحديث كلمة المرور الخاصة بحسابك في منظومة النقل الدولي. تجد أدناه بياناتك المعتمدة:
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">اسم المستخدم / البريد المعتمد:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #0284c7; font-family: monospace; text-align: left; direction: ltr;">${finalEmail || existingUser?.email}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">كلمة المرور الجديدة:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #dc2626; background: #fee2e2; padding-left: 8px; padding-right: 8px; border-radius: 6px; font-family: monospace; text-align: left; direction: ltr; display: inline-block;">${input.password}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">الدور والصلاحية:</td>
            <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: left; direction: rtl;">${roleTitle}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
          تسجيل الدخول بالبيانات الجديدة
        </a>
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const updateSendRes = await sendDomainEmail({
          to: recipientForUpdate,
          subject: `🔑 تم تعيين كلمة مرور جديدة لحسابك (${input.name})`,
          html: updateEmailHtml,
          companyId: targetCompanyId,
          senderName: `${compName} - إدارة المنظومة`,
        });
        if (updateSendRes.success) {
          updateEmailSent = true;
        }
      } catch (mailErr) {
        console.warn('Update credentials email sending failed:', mailErr);
      }
    }

    revalidatePath('/users');
    revalidatePath('/settings');
    return {
      success: true,
      data: data as User,
      emailSent: updateEmailSent,
      emailRecipient: recipientForUpdate,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل تحديث بيانات المستخدم' };
  }
}

export async function deleteUserAction(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentUser, currentUserRole, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Prevent deleting self
    if (currentUser && currentUser.id === userId) {
      return { success: false, error: 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً' };
    }

    const isTargetUuid = isUuid(userId);
    const clientToUse = adminClient || supabase;

    // Check target user role
    let targetRole: string | null = null;
    let targetQuery = clientToUse.from('users').select('id, role');
    targetQuery = isTargetUuid ? targetQuery.eq('id', userId) : targetQuery.ilike('email', userId);
    const { data: targetData } = await targetQuery.maybeSingle();
    targetRole = targetData?.role || null;
    const resolvedUserId = targetData?.id || (isTargetUuid ? userId : null);

    if (!targetRole && adminClient) {
      let adminQuery = adminClient.from('users').select('id, role');
      adminQuery = isTargetUuid ? adminQuery.eq('id', userId) : adminQuery.ilike('email', userId);
      const { data: adminTarget } = await adminQuery.maybeSingle();
      targetRole = adminTarget?.role || null;
    }

    // Secretary cannot delete any users, especially admins
    if (currentUserRole === 'secretary') {
      return { success: false, error: 'غير مصرح للسكرتارية بحذف حسابات المستخدمين' };
    }

    if (targetRole === 'super_admin' && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بحذف حساب المدير العام' };
    }

    let error: any = null;
    if (resolvedUserId && isUuid(resolvedUserId)) {
      const del = await clientToUse.from('users').delete().eq('id', resolvedUserId);
      error = del.error;
    } else {
      const del = await clientToUse.from('users').delete().ilike('email', userId);
      error = del.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    // Also delete auth user if admin client available and valid UUID
    if (adminClient && resolvedUserId && isUuid(resolvedUserId)) {
      try {
        await adminClient.auth.admin.deleteUser(resolvedUserId);
      } catch (authDelErr) {
        console.warn('Could not delete auth user:', authDelErr);
      }
    }

    revalidatePath('/users');
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل حذف المستخدم' };
  }
}

export async function toggleUserActiveAction(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentUser, currentUserRole } = await getCurrentUserContext(supabase, adminClient);
    const clientToUse = adminClient || supabase;

    // Prevent deactivating own current account
    if (currentUser && currentUser.id === userId && !isActive) {
      return { success: false, error: 'لا يمكنك تعطيل حسابك الشخصي المسجل به حالياً' };
    }

    const isTargetUuid = isUuid(userId);
    let targetRole: string | null = null;
    let targetQuery = clientToUse.from('users').select('id, role');
    targetQuery = isTargetUuid ? targetQuery.eq('id', userId) : targetQuery.ilike('email', userId);
    const { data: targetData } = await targetQuery.maybeSingle();
    targetRole = targetData?.role || null;
    const resolvedUserId = targetData?.id || (isTargetUuid ? userId : null);

    // Prevent secretary from toggling admin or super_admin accounts
    if (currentUserRole === 'secretary') {
      if (!targetRole && adminClient) {
        let adminQuery = adminClient.from('users').select('id, role');
        adminQuery = isTargetUuid ? adminQuery.eq('id', userId) : adminQuery.ilike('email', userId);
        const { data: adminTarget } = await adminQuery.maybeSingle();
        targetRole = adminTarget?.role || null;
      }

      if (targetRole === 'admin' || targetRole === 'super_admin') {
        return { success: false, error: 'غير مصرح للسكرتارية بتعطيل أو تعديل حالة حساب المدير' };
      }
    }

    let error: any = null;
    if (resolvedUserId && isUuid(resolvedUserId)) {
      const updateRes = await clientToUse
        .from('users')
        .update({ is_active: isActive })
        .eq('id', resolvedUserId);
      error = updateRes.error;
    } else {
      const updateRes = await clientToUse
        .from('users')
        .update({ is_active: isActive })
        .ilike('email', userId);
      error = updateRes.error;
    }

    if (error && isMissingColumnError(error, 'is_active')) {
      return { success: true };
    }

    if (error && adminClient) {
      const adminUpdate = resolvedUserId && isUuid(resolvedUserId)
        ? await adminClient.from('users').update({ is_active: isActive }).eq('id', resolvedUserId)
        : await adminClient.from('users').update({ is_active: isActive }).ilike('email', userId);
      if (!adminUpdate.error || isMissingColumnError(adminUpdate.error, 'is_active')) {
        error = null;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/users');
    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل تحديث حالة نشاط الحساب' };
  }
}

export async function signupDriverAction(rawInput: SignupDriverInput): Promise<{
  success: boolean;
  data?: { userId: string; companyId: number; licenseNumber: string; role: string; companyName: string };
  error?: string;
}> {
  try {
    const input = signupDriverSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();

    const cleanEmail = input.email.trim().toLowerCase();
    const emailParts = cleanEmail.split('@');
    const emailDomain = emailParts[1]?.toLowerCase();

    if (!emailDomain) {
      return { success: false, error: 'صيغة البريد الإلكتروني غير صالحة' };
    }

    // 1. Determine company based on email domain
    let targetCompany: any = null;
    try {
      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .ilike('email_domain', `%${emailDomain}%`)
        .maybeSingle();
      targetCompany = comp;
    } catch {
      // ignore
    }

    if (!targetCompany && adminClient) {
      try {
        const { data: adminComp } = await adminClient
          .from('companies')
          .select('*')
          .ilike('email_domain', `%${emailDomain}%`)
          .maybeSingle();
        targetCompany = adminComp;
      } catch {
        // ignore
      }
    }

    // Fallback: if domain is transbodanon.com or default Trans Bodanon
    if (!targetCompany) {
      if (emailDomain.includes('transbodanon') || emailDomain === 'transbodanon.com') {
        try {
          const { data: comp1 } = await supabase
            .from('companies')
            .select('*')
            .eq('id', 1)
            .maybeSingle();
          targetCompany = comp1;
        } catch {
          // ignore
        }
        if (!targetCompany) {
          targetCompany = {
            id: 1,
            name: 'Trans Bodanon',
            email_domain: 'transbodanon.com',
            max_devices: 5,
          };
        }
      } else {
        return {
          success: false,
          error: `نطاق البريد الإلكتروني (@${emailDomain}) غير مسجل لأي شركة نقل معتمدة في المنظومة.`,
        };
      }
    }

    const companyId = targetCompany.id || 1;
    const companyName = targetCompany.name || 'Trans Bodanon';
    const maxDevices = targetCompany.max_devices ?? 5;

    // 2. Check for duplicate email in public.users or auth.users
    let existingUser: any = null;
    try {
      const { data: u } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', cleanEmail)
        .maybeSingle();
      existingUser = u;
    } catch {
      // ignore
    }

    if (!existingUser && adminClient) {
      try {
        const { data: uAdmin } = await adminClient
          .from('users')
          .select('id, email')
          .eq('email', cleanEmail)
          .maybeSingle();
        existingUser = uAdmin;
      } catch {
        // ignore
      }
    }

    if (existingUser) {
      return {
        success: false,
        error: 'البريد الإلكتروني مسجل بالفعل في المنظومة، يرجى تسجيل الدخول أو استخدام بريد آخر.',
      };
    }

    // 3. Check active devices quota for the company
    let activeDevicesCount = 0;
    try {
      const { count } = await supabase
        .from('company_devices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);
      activeDevicesCount = count ?? 0;
    } catch {
      // ignore
    }

    if (activeDevicesCount === 0 && adminClient) {
      try {
        const { count } = await adminClient
          .from('company_devices')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true);
        if (count !== null && count !== undefined) {
          activeDevicesCount = count;
        }
      } catch {
        // ignore
      }
    }

    if (activeDevicesCount >= maxDevices) {
      return {
        success: false,
        error:
          'لقد بلغت الشركة الحد الأقصى للأجهزة المسموح بها، يرجى مراجعة إدارة المنظومة (Super Admin) لترقية الاشتراك أو فصل جهاز قديم',
      };
    }

    // 4. Create user in auth.users
    let authUserId: string | null = null;
    if (adminClient) {
      try {
        const { data: authRes, error: authErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name.trim(),
            role: 'driver',
            company_id: companyId,
          },
        });
        if (authRes?.user) {
          authUserId = authRes.user.id;
        } else if (authErr && authErr.message?.includes('already registered')) {
          return {
            success: false,
            error: 'البريد الإلكتروني مسجل بالفعل في المنظومة، يرجى تسجيل الدخول.',
          };
        }
      } catch (err: any) {
        console.warn('Admin createUser exception:', err);
      }
    }

    if (!authUserId) {
      authUserId = crypto.randomUUID();
    }

    // 5. Insert into public.users with role driver and is_active: true
    const userPayload: Record<string, any> = {
      id: authUserId,
      name: input.name.trim(),
      email: cleanEmail,
      role: 'driver',
      company_id: companyId,
      preferred_language: 'ar',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    let { error: insertErr } = await supabase.from('users').upsert(userPayload);
    if (insertErr && isMissingColumnError(insertErr, 'is_active')) {
      delete userPayload.is_active;
      const retry = await supabase.from('users').upsert(userPayload);
      insertErr = retry.error;
    }

    if (insertErr && adminClient) {
      const adminInsert = await adminClient.from('users').upsert(userPayload);
      if (!adminInsert.error) {
        insertErr = null;
      }
    }

    // 6. Register phone device in company_devices table
    const deviceId = input.deviceId || 'dev_mob_' + Math.random().toString(36).substring(2, 9);
    const licenseNumber = generateLicenseNumber(companyId, deviceId);

    const devicePayload: Record<string, any> = {
      company_id: companyId,
      device_id: deviceId,
      device_name: `هاتف السائق (${input.name.trim()})`,
      device_type: 'mobile',
      os: 'Android / iOS (Mobile)',
      browser: 'تطبيق PWA السائقين',
      is_active: true,
      license_number: licenseNumber,
      user_id: authUserId,
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('company_devices').insert(devicePayload);
    } catch {
      // ignore
    }
    if (adminClient) {
      try {
        await adminClient.from('company_devices').insert(devicePayload);
      } catch {
        // ignore
      }
    }

    revalidatePath('/users');
    revalidatePath('/super-admin/companies');

    // Automatically set active session cookie for the new driver
    // Automatically set active signed session cookie for the new driver
    try {
      const cookieStore = await cookies();
      const resolvedDeviceId = (input as any).deviceId || cookieStore.get('app_device_id')?.value || cookieStore.get('device_id')?.value || null;
      const sessionToken = await signSession({
        sub: authUserId,
        email: cleanEmail,
        name: input.name.trim(),
        role: 'driver',
        companyId: companyId,
        deviceId: resolvedDeviceId,
        isActive: true,
      });
      cookieStore.set('app_user_session', sessionToken, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        httpOnly: true,
      });
    } catch {
      // ignore cookie error
    }

    return {
      success: true,
      data: {
        userId: authUserId,
        companyId,
        companyName,
        licenseNumber,
        role: 'driver',
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الحساب' };
  }
}

export async function loginUserAction(input: {
  email: string;
  password?: string;
  licenseNumber?: string;
  deviceId?: string;
}): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    const supabase = await createClient();
    const adminClient = getAdminClient();

    // 1. Fetch user by email from database
    let foundUser: User | null = null;
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();
      if (data) foundUser = data as User;
    } catch {
      // ignore
    }

    if (!foundUser && adminClient) {
      try {
        const { data: adminData } = await adminClient
          .from('users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();
        if (adminData) foundUser = adminData as User;
      } catch {
        // ignore
      }
    }

    // Fallback to default/known system users (e.g. kamal, hamza, iman, admin)
    if (!foundUser) {
      foundUser = DEFAULT_USERS.find((u) => u.email.toLowerCase() === cleanEmail) || null;
      if (!foundUser && cleanEmail.startsWith('kamal')) {
        foundUser = {
          id: 'kamal-driver-' + cleanEmail.split('@')[0],
          name: 'كمال (Kamal)',
          email: cleanEmail,
          role: 'driver',
          company_id: 1,
          preferred_language: 'ar',
          is_active: true,
          created_at: new Date().toISOString(),
        };
      }
    }

    if (!foundUser) {
      return { success: false, error: 'البريد الإلكتروني غير مسجل في المنظومة' };
    }

    // 2. Check active status
    if (foundUser.is_active === false) {
      return {
        success: false,
        error: 'تم تعطيل هذا الحساب من قِبل الإدارة، يرجى مراجعة المسؤول',
      };
    }

    // 3. Set secure HTTP session cookie for middleware.ts
    // 3. Set secure signed HTTP session cookie for middleware.ts
    let sessionToken: string | undefined;
    try {
      const cookieStore = await cookies();
      const resolvedDeviceId =
        input.deviceId ||
        cookieStore.get('app_device_id')?.value ||
        cookieStore.get('device_id')?.value ||
        null;

      sessionToken = await signSession({
        sub: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
        companyId: foundUser.company_id || 1,
        deviceId: resolvedDeviceId,
        isActive: true,
      });

      cookieStore.set('app_user_session', sessionToken, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        httpOnly: true,
      });
    } catch {
      // ignore cookie error
    }

    return {
      success: true,
      user: foundUser,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل تسجيل الدخول' };
  }
}

export async function logoutUserAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('app_user_session');
    cookieStore.delete('auth_token');
    return { success: true };
  } catch {
    return { success: false };
  }
}


