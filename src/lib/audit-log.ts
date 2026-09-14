import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from './audit.server';
import type { AuditAction } from './audit.server';

export interface AuditLogContext {
  userId: string;
  role: string;
  companyId: number | null;
  deviceId?: string | null;
}

export interface AuditLogOptions {
  entity: string;
  entityId: string | number;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
}

export async function getAuditContext(): Promise<AuditLogContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    userId: user.id,
    role: (profile.role as string) || 'unknown',
    companyId: (profile.company_id as number) ?? null,
  };
}

export async function logAudit(options: AuditLogOptions): Promise<void> {
  try {
    const context = await getAuditContext();
    if (!context) return;

    await recordAuditLog({
      entityType: options.entity,
      entityId: typeof options.entityId === 'number' ? options.entityId : Number(options.entityId),
      actionType: options.action,
      reason: options.reason || 'إجراء نظامي',
      oldData: options.before ?? null,
      newData: options.after ?? null,
    });
  } catch (err) {
    console.error('[AuditLog] فشل تسجيل التدقيق:', err);
  }
}
