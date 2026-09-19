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
  const metaToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!metaToken || !phoneNumberId) {
    console.warn('⚠️ Missing Meta WhatsApp credentials: WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID');
    return { success: false, provider: 'none', reason: 'Missing Meta WhatsApp credentials' };
  }

  const SAFE_TEST_PHONE = '212654051029';
  const originalPhone = formatPhoneNumber(to);
  const finalPhone = SAFE_TEST_PHONE;
  const finalMessage = originalPhone === SAFE_TEST_PHONE
    ? message
    : `[Test Mode]\nOriginal target: ${originalPhone}\n\n${message}`;

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
      throw new Error(data?.error?.message || 'Meta WhatsApp API error');
    }

    console.log('✅ WhatsApp message sent via Meta Cloud API.');
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta WhatsApp Error:', error);
    throw error;
  }
}
