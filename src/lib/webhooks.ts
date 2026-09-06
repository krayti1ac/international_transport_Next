import crypto from 'crypto';
import { recordAuditLog } from '@/lib/audit.server';

export interface WebhookEventPayload {
  event: 'trip.status_changed' | 'trip.delivered' | 'trip.geofence_entered';
  timestamp: string;
  tripId: number;
  data: Record<string, unknown>;
}

export async function dispatchClientWebhook(
  targetUrl: string,
  secretKey: string | undefined,
  payload: WebhookEventPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const rawBody = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Event-Type': payload.event,
      'X-Event-Timestamp': payload.timestamp,
      'User-Agent': 'TransBodanon-WebhookEngine/1.0',
    };

    if (secretKey) {
      const signature = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');
      headers['X-Signature-256'] = signature;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Webhook failed [${response.status}] for trip ${payload.tripId}`);
      return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
    }

    return { success: true, statusCode: response.status };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل إرسال الخطاف البرمجي';
    console.warn(`Webhook execution error for trip ${payload.tripId}:`, message);

    await recordAuditLog({
      entityType: 'webhook_failure',
      entityId: payload.tripId,
      actionType: 'security_alert',
      reason: `فشل تسليم الويب هوك: ${message}`,
      newData: { targetUrl, event: payload.event },
    });

    return { success: false, error: message };
  }
}
