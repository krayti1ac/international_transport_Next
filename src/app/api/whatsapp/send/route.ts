import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول لإجراء هذه العملية' }, { status: 401 });
    }

    const { to, message, clientId } = await req.json();

    if (!to || !message) {
      return NextResponse.json({ error: 'الرقم والرسالة مطلوبان' }, { status: 400 });
    }

    const result = await sendWhatsAppCloudMessage({ to, message });

    await supabase.from('audit_logs').insert({
      entity_type: 'whatsapp_notification',
      entity_id: clientId || 0,
      action_type: 'create',
      employee_id: user.id,
      reason: `إرسال رسالة واتساب آلية إلى ${to}`,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء الإرسال' }, { status: 500 });
  }
}
