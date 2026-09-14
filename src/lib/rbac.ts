import type { UserRole } from '@/types/database';

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
