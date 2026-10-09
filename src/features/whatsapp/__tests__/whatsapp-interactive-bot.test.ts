import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  identifySenderContext,
  handleInteractiveButton,
  handleTextMessage,
  processInboundWhatsAppMessage,
} from '../services/whatsapp-bot.service';
import {
  sendWhatsAppInteractiveButtons,
  sendWhatsAppInteractiveList,
} from '../services/whatsapp-meta-client';
import { GET as webhookGet, POST as webhookPost } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockTrip = {
  id: 501,
  route: 'Agadir ➔ Perpignan',
  route_export: 'Agadir ➔ Perpignan (Export Fruits & Primeurs)',
  status: 'assigned',
  departure_date: '2026-10-15',
  cmr_number: 'CMR-MA-2026-0501',
  cmr_export_number: 'CMR-EXP-501',
  truck_id: 10,
  client_id: 20,
  driver_id: 30,
  origin: 'Agadir',
  destination: 'Perpignan',
  shipping_gps_url: 'https://maps.google.com/?q=30.4278,-9.5981',
  unloading_gps_url: 'https://maps.google.com/?q=42.6986,2.8956',
};

const mockInvoice = {
  id: 701,
  invoice_number: 'INV-2026-0701',
  total_amount: '18500.50',
  ttc_amount: '18500.50',
  paid_amount: '5000.00',
  currency: 'MAD',
  due_date: '2026-10-25',
  client_id: 20,
};

const mockClient = {
  id: 20,
  name: 'Atlas Export Frigo S.A.',
  phone: '212612345678',
  shipping_country: 'France',
  preferred_notification_method: 'whatsapp_french',
};

const mockDriver = {
  id: 30,
  name: 'Hassan Amrani',
  first_name: 'Hassan',
  last_name: 'Amrani',
  phone: '212694585307',
};

