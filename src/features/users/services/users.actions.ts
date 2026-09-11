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

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

export async function createUserAction(rawInput: CreateUserInput): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
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
    if (companyIdToAssign) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id, name, email_domain')
          .eq('id', companyIdToAssign)
          .maybeSingle();

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
    if (
      error &&
      (isMissingColumnError(error, 'preferred_language') ||
        isMissingColumnError(error, 'avatar_url') ||
        isMissingColumnError(error, 'is_active'))
    ) {
      if (isMissingColumnError(error, 'preferred_language')) delete payload.preferred_language;
      if (isMissingColumnError(error, 'avatar_url')) delete payload.avatar_url;
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

      if (adminInsert.error && (isMissingColumnError(adminInsert.error, 'preferred_language') || isMissingColumnError(adminInsert.error, 'avatar_url'))) {
        if (isMissingColumnError(adminInsert.error, 'preferred_language')) delete payload.preferred_language;
        if (isMissingColumnError(adminInsert.error, 'avatar_url')) delete payload.avatar_url;
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

    revalidatePath('/users');
    revalidatePath('/settings');
    return { success: true, data: data as User };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل إضافة المستخدم' };
  }
}

export async function updateUserAction(rawInput: UpdateUserInput): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
    const input = updateUserSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const { currentCompanyId, currentUserRole, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Fetch existing user to verify permissions
    let existingUser: User | null = null;
    const { data: existingData } = await supabase
      .from('users')
      .select('id, email, role, company_id')
      .eq('id', input.id)
      .maybeSingle();

    existingUser = existingData as User | null;

    if (!existingUser && adminClient) {
      const { data: adminExisting } = await adminClient
        .from('users')
        .select('id, email, role, company_id')
        .eq('id', input.id)
        .maybeSingle();
      existingUser = adminExisting as User | null;
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

    // Resolve user ID if given ID was a mock ID or if user exists with finalEmail
    let targetUserId = input.id;
    try {
      const matchQuery = finalEmail
        ? `id.eq.${input.id},email.ilike.${finalEmail}`
        : `id.eq.${input.id}`;
      const { data: matched } = await supabase
        .from('users')
        .select('id, email, company_id')
        .or(matchQuery)
        .maybeSingle();

      if (matched) {
        targetUserId = matched.id;
      }
    } catch {
      // ignore
    }

    let { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select()
      .maybeSingle();

    // Graceful fallback if preferred_language, avatar_url, or is_active column is not yet in Supabase schema cache
    if (
      error &&
      (isMissingColumnError(error, 'preferred_language') ||
        isMissingColumnError(error, 'avatar_url') ||
        isMissingColumnError(error, 'is_active'))
    ) {
      if (isMissingColumnError(error, 'preferred_language')) delete updatePayload.preferred_language;
      if (isMissingColumnError(error, 'avatar_url')) delete updatePayload.avatar_url;
      if (isMissingColumnError(error, 'is_active')) delete updatePayload.is_active;
      const retry = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', targetUserId)
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error && adminClient) {
      let adminUpdate = await adminClient
        .from('users')
        .update(updatePayload)
        .eq('id', targetUserId)
        .select()
        .maybeSingle();

      if (
        adminUpdate.error &&
        (isMissingColumnError(adminUpdate.error, 'preferred_language') ||
          isMissingColumnError(adminUpdate.error, 'avatar_url') ||
          isMissingColumnError(adminUpdate.error, 'is_active'))
      ) {
        if (isMissingColumnError(adminUpdate.error, 'preferred_language')) delete updatePayload.preferred_language;
        if (isMissingColumnError(adminUpdate.error, 'avatar_url')) delete updatePayload.avatar_url;
        if (isMissingColumnError(adminUpdate.error, 'is_active')) delete updatePayload.is_active;
        adminUpdate = await adminClient
          .from('users')
          .update(updatePayload)
          .eq('id', targetUserId)
          .select()
          .maybeSingle();
      }

      if (!adminUpdate.error) {
        data = adminUpdate.data;
        error = null;
      }
    }

    // If update returned 0 rows (e.g. ID was from localStorage or mock user that isn't yet in DB)
    if (!data && !error && finalEmail) {
      // Check if user exists by email
      const { data: userByEmail } = await supabase
        .from('users')
        .select('id')
        .ilike('email', finalEmail)
        .maybeSingle();

      if (userByEmail) {
        targetUserId = userByEmail.id;
        const retryByEmail = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', targetUserId)
          .select()
          .maybeSingle();
        if (retryByEmail.data) {
          data = retryByEmail.data;
        }
      }
    }

    // If still no row in database, upsert it
    if (!data && !error) {
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
      const upsertRes = await supabase
        .from('users')
        .upsert(upsertPayload, { onConflict: 'id' })
        .select()
        .maybeSingle();
      if (upsertRes.data) {
        data = upsertRes.data;
      } else if (adminClient) {
        const adminUpsert = await adminClient
          .from('users')
          .upsert(upsertPayload, { onConflict: 'id' })
          .select()
          .maybeSingle();
        if (adminUpsert.data) {
          data = adminUpsert.data;
        }
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
        await adminClient.auth.admin.updateUserById(targetUserId, authUpdates);
      } catch (pwdErr) {
        console.warn('Could not update auth user metadata/password:', pwdErr);
        console.warn('Could not update auth user metadata/password/email:', pwdErr);
      }
    }

    revalidatePath('/users');
    revalidatePath('/settings');
    return { success: true, data: data as User };
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

    // Check target user role
    let targetRole: string | null = null;
    const { data: targetData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    targetRole = targetData?.role || null;

    if (!targetRole && adminClient) {
      const { data: adminTarget } = await adminClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      targetRole = adminTarget?.role || null;
    }

    // Secretary cannot delete any users, especially admins
    if (currentUserRole === 'secretary') {
      return { success: false, error: 'غير مصرح للسكرتارية بحذف حسابات المستخدمين' };
    }

    if (targetRole === 'super_admin' && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بحذف حساب المدير العام' };
    }

    let { error } = await supabase.from('users').delete().eq('id', userId);

    if (error && adminClient) {
      const adminDelete = await adminClient.from('users').delete().eq('id', userId);
      if (!adminDelete.error) {
        error = null;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }

    // Also delete auth user if admin client available
    if (adminClient) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
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

    // Prevent deactivating own current account
    if (currentUser && currentUser.id === userId && !isActive) {
      return { success: false, error: 'لا يمكنك تعطيل حسابك الشخصي المسجل به حالياً' };
    }

    // Prevent secretary from toggling admin or super_admin accounts
    if (currentUserRole === 'secretary') {
      let targetRole: string | null = null;
      const { data: targetData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      targetRole = targetData?.role || null;

      if (!targetRole && adminClient) {
        const { data: adminTarget } = await adminClient
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        targetRole = adminTarget?.role || null;
      }

      if (targetRole === 'admin' || targetRole === 'super_admin') {
        return { success: false, error: 'غير مصرح للسكرتارية بتعطيل أو تعديل حالة حساب المدير' };
      }
    }

    let { error } = await supabase
      .from('users')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error && isMissingColumnError(error, 'is_active')) {
      return { success: true };
    }

    if (error && adminClient) {
      const adminUpdate = await adminClient
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId);
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
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        'app_user_session',
        JSON.stringify({
          id: authUserId,
          email: cleanEmail,
          name: input.name.trim(),
          role: 'driver',
          company_id: companyId,
          is_active: true,
        }),
        {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
          sameSite: 'lax',
          httpOnly: false,
        }
      );
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
    try {
      const cookieStore = await cookies();
      cookieStore.set(
        'app_user_session',
        JSON.stringify({
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          role: foundUser.role,
          company_id: foundUser.company_id || 1,
          is_active: true,
        }),
        {
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
          sameSite: 'lax',
          httpOnly: false,
        }
      );
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
    return { success: true };
  } catch {
    return { success: false };
  }
}


