import { createClient } from '@/lib/supabase/server';

export type AuditAction = 'soft_delete' | 'update' | 'duplicate' | 'create' | 'auth_login' | 'role_change' | 'security_alert';

interface LogActionParams {
  entityType: string;
  entityId: number;
  actionType: AuditAction;
  reason?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog({
  entityType,
  entityId,
  actionType,
  reason,
  oldData,
  newData,
  ipAddress,
  userAgent,
}: LogActionParams): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'system';

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      action: actionType,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldData ? JSON.stringify(oldData) : undefined,
      new_values: newData ? JSON.stringify(newData) : undefined,
    };

    if (reason !== undefined) insertPayload.reason = reason;
    if (ipAddress) insertPayload.ip_address = ipAddress;
    if (userAgent) insertPayload.user_agent = userAgent;

    await supabase.from('audit_logs').insert(insertPayload);
  } catch (err) {
    console.error('فشل تسجيل حركة التدقيق الأمني:', err);
  }
}
