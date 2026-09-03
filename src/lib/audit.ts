import { createClient } from '@/lib/supabase/client';

export type AuditAction = 'soft_delete' | 'update' | 'duplicate' | 'create';

interface LogActionParams {
  entityType: string;
  entityId: number;
  actionType: AuditAction;
  reason?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}

export async function recordAuditLog({
  entityType,
  entityId,
  actionType,
  reason = 'إجراء روتيني من النظام',
  oldData,
  newData,
}: LogActionParams): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const employeeId = session?.user?.id || 'system';

    await supabase.from('audit_logs').insert({
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType === 'create' ? 'update' : actionType,
      employee_id: employeeId,
      reason,
      old_data: oldData ? JSON.stringify(oldData) : undefined,
      new_data: newData ? JSON.stringify(newData) : undefined,
    });
  } catch (err) {
    console.error('فشل تسجيل حركة التدقيق:', err);
  }
}
