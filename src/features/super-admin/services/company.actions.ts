'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import {
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '../schemas/company.schema';
import type { Company, CompanyDevice } from '@/types/database';

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بالوصول (يجب تسجيل الدخول)' };
    }

    let companiesData: Company[] | null = null;
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
          companiesData = adminData as Company[];
        }
      }
      if (!companiesData) {
        return { success: false, error: error.message };
      }
    } else {
      companiesData = data as Company[];
    }

    // Safely query active devices count per company
    let deviceCounts: Record<number, number> = {};
    try {
      const { data: devicesData } = await supabase
        .from('company_devices')
        .select('company_id, is_active')
        .eq('is_active', true);

      if (devicesData) {
        deviceCounts = devicesData.reduce((acc, dev) => {
          const cid = dev.company_id as number;
          acc[cid] = (acc[cid] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
      }
    } catch {
      // Ignore if company_devices table is not yet created
    }

    const enrichedCompanies: Company[] = (companiesData || []).map((comp) => ({
      ...comp,
      subscription_cost: comp.subscription_cost ?? 0,
      subscription_start_date: comp.subscription_start_date || null,
      subscription_end_date: comp.subscription_end_date || null,
      max_devices: comp.max_devices ?? 5,
      email_domain: comp.email_domain || null,
      active_devices_count: deviceCounts[comp.id] ?? 0,
    }));

    return { success: true, data: enrichedCompanies };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في جلب قائمة الشركات';
    return { success: false, error: message };
  }
}

function isMissingColumnError(errMessage?: string): boolean {
  if (!errMessage) return false;
  return (
    errMessage.includes('column') ||
    errMessage.includes('schema cache') ||
    errMessage.includes('PGRST204')
  );
}

export async function ensureCompanyAdminAccount(
  companyId: number,
  companyName: string,
  domain: string
): Promise<{ email: string; created: boolean; error?: string }> {
  const cleanDomain = domain.replace(/^@+/, '').trim().toLowerCase();
  if (!cleanDomain) {
    return { email: '', created: false, error: 'نطاق البريد غير صالح' };
  }

  const adminEmail = `admin@${cleanDomain}`;
  const adminName = `مسؤول ${companyName.trim()}`;
  const defaultPassword = '123456';

  try {
    const adminClient = getAdminClient();
    const supabase = await createClient();
    let authUserId: string | null = null;

    // 1. Check if user already exists in public.users
    const { data: existingPublicUser } = await supabase
      .from('users')
      .select('id, email, company_id, role')
      .eq('email', adminEmail)
      .maybeSingle();

    if (existingPublicUser) {
      authUserId = existingPublicUser.id;
      if (existingPublicUser.company_id !== companyId || existingPublicUser.role !== 'admin') {
        await supabase
          .from('users')
          .update({ company_id: companyId, role: 'admin' })
          .eq('id', existingPublicUser.id);
      }
      return { email: adminEmail, created: true };
    }

    // 2. Create in Supabase Auth via Admin Client
    if (adminClient) {
      try {
        const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
          email: adminEmail,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            name: adminName,
            role: 'admin',
            company_id: companyId,
          },
        });

        if (newAuthUser?.user) {
          authUserId = newAuthUser.user.id;
        } else if (authError && authError.message?.includes('already been registered')) {
          const { data: list } = await adminClient.auth.admin.listUsers();
          const found = list?.users?.find((u) => u.email?.toLowerCase() === adminEmail);
          if (found) {
            authUserId = found.id;
          }
        }
      } catch (authErr) {
        console.warn('Auth admin user creation exception:', authErr);
      }
    }

    if (!authUserId) {
      authUserId = crypto.randomUUID();
    }

    // 3. Upsert into public.users
    const userPayload = {
      id: authUserId,
      email: adminEmail,
      name: adminName,
      role: 'admin' as const,
      company_id: companyId,
      preferred_language: 'ar' as const,
      created_at: new Date().toISOString(),
    };

    const { error: userError } = await supabase
      .from('users')
      .upsert(userPayload, { onConflict: 'id' });

    if (userError && adminClient) {
      await adminClient.from('users').upsert(userPayload, { onConflict: 'id' });
    }

    return { email: adminEmail, created: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error creating default admin for company:', msg);
    return { email: adminEmail, created: false, error: msg };
  }
}

