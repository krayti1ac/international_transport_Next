import type { UserRole } from '@/types/database';

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
  | 'devices:manage'
  | 'bookings:create'
  | 'bookings:read'
  | 'portal:access';

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
    'bookings:create',
    'bookings:read',
    'portal:access',
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
    'bookings:create',
    'bookings:read',
    'portal:access',
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
    'bookings:create',
    'bookings:read',
    'portal:access',
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
  // 🏢 صلاحيات دور العميل المصدر / المستورد
  client: [
    'portal:access',
    'trips:read',
    'invoices:read',
    'documents:read',
    'bookings:create',
    'bookings:read',
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
    '/fleet-utilization',
    '/incidents',
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
    '/fleet-utilization',
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
    '/incidents',
    '/truck-tracking',
    '/transport-routes',
    '/pricing',
    '/fleet-utilization',
    '/predictive-analytics',
    '/documents',
    '/notifications/expiration',
    '/geofence-zones',
    '/geofence-alerts',
    '/drivers',
    '/providers',
    '/chat',
  ],
  // 🏢 مسارات دور العميل المصدر / المستورد
  client: [
    '/portal',
    '/portal/bookings',
    '/portal/invoices',
    '/portal/trips',
    '/track',
  ],
};

export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
  super_admin: '/super-admin/companies',
  admin: '/dashboard',
  secretary: '/dashboard',
  driver: '/driver-tasks',
  accountant: '/invoices',
  fleet_manager: '/fleet',
  client: '/portal',
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
  clientId?: number | null;
  isActive: boolean;
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === 'super_admin' || role === 'admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}


