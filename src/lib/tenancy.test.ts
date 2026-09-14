import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase modules before importing tenancy
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getCurrentCompanyId, getCurrentUserRole, withTenantFilter, assertTenantAccess } from './tenancy';

const mockCreateClient = vi.mocked(createClient);

describe('Tenancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentCompanyId', () => {
    it('should return null when user is not authenticated', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: vi.fn(),
      } as any);

      const result = await getCurrentCompanyId();
      expect(result).toBeNull();
    });

    it('should return company_id from user profile', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { company_id: 42 } }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const result = await getCurrentCompanyId();
      expect(result).toBe(42);
    });

    it('should return null when profile has no company_id', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: {} }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const result = await getCurrentCompanyId();
      expect(result).toBeNull();
    });
  });

  describe('getCurrentUserRole', () => {
    it('should return null when user is not authenticated', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: vi.fn(),
      } as any);

      const result = await getCurrentUserRole();
      expect(result).toBeNull();
    });

    it('should return role from user profile', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'admin' } }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const result = await getCurrentUserRole();
      expect(result).toBe('admin');
    });
  });

  describe('withTenantFilter', () => {
    it('should add company_id filter for tenant users', () => {
      const mockQuery = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      const result = withTenantFilter(mockQuery as any, 42, 'secretary');

      expect(result.eq).toBeDefined();
      expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 42);
    });

    it('should skip filter for super_admin', () => {
      const mockQuery = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      const result = withTenantFilter(mockQuery as any, 42, 'super_admin');

      expect(result).toBe(mockQuery);
      expect(mockQuery.eq).not.toHaveBeenCalled();
    });

    it('should skip filter when companyId is null', () => {
      const mockQuery = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      const result = withTenantFilter(mockQuery as any, null, 'secretary');

      expect(result).toBe(mockQuery);
      expect(mockQuery.eq).not.toHaveBeenCalled();
    });

    it('should skip filter when role is null', () => {
      const mockQuery = {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };

      const result = withTenantFilter(mockQuery as any, 42, null);

      expect(result).toBe(mockQuery);
      expect(mockQuery.eq).not.toHaveBeenCalled();
    });
  });

  describe('assertTenantAccess', () => {
    it('should throw when user does not belong to company', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin', company_id: 99 },
              }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      expect(assertTenantAccess(42, 'user-1')).rejects.toThrow('TENANT_ACCESS_DENIED');
    });

    it('should allow access when user belongs to company', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'admin', company_id: 42 },
              }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      await expect(assertTenantAccess(42, 'user-1')).resolves.toBeUndefined();
    });

    it('should allow super_admin to access any company', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'super_admin', company_id: 1 },
              }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      await expect(assertTenantAccess(999, 'user-1')).resolves.toBeUndefined();
    });

    it('should not throw when userId is not provided', async () => {
      await expect(assertTenantAccess(42, undefined)).resolves.toBeUndefined();
    });
  });
});