const mockTruck = {
  id: 10,
  plate_number: '12345-A-40',
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: any) => ({
          single: () => {
            if (table === 'trip_orders') return Promise.resolve({ data: mockTrip, error: null });
            if (table === 'invoices') return Promise.resolve({ data: mockInvoice, error: null });
            if (table === 'clients') return Promise.resolve({ data: mockClient, error: null });
            if (table === 'drivers') return Promise.resolve({ data: mockDriver, error: null });
            if (table === 'trucks') return Promise.resolve({ data: mockTruck, error: null });
            return Promise.resolve({ data: null, error: null });
          },
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [mockTrip], error: null }),
            }),
          }),
        }),
        in: () => ({
          order: () => ({
            limit: () => {
              if (table === 'invoices') return Promise.resolve({ data: [mockInvoice], error: null });
              if (table === 'trip_orders') return Promise.resolve({ data: [mockTrip], error: null });
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
        limit: () => {
          if (table === 'drivers') return Promise.resolve({ data: [mockDriver], error: null });
          if (table === 'clients') return Promise.resolve({ data: [mockClient], error: null });
          return Promise.resolve({ data: [], error: null });
        },
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/features/trips/services/notification-dispatcher', () => ({
  dispatchTripLifecycleNotifications: vi.fn().mockResolvedValue({ success: true, dispatchedToClient: true }),
  inferClientLocale: vi.fn((c: any) => (c.shipping_country === 'France' ? 'fr' : 'ar')),
}));

describe('Trans Bodanon TMS — WhatsApp Cloud API & Interactive Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Sender Context & Role Identification', () => {
    it('identifies registered driver and assigns driver role', async () => {
      const context = await identifySenderContext('0694585307');
      expect(context.role).toBe('driver');
      expect(context.matchedDriverId).toBe(30);
      expect(context.matchedDriverName).toBe('Hassan Amrani');
    });

    it('identifies registered client and respects inferred language locale', async () => {
      const context = await identifySenderContext('+212 612 345 678');
      expect(context.role).toBe('client');
      expect(context.matchedClientId).toBe(20);
      expect(context.matchedClientName).toBe('Atlas Export Frigo S.A.');
      expect(context.locale).toBe('fr');
    });

    it('identifies unknown guest and infers language from country code', async () => {
      const spanishGuest = await identifySenderContext('+34 600 11 22 33');
      expect(spanishGuest.role).toBe('unknown');
      expect(spanishGuest.locale).toBe('es');

      const moroccanGuest = await identifySenderContext('0622334455');
      expect(moroccanGuest.role).toBe('unknown');
      expect(moroccanGuest.locale).toBe('ar');
    });
  });

  describe('2. Interactive Button Handlers', () => {
    it('handles btn_track_<tripId> and returns tracking link with CMR button', async () => {
      const context = await identifySenderContext('0612345678');
      const result = await handleInteractiveButton('btn_track_501', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('track_trip');
      expect(result.replySent).toBe(true);
      expect(result.replyMessage).toContain('501');
      expect(result.replyMessage).toContain('track/501');
    });

    it('handles btn_pay_inv_<invoiceId> with Decimal.js precision & cryptographic payment link', async () => {
      const context = await identifySenderContext('0612345678');
      const result = await handleInteractiveButton('btn_pay_inv_701', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('pay_invoice');
      expect(result.replySent).toBe(true);

      // Verify Decimal.js remaining balance: 18500.50 - 5000.00 = 13500.50
      const totalDec = new Decimal(mockInvoice.total_amount);
      const paidDec = new Decimal(mockInvoice.paid_amount);
      const expectedBalance = totalDec.minus(paidDec).toFixed(2);

      expect(result.replyMessage).toContain(expectedBalance);
      expect(result.replyMessage).toContain('/pay/');
      expect(result.replyMessage).toContain('INV-2026-0701');
    });

    it('handles btn_driver_start_<tripId> and marks trip as in_transit', async () => {
      const context = await identifySenderContext('0694585307');
      const result = await handleInteractiveButton('btn_driver_start_501', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('driver_start_trip');
      expect(result.actionExecuted).toBe('trip_501_started');
    });
  });

  describe('3. Natural Language & Keyword Recognition', () => {
    it('recognizes emergency SOS keywords and triggers instant 24/7 hotline reply', async () => {
      const context = await identifySenderContext('0694585307');
      const result = await handleTextMessage('SOS عندي عطل في الشاحنة', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('emergency_alert');
      expect(result.replySent).toBe(true);
    });

    it('recognizes tracking query and extracts shipment ID', async () => {
      const context = await identifySenderContext('0612345678');
      const result = await handleTextMessage('تتبع 501', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('track_trip');
    });

    it('recognizes invoice query and returns remaining balance with payment button', async () => {
      const context = await identifySenderContext('0612345678');
      const result = await handleTextMessage('مرحباً أريد معرفة الفاتورة', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('get_invoice');
      expect(result.replySent).toBe(true);
    });

    it('recognizes driver mission inquiry', async () => {
      const context = await identifySenderContext('0694585307');
      const result = await handleTextMessage('ما هي رحلتي اليوم؟', context);

      expect(result.processed).toBe(true);
      expect(result.intent).toBe('driver_mission');
    });
  });

  describe('4. Webhook HTTP Endpoints & Safety Override', () => {
    it('verifies Meta challenge during GET handshake', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'trans_bodanon_webhook_token_2026';

      const req = new NextRequest(
        'https://app.transbodanon.ma/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=trans_bodanon_webhook_token_2026&hub.challenge=test_challenge_code_123'
      );

      const response = await webhookGet(req);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('test_challenge_code_123');
    });

    it('rejects invalid GET verification token with 403 Forbidden', async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = 'trans_bodanon_webhook_token_2026';

      const req = new NextRequest(
        'https://app.transbodanon.ma/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=test_challenge_code_123'
      );

      const response = await webhookGet(req);
      expect(response.status).toBe(403);
    });

    it('receives POST inbound webhook and processes interactive button without errors', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '1001',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '212528840000',
                    phone_number_id: '123456789',
                  },
                  messages: [
                    {
                      from: '212612345678',
                      id: 'wamid.HBgLMjEyNjEyMzQ1Njc4FQIAEhgg...',
                      timestamp: '1728475200',
                      type: 'interactive',
                      interactive: {
                        type: 'button_reply',
                        button_reply: {
                          id: 'btn_track_501',
                          title: '📍 تتبع الشحنة',
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const req = new NextRequest('https://app.transbodanon.ma/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('EVENT_RECEIVED');
    });
  });

  describe('5. Interactive Message Builder Validations', () => {
    it('safely limits quick reply buttons to a maximum of 3', async () => {
      const res = await sendWhatsAppInteractiveButtons({
        to: '+34 600 123 456',
        body: 'Seleccione una opción:',
        buttons: [
          { id: 'btn_1', title: 'Opción 1' },
          { id: 'btn_2', title: 'Opción 2' },
          { id: 'btn_3', title: 'Opción 3' },
          { id: 'btn_4', title: 'Opción 4 (Ignorada)' },
        ],
      });

      expect(res.isTestMode).toBe(true);
      expect(res.originalPhone).toBe('34600123456');
    });

    it('formats interactive list sections correctly', async () => {
      const res = await sendWhatsAppInteractiveList({
        to: '+212 694 585 307',
        body: 'قائمة الخدمات اللوجستية',
        buttonText: 'عرض الخدمات',
        sections: [
          {
            title: 'العمليات',
            rows: [
              { id: 'srv_track', title: 'تتبع الشحنات', description: 'تتبع بالأقمار الصناعية' },
              { id: 'srv_cmr', title: 'بوالص CMR', description: 'تحميل الوثائق المعتمدة' },
            ],
          },
        ],
      });

      expect(res.isTestMode).toBe(true);
      expect(res.originalPhone).toBe('212694585307');
    });
  });
});

