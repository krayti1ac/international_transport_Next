'use server';

import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppCloudMessage, formatPhoneNumber } from '@/lib/whatsapp';
import { dispatchClientWebhook } from '@/lib/webhooks';
import type { TripOrder, Client, Truck } from '@/types/database';

export type TripLifecycleEventType =
  | 'trip_dispatched'
  | 'status_update'
  | 'port_geofence_entry'
  | 'port_geofence_exit'
  | 'delivery_completed';

export interface MilestoneNotificationDetails {
  // Dispatched / Status update
  plateNumber?: string;
  driverName?: string;
  // Port / Geofence
  zoneId?: string;
  zoneNameAr?: string;
  zoneNameFr?: string;
  zoneNameEs?: string;
  zoneType?:
    | 'seaport'
    | 'border_crossing'
    | 'logistics_hub'
    | 'customs_hub'
    | 'logistics_platform';
  // Delivery completed
  recipientName?: string;
  signedAt?: string;
  latitude?: number;
  longitude?: number;
  signatureUrl?: string;
  cmrUrl?: string;
  // Custom language override
  locale?: 'ar' | 'fr' | 'es';
}

/**
 * Infer the best customer communication locale based on country, phone prefix, or preference
 */
export function inferClientLocale(client: Partial<Client>): 'ar' | 'fr' | 'es' {
  const pref = (client.preferred_notification_method || '').toLowerCase();
  if (pref.includes('es') || pref.includes('span')) return 'es';
  if (pref.includes('fr') || pref.includes('fren')) return 'fr';
  if (pref.includes('ar')) return 'ar';

  const phone = formatPhoneNumber(client.phone || '');
  if (phone.startsWith('34')) return 'es';
  if (phone.startsWith('33') || phone.startsWith('221') || phone.startsWith('222')) return 'fr';

  const country = (client.shipping_country || client.billing_country || '').toLowerCase();
  if (country.includes('spain') || country.includes('esp')) return 'es';
  if (
    country.includes('france') ||
    country.includes('sénégal') ||
    country.includes('senegal') ||
    country.includes('mauritani')
  ) {
    return 'fr';
  }

  return 'ar';
}

/**
 * Builds formatted WhatsApp milestone messages in Arabic, French, or Spanish
 */
