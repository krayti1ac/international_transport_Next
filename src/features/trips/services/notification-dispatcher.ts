'use server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { dispatchClientWebhook } from '@/lib/webhooks';
import type { TripOrder, Client } from '@/types/database';

export async function dispatchTripLifecycleNotifications(
  tripId: number,
  eventType: 'status_update' | 'delivery_completed',
  extraDetails?: { signatureUrl?: string; cmrUrl?: string }
): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: trip } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single<TripOrder>();

    if (!trip || !trip.client_id) return;

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', trip.client_id)
      .single<Client>();

    if (!client) return;

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';
    const trackingLink = `${siteUrl}/track/${trip.id}`;

    const clientWebhookUrl = (client as unknown as { webhook_url?: string }).webhook_url;
    if (clientWebhookUrl) {
      await dispatchClientWebhook(clientWebhookUrl, undefined, {
        event: eventType === 'delivery_completed' ? 'trip.delivered' : 'trip.status_changed',
        timestamp: new Date().toISOString(),
        tripId: trip.id,
        data: {
          status: trip.status,
          route: trip.route,
          departureDate: trip.departure_date,
          trackingUrl: trackingLink,
          ...extraDetails,
        },
      });
    }

    if (client.phone && process.env.WHATSAPP_API_TOKEN) {
      let message = '';
      if (eventType === 'delivery_completed') {
        message = `مرحباً ${client.name}،\n\nنود إشعاركم بأنه قد تم تسليم شحنتكم الخاصة بالرحلة (#${trip.id}) بنجاح تام.\n\nالمسار: ${trip.route}\nرابط إثبات التسليم المباشر:\n${trackingLink}\n\nشكراً لثقتكم بشركة Trans Bodanon.`;
      } else {
        message = `مرحباً ${client.name}،\n\nتحديث جديد بخصوص شحنتكم (#${trip.id}):\nالحالة الحالية: ${trip.status}\nالمسار: ${trip.route}\n\nيمكنكم متابعة موقع الشاحنة حياً عبر الرابط:\n${trackingLink}`;
      }

      await sendWhatsAppCloudMessage({
        to: client.phone,
        message,
      });
    }
  } catch (err) {
    console.warn('Dispatch notification non-blocking failure:', err);
  }
}
