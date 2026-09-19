import { NextResponse } from 'next/server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';

export async function GET() {
  const visaMessage = `🚨 تنبيه: تأشيرة شنغن على وشك الانتهاء
السائق: رشيد 
رقم التأشيرة: 2024-MA-8842
تاريخ الانتهاء: 2026-09-25
متبقي: 10 أيام

يرجى تجديد التأشيرة قبل تاريخ الانتهاء لضمان استمرارية الرحلات الدولية.`;

  try {
    const result = await sendWhatsAppCloudMessage({
      to: '+212 654-051029',
      message: visaMessage,
    });

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      phone: '212654051029',
      message: visaMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
