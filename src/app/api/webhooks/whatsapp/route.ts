/**
 * Trans Bodanon TMS — Official WhatsApp Cloud API Inbound Webhook
 * Handles Meta verification challenge, incoming interactive messages,
 * delivery receipts, and automated bot dispatching.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { processInboundWhatsAppMessage } from '@/features/whatsapp/services/whatsapp-bot.service';
import type { MetaWebhookPayload, MetaWebhookStatus } from '@/features/whatsapp/types/whatsapp.types';

/**
 * 1. Meta Webhook Verification (hub.challenge)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * 2. Inbound Events (Messages, Interactive Button Clicks, Delivery Statuses)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    // Optional cryptographic signature check if secret is configured
    if (appSecret) {
      const signatureHeader = req.headers.get('x-hub-signature-256');
      if (signatureHeader) {
        const expectedSig = `sha256=${crypto
          .createHmac('sha256', appSecret)
          .update(rawBody)
          .digest('hex')}`;

        if (signatureHeader !== expectedSig) {
          console.warn('⚠️ Invalid WhatsApp Webhook Signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    }

    const body = JSON.parse(rawBody) as MetaWebhookPayload;

    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      const supabase = await createClient();

      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;

          // A. Process Inbound Messages (Text, Interactive Buttons, Location)
          if (value?.messages?.length) {
            for (const msg of value.messages) {
              const senderPhone = msg.from;
              const messageBody = msg.text?.body || msg.interactive?.button_reply?.title || '[مرفق تفاعلي]';

              // Legacy chat_messages table fallback
              try {
                await supabase.from('chat_messages').insert({
                  sender_id: senderPhone,
                  message: `[WhatsApp: ${senderPhone}] ${messageBody}`,
                });
              } catch {}

              // Delegate to intelligent conversational bot engine
              try {
                await processInboundWhatsAppMessage(msg);
              } catch (botErr) {
                console.error('[WhatsApp Bot Processing Error]:', botErr);
              }
            }
          }

          // B. Process Message Delivery Status Receipts (Sent, Delivered, Read, Failed)
          if (value?.statuses?.length) {
            for (const statusObj of value.statuses) {
              const wamid = statusObj.id;
              const deliveryStatus = statusObj.status;

              try {
                await supabase
                  .from('whatsapp_message_logs')
                  .update({
                    status: deliveryStatus,
                    error_message: statusObj.errors?.[0]?.message || null,
                  })
                  .eq('wamid', wamid);
              } catch {}
            }
          }
        }
      }

      return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: any) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
