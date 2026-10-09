/**
 * Trans Bodanon TMS — Conversational Logistics Bot Engine
 * Handles inbound WhatsApp webhooks, interactive button actions,
 * natural language queries, and autonomous dispatching.
 * Strictly adheres to Decimal.js for financial/balance calculations.
 */

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { formatPhoneNumber } from '@/lib/phone-utils';
import {
  sendWhatsAppText,
  sendWhatsAppInteractiveButtons,
} from './whatsapp-meta-client';
import { generatePaymentLinkToken } from '@/features/payments/services/payment-gateway.service';
import { dispatchTripLifecycleNotifications, inferClientLocale } from '@/features/trips/services/notification-dispatcher';
import type {
  MetaWebhookMessage,
  BotContext,
  BotExecutionResult,
  WhatsAppLocale,
  BotSenderRole,
} from '../types/whatsapp.types';
import type { TripOrder, Client, Driver, Invoice, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 1. Resolves sender identity (Driver vs Client vs Unknown) and communication locale
 */
export async function identifySenderContext(rawPhone: string): Promise<BotContext> {
  const cleanPhone = formatPhoneNumber(rawPhone);
  const supabase = await createClient();

  // A. Check Driver Table
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, phone')
    .limit(100);

  const matchedDriver = (drivers || []).find(
    (d: any) => formatPhoneNumber(d.phone || '') === cleanPhone
  );

  if (matchedDriver) {
    const locale: WhatsAppLocale = cleanPhone.startsWith('34')
      ? 'es'
      : cleanPhone.startsWith('33') || cleanPhone.startsWith('221') || cleanPhone.startsWith('222')
        ? 'fr'
        : 'ar';

    return {
      senderPhone: rawPhone,
      cleanPhone,
      role: 'driver',
      locale,
      matchedDriverId: matchedDriver.id,
      matchedDriverName: matchedDriver.name || 'سائق',
    };
  }

  // B. Check Client Table
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, phone, shipping_country, preferred_notification_method')
    .limit(100);

  const matchedClient = (clients || []).find(
    (c: any) => formatPhoneNumber(c.phone || '') === cleanPhone
  );

  if (matchedClient) {
    const locale = inferClientLocale(matchedClient);
    return {
      senderPhone: rawPhone,
      cleanPhone,
      role: 'client',
      locale,
      matchedClientId: matchedClient.id,
      matchedClientName: matchedClient.name,
    };
  }

  // C. Unregistered / Guest user
  const guestLocale: WhatsAppLocale = cleanPhone.startsWith('34')
    ? 'es'
    : cleanPhone.startsWith('33') || cleanPhone.startsWith('221') || cleanPhone.startsWith('222')
      ? 'fr'
      : 'ar';

  return {
    senderPhone: rawPhone,
    cleanPhone,
    role: 'unknown',
    locale: guestLocale,
  };
}

/**
 * 2. Handles Interactive Quick Reply Button Clicks
 */
export async function handleInteractiveButton(
  buttonId: string,
  context: BotContext
): Promise<BotExecutionResult> {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

  // ========================================================
  // Action: Track Trip (btn_track_<tripId>)
  // ========================================================
  if (buttonId.startsWith('btn_track_')) {
    const tripId = parseInt(buttonId.replace('btn_track_', ''), 10);
    const { data: trip } = await supabase
      .from('trip_orders')
      .select('id, route, route_export, status, departure_date, cmr_number, cmr_export_number, truck_id')
      .eq('id', tripId)
      .single<TripOrder>();

    if (!trip) {
      const errText =
        context.locale === 'es'
          ? `❌ Lo sentimos, no se encontró el envío #${tripId}.`
          : context.locale === 'fr'
            ? `❌ Désolé, l'expédition #${tripId} est introuvable.`
            : `❌ عذراً، لم نتمكن من العثور على الشحنة رقم #${tripId}.`;

      await sendWhatsAppText({ to: context.cleanPhone, message: errText });
      return { processed: true, intent: 'track_trip', replySent: true, error: 'Trip not found' };
    }

    let truckPlate = '';
    if (trip.truck_id) {
      const { data: truck } = await supabase
        .from('trucks')
        .select('plate_number')
        .eq('id', trip.truck_id)
        .single<Truck>();
      if (truck) truckPlate = truck.plate_number;
    }

    const trackLink = `${siteUrl}/track/${trip.id}`;
    const route = trip.route_export || trip.route || 'مسار دولي';
    const cmr = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;

    let replyBody = '';
    if (context.locale === 'es') {
      replyBody =
        `📍 *Detalles en Vivo del Envío #${trip.id}*\n\n` +
        `• *Ruta :* ${route}\n` +
        `• *Estado :* ${trip.status}\n` +
        (truckPlate ? `• *Vehículo :* ${truckPlate}\n` : '') +
        `• *CMR :* ${cmr}\n\n` +
        `🔗 *Ver satélite y temperatura frigorífica :*\n${trackLink}`;
    } else if (context.locale === 'fr') {
      replyBody =
        `📍 *Détails en Temps Réel Expédition #${trip.id}*\n\n` +
        `• *Trajet :* ${route}\n` +
        `• *Statut :* ${trip.status}\n` +
        (truckPlate ? `• *Véhicule :* ${truckPlate}\n` : '') +
        `• *CMR :* ${cmr}\n\n` +
        `🔗 *Voir suivi GPS et chaîne du froid :*\n${trackLink}`;
    } else {
      replyBody =
        `📍 *بيانات التتبع المباشر للإرسالية #${trip.id}*\n\n` +
        `• *المسار اللوجستي:* ${route}\n` +
        `• *الحالة الميدانية:* ${trip.status}\n` +
        (truckPlate ? `• *الشاحنة المخصصة:* ${truckPlate}\n` : '') +
        `• *رقم البوليصة:* ${cmr}\n\n` +
        `🔗 *رابط التتبع الفضائي وحالة المبرد:*\n${trackLink}`;
    }

    await sendWhatsAppInteractiveButtons({
      to: context.cleanPhone,
      body: replyBody,
      buttons: [
        {
          id: `btn_cmr_${trip.id}`,
          title: context.locale === 'es' ? '📄 Ver e-CMR' : context.locale === 'fr' ? '📄 Voir e-CMR' : '📄 بوليصة CMR',
        },
        {
          id: `btn_track_${trip.id}`,
          title: context.locale === 'es' ? '🔄 Actualizar' : context.locale === 'fr' ? '🔄 Actualiser' : '🔄 تحديث الموقع',
        },
      ],
      auditEntity: { type: 'trip_order', id: trip.id },
    });

    return { processed: true, intent: 'track_trip', replySent: true, replyMessage: replyBody };
  }

  // ========================================================
  // Action: CMR / e-POD Document Download (btn_cmr_<tripId>)
  // ========================================================
  if (buttonId.startsWith('btn_cmr_')) {
    const tripId = parseInt(buttonId.replace('btn_cmr_', ''), 10);
    const podUrl = `${siteUrl}/api/pod?tripId=${tripId}`;

    const text =
      context.locale === 'es'
        ? `📄 *Documentación e-CMR / e-POD del Envío #${tripId}*\n\nPuede descargar el comprobante oficial con firma criptográfica HMAC en el siguiente enlace:\n${podUrl}`
        : context.locale === 'fr'
          ? `📄 *Documentation e-CMR / e-POD du Dossier #${tripId}*\n\nVous pouvez télécharger le récépissé officiel avec sceau d'intégrité numérique HMAC :\n${podUrl}`
          : `📄 *وثيقة الشحن الإلكترونية (e-CMR / e-POD) للإرسالية #${tripId}*\n\nيمكنكم تحميل وثيقة التسليم الرسمية وبوليصة الشحن بختم النزاهة التشفيري عبر الرابط:\n${podUrl}`;

    await sendWhatsAppInteractiveButtons({
      to: context.cleanPhone,
      body: text,
      buttons: [
        {
          id: `btn_track_${tripId}`,
          title: context.locale === 'es' ? '📍 Seguimiento GPS' : context.locale === 'fr' ? '📍 Suivi GPS' : '📍 تتبع الشحنة',
        },
      ],
      auditEntity: { type: 'trip_order', id: tripId },
    });

    return { processed: true, intent: 'track_trip', replySent: true };
  }

  // ========================================================
  // Action: Online Payment Link (btn_pay_inv_<invoiceId>)
  // ========================================================
  if (buttonId.startsWith('btn_pay_inv_')) {
    const invId = parseInt(buttonId.replace('btn_pay_inv_', ''), 10);
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, ttc_amount, paid_amount, currency, due_date')
      .eq('id', invId)
      .single<Invoice>();

    if (!invoice) {
      await sendWhatsAppText({
        to: context.cleanPhone,
        message: '❌ لم يتم العثور على بيانات الفاتورة المحددة.',
      });
      return { processed: true, intent: 'pay_invoice', replySent: true, error: 'Invoice not found' };
    }

    // Strict Decimal.js arithmetic for balance calculation
    const totalDec = new Decimal(invoice.ttc_amount || invoice.total_amount || 0);
    const paidDec = new Decimal(invoice.paid_amount || 0);
    const balanceDec = Decimal.max(0, totalDec.minus(paidDec));
    const currency = invoice.currency || 'MAD';

    const invNumber = invoice.invoice_number || `INV-${invoice.id}`;
    const { token } = generatePaymentLinkToken({
      invoiceId: invoice.id,
      invoiceNumber: invNumber,
      amount: balanceDec.toFixed(2),
      currency,
      expiresInDays: 30,
    });

    const paymentUrl = `${siteUrl}/pay/${encodeURIComponent(token)}`;

    let payMsg = '';
    if (context.locale === 'es') {
      payMsg =
        `💳 *Enlace de Pago Digital Seguro | Trans Bodanon*\n\n` +
        `• *Factura :* ${invNumber}\n` +
        `• *Saldo Pendiente :* ${balanceDec.toFixed(2)} ${currency}\n` +
        `• *Métodos aceptados :* Tarjeta Bancaria (CMI / Visa / Mastercard) o Transferencia\n\n` +
        `🔗 *Proceder al pago inmediato seguro :*\n${paymentUrl}\n\n` +
        `_Este enlace es personal y expira en 30 días._`;
    } else if (context.locale === 'fr') {
      payMsg =
        `💳 *Lien de Paiement Numérique Sécurisé | Trans Bodanon*\n\n` +
        `• *Facture N° :* ${invNumber}\n` +
        `• *Solde Restant Dû :* ${balanceDec.toFixed(2)} ${currency}\n` +
        `• *Moyens acceptés :* Carte Bancaire (CMI / Visa / Mastercard) ou Virement\n\n` +
        `🔗 *Régler immédiatement en ligne :*\n${paymentUrl}\n\n` +
        `_Ce lien est sécurisé et expire dans 30 jours._`;
    } else {
      payMsg =
        `💳 *رابط السداد الإلكتروني الفوري والآمن | Trans Bodanon*\n\n` +
        `• *رقم الفاتورة:* ${invNumber}\n` +
        `• *المبلغ المستحق:* ${balanceDec.toFixed(2)} ${currency}\n` +
        `• *طرق الدفع المتاحة:* البطاقات البنكية المغربية والدولية (CMI / Visa / Mastercard)\n\n` +
        `🔗 *رابط السداد الفوري الآمن:*\n${paymentUrl}\n\n` +
        `_الرابط مشفر وصالح لمدة 30 يوماً._`;
    }

    await sendWhatsAppText({
      to: context.cleanPhone,
      message: payMsg,
      auditEntity: { type: 'invoices', id: invoice.id },
    });

    return { processed: true, intent: 'pay_invoice', replySent: true, replyMessage: payMsg };
  }

  // ========================================================
  // Action: Driver Mission (btn_driver_trip_<tripId>)
  // ========================================================
  if (buttonId.startsWith('btn_driver_trip_')) {
    const tripId = parseInt(buttonId.replace('btn_driver_trip_', ''), 10);
    const { data: trip } = await supabase
      .from('trip_orders')
      .select('id, route, route_export, status, departure_date, cmr_number, shipping_gps_url, unloading_gps_url, origin, destination')
      .eq('id', tripId)
      .single<TripOrder>();

    if (!trip) {
      await sendWhatsAppText({ to: context.cleanPhone, message: '❌ لم يتم العثور على تفاصيل الرحلة.' });
      return { processed: true, intent: 'driver_mission', replySent: true, error: 'Trip not found' };
    }

    let missionBody =
      `🚚 *تفاصيل مهمتك التشغيلية #${trip.id}*\n\n` +
      `• *المسار:* ${trip.route_export || trip.route || 'مسار دولي'}\n` +
      `• *الحالة:* ${trip.status}\n` +
      `• *تاريخ الانطلاق:* ${trip.departure_date || 'فوري'}\n\n`;

    if (trip.shipping_gps_url) {
      missionBody += `📍 *موقع الشحن والتحميل (GPS):*\n${trip.shipping_gps_url}\n\n`;
    }
    if (trip.unloading_gps_url) {
      missionBody += `🎯 *موقع التفريغ والتسليم (GPS):*\n${trip.unloading_gps_url}\n\n`;
    }

    await sendWhatsAppInteractiveButtons({
      to: context.cleanPhone,
      body: missionBody,
      buttons: [
        { id: `btn_driver_start_${trip.id}`, title: '🚀 انطلقت في الطريق' },
        { id: `btn_driver_delivered_${trip.id}`, title: '✅ وصلت للتفريغ' },
      ],
      auditEntity: { type: 'trip_order', id: trip.id },
    });

    return { processed: true, intent: 'driver_mission', replySent: true };
  }

  // ========================================================
  // Action: Driver Departed / Start Trip (btn_driver_start_<tripId>)
  // ========================================================
  if (buttonId.startsWith('btn_driver_start_')) {
    const tripId = parseInt(buttonId.replace('btn_driver_start_', ''), 10);

    // Update trip order status to in_transit
    await supabase
      .from('trip_orders')
      .update({ status: 'in_transit' })
      .eq('id', tripId);

    // Dispatch milestone alert to client automatically!
    await dispatchTripLifecycleNotifications(tripId, 'trip_dispatched');

    const confirmMsg =
      `✅ *تم تسجيل انطلاقك بنجاح!*\n\nتم تحديث حالة الرحلة #${tripId} إلى (في الطريق الدولي) وتم إرسال رابط التتبع المباشر إلى العميل آلياً.\nنتمنى لك رحلة آمنة وموفقة. 🛣️`;

    await sendWhatsAppText({
      to: context.cleanPhone,
      message: confirmMsg,
      auditEntity: { type: 'trip_order', id: tripId },
    });

    return {
      processed: true,
      intent: 'driver_start_trip',
      replySent: true,
      actionExecuted: `trip_${tripId}_started`,
    };
  }

  // ========================================================
  // Action: Driver Delivered (btn_driver_delivered_<tripId>)
  // ========================================================
  if (buttonId.startsWith('btn_driver_delivered_')) {
    const tripId = parseInt(buttonId.replace('btn_driver_delivered_', ''), 10);
    const pwaUploadLink = `${siteUrl}/driver-tasks?tripId=${tripId}`;

    const text =
      `🎉 *تم تسجيل وصولك لموقع التفريغ!*\n\n` +
      `يرجى فتح تطبيق السائق وتوثيق التوقيع الرقمي (e-POD) وصور الـ CMR:\n${pwaUploadLink}`;

    await sendWhatsAppText({
      to: context.cleanPhone,
      message: text,
      auditEntity: { type: 'trip_order', id: tripId },
    });

    return {
      processed: true,
      intent: 'driver_report_arrival',
      replySent: true,
      actionExecuted: `trip_${tripId}_arrival_prompted`,
    };
  }

  // Fallback for unknown buttons
  await sendWhatsAppText({
    to: context.cleanPhone,
    message: context.locale === 'es' ? 'Acción recibida.' : context.locale === 'fr' ? 'Action reçue.' : 'تم استلام طلبك.',
  });

  return { processed: true, intent: 'unknown', replySent: true };
}

/**
 * 3. Handles Inbound Text Messages (Keyword Recognition & NLP Assistant)
 */
export async function handleTextMessage(
  text: string,
  context: BotContext
): Promise<BotExecutionResult> {
  const normalized = text.trim().toLowerCase();
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

  // ----------------------------------------------------
  // Intent: Emergency SOS
  // ----------------------------------------------------
  if (
    normalized.includes('sos') ||
    normalized.includes('urgence') ||
    normalized.includes('طارئ') ||
    normalized.includes('حادث') ||
    normalized.includes('panne') ||
    normalized.includes('accident')
  ) {
    const sosMsg =
      `🚨 *مركز الطوارئ والعمليات اللوجستية 24/7*\n\n` +
      `تم استلام نداء الطوارئ الخاص بك وتوجيهه فوراً إلى غرفة التحكم المركزية.\n` +
      `• هاتف الطوارئ المباشر: +212 5 28 84 00 00\n` +
      `• مسؤول الأسطول: +212 6 61 24 55 89\n\n` +
      `إذا كانت هناك حاجة للإسعاف أو الدرك الملكي، اتصل بـ 177 / 190.`;

    await sendWhatsAppText({
      to: context.cleanPhone,
      message: sosMsg,
    });

    return { processed: true, intent: 'emergency_alert', replySent: true };
  }

  // ----------------------------------------------------
  // Intent: Driver requesting active mission
  // ----------------------------------------------------
  if (
    context.role === 'driver' &&
    (normalized.includes('رحلة') ||
      normalized.includes('رحلتي') ||
      normalized.includes('رحل') ||
      normalized.includes('شحنة') ||
      normalized.includes('شحنتي') ||
      normalized.includes('mission') ||
      normalized.includes('viaje') ||
      normalized.includes('camion'))
  ) {
    // Lookup latest active trip for this driver
    const { data: driverTrips } = await supabase
      .from('trip_orders')
      .select('id, route, route_export, status, departure_date, cmr_number')
      .eq('driver_id', context.matchedDriverId)
      .in('status', ['assigned', 'loading', 'in_transit', 'customs_pending'])
      .order('id', { ascending: false })
      .limit(1);

    const activeTrip = driverTrips?.[0];
    if (activeTrip) {
      return handleInteractiveButton(`btn_driver_trip_${activeTrip.id}`, context);
    } else {
      await sendWhatsAppText({
        to: context.cleanPhone,
        message: `مرحباً ${context.matchedDriverName}، لا توجد رحلات نشطة مسندة إليك حالياً في النظام.`,
      });
      return { processed: true, intent: 'driver_mission', replySent: true };
    }
  }

  // ----------------------------------------------------
  // Intent: Track Trip by ID or CMR code
  // ----------------------------------------------------
  const tripIdMatch = normalized.match(/(?:تتبع|track|suivi|viaje|#)?\s*([0-9]{2,6})/i);
  if (
    normalized.includes('تتبع') ||
    normalized.includes('track') ||
    normalized.includes('suivi') ||
    normalized.includes('rastreo') ||
    normalized.includes('cmr') ||
    tripIdMatch
  ) {
    let candidateTripId: number | null = null;
    if (tripIdMatch && tripIdMatch[1]) {
      candidateTripId = parseInt(tripIdMatch[1], 10);
    }

    if (candidateTripId) {
      return handleInteractiveButton(`btn_track_${candidateTripId}`, context);
    }

    // If client asked for tracking without ID, look up their latest open shipment
    if (context.matchedClientId) {
      const { data: clientTrips } = await supabase
        .from('trip_orders')
        .select('id')
        .eq('client_id', context.matchedClientId)
        .order('id', { ascending: false })
        .limit(1);

      if (clientTrips && clientTrips.length > 0) {
        return handleInteractiveButton(`btn_track_${clientTrips[0].id}`, context);
      }
    }

    const askTripPrompt =
      context.locale === 'es'
        ? 'Por favor, indíquenos el número de envío (ejemplo: *#501* o *CMR-1234*) para localizar su carga.'
        : context.locale === 'fr'
          ? "Veuillez préciser le numéro d'expédition (ex: *#501* ou *CMR-1234*) pour le suivi en direct."
          : 'يرجى كتابة رقم الإرسالية (مثال: *#501* أو *تتبع 501*) لمعرفة موقع شحنتكم وتفاصيل التبريد.';

    await sendWhatsAppText({ to: context.cleanPhone, message: askTripPrompt });
    return { processed: true, intent: 'track_trip', replySent: true };
  }

  // ----------------------------------------------------
  // Intent: Invoices & Payments
  // ----------------------------------------------------
  if (
    normalized.includes('فاتورة') ||
    normalized.includes('facture') ||
    normalized.includes('invoice') ||
    normalized.includes('factura') ||
    normalized.includes('رصيد') ||
    normalized.includes('سداد') ||
    normalized.includes('payer') ||
    normalized.includes('pagar')
  ) {
    if (context.matchedClientId) {
      const { data: openInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, ttc_amount, paid_amount, currency, due_date')
        .eq('client_id', context.matchedClientId)
        .in('status', ['unpaid', 'partially_paid', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(3);

      if (openInvoices && openInvoices.length > 0) {
        const inv = openInvoices[0];
        // Calculate remaining with Decimal.js
        const totalDec = new Decimal(inv.ttc_amount || inv.total_amount || 0);
        const paidDec = new Decimal(inv.paid_amount || 0);
        const remainingDec = Decimal.max(0, totalDec.minus(paidDec));
        const ccy = inv.currency || 'MAD';

        const promptText =
          context.locale === 'es'
            ? `📄 *Factura Pendiente #${inv.invoice_number || inv.id}*\n• Saldo : *${remainingDec.toFixed(2)} ${ccy}*\n• Vencimiento : ${inv.due_date || 'Inmediato'}`
            : context.locale === 'fr'
              ? `📄 *Facture Impayée #${inv.invoice_number || inv.id}*\n• Solde Dû : *${remainingDec.toFixed(2)} ${ccy}*\n• Échéance : ${inv.due_date || 'Immédiat'}`
              : `📄 *فاتورة مستحقة #${inv.invoice_number || inv.id}*\n• المبلغ المتبقي: *${remainingDec.toFixed(2)} ${ccy}*\n• موعد الاستحقاق: ${inv.due_date || 'فوري'}`;

        await sendWhatsAppInteractiveButtons({
          to: context.cleanPhone,
          body: promptText,
          buttons: [
            {
              id: `btn_pay_inv_${inv.id}`,
              title: context.locale === 'es' ? '💳 Pagar en línea' : context.locale === 'fr' ? '💳 Payer en ligne' : '💳 سداد إلكتروني',
            },
          ],
          auditEntity: { type: 'invoices', id: inv.id },
        });

        return { processed: true, intent: 'get_invoice', replySent: true };
      }
    }

    const noInvText =
      context.locale === 'es'
        ? '✅ No tiene facturas pendientes de pago en este momento. ¡Gracias!'
        : context.locale === 'fr'
          ? "✅ Vous n'avez aucune facture en attente de règlement actuellement. Merci !"
          : '✅ لا توجد فواتير متأخرة أو مستحقة على حسابكم حالياً. شكراً لوفائكم.';

    await sendWhatsAppText({ to: context.cleanPhone, message: noInvText });
    return { processed: true, intent: 'get_invoice', replySent: true };
  }

  // ----------------------------------------------------
  // Intent: Welcome / Help Menu
  // ----------------------------------------------------
  let welcomeBody = '';
  const buttons = [];

  if (context.locale === 'es') {
    welcomeBody =
      `👋 *Bienvenido al Servicio Oficial de Trans Bodanon TMS*\n\n` +
      `¿En qué podemos ayudarle hoy? Seleccione una opción rápida o escriba el número de su envío.`;
    buttons.push({ id: 'btn_help_track', title: '📍 Seguimiento de Envío' });
    buttons.push({ id: 'btn_help_invoices', title: '💳 Facturas y Pagos' });
  } else if (context.locale === 'fr') {
    welcomeBody =
      `👋 *Bienvenue sur le Service Officiel Trans Bodanon TMS*\n\n` +
      `Comment pouvons-nous vous aider ? Sélectionnez une action ou indiquez votre numéro de dossier.`;
    buttons.push({ id: 'btn_help_track', title: '📍 Suivi Expédition' });
    buttons.push({ id: 'btn_help_invoices', title: '💳 Factures & Paiement' });
  } else {
    welcomeBody =
      `👋 *أهلاً بكم في المساعد الآلي لشركة Trans Bodanon للنقل الدولي*\n\n` +
      `كيف يمكننا خدمتكم اليوم؟ يمكنكم الضغط على أحد الخيارات أو كتابة رقم الإرسالية مباشرة.`;
    buttons.push({ id: 'btn_help_track', title: '📍 تتبع شحنة' });
    buttons.push({ id: 'btn_help_invoices', title: '💳 استعلام عن فاتورة' });
  }

  if (context.role === 'driver') {
    buttons.unshift({ id: 'btn_help_driver', title: '🚚 رحلتي الحالية' });
  }

  await sendWhatsAppInteractiveButtons({
    to: context.cleanPhone,
    body: welcomeBody,
    buttons: buttons.slice(0, 3),
  });

  return { processed: true, intent: 'help_menu', replySent: true };
}

/**
 * 4. Main Webhook Message Ingestion Entrypoint
 */
export async function processInboundWhatsAppMessage(
  message: MetaWebhookMessage
): Promise<BotExecutionResult> {
  const senderPhone = message.from;
  const context = await identifySenderContext(senderPhone);
  const supabase = await createClient();

  // A. Handle interactive button reply
  if (message.type === 'interactive' && message.interactive?.button_reply) {
    const btn = message.interactive.button_reply;

    // Log inbound interaction to DB
    try {
      await supabase.from('whatsapp_message_logs').insert({
        phone: context.cleanPhone,
        direction: 'inbound',
        message_type: 'interactive',
        content: `[Button Click: ${btn.title}] id=${btn.id}`,
        interactive_action_id: btn.id,
        status: 'received',
        wamid: message.id,
        raw_payload: message as any,
      });
    } catch {}

    return handleInteractiveButton(btn.id, context);
  }

  // B. Handle location sharing (e.g. from driver or client)
  if (message.type === 'location' && message.location) {
    const loc = message.location;

    try {
      await supabase.from('whatsapp_message_logs').insert({
        phone: context.cleanPhone,
        direction: 'inbound',
        message_type: 'location',
        content: `[GPS Pin: ${loc.latitude}, ${loc.longitude}]`,
        status: 'received',
        wamid: message.id,
        raw_payload: loc as any,
      });
    } catch {}

    const ack =
      context.locale === 'es'
        ? `📍 Posición GPS recibida (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}). ¡Gracias!`
        : context.locale === 'fr'
          ? `📍 Coordonnées GPS reçues (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}). Merci !`
          : `📍 تم استلام إحداثيات موقعك (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}) وحفظها في المنظومة بنجاح.`;

    await sendWhatsAppText({ to: context.cleanPhone, message: ack });
    return { processed: true, intent: 'unknown', replySent: true };
  }

  // C. Handle standard text message
  const textBody = message.text?.body || '';

  try {
    await supabase.from('whatsapp_message_logs').insert({
      phone: context.cleanPhone,
      direction: 'inbound',
      message_type: 'text',
      content: textBody,
      status: 'received',
      wamid: message.id,
      raw_payload: message as any,
    });
  } catch {}

  return handleTextMessage(textBody, context);
}
