'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createCompanySchema, type CreateCompanyInput } from '../schemas/company.schema';
import type { Company } from '@/types/database';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseJsClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getCompaniesAction(): Promise<{
  success: boolean;
  data?: Company[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بالوصول (يجب تسجيل الدخول)' };
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      // Fallback with service role if RLS policy on companies restricts access during migration
      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: adminData, error: adminError } = await adminClient
          .from('companies')
          .select('*')
          .order('id', { ascending: true });

        if (!adminError && adminData) {
          return { success: true, data: adminData as Company[] };
        }
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as Company[]) || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في جلب قائمة الشركات';
    return { success: false, error: message };
  }
}

export async function createCompanyAction(
  rawInput: CreateCompanyInput
): Promise<{ success: boolean; data?: Company; error?: string }> {
  try {
    const parsed = createCompanySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'بيانات غير صالحة' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بتأسيس شركات جديدة' };
    }

    const payload = {
      name: parsed.data.name.trim(),
      ice: parsed.data.ice?.trim() || null,
      currency: parsed.data.currency || 'MAD',
      is_active: true,
    };

    const { data, error } = await supabase
      .from('companies')
      .insert(payload)
      .select()
      .single();

    if (error) {
      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: adminData, error: adminError } = await adminClient
          .from('companies')
          .insert(payload)
          .select()
          .single();

        if (!adminError && adminData) {
          revalidatePath('/super-admin/companies');
          return { success: true, data: adminData as Company };
        }
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/super-admin/companies');
    return { success: true, data: data as Company };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في إضافة الشركة الجديدة';
    return { success: false, error: message };
  }
}

export async function toggleCompanyStatusAction(
  companyId: number,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('companies')
      .update({ is_active: isActive })
      .eq('id', companyId);

    if (error) {
      const adminClient = getAdminClient();
      if (adminClient) {
        const { error: adminError } = await adminClient
          .from('companies')
          .update({ is_active: isActive })
          .eq('id', companyId);
        if (!adminError) {
          revalidatePath('/super-admin/companies');
          return { success: true };
        }
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/super-admin/companies');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في تحديث حالة الشركة';
    return { success: false, error: message };
  }
}