export function buildMilestoneMessage(params: {
  eventType: TripLifecycleEventType;
  locale: 'ar' | 'fr' | 'es';
  clientName: string;
  tripId: number;
  cmrNumber: string;
  route: string;
  departureDate?: string;
  plateNumber?: string;
  trackingUrl: string;
  podPdfUrl: string;
  details?: MilestoneNotificationDetails;
}): string {
  const {
    eventType,
    locale,
    clientName,
    tripId,
    cmrNumber,
    route,
    departureDate,
    plateNumber,
    trackingUrl,
    podPdfUrl,
    details,
  } = params;

  // 1. TRIP DISPATCHED / STATUS UPDATE TO TRANSIT
  if (eventType === 'trip_dispatched' || eventType === 'status_update') {
    if (locale === 'es') {
      return (
        `🚚 *Aviso de Salida de Envío Internacional | Trans Bodanon TMS*\n\n` +
        `Estimado/a *${clientName}*,\n` +
        `Le informamos que su envío internacional ha salido y se encuentra en ruta :\n\n` +
        `• *Ref. Envío :* #${tripId}\n` +
        `• *Carta de Porte (CMR) :* ${cmrNumber}\n` +
        `• *Ruta :* ${route}\n` +
        (plateNumber ? `• *Vehículo asignado :* ${plateNumber}\n` : '') +
        (departureDate ? `• *Fecha de salida :* ${departureDate}\n` : '') +
        `• *Estado :* En tránsito internacional\n\n` +
        `📍 *Seguimiento GPS y Temperatura Frigo en directo :*\n` +
        `${trackingUrl}\n\n` +
        `_Trans Bodanon TMS • Su socio en logística internacional_`
      );
    }

    if (locale === 'fr') {
      return (
        `🚚 *Avis de Départ Expédition Internationale | Trans Bodanon TMS*\n\n` +
        `Bonjour *${clientName}*,\n` +
        `Nous avons le plaisir de vous informer que votre expédition est en route :\n\n` +
        `• *Réf Dossier :* #${tripId}\n` +
        `• *Lettre de Voiture (CMR) :* ${cmrNumber}\n` +
        `• *Itinéraire :* ${route}\n` +
        (plateNumber ? `• *Véhicule assigné :* ${plateNumber}\n` : '') +
        (departureDate ? `• *Date de départ :* ${departureDate}\n` : '') +
        `• *Statut :* En transit international\n\n` +
        `📍 *Suivi GPS et Chaîne du Froid en temps réel :*\n` +
        `${trackingUrl}\n\n` +
        `_Trans Bodanon TMS • Votre partenaire logistique international_`
      );
    }

    // Default Arabic
    return (
      `🚚 *إشعار انطلاق شحنة دولية | Trans Bodanon TMS*\n\n` +
      `مرحباً *${clientName}*،\n` +
      `يسرنا إبلاغكم بأن شاحنتكم المخصصة قد انطلقت بنجاح وفق البيانات التالية:\n\n` +
      `• *رقم الإرسالية:* #${tripId}\n` +
      `• *وثيقة الشحن (CMR):* ${cmrNumber}\n` +
      `• *المسار اللوجستي:* ${route}\n` +
      (plateNumber ? `• *الشاحنة المخصصة:* ${plateNumber}\n` : '') +
      (departureDate ? `• *تاريخ الانطلاق:* ${departureDate}\n` : '') +
      `• *الحالة:* في الطريق الدولي المعتمد\n\n` +
      `📍 *رابط التتبع الفضائي المباشر وحالة التبريد (بدون تسجيل دخول):*\n` +
      `${trackingUrl}\n\n` +
      `_Trans Bodanon TMS • شريككم الموثوق في النقل الدولي واللوجستيك_`
    );
  }

  // 2. PORT / BORDER GEOFENCE ENTRY
  if (eventType === 'port_geofence_entry') {
    const zoneAr = details?.zoneNameAr || 'الميناء / المعبر الدولي';
    const zoneFr = details?.zoneNameFr || 'Port / Frontière Internationale';
    const zoneEs = details?.zoneNameEs || details?.zoneNameFr || 'Puerto / Paso Fronterizo';
    const timeNow = new Date().toLocaleTimeString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (locale === 'es') {
      return (
        `⚓ *Alerta de Cruce Puerto / Frontera | Trans Bodanon TMS*\n\n` +
        `Estimado/a *${clientName}*,\n` +
        `El vehículo (${plateNumber || `#${tripId}`}) ha entrado en la zona de paso internacional:\n\n` +
        `• *Punto de cruce :* ${zoneEs}\n` +
        `• *Hora registrada :* ${timeNow}\n` +
        `• *Trámite :* En gestión de aduanas y tránsito de embarque\n\n` +
        `📍 *Seguir la posición del vehículo en directo :*\n` +
        `${trackingUrl}\n\n` +
        `_Trans Bodanon TMS • Control Operativo de Corredores_`
      );
    }

    if (locale === 'fr') {
      return (
        `⚓ *Alerte Passage Port / Frontière | Trans Bodanon TMS*\n\n` +
        `Bonjour *${clientName}*,\n` +
        `Le véhicule (${plateNumber || `#${tripId}`}) est arrivé dans la zone de transit :\n\n` +
        `• *Point de passage :* ${zoneFr}\n` +
        `• *Horodatage :* ${timeNow}\n` +
        `• *Formalité :* Dédouanement et embarquement maritime/terrestre\n\n` +
        `📍 *Suivre la position du véhicule en direct :*\n` +
        `${trackingUrl}\n\n` +
        `_Trans Bodanon TMS • Tour de Contrôle Logistique_`
      );
    }

    // Default Arabic
    return (
      `⚓ *تنبيه عبور الموانئ والمعابر الدولية | Trans Bodanon TMS*\n\n` +
      `مرحباً *${clientName}*،\n` +
      `وصلت الشاحنة (${plateNumber || `#${tripId}`}) التابعة لإرساليتكم إلى نقطة العبور:\n\n` +
      `• *الميناء / المعبر:* ${zoneAr}\n` +
      `• *التوقيت:* ${timeNow}\n` +
      `• *الإجراء الميداني:* جارٍ استكمال التخليص الجمركي وإجراءات العبور الدولي\n\n` +
      `📍 *متابعة موقع الشاحنة حياً عبر الأقمار الصناعية:*\n` +
      `${trackingUrl}\n\n` +
      `_Trans Bodanon TMS • نظام المتابعة اللوجستية الميدانية_`
    );
  }

  // 3. PORT / BORDER GEOFENCE EXIT
  if (eventType === 'port_geofence_exit') {
    const zoneAr = details?.zoneNameAr || 'الميناء الدولي';
    const zoneFr = details?.zoneNameFr || 'Point de transit';
    const zoneEs = details?.zoneNameEs || 'Punto de tránsito';

    if (locale === 'es') {
      return (
        `🚢 *Salida de Cruce Portuario / Fronterizo | Trans Bodanon TMS*\n\n` +
        `Estimado/a *${clientName}*,\n` +
        `El vehículo (${plateNumber || `#${tripId}`}) ha completado el cruce de *${zoneEs}* y continúa su trayecto hacia el destino final.\n\n` +
        `📍 *Enlace de seguimiento continuo :*\n${trackingUrl}`
      );
    }

    if (locale === 'fr') {
      return (
        `🚢 *Sortie de Transit Portuaire / Frontière | Trans Bodanon TMS*\n\n` +
        `Bonjour *${clientName}*,\n` +
        `Le véhicule (${plateNumber || `#${tripId}`}) a franchi *${zoneFr}* avec succès et poursuit sa route vers sa destination finale.\n\n` +
        `📍 *Lien de suivi direct :*\n${trackingUrl}`
      );
    }

    return (
      `🚢 *مغادرة نقطة العبور والميناء | Trans Bodanon TMS*\n\n` +
      `مرحباً *${clientName}*،\n` +
      `اجتازت الشاحنة (${plateNumber || `#${tripId}`}) نقطة *${zoneAr}* بنجاح وتواصل سيرها نحو الوجهة المحددة.\n\n` +
      `📍 *رابط التتبع المباشر:*\n${trackingUrl}`
    );
  }

  // 4. DELIVERY COMPLETED & E-POD
  if (eventType === 'delivery_completed') {
    const recipient = details?.recipientName || 'المستلم المعتمد / Destinataire';
    const deliveredAt = details?.signedAt
      ? new Date(details.signedAt).toLocaleString(
          locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'es-ES',
          {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }
        )
      : new Date().toLocaleString();

    const gpsCoords =
      details?.latitude && details?.longitude
        ? `${details.latitude.toFixed(4)}, ${details.longitude.toFixed(4)}`
        : null;

    if (locale === 'es') {
      return (
        `✅ *Confirmación de Entrega y e-POD Certificado | Trans Bodanon TMS*\n\n` +
        `Estimado/a *${clientName}*,\n` +
        `Nos complace informarle que su envío internacional ha sido entregado y descargado con éxito :\n\n` +
        `• *Ref. Envío :* #${tripId} (${cmrNumber})\n` +
        `• *Destinatario firmante :* ${recipient}\n` +
        `• *Fecha y hora de entrega :* ${deliveredAt}\n` +
        (gpsCoords ? `• *Coordenadas de entrega :* ${gpsCoords}\n` : '') +
        `• *Seguridad :* Sello de Integridad HMAC-SHA256 Certificado (ISO 19845)\n\n` +
        `📄 *Descargar comprobante e-POD oficial firmado (PDF) :*\n` +
        `${podPdfUrl}\n\n` +
        `📍 *Ver fotos y firma digital en el portal :*\n` +
        `${trackingUrl}\n\n` +
        `Muchas gracias por confiar en Trans Bodanon.`
      );
    }

    if (locale === 'fr') {
      return (
        `✅ *Confirmation de Livraison & e-POD Certifié | Trans Bodanon TMS*\n\n` +
        `Bonjour *${clientName}*,\n` +
        `Nous avons le plaisir de vous confirmer la livraison et le déchargement de votre expédition :\n\n` +
        `• *Réf Dossier :* #${tripId} (${cmrNumber})\n` +
        `• *Réceptionnaire agréé :* ${recipient}\n` +
        `• *Date et heure de décharge :* ${deliveredAt}\n` +
        (gpsCoords ? `• *Localisation GPS :* ${gpsCoords}\n` : '') +
        `• *Sécurité :* Sceau d'intégrité numérique HMAC-SHA256 validé (ISO 19845)\n\n` +
        `📄 *Télécharger le récépissé officiel e-POD (PDF) :*\n` +
        `${podPdfUrl}\n\n` +
        `📍 *Consulter l'historique et la signature sur le portail :*\n` +
        `${trackingUrl}\n\n` +
        `Merci de votre confiance en Trans Bodanon.`
      );
    }

    // Default Arabic
    return (
      `✅ *تأكيد تسليم الشحنة وإثبات التسليم الرقمي المعتمد (e-POD) | Trans Bodanon*\n\n` +
      `مرحباً *${clientName}*،\n` +
      `تم بحمد الله تفريغ وتسليم شحنتكم الدولية بنجاح وتوثيق الاستلام إلكترونياً:\n\n` +
      `• *رقم الإرسالية:* #${tripId} (${cmrNumber})\n` +
      `• *المستلم المعتمد:* ${recipient}\n` +
      `• *تاريخ وتوقيت الاستلام:* ${deliveredAt}\n` +
      (gpsCoords ? `• *إحداثيات موقع التسليم:* ${gpsCoords}\n` : '') +
      `• *التوثيق الرقمي:* ختم النزاهة HMAC-SHA256 المشفر وغير القابل للتلاعب (ISO 19845)\n\n` +
      `📄 *تحميل وثيقة التسليم والتوقيع الرسمي المعتمد (PDF):*\n` +
      `${podPdfUrl}\n\n` +
      `📍 *معاينة وثيقة الاستلام وصور الـ CMR بالبوابة:*\n` +
      `${trackingUrl}\n\n` +
      `شكراً لاختياركم شركة Trans Bodanon لخدمات النقل الدولي.`
    );
  }

  return `تحديث بشأن الشحنة #${tripId}: ${route} - الرابط: ${trackingUrl}`;
}

