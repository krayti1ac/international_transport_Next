import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatReeferTempDisplay,
  handleTelegramBotWebhookUpdate,
  sendTelegramAlert,
} from '../telegram';

describe('Telegram Bot & Multi-Tenant Alert Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: '123456789:TEST_BOT_TOKEN',
      TELEGRAM_DEFAULT_CHAT_ID: '-100192837465',
      TELEGRAM_LIVE_DISPATCH: 'false',
      NEXT_PUBLIC_APP_URL: 'https://app.transbodanon.ma',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns error gracefully when TELEGRAM_BOT_TOKEN is not configured', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    const res = await sendTelegramAlert({
      chatId: '-100192837465',
      message: '<b>Test Alert</b>',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('TELEGRAM_BOT_TOKEN');
  });

  it('redirects alerts to TELEGRAM_DEFAULT_CHAT_ID in safe simulation mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 901 } }),
    } as Response);

    const res = await sendTelegramAlert({
      chatId: '-100888777666',
      message: '🚚 <b>إشعار انطلاق شحنة #1042</b>',
      inlineButtons: [
        [
          {
            text: '📍 التتبع الفضائي',
            url: 'https://app.transbodanon.ma/track/1042',
          },
        ],
      ],
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBe(901);
    expect(res.safetyRedirected).toBe(true);
    expect(res.effectiveChatId).toBe('-100192837465');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, reqInit] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(reqInit?.body));
    expect(body.chat_id).toBe('-100192837465');
    expect(body.parse_mode).toBe('HTML');
    expect(body.text).toContain('Redirected from Chat: -100888777666');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://app.transbodanon.ma/track/1042'
    );
  });

  it('dispatches directly to target tenant/client chatId when TELEGRAM_LIVE_DISPATCH is true', async () => {
    process.env.TELEGRAM_LIVE_DISPATCH = 'true';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 902 } }),
    } as Response);

    const res = await sendTelegramAlert({
      chatId: '-100555444333',
      message: '✅ <b>تم تسليم الشحنة بنجاح</b>',
      silent: true,
    });

    expect(res.success).toBe(true);
    expect(res.safetyRedirected).toBe(false);
    expect(res.effectiveChatId).toBe('-100555444333');

    const [, reqInit] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(reqInit?.body));
    expect(body.chat_id).toBe('-100555444333');
    expect(body.disable_notification).toBe(true);
    expect(body.text).not.toContain('Redirected from Chat');
  });

  it('formats reefer temperatures accurately using Decimal.js', () => {
    expect(formatReeferTempDisplay('-18.24')).toBe('-18.2°C');
    expect(formatReeferTempDisplay('2.36')).toBe('+2.4°C');
    expect(formatReeferTempDisplay(0)).toBe('0.0°C');
    expect(formatReeferTempDisplay(null)).toBe('N/A');
  });

  it('handles interactive /track and /reefer bot commands with live telemetry and e-POD buttons', async () => {
    process.env.TELEGRAM_LIVE_DISPATCH = 'true';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 999 } }),
    } as Response);

    const webhookResult = await handleTelegramBotWebhookUpdate(
      {
        update_id: 5001,
        message: {
          message_id: 77,
          chat: { id: -100192837465, type: 'supergroup' },
          text: '/track #1042',
        },
      },
      {
        lookupTrip: async (query) => {
          if (query === '1042') {
            return {
              tripId: 1042,
              companyId: 1,
              cmrNumber: 'CMR-2026-1042',
              route: 'Agadir -> Perpignan (Saint-Charles)',
              status: 'delivered',
              plateNumber: '74521-A-1',
              currentLocationLabel: 'Perpignan, France',
              reeferSetpointC: '-18.0',
              reeferSupplyTempC: '-18.2',
              etaText: 'تم الوصول والتفريغ',
            };
          }
          return null;
        },
      }
    );

    expect(webhookResult.handled).toBe(true);
    expect(webhookResult.command).toBe('/track');
    expect(webhookResult.query).toBe('1042');
    expect(webhookResult.replyDispatched).toBe(true);
    expect(webhookResult.replyText).toContain('CMR-2026-1042');
    expect(webhookResult.replyText).toContain('-18.2°C');

    const [, reqInit] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(reqInit?.body));
    // Should include both Live Tracking and e-POD PDF inline buttons for delivered trip
    expect(body.reply_markup.inline_keyboard).toHaveLength(2);
    expect(body.reply_markup.inline_keyboard[1][0].url).toContain(
      '/api/pod?tripId=1042'
    );
  });
});
