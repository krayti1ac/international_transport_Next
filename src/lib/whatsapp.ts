export interface SendWhatsAppTextOptions {
  to: string;
  message: string;
}

export interface SendWhatsAppTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  else if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
  return cleaned;
}

export async function sendWhatsAppCloudMessage({ to, message }: SendWhatsAppTextOptions) {
  // جلب المفاتيح من بيئة التشغيل
  const callMeBotKey = process.env.CALLMEBOT_API_KEY;
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 🛑 صمام الأمان (Testing Safeguard): تحويل جميع الرسائل إلى الرقم الإداري المعتمد حصرياً
  const SAFE_TEST_PHONE = '212694585307';
  const originalPhone = formatPhoneNumber(to);
  const isTargetingAdmin = originalPhone === SAFE_TEST_PHONE;
  
  const finalPhone = SAFE_TEST_PHONE;
  const finalMessage = isTargetingAdmin 
    ? message 
    : `[وضع التجربة 🧪]\nكانت هذه الرسالة موجهة للرقم: ${originalPhone}\n\n${message}`;

  // 1️⃣ الأولوية الأولى: الإرسال المجاني عبر CallMeBot (مخصص لرقمك)
  if (callMeBotKey) {
    try {
      const encodedMessage = encodeURIComponent(finalMessage);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${finalPhone}&text=${encodedMessage}&apikey=${callMeBotKey}`;
      
      const res = await fetch(url);
      if (res.ok) {
        console.log('✅ تم إرسال الإشعار بنجاح عبر CallMeBot.');
        return { success: true, provider: 'callmebot' };
      }
      console.warn(`CallMeBot Warning: HTTP ${res.status}. محاولة التبديل لـ Meta API...`);
    } catch (error) {
      console.error('CallMeBot Error:', error);
    }
  }

  // 2️⃣ الأولوية الثانية: الإرسال عبر Meta Cloud API (إذا توفرت المفاتيح)
  if (metaToken && phoneNumberId) {
    try {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: finalPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: finalMessage,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'فشل إرسال رسالة الواتساب عبر Meta API');
      }
      
      console.log('✅ تم إرسال الإشعار بنجاح عبر Meta Cloud API.');
      return { success: true, provider: 'meta', data };
    } catch (error) {
      console.error('Meta API Error:', error);
      throw error; // رمي الخطأ إذا فشل النظام الرسمي
    }
  }

  // 3️⃣ الأولوية الثالثة: غياب المفاتيح (تجنب انهيار النظام وتسجيل التدقيق)
  console.warn('⚠️ لم يتم العثور على مفاتيح CallMeBot أو Meta API. تم تسجيل الإشعار فقط:');
  console.info(finalMessage);
  
  return { success: false, provider: 'none', reason: 'Missing API Keys' };
}
