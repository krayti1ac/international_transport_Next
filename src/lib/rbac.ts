import type { UserRole } from '@/types/database';

export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  super_admin: ['*'],
  admin: ['*'],
  secretary: [
    '/dashboard',
    '/trips',
    '/trip-profitability',
    '/truck-tracking',
    '/fleet',
    '/treasury',
    '/bank-reconciliation',
    '/fuel-analytics',
    '/clients',
    '/invoices',
    '/reports',
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
    '/advanced-reports',
    '/executive-dashboard',
    '/settings',
    '/forex',
    '/ferry-expenses',
  ],
  driver: [
    '/driver-tasks',
    '/driver-advances',
    '/fuel-receipt',
    '/emergency-advance-requests',
    '/chat',
  ],
};

export const ROLE_DEFAULT_REDIRECT: Record<UserRole, string> = {
  super_admin: '/super-admin/companies',
  admin: '/dashboard',
  secretary: '/dashboard',
  driver: '/driver-tasks',
};

export function isRouteAllowed(role: UserRole, pathname: string): boolean {
  if (role === 'super_admin' || role === 'admin') return true;
  const allowed = ROLE_ALLOWED_ROUTES[role] || [];
  return allowed.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
