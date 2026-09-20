import { createClient } from '@/lib/supabase/server';
import { getSessionFromCookie } from './session';
import { hasPermission } from './rbac';
import type { Permission, AuthResult } from './rbac';
import type { UserRole } from '@/types/database';

export type { Permission, AuthResult };

export async function getCurrentUser(): Promise<AuthResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const session = await getSessionFromCookie();
    if (!session) return null;

    return {
      userId: session.sub,
      role: (session.role as UserRole) || 'driver',
      companyId: (session.companyId as number) ?? null,
      clientId: (session.clientId as number) ?? null,
      isActive: session.isActive !== false,
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, client_id, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const session = await getSessionFromCookie();
    if (!session) return null;

    return {
      userId: session.sub,
      role: (session.role as UserRole) || 'driver',
      companyId: (session.companyId as number) ?? null,
      clientId: (session.clientId as number) ?? null,
      isActive: session.isActive !== false,
    };
  }

  return {
    userId: user.id,
    role: (profile.role as UserRole) || 'driver',
    companyId: (profile.company_id as number) ?? null,
    clientId: (profile.client_id as number) ?? null,
    isActive: profile.is_active !== false,
  };
}

export async function requirePermission(
  permission: Permission,
  options?: { companyId?: number | null }
): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole = 'driver';
  let companyId: number | null = null;
  let clientId: number | null = null;
  let isActive = true;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, company_id, client_id, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = (profile.role as UserRole) || 'driver';
      companyId = (profile.company_id as number) ?? null;
      clientId = (profile.client_id as number) ?? null;
      if (profile.is_active === false) isActive = false;
    }
  }

  if (!user) {
    const session = await getSessionFromCookie();
    if (session) {
      role = (session.role as UserRole) || 'driver';
      companyId = (session.companyId as number) ?? null;
      clientId = (session.clientId as number) ?? null;
      if (session.isActive === false) isActive = false;
    }
  }

  if (!user && role === 'driver') {
    throw new Error('AUTH_REQUIRED');
  }

  if (!isActive) {
    throw new Error('ACCOUNT_DISABLED');
  }

  if (role !== 'super_admin' && role !== 'admin' && !hasPermission(role, permission)) {
    throw new Error(`FORBIDDEN:${permission}`);
  }

  if (options?.companyId && role !== 'super_admin' && companyId !== options.companyId) {
    throw new Error('TENANT_MISMATCH');
  }

  return {
    userId: user?.id || '',
    role,
    companyId,
    clientId,
    isActive: true,
  };
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole = 'driver';
  let isActive = true;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = (profile.role as UserRole) || 'driver';
      if (profile.is_active === false) isActive = false;
    }
  }

  if (!user) {
    const session = await getSessionFromCookie();
    if (session) {
      role = (session.role as UserRole) || 'driver';
      if (session.isActive === false) isActive = false;
    }
  }

  if (!user && role === 'driver') {
    throw new Error('AUTH_REQUIRED');
  }

  if (!isActive) {
    throw new Error('ACCOUNT_DISABLED');
  }

  if (role !== 'super_admin') {
    throw new Error('FORBIDDEN:super_admin_only');
  }

  return {
    userId: user?.id || '',
    role,
    companyId: null,
    isActive: true,
  };
}

/**
 * Strict server helper to resolve authenticated session or throw AUTH_REQUIRED.
 */
export async function getAuthenticatedSession(): Promise<AuthResult> {
  const current = await getCurrentUser();
  if (!current) {
    throw new Error('AUTH_REQUIRED');
  }
  if (!current.isActive) {
    throw new Error('ACCOUNT_DISABLED');
  }
  return current;
}

/**
 * Strict server helper to extract company ID from authenticated session.
 * Guaranteed to prevent tenant spoofing by never blindly trusting untrusted client parameters.
 */
export async function getAuthenticatedCompanyId(requestedCompanyId?: number | null): Promise<number> {
  const session = await getAuthenticatedSession();

  // Super-admin can operate on requested company or fallback
  if (session.role === 'super_admin') {
    if (requestedCompanyId) return requestedCompanyId;
    return session.companyId || 1;
  }

  // All other roles are strictly locked to their session's verified company_id
  if (!session.companyId) {
    throw new Error('TENANT_COMPANY_NOT_ASSIGNED');
  }

  return session.companyId;
}


