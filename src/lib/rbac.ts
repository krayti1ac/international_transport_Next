import type { UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { getSessionFromCookie } from './session';

export type Permission =
  | 'companies:manage'
  | 'users:manage'
  | 'settings:manage'
  | 'trips:create'
  | 'trips:read'
  | 'trips:update'
  | 'trips:delete'
  | 'invoices:read'
  | 'invoices:create'
  | 'invoices:update'
  | 'invoices:delete'
  | 'payments:collect'
  | 'payments:read'
  | 'payroll:approve'
  | 'fleet:manage'
  | 'fleet:read'
  | 'reports:financial'
  | 'reports:operational'
  | 'audit:read'
  | 'documents:manage'
  | 'documents:read'
  | 'drivers:manage'
  | 'drivers:read'
  | 'clients:manage'
  | 'clients:read'
  | 'treasury:manage'
  | 'treasury:read'
  | 'maintenance:manage'
  | 'maintenance:read'
  | 'fuel:manage'
  | 'fuel:read'
  | 'forex:manage'
  | 'forex:read'
  | 'pricing:manage'
  | 'pricing:read'
  | 'predictive:read'
  | 'notifications:send'
  | 'chat:access'
  | 'branches:manage'
  | 'branches:read'
  | 'devices:manage';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'companies:manage',
    'users:manage',
    'settings:manage',
    'trips:create',
    'trips:read',
    'trips:update',
    'trips:delete',
    'invoices:read',
    'invoices:create',
    'invoices:update',
    'invoices:delete',
    'payments:collect',
    'payments:read',
    'payroll:approve',
    'fleet:manage',
    'fleet:read',
    'reports:financial',
    'reports:operational',
    'audit:read',
    'documents:manage',
    'drivers:manage',
    'clients:manage',
    'treasury:manage',
    'maintenance:manage',
    'fuel:manage',
    'forex:manage',
    'pricing:manage',
    'predictive:read',
    'notifications:send',
    'chat:access',
    'branches:manage',
    'devices:manage',
  ],
  admin: [
    'companies:manage',
    'users:manage',
    'settings:manage',
    'trips:create',
    'trips:read',
    'trips:update',
    'trips:delete',
    'invoices:read',
    'invoices:create',
    'invoices:update',
    'invoices:delete',
    'payments:collect',
    'payments:read',
    'payroll:approve',
    'fleet:manage',
    'fleet:read',
    'reports:financial',
    'reports:operational',
    'audit:read',
    'documents:manage',
    'drivers:manage',
    'clients:manage',
    'treasury:manage',
    'maintenance:manage',
    'fuel:manage',
    'forex:manage',
    'pricing:manage',
    'predictive:read',
    'notifications:send',
    'chat:access',
    'branches:manage',
    'devices:manage',
  ],
  secretary: [
    'trips:read',
    'trips:create',
    'trips:update',
    'invoices:read',
    'invoices:create',
    'clients:manage',
    'drivers:read',
    'fleet:read',
    'documents:manage',
    'treasury:read',
    'forex:read',
    'reports:operational',
    'notifications:send',
    'chat:access',
    'fuel:read',
    'maintenance:read',
    'branches:read',
    'pricing:read',
  ],
  driver: [
    'trips:read',
    'invoices:read',
    'documents:read',
    'chat:access',
    'fuel:read',
  ],
  accountant: [
    'invoices:read',
    'invoices:create',
    'invoices:update',
    'payments:collect',
    'payments:read',
    'payroll:approve',
    'treasury:manage',
    'forex:manage',
    'reports:financial',
    'reports:operational',
    'clients:read',
    'trips:read',
    'chat:access',
    'pricing:read',
    'predictive:read',
  ],
  fleet_manager: [
    'fleet:manage',
    'fleet:read',
    'maintenance:manage',
    'fuel:manage',
    'trips:read',
    'drivers:read',
    'reports:operational',
    'documents:manage',
    'notifications:send',
    'chat:access',
    'pricing:read',
    'predictive:read',
    'clients:read',
  ],
};

