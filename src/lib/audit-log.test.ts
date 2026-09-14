import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('./audit.server', () => ({
  recordAuditLog: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from './audit.server';
import { getAuditContext, logAudit } from './audit-log';

const mockCreateClient = vi.mocked(createClient);
const mockRecordAuditLog = vi.mocked(recordAuditLog);

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuditContext', () => {
    it('should return null when user is not authenticated', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: vi.fn(),
      } as any);

      const result = await getAuditContext();
      expect(result).toBeNull();
    });

    it('should return user context when authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
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

      const result = await getAuditContext();
      expect(result).toEqual({
        userId: 'user-1',
        role: 'admin',
        companyId: 42,
      });
    });

    it('should return null when profile is not found', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const result = await getAuditContext();
      expect(result).toBeNull();
    });
  });

  describe('logAudit', () => {
    it('should not call recordAuditLog when context is null', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: vi.fn(),
      } as any);

      await logAudit({
        entity: 'company',
        entityId: 1,
        action: 'update',
      });

      expect(mockRecordAuditLog).not.toHaveBeenCalled();
    });

    it('should call recordAuditLog with correct params when authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
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
      mockRecordAuditLog.mockResolvedValue(undefined);

      await logAudit({
        entity: 'company',
        entityId: 1,
        action: 'update',
        before: { name: 'Old Name' },
        after: { name: 'New Name' },
        reason: 'Updated company name',
      });

      expect(mockRecordAuditLog).toHaveBeenCalledWith({
        entityType: 'company',
        entityId: 1,
        actionType: 'update',
        reason: 'Updated company name',
        oldData: { name: 'Old Name' },
        newData: { name: 'New Name' },
      });
    });

    it('should use default reason when not provided', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
        },
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
      mockRecordAuditLog.mockResolvedValue(undefined);

      await logAudit({
        entity: 'trip',
        entityId: 123,
        action: 'create',
      });

      expect(mockRecordAuditLog).toHaveBeenCalledWith({
        entityType: 'trip',
        entityId: 123,
        actionType: 'create',
        reason: 'إجراء نظامي',
        oldData: null,
        newData: null,
      });
    });
  });
});
