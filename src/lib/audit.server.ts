import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'soft_delete' 
  | 'duplicate'
  | 'auth_login' 
  | 'role_change' 
  | 'security_alert' 
  | 'fifo_payment';

export interface LogActionParams {
  entityType: string;
  entityId: string | number;
  actionType: AuditAction;
  reason?: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * تسجيل حركات التدقيق الأمني بشكل غير متزامن وآمن.
 * لا تقوم هذه الدالة بإيقاف سير العمل الأساسي في حال فشل التسجيل (Non-blocking).
 */
export async function recordAuditLog(params: LogActionParams): Promise<void> {
  try {
    const supabase = await createClient();
    
    // محاولة جلب هوية المستخدم (ستكون system إذا تم الاستدعاء من Cron)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'system';

    let ipAddress = params.ipAddress || 'Unknown IP';
    let userAgent = params.userAgent || 'Unknown Agent';

    // استخراج بيانات الشبكة مع حماية ضد استدعاءات الخلفية (Background Tasks)
    try {
      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for');
      const realIp = headersList.get('x-real-ip');
      
      // أخذ الـ IP الحقيقي خاصة خلف خدمات مثل Vercel
      if (!params.ipAddress) {
        ipAddress = forwardedFor 
          ? forwardedFor.split(',')[0].trim() 
          : (realIp || 'Unknown IP');
      }
        
      if (!params.userAgent) {
        userAgent = headersList.get('user-agent') || 'Unknown Agent';
      }
    } catch {
      // الارتداد الآمن في حال تم الاستدعاء خارج سياق HTTP (مثل المهام المجدولة Cron)
      if (!params.ipAddress) ipAddress = 'Background Job / Cron';
      if (!params.userAgent) userAgent = 'System Internal';
    }

    // إدراج السجل في قاعدة البيانات
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action: params.actionType,
      entity_type: params.entityType,
      entity_id: params.entityId.toString(),
      old_values: params.oldData ? JSON.stringify(params.oldData) : null,
      new_values: params.newData ? JSON.stringify(params.newData) : null,
      reason: params.reason || 'إجراء نظامي',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      console.error('[Audit DB Error] فشل إدراج السجل:', error.message);
    }
  } catch (err) {
    console.error('[Audit System Error] خطأ غير متوقع في محرك التدقيق:', err);
  }
}
