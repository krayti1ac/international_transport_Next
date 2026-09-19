'use server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { calculateLiveTripEta } from '@/features/tracking/services/eta-calculator.actions';

export interface TripStartNotificationResult {
  success: boolean;
  message?: string;
  trackingUrl?: string;
  etaHours?: number;
  recipientPhone?: string;
  error?: string;
}

/**
 * Triggers automated WhatsApp notification to the client when a trip starts (in_transit)
 */
export async function onTripStarted(tripId: number): Promise<TripStartNotificationResult> {
  try {
    const supabase = await createClient();

    // 1. Fetch trip details, vehicle, and client information
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        id,
        route,
        route_export,
        cmr_number,
        cmr_export_number,
        truck:trucks(plate_number, model),
        client:clients(id, name, phone)
      `)
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return { success: false, error: 'Trip not found' };
    }

    // Client and truck info typing
    const client = trip.client as unknown as { id: number; name: string; phone?: string } | null;
    const truck = trip.truck as unknown as { plate_number: string; model?: string } | null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.ma';
    const trackingUrl = `${baseUrl}/track/${trip.id}`;
    const routeDisplay = trip.route_export || trip.route || 'المسار الدولي';
    const plateDisplay = truck?.plate_number || 'N/A';
    const cmrDisplay = trip.cmr_export_number || trip.cmr_number || `#${trip.id}`;

    // 2. Calculate initial live dynamic ETA
    const eta = await calculateLiveTripEta(trip.id);
    const etaText = eta
      ? `\n⏱ المسافة المتبقية التقديرية: ${eta.remainingDistanceKm} كم (~${eta.estimatedHoursRemaining} ساعة)`
      : '';

    const message =
      `مرحباً ${client?.name || 'عميلنا العزيز'}،\n` +
      `انطلقت شاحنتكم ذات اللوحة (${plateDisplay}) في رحلتها: ${routeDisplay} (CMR: ${cmrDisplay}).\n` +
      `${etaText}\n\n` +
      `📍 لمتابعة خط سير الشاحنة وحالة الشحنة مباشرة:\n${trackingUrl}\n\n` +
      `Trans Bodanon Logistics - تتبع الشحنات الدولية المباشر`;

    // 3. Dispatch WhatsApp message if client phone is available
    if (client?.phone) {
      await sendWhatsAppCloudMessage({
        to: client.phone,
        message,
      });

      return {
        success: true,
        message,
        trackingUrl,
        etaHours: eta?.estimatedHoursRemaining,
        recipientPhone: client.phone,
      };
    }

    return {
      success: true,
      message,
      trackingUrl,
      etaHours: eta?.estimatedHoursRemaining,
    };
  } catch (error) {
    console.error('Error in onTripStarted trigger:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

