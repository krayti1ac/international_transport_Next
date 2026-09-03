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
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('إعدادات WhatsApp Cloud API غير مكتملة في متغيرات البيئة.');
  }

  const formattedTo = formatPhoneNumber(to);
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedTo,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Meta WhatsApp API Error:', data);
    throw new Error(data?.error?.message || 'فشل إرسال رسالة الواتساب عبر الخادم');
  }

  return data;
}
