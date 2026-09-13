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
  if (role === 'admin') return true;
  const allowed = ROLE_ALLOWED_ROUTES[role] || [];
  return allowed.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