/**
 * Main dispatcher for trip lifecycle milestone notifications
 */
export async function dispatchTripLifecycleNotifications(
  tripId: number,
  eventType: TripLifecycleEventType,
  extraDetails?: MilestoneNotificationDetails
): Promise<{ success: boolean; dispatchedToClient: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Fetch trip order with vehicle
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        id,
        route,
        route_export,
        departure_date,
        cmr_number,
        cmr_export_number,
        status,
        client_id,
        truck_id
      `)
      .eq('id', tripId)
      .single<TripOrder>();

    if (tripErr || !trip) {
      return { success: false, dispatchedToClient: false, error: 'Trip not found' };
    }

    if (!trip.client_id) {
      return { success: true, dispatchedToClient: false };
    }

    // 2. Fetch Client and Truck details
    const [clientRes, truckRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', trip.client_id).single<Client>(),
      trip.truck_id
        ? supabase.from('trucks').select('plate_number').eq('id', trip.truck_id).single<Truck>()
        : Promise.resolve({ data: null }),
    ]);

    const client = clientRes.data;
    if (!client) {
      return { success: false, dispatchedToClient: false, error: 'Client not found' };
    }

    const truckPlate = truckRes.data?.plate_number || extraDetails?.plateNumber || '';
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';
    const trackingLink = `${siteUrl}/track/${trip.id}`;
    const podPdfLink = `${siteUrl}/api/pod?tripId=${trip.id}`;
    const cmrCode = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;
    const routeText = trip.route_export || trip.route || 'شحنة دولية';

    // 3. Dispatch to Client Webhook if configured
    const clientWebhookUrl = (client as unknown as { webhook_url?: string }).webhook_url;
    if (clientWebhookUrl) {
      await dispatchClientWebhook(clientWebhookUrl, undefined, {
        event:
          eventType === 'delivery_completed'
            ? 'trip.delivered'
            : eventType === 'port_geofence_entry'
              ? 'trip.port_entry'
              : 'trip.status_changed',
        timestamp: new Date().toISOString(),
        tripId: trip.id,
        data: {
          status: trip.status,
          route: routeText,
          departureDate: trip.departure_date,
          trackingUrl: trackingLink,
          podPdfUrl: podPdfLink,
          plateNumber: truckPlate,
          ...extraDetails,
        },
      }).catch((whErr) => console.warn('Webhook dispatch error:', whErr));
    }

    // 4. Build and dispatch WhatsApp Notification
    let dispatchedToClient = false;
    if (client.phone && (process.env.WHATSAPP_API_TOKEN || process.env.CALLMEBOT_API_KEY)) {
      const locale = extraDetails?.locale || inferClientLocale(client);

      const message = buildMilestoneMessage({
        eventType,
        locale,
        clientName: client.name || 'عميلنا العزيز',
        tripId: trip.id,
        cmrNumber: cmrCode,
        route: routeText,
        departureDate: trip.departure_date,
        plateNumber: truckPlate,
        trackingUrl: trackingLink,
        podPdfUrl: podPdfLink,
        details: extraDetails,
      });

      await sendWhatsAppCloudMessage({
        to: client.phone,
        message,
        auditEntity: {
          type: 'trip_order',
          id: trip.id,
        },
      });

      dispatchedToClient = true;
    }

    return { success: true, dispatchedToClient };
  } catch (err) {
    console.warn('Dispatch notification non-blocking failure:', err);
    return {
      success: false,
      dispatchedToClient: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