export async function createCompanyAction(
  rawInput: CreateCompanyInput
): Promise<{
  success: boolean;
  data?: Company;
  adminAccount?: { email: string; password: string };
  warning?: string;
  error?: string;
}> {
  try {
    const parsed = createCompanySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'بيانات غير صالحة' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بتأسيس شركات جديدة' };
    }

    const fullPayload = {
      name: parsed.data.name.trim(),
      ice: parsed.data.ice?.trim() || null,
      currency: parsed.data.currency || 'MAD',
      subscription_cost: parsed.data.subscription_cost ?? 0,
      subscription_start_date: parsed.data.subscription_start_date || null,
      subscription_end_date: parsed.data.subscription_end_date || null,
      max_devices: parsed.data.max_devices ?? 5,
      email_domain: parsed.data.email_domain || null,
      is_active: true,
    };

    let finalCompany: Company | null = null;
    let fallbackWarning: string | undefined = undefined;

    const { data, error } = await supabase
      .from('companies')
      .insert(fullPayload)
      .select()
      .single();

    if (error) {
      // If error is due to missing columns, fallback to base columns
      if (isMissingColumnError(error.message)) {
        const basePayload = {
          name: parsed.data.name.trim(),
          ice: parsed.data.ice?.trim() || null,
          currency: parsed.data.currency || 'MAD',
          is_active: true,
        };

        const { data: baseData, error: baseError } = await supabase
          .from('companies')
          .insert(basePayload)
          .select()
          .single();

        if (!baseError && baseData) {
          finalCompany = {
            ...baseData,
            subscription_cost: parsed.data.subscription_cost ?? 0,
            subscription_start_date: parsed.data.subscription_start_date || null,
            subscription_end_date: parsed.data.subscription_end_date || null,
            max_devices: parsed.data.max_devices ?? 5,
            email_domain: parsed.data.email_domain || null,
          } as Company;
          fallbackWarning = 'تم تأسيس الشركة بالبيانات الأساسية. يرجى تنفيذ ملف الترحيل في Supabase لتفعيل حقول الاشتراك والنطاق.';
        }
      }

      if (!finalCompany) {
        const adminClient = getAdminClient();
        if (adminClient) {
          const { data: adminData, error: adminError } = await adminClient
            .from('companies')
            .insert(fullPayload)
            .select()
            .single();

          if (!adminError && adminData) {
            finalCompany = adminData as Company;
          }
        }
      }

      if (!finalCompany) {
        return { success: false, error: error.message };
      }
    } else {
      finalCompany = data as Company;
    }

    // Automatically create the admin@<domain> account for the new company
    let adminAccount: { email: string; password: string } | undefined = undefined;
    const domainToUse = (finalCompany.email_domain || parsed.data.email_domain || '')
      .replace(/^@+/, '')
      .trim()
      .toLowerCase();

    if (domainToUse && finalCompany.id) {
      const adminRes = await ensureCompanyAdminAccount(finalCompany.id, finalCompany.name, domainToUse);
      if (adminRes.email) {
        adminAccount = { email: adminRes.email, password: '123' };
      }
    }

    revalidatePath('/super-admin/companies');
    return {
      success: true,
      data: finalCompany,
      adminAccount,
      warning: fallbackWarning,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في إضافة الشركة الجديدة';
    return { success: false, error: message };
  }
}

