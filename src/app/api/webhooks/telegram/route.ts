import { NextResponse } from 'next/server';
import {
  handleTelegramBotWebhookUpdate,
  type TelegramWebhookUpdate,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * نقطة استماع أوامر بوت تيليجرام التفاعلية (Telegram Bot Webhook Endpoint)
 * تدعم أوامر:
 * - /start, /help
 * - /track <TripID_or_CMR>
 * - /reefer <TripID_or_CMR>
 */
export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const incomingToken = request.headers.get(
        'x-telegram-bot-api-secret-token'
      );
      if (incomingToken !== webhookSecret) {
        return NextResponse.json(
          { ok: false, error: 'Unauthorized Telegram Webhook Secret' },
          { status: 401 }
        );
      }
    }

    const update = (await request.json()) as TelegramWebhookUpdate;
    const result = await handleTelegramBotWebhookUpdate(update);

    return NextResponse.json({
      ok: true,
      handled: result.handled,
      command: result.command || null,
      query: result.query || null,
      replyDispatched: result.replyDispatched ?? false,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Telegram webhook error';
    console.error('[Telegram Webhook Route Error]:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
