import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export async function getCurrentCompanyId(): Promise<number | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  return (profile?.company_id as number) ?? null;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return (profile?.role as UserRole) ?? null;
}

export function withTenantFilter<T extends Record<string, unknown>>(
  query: { eq: (column: string, value: unknown) => { eq: (column: string, value: unknown) => { select: (cols?: string) => Promise<{ data: T[] | null; error: unknown }> } } },
  companyId: number | null,
  role: UserRole | null
) {
  if (role === 'super_admin' || companyId === null || companyId === undefined || role === null || role === undefined) {
    return query;
  }
  return query.eq('company_id', companyId);
}

export async function assertTenantAccess(companyId: number, userId?: string): Promise<void> {
  if (!userId) return;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return;

  if (profile.role === 'super_admin') return;
  if ((profile.company_id as number) === companyId) return;

  throw new Error('TENANT_ACCESS_DENIED');
}