export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  super_admin: ['/super-admin', '/super-admin/companies', '/super-admin/screen-issues'],
  admin: ['*'],
  secretary: [
    '/dashboard',
    '/trips',
    '/truck-tracking',
    '/fleet',
    '/fuel-receipt',
    '/treasury',
    '/clients',
    '/invoices',
    '/maintenance',
    '/drivers',
    '/driver-settlements',
    '/geofence-zones',
    '/geofence-alerts',
    '/whatsapp-notifications',
    '/whatsapp-reminders',
    '/chat',
    '/documents',
    '/emergency-advance-requests',
    '/providers',
    '/settings',
    '/forex',
    '/ferry-expenses',
    '/pricing',
  ],
  driver: [
    '/driver-tasks',
    '/driver-advances',
    '/fuel-receipt',
    '/emergency-advance-requests',
    '/chat',
  ],
  // 💼 صلاحيات دور المحاسب / المدقق المالي
  accountant: [
    '/dashboard',
    '/invoices',
    '/treasury',
    '/bank-reconciliation',
    '/forex',
    '/driver-settlements',
    '/emergency-advance-requests',
    '/reports',
    '/advanced-reports',
    '/trip-profitability',
    '/pricing',
    '/predictive-analytics',
    '/clients',
    '/chat',
  ],
  // 🚛 صلاحيات دور مدير الأسطول والصيانة
  fleet_manager: [
    '/dashboard',
    '/fleet',
    '/maintenance',
    '/fuel-analytics',
    '/fuel-receipt',
    '/ferry-expenses',
    '/truck-tracking',
    '/transport-routes',
    '/pricing',
    '/predictive-analytics',
    '/documents',
    '/notifications/expiration',
    '/geofence-zones',
    '/geofence-alerts',
    '/drivers',
    '/providers',
    '/chat',
  ],
};

export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
  super_admin: '/super-admin/companies',
  admin: '/dashboard',
  secretary: '/dashboard',
  driver: '/driver-tasks',
  accountant: '/invoices',
  fleet_manager: '/fleet',
};

export function isRouteAllowed(role: UserRole, pathname: string): boolean {
  // تجريد أي استعلامات أو خطوط مائلة زائدة في نهاية المسار للمقارنة الدقيقة
  const cleanPath = (pathname.split('?')[0] || '').replace(/\/+$/, '') || '/';

  // 1. مسارات المشرف العام محصورة حصرياً بدور super_admin (المشرف العام)
  // ويُمنع منعاً باتاً وصول أي دور آخر إليها بما في ذلك مدير الشركة (admin) أو السكرتارية أو السائقين
  const isSuperAdminRoute = cleanPath === '/super-admin' || cleanPath.startsWith('/super-admin/');
  if (isSuperAdminRoute) {
    return role === 'super_admin';
  }

  // 2. المشرف العام (super_admin) محصور في مسارات الإشراف العام المخصصة له فقط
  if (role === 'super_admin') {
    const allowed = ROLE_ALLOWED_ROUTES.super_admin || [];
    return allowed.some((route) => cleanPath === route || cleanPath.startsWith(`${route}/`));
  }

  // 3. مدير الشركة (admin) له صلاحية الوصول لكافة مسارات النظام التشغيلية والإدارية عدا لوحة المشرف العام
  if (role === 'admin') return true;

  // 4. بقية الأدوار (السكرتارية، السائقين، المحاسبين، مديري الأسطول) حسب المصفوفة
  const allowed = ROLE_ALLOWED_ROUTES[role] || [];
  return allowed.some((route) => cleanPath === route || cleanPath.startsWith(`${route}/`));
}

export interface AuthResult {
  userId: string;
  role: UserRole;
  companyId: number | null;
  isActive: boolean;
}

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
      isActive: session.isActive !== false,
    };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const session = await getSessionFromCookie();
    if (!session) return null;

    return {
      userId: session.sub,
      role: (session.role as UserRole) || 'driver',
      companyId: (session.companyId as number) ?? null,
      isActive: session.isActive !== false,
    };
  }

  return {
    userId: user.id,
    role: (profile.role as UserRole) || 'driver',
    companyId: (profile.company_id as number) ?? null,
    isActive: profile.is_active !== false,
  };
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === 'super_admin' || role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
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
  let isActive = true;

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, company_id, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      role = (profile.role as UserRole) || 'driver';
      companyId = (profile.company_id as number) ?? null;
      if (profile.is_active === false) isActive = false;
    }
  }

  if (!user) {
    const session = await getSessionFromCookie();
    if (session) {
      role = (session.role as UserRole) || 'driver';
      companyId = (session.companyId as number) ?? null;
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
