import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isRouteAllowed,
  ROLE_PERMISSIONS,
  ROLE_DEFAULT_REDIRECT,
} from './rbac';
import type { UserRole } from '@/types/database';
import type { Permission } from './rbac';

describe('RBAC', () => {
  describe('hasPermission', () => {
    it('should grant all permissions to super_admin', () => {
      const allPermissions: Permission[] = [
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
        'documents:read',
        'drivers:manage',
        'drivers:read',
        'clients:manage',
        'clients:read',
        'treasury:manage',
        'treasury:read',
        'maintenance:manage',
        'maintenance:read',
        'fuel:manage',
        'fuel:read',
        'forex:manage',
        'forex:read',
        'pricing:manage',
        'pricing:read',
        'predictive:read',
        'notifications:send',
        'chat:access',
        'branches:manage',
        'branches:read',
        'devices:manage',
      ];

      for (const permission of allPermissions) {
        expect(hasPermission('super_admin', permission)).toBe(true);
      }
    });

    it('should grant all permissions to admin', () => {
      expect(hasPermission('admin', 'trips:create')).toBe(true);
      expect(hasPermission('admin', 'invoices:delete')).toBe(true);
      expect(hasPermission('admin', 'companies:manage')).toBe(true);
    });

    it('should grant secretary trips:create', () => {
      expect(hasPermission('secretary', 'trips:create')).toBe(true);
      expect(hasPermission('secretary', 'trips:read')).toBe(true);
      expect(hasPermission('secretary', 'invoices:create')).toBe(true);
      expect(hasPermission('secretary', 'clients:manage')).toBe(true);
    });

    it('should deny secretary sensitive permissions', () => {
      expect(hasPermission('secretary', 'companies:manage')).toBe(false);
      expect(hasPermission('secretary', 'users:manage')).toBe(false);
      expect(hasPermission('secretary', 'payroll:approve')).toBe(false);
      expect(hasPermission('secretary', 'fleet:manage')).toBe(false);
    });

    it('should deny driver sensitive permissions', () => {
      expect(hasPermission('driver', 'trips:create')).toBe(false);
      expect(hasPermission('driver', 'invoices:create')).toBe(false);
      expect(hasPermission('driver', 'companies:manage')).toBe(false);
      expect(hasPermission('driver', 'users:manage')).toBe(false);
    });

    it('should grant driver only basic permissions', () => {
      expect(hasPermission('driver', 'trips:read')).toBe(true);
      expect(hasPermission('driver', 'invoices:read')).toBe(true);
      expect(hasPermission('driver', 'documents:read')).toBe(true);
      expect(hasPermission('driver', 'chat:access')).toBe(true);
      expect(hasPermission('driver', 'fuel:read')).toBe(true);
    });

    it('should grant accountant finance permissions', () => {
      expect(hasPermission('accountant', 'invoices:read')).toBe(true);
      expect(hasPermission('accountant', 'invoices:create')).toBe(true);
      expect(hasPermission('accountant', 'payments:collect')).toBe(true);
      expect(hasPermission('accountant', 'payroll:approve')).toBe(true);
      expect(hasPermission('accountant', 'treasury:manage')).toBe(true);
      expect(hasPermission('accountant', 'forex:manage')).toBe(true);
      expect(hasPermission('accountant', 'reports:financial')).toBe(true);
    });

    it('should deny accountant operational permissions', () => {
      expect(hasPermission('accountant', 'trips:create')).toBe(false);
      expect(hasPermission('accountant', 'fleet:manage')).toBe(false);
      expect(hasPermission('accountant', 'maintenance:manage')).toBe(false);
      expect(hasPermission('accountant', 'companies:manage')).toBe(false);
    });

    it('should grant fleet_manager fleet and maintenance permissions', () => {
      expect(hasPermission('fleet_manager', 'fleet:manage')).toBe(true);
      expect(hasPermission('fleet_manager', 'maintenance:manage')).toBe(true);
      expect(hasPermission('fleet_manager', 'fuel:manage')).toBe(true);
      expect(hasPermission('fleet_manager', 'trips:read')).toBe(true);
      expect(hasPermission('fleet_manager', 'drivers:read')).toBe(true);
      expect(hasPermission('fleet_manager', 'documents:manage')).toBe(true);
    });

    it('should deny fleet_manager sensitive admin permissions', () => {
      expect(hasPermission('fleet_manager', 'companies:manage')).toBe(false);
      expect(hasPermission('fleet_manager', 'users:manage')).toBe(false);
      expect(hasPermission('fleet_manager', 'payroll:approve')).toBe(false);
      expect(hasPermission('fleet_manager', 'treasury:manage')).toBe(false);
    });
  });

  describe('isRouteAllowed', () => {
    it('should only allow super_admin to /super-admin routes', () => {
      expect(isRouteAllowed('super_admin', '/super-admin')).toBe(true);
      expect(isRouteAllowed('super_admin', '/super-admin/companies')).toBe(true);
      expect(isRouteAllowed('super_admin', '/super-admin/screen-issues')).toBe(true);

      expect(isRouteAllowed('admin', '/super-admin')).toBe(false);
      expect(isRouteAllowed('secretary', '/super-admin')).toBe(false);
      expect(isRouteAllowed('driver', '/super-admin')).toBe(false);
      expect(isRouteAllowed('accountant', '/super-admin')).toBe(false);
      expect(isRouteAllowed('fleet_manager', '/super-admin')).toBe(false);
    });

    it('should restrict super_admin to super-admin routes only', () => {
      expect(isRouteAllowed('super_admin', '/dashboard')).toBe(false);
      expect(isRouteAllowed('super_admin', '/trips')).toBe(false);
      expect(isRouteAllowed('super_admin', '/fleet')).toBe(false);
    });

    it('should allow admin to all operational routes', () => {
      expect(isRouteAllowed('admin', '/dashboard')).toBe(true);
      expect(isRouteAllowed('admin', '/trips')).toBe(true);
      expect(isRouteAllowed('admin', '/fleet')).toBe(true);
      expect(isRouteAllowed('admin', '/invoices')).toBe(true);
      expect(isRouteAllowed('admin', '/settings')).toBe(true);
    });

    it('should allow secretary to allowed routes only', () => {
      expect(isRouteAllowed('secretary', '/dashboard')).toBe(true);
      expect(isRouteAllowed('secretary', '/trips')).toBe(true);
      expect(isRouteAllowed('secretary', '/clients')).toBe(true);
      expect(isRouteAllowed('secretary', '/invoices')).toBe(true);
      expect(isRouteAllowed('secretary', '/fleet')).toBe(true);
      expect(isRouteAllowed('secretary', '/maintenance')).toBe(true);

      expect(isRouteAllowed('secretary', '/super-admin')).toBe(false);
      expect(isRouteAllowed('secretary', '/driver-tasks')).toBe(false);
    });

    it('should allow driver to driver routes only', () => {
      expect(isRouteAllowed('driver', '/driver-tasks')).toBe(true);
      expect(isRouteAllowed('driver', '/driver-advances')).toBe(true);
      expect(isRouteAllowed('driver', '/fuel-receipt')).toBe(true);
      expect(isRouteAllowed('driver', '/chat')).toBe(true);

      expect(isRouteAllowed('driver', '/dashboard')).toBe(false);
      expect(isRouteAllowed('driver', '/trips')).toBe(false);
      expect(isRouteAllowed('driver', '/fleet')).toBe(false);
    });

    it('should allow accountant to finance routes', () => {
      expect(isRouteAllowed('accountant', '/dashboard')).toBe(true);
      expect(isRouteAllowed('accountant', '/invoices')).toBe(true);
      expect(isRouteAllowed('accountant', '/treasury')).toBe(true);
      expect(isRouteAllowed('accountant', '/bank-reconciliation')).toBe(true);
      expect(isRouteAllowed('accountant', '/forex')).toBe(true);
      expect(isRouteAllowed('accountant', '/reports')).toBe(true);
      expect(isRouteAllowed('accountant', '/clients')).toBe(true);
    });

    it('should allow fleet_manager to fleet routes', () => {
      expect(isRouteAllowed('fleet_manager', '/dashboard')).toBe(true);
      expect(isRouteAllowed('fleet_manager', '/fleet')).toBe(true);
      expect(isRouteAllowed('fleet_manager', '/maintenance')).toBe(true);
      expect(isRouteAllowed('fleet_manager', '/fuel-analytics')).toBe(true);
      expect(isRouteAllowed('fleet_manager', '/truck-tracking')).toBe(true);
      expect(isRouteAllowed('fleet_manager', '/documents')).toBe(true);
    });
  });

  describe('ROLE_DEFAULT_REDIRECT', () => {
    it('should have redirect for all roles', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'secretary', 'driver', 'accountant', 'fleet_manager'];
      for (const role of roles) {
        expect(ROLE_DEFAULT_REDIRECT[role]).toBeDefined();
        expect(ROLE_DEFAULT_REDIRECT[role].startsWith('/')).toBe(true);
      }
    });

    it('should redirect super_admin to companies', () => {
      expect(ROLE_DEFAULT_REDIRECT.super_admin).toBe('/super-admin/companies');
    });

    it('should redirect driver to driver-tasks', () => {
      expect(ROLE_DEFAULT_REDIRECT.driver).toBe('/driver-tasks');
    });
  });

  describe('ROLE_PERMISSIONS coverage', () => {
    it('should have permissions defined for all roles', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'secretary', 'driver', 'accountant', 'fleet_manager'];
      for (const role of roles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    });

    it('should not have duplicate permissions within a role', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'secretary', 'driver', 'accountant', 'fleet_manager'];
      for (const role of roles) {
        const perms = ROLE_PERMISSIONS[role];
        const unique = new Set(perms);
        expect(unique.size).toBe(perms.length);
      }
    });
  });
});
