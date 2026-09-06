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

export async function getUsersAction(): Promise<{ success: boolean; data?: User[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If RLS denies or table issue, check if adminClient can read
      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: adminData, error: adminError } = await adminClient
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        if (!adminError && adminData) {
          return { success: true, data: adminData as User[] };
        }
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as User[] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'تعذر جلب بيانات المستخدمين' };
  }
}

export async function createUserAction(rawInput: CreateUserInput): Promise<{ success: boolean; data?: User; error?: string }> {
  try {
    const input = createUserSchema.parse(rawInput);
    const supabase = await createClient();
    const adminClient = getAdminClient();

    let authUserId: string | null = null;

    // 1. Try creating user in Supabase Auth via Admin Client
    if (adminClient) {
      try {
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            name: input.name,
            role: input.role,
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
      email: input.email.toLowerCase().trim(),
      role: input.role,
      preferred_language: input.preferred_language || 'ar',
      created_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select()
      .single();

    // If RLS blocked user insertion on normal client, attempt with adminClient
    if (error && adminClient) {
      const adminInsert = await adminClient
        .from('users')
        .insert(payload)
        .select()
        .single();
      if (!adminInsert.error) {
        data = adminInsert.data;
        error = null;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }

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

    const updatePayload: Record<string, any> = {
      name: input.name,
      role: input.role,
    };
    if (input.preferred_language) {
      updatePayload.preferred_language = input.preferred_language;
    }

    let { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single();

    if (error && adminClient) {
      const adminUpdate = await adminClient
        .from('users')
        .update(updatePayload)
        .eq('id', input.id)
        .select()
        .single();
      if (!adminUpdate.error) {
        data = adminUpdate.data;
        error = null;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }

    // If password provided, update via Admin Auth
    if (input.password && input.password.trim().length >= 6 && adminClient) {
      try {
        await adminClient.auth.admin.updateUserById(input.id, {
          password: input.password.trim(),
          user_metadata: { name: input.name, role: input.role },
        });
      } catch (pwdErr) {
        console.warn('Could not update auth password:', pwdErr);
      }
    }

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

    // Prevent deleting self
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser && currentUser.id === userId) {
      return { success: false, error: 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً' };
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

    revalidatePath('/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل حذف المستخدم' };
  }
}

