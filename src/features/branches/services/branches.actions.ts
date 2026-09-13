'use server';

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { branchSchema, type BranchFormData } from '../schemas/branch.schema';
import type { CompanyBranch } from '@/types/database';

export interface BranchActionResult {
  success: boolean;
  branch?: CompanyBranch;
  error?: string;
}

/**
 * Get all company branches for the authenticated user's company
 */
export async function getCompanyBranches(): Promise<{
  success: boolean;
  branches: CompanyBranch[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. Fetch user to ensure authentication and get company_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, branches: [], error: 'المستخدم غير مسجل' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    const companyId = userProfile?.company_id;

    let query = supabase
      .from('company_branches')
      .select(`
        id,
        company_id,
        name,
        code,
        country,
        city,
        address,
        phone,
        email,
        is_headquarters,
        is_active,
        default_cash_box_id,
        created_at,
        updated_at
      `)
      .order('is_headquarters', { ascending: false })
      .order('name', { ascending: true });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Auto-seed default headquarters branch if none exists yet
    if ((!data || data.length === 0) && companyId) {
      const defaultHQ = {
        company_id: companyId,
        name: 'المقر الرئيسي (طنجة المتوسط)',
        code: 'TNG-HQ',
        country: 'MA',
        city: 'Tanger Med',
        address: 'Zone Franche Logistique, Port Tanger Med',
        is_headquarters: true,
        is_active: true,
      };

      const { data: seeded, error: seedError } = await supabase
        .from('company_branches')
        .insert(defaultHQ)
        .select()
        .single();

      if (!seedError && seeded) {
        return { success: true, branches: [seeded as CompanyBranch] };
      }
    }

    return { success: true, branches: (data || []) as CompanyBranch[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب قائمة الفروع';
    return { success: false, branches: [], error: message };
  }
}

/**
 * Create a new company branch
 */
export async function createBranch(data: BranchFormData): Promise<BranchActionResult> {
  try {
    const validated = branchSchema.parse(data);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'غير مصرح لك بإجراء هذه العملية' };
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.company_id) {
      return { success: false, error: 'لم يتم العثور على الشركة التابعة للمستخدم' };
    }

    const companyId = userProfile.company_id;

    // If marked as headquarters, unset previous headquarters
    if (validated.is_headquarters) {
      await supabase
        .from('company_branches')
        .update({ is_headquarters: false })
        .eq('company_id', companyId);
    }

    const newBranchPayload = {
      company_id: companyId,
      name: validated.name,
      code: validated.code,
      country: validated.country,
      city: validated.city,
      address: validated.address || null,
      phone: validated.phone || null,
      email: validated.email || null,
      is_headquarters: validated.is_headquarters,
      is_active: validated.is_active,
      default_cash_box_id: validated.default_cash_box_id || null,
    };

    const { data: created, error } = await supabase
      .from('company_branches')
      .insert(newBranchPayload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'رمز الفرع (Code) مستخدم مسبقاً داخل الشركة' };
      }
      throw error;
    }

    await recordAuditLog({
      actionType: 'create',
      entityType: 'company_branches',
      entityId: created.id.toString(),
      reason: `إنشاء فرع جديد: ${created.name} (${created.code})`,
      newData: created,
    });

    return { success: true, branch: created as CompanyBranch };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء الفرع';
    return { success: false, error: message };
  }
}

/**
 * Update an existing company branch
 */
export async function updateBranch(
  id: number,
  data: Partial<BranchFormData>
): Promise<BranchActionResult> {
  try {
    const supabase = await createClient();

    // If setting as headquarters, unset others first
    if (data.is_headquarters) {
      const { data: existing } = await supabase
        .from('company_branches')
        .select('company_id')
        .eq('id', id)
        .single();

      if (existing) {
        await supabase
          .from('company_branches')
          .update({ is_headquarters: false })
          .eq('company_id', existing.company_id);
      }
    }

    const { data: updated, error } = await supabase
      .from('company_branches')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await recordAuditLog({
      actionType: 'update',
      entityType: 'company_branches',
      entityId: id.toString(),
      reason: `تحديث بيانات الفرع: ${updated.name}`,
      newData: updated,
    });

    return { success: true, branch: updated as CompanyBranch };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحديث الفرع';
    return { success: false, error: message };
  }
}

/**
 * Delete a company branch
 */
export async function deleteBranch(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Check if it's headquarters
    const { data: branch } = await supabase
      .from('company_branches')
      .select('is_headquarters, name')
      .eq('id', id)
      .single();

    if (branch?.is_headquarters) {
      return { success: false, error: 'لا يمكن حذف المقر الرئيسي للشركة' };
    }

    // Check if linked to active trips or trucks
    const { count: truckCount } = await supabase
      .from('trucks')
      .select('*', { count: 'exact', head: true })
      .eq('home_branch_id', id);

    if (truckCount && truckCount > 0) {
      return {
        success: false,
        error: `لا يمكن حذف هذا الفرع لوجود ${truckCount} شاحنة تابعة له حالياً`,
      };
    }

    const { error } = await supabase.from('company_branches').delete().eq('id', id);

    if (error) throw error;

    await recordAuditLog({
      actionType: 'delete',
      entityType: 'company_branches',
      entityId: id.toString(),
      reason: `حذف الفرع: ${branch?.name}`,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل حذف الفرع';
    return { success: false, error: message };
  }
}