export async function updateCompanyAction(
  rawInput: UpdateCompanyInput
): Promise<{ success: boolean; data?: Company; warning?: string; error?: string }> {
  try {
    const parsed = updateCompanySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'بيانات غير صالحة' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بتعديل بيانات الشركة' };
    }

    const fullPayload = {
      name: parsed.data.name.trim(),
      ice: parsed.data.ice?.trim() || null,
      currency: parsed.data.currency || 'MAD',
      subscription_cost: parsed.data.subscription_cost ?? 0,
      subscription_start_date: parsed.data.subscription_start_date || null,
      subscription_end_date: parsed.data.subscription_end_date || null,
      max_devices: parsed.data.max_devices ?? 5,
      email_domain: parsed.data.email_domain !== undefined ? parsed.data.email_domain : null,
      ...(parsed.data.is_active !== undefined ? { is_active: parsed.data.is_active } : {}),
    };

    const { data, error } = await supabase
      .from('companies')
      .update(fullPayload)
      .eq('id', parsed.data.id)
      .select()
      .single();

    if (error) {
      // Fallback: If migration columns (max_devices, email_domain, etc.) are not yet present on remote DB
      if (isMissingColumnError(error.message)) {
        const basePayload = {
          name: parsed.data.name.trim(),
          ice: parsed.data.ice?.trim() || null,
          currency: parsed.data.currency || 'MAD',
          ...(parsed.data.is_active !== undefined ? { is_active: parsed.data.is_active } : {}),
        };

        const { data: baseData, error: baseError } = await supabase
          .from('companies')
          .update(basePayload)
          .eq('id', parsed.data.id)
          .select()
          .single();

        if (!baseError && baseData) {
          revalidatePath('/super-admin/companies');
          return {
            success: true,
            data: {
              ...baseData,
              subscription_cost: parsed.data.subscription_cost ?? 0,
              subscription_start_date: parsed.data.subscription_start_date || null,
              subscription_end_date: parsed.data.subscription_end_date || null,
              max_devices: parsed.data.max_devices ?? 5,
              email_domain: parsed.data.email_domain || null,
            } as Company,
            warning: 'تم حفظ البيانات الأساسية للشركة بنجاح. لتفعيل حفظ تكلفة الاشتراك والأجهزة بشكل دائم، يرجى تنفيذ ملف SQL في Supabase SQL Editor.',
          };
        }
      }

      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: adminData, error: adminError } = await adminClient
          .from('companies')
          .update(fullPayload)
          .eq('id', parsed.data.id)
          .select()
          .single();

        if (!adminError && adminData) {
          revalidatePath('/super-admin/companies');
          return { success: true, data: adminData as Company };
        }
      }
      return { success: false, error: error.message };
    }

    // Ensure admin@domain exists if an email domain was set or updated
    const updateDomain = (parsed.data.email_domain || '').replace(/^@+/, '').trim().toLowerCase();
    if (updateDomain && parsed.data.id) {
      await ensureCompanyAdminAccount(parsed.data.id, parsed.data.name, updateDomain);
    }

    revalidatePath('/super-admin/companies');
    return { success: true, data: data as Company };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في تحديث بيانات الشركة';
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

export async function getCompanyDevicesAction(
  companyId: number
): Promise<{ success: boolean; data?: CompanyDevice[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('company_devices')
      .select('*')
      .eq('company_id', companyId)
      .order('last_active_at', { ascending: false });

    if (error) {
      const adminClient = getAdminClient();
      if (adminClient) {
        const { data: adminData, error: adminError } = await adminClient
          .from('company_devices')
          .select('*')
          .eq('company_id', companyId)
          .order('last_active_at', { ascending: false });

        if (!adminError && adminData) {
          return { success: true, data: adminData as CompanyDevice[] };
        }
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as CompanyDevice[]) || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل في جلب أجهزة الشركة';
    return { success: false, error: message };
  }
}

export async function toggleDeviceStatusAction(
  deviceId: number,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('company_devices')
      .update({ is_active: isActive })
      .eq('id', deviceId);

    if (error) {
      const adminClient = getAdminClient();
      if (adminClient) {
        const { error: adminError } = await adminClient
          .from('company_devices')
          .update({ is_active: isActive })
          .eq('id', deviceId);
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
    const message = err instanceof Error ? err.message : 'فشل في تحديث حالة الجهاز';
    return { success: false, error: message };
  }
}

