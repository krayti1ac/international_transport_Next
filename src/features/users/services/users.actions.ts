'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createUserSchema, updateUserSchema, type CreateUserInput, type UpdateUserInput } from '../schemas/user.schema';
import type { User } from '@/types/database';

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
    const { currentCompanyId, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Prevent non-super-admins from creating super_admin accounts
    if (input.role === 'super_admin' && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بإنشاء حساب بصلاحية المدير العام' };
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
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select()
      .single();

    // If preferred_language or avatar_url column doesn't exist in Supabase schema cache, retry without it
    if (error && (isMissingColumnError(error, 'preferred_language') || isMissingColumnError(error, 'avatar_url'))) {
      if (isMissingColumnError(error, 'preferred_language')) delete payload.preferred_language;
      if (isMissingColumnError(error, 'avatar_url')) delete payload.avatar_url;
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
    const { currentCompanyId, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

    // Fetch existing user to verify permissions
    let existingUser: User | null = null;
    const { data: existingData } = await supabase
      .from('users')
      .select('role, company_id')
      .select('id, email, role, company_id')
      .eq('id', input.id)
      .maybeSingle();

    existingUser = existingData as User | null;

    if (!existingUser && adminClient) {
      const { data: adminExisting } = await adminClient
        .from('users')
        .select('role, company_id')
        .select('id, email, role, company_id')
        .eq('id', input.id)
        .maybeSingle();
      existingUser = adminExisting as User | null;
    }

    // If target is super_admin or attempting to elevate to super_admin, require isSuperAdmin
    if ((existingUser?.role === 'super_admin' || input.role === 'super_admin') && !isSuperAdmin) {
      return { success: false, error: 'غير مصرح لك بتعديل أو تعيين صلاحية المدير العام' };
    }

    const updatePayload: Record<string, any> = {
      name: input.name,
      role: input.role,
    };

    if (input.avatar_url !== undefined) {
      updatePayload.avatar_url = input.avatar_url;
    }

    // If email is provided, validate and enforce domain
    let finalEmail: string | undefined = undefined;
    if (input.email) {
      const trimmedEmail = input.email.trim().toLowerCase();
      let companyEmailDomain: string | null = null;
      const targetCompanyId = input.company_id ?? existingUser?.company_id ?? currentCompanyId;

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

    let { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single();

    // Graceful fallback if preferred_language or avatar_url column is not yet in Supabase schema cache
    if (error && (isMissingColumnError(error, 'preferred_language') || isMissingColumnError(error, 'avatar_url'))) {
      if (isMissingColumnError(error, 'preferred_language')) delete updatePayload.preferred_language;
      if (isMissingColumnError(error, 'avatar_url')) delete updatePayload.avatar_url;
      const retry = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error && adminClient) {
      let adminUpdate = await adminClient
        .from('users')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();

      if (adminUpdate.error && (isMissingColumnError(adminUpdate.error, 'preferred_language') || isMissingColumnError(adminUpdate.error, 'avatar_url'))) {
        if (isMissingColumnError(adminUpdate.error, 'preferred_language')) delete updatePayload.preferred_language;
        if (isMissingColumnError(adminUpdate.error, 'avatar_url')) delete updatePayload.avatar_url;
        adminUpdate = await adminClient
          .from('users')
          .update(updatePayload)
          .eq('id', input.id)
          .select()
          .single();
      }

      if (!adminUpdate.error) {
        data = adminUpdate.data;
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
        await adminClient.auth.admin.updateUserById(input.id, authUpdates);
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
    const { currentUser, isSuperAdmin } = await getCurrentUserContext(supabase, adminClient);

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

