/**
 * Trans Bodanon TMS — Automated Interactive WhatsApp Dispatch Engine
 * Bridges logistics operations (Trip Departure, e-CMR, e-POD, Invoices)
 * with the official Meta Interactive Cloud API.
 * Adheres strictly to Decimal.js financial and precision rules.
 */

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import {
  sendWhatsAppInteractiveButtons,
  sendWhatsAppText,
} from './whatsapp-meta-client';
import { generatePaymentLinkToken } from '@/features/payments/services/payment-gateway.service';
import { inferClientLocale } from '@/features/trips/services/notification-dispatcher';
import type { TripOrder, Client, Driver, Invoice, Truck } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * 1. Dispatches Interactive Departure Alert with Live Tracking and e-CMR buttons
 */
export async function dispatchTripDepartureInteractive(tripId: number): Promise<{
  success: boolean;
  clientNotified: boolean;
  driverNotified: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single<TripOrder>();

    if (tripErr || !trip) {
      return { success: false, clientNotified: false, driverNotified: false, error: 'Trip not found' };
    }

    const [clientRes, driverRes, truckRes] = await Promise.all([
      trip.client_id
        ? supabase.from('clients').select('*').eq('id', trip.client_id).single<Client>()
        : Promise.resolve({ data: null }),
      trip.driver_id
        ? supabase.from('drivers').select('*').eq('id', trip.driver_id).single<Driver>()
        : Promise.resolve({ data: null }),
      trip.truck_id
        ? supabase.from('trucks').select('*').eq('id', trip.truck_id).single<Truck>()
        : Promise.resolve({ data: null }),
    ]);

    const client = clientRes.data;
    const driver = driverRes.data;
    const truck = truckRes.data;

    let clientNotified = false;
    let driverNotified = false;

    // A. Dispatch to Client
    if (client && client.phone) {
      const locale = inferClientLocale(client);
      const trackingUrl = `${siteUrl}/track/${trip.id}`;
      const route = trip.route_export || trip.route || 'مسار دولي';
      const cmrNumber = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;
      const truckPlate = truck?.plate_number || 'مخصصة';

      let body = '';
      if (locale === 'es') {
        body =
          `🚚 *Aviso de Salida de Envío Internacional | Trans Bodanon*\n\n` +
          `Estimado/a *${client.name}*,\n` +
          `Su mercancía ha salido en viaje internacional :\n\n` +
          `• *Ref. Envío :* #${trip.id}\n` +
          `• *CMR :* ${cmrNumber}\n` +
          `• *Ruta :* ${route}\n` +
          `• *Vehículo :* ${truckPlate}\n\n` +
          `📍 *Seguimiento GPS y Temperatura :*\n${trackingUrl}`;
      } else if (locale === 'fr') {
        body =
          `🚚 *Aviso de Départ Expédition Internationale | Trans Bodanon*\n\n` +
          `Bonjour *${client.name}*,\n` +
          `Votre expédition a pris le départ en transit international :\n\n` +
          `• *Réf Dossier :* #${trip.id}\n` +
          `• *CMR :* ${cmrNumber}\n` +
          `• *Trajet :* ${route}\n` +
          `• *Véhicule :* ${truckPlate}\n\n` +
          `📍 *Suivi GPS et Température :*\n${trackingUrl}`;
      } else {
        body =
          `🚚 *إشعار انطلاق شحنة دولية | Trans Bodanon TMS*\n\n` +
          `مرحباً *${client.name}*،\n` +
          `نحيطكم علماً بأن شاحنتكم قد انطلقت بنجاح في مسارها الدولي المعتمد:\n\n` +
          `• *رقم الإرسالية:* #${trip.id}\n` +
          `• *بوليصة الشحن (CMR):* ${cmrNumber}\n` +
          `• *المسار اللوجستي:* ${route}\n` +
          `• *الشاحنة المخصصة:* ${truckPlate}\n\n` +
          `📍 *رابط التتبع الفضائي المباشر وحالة التبريد:*\n${trackingUrl}`;
      }

      await sendWhatsAppInteractiveButtons({
        to: client.phone,
        body,
        buttons: [
          {
            id: `btn_track_${trip.id}`,
            title: locale === 'es' ? '📍 Ver Mapa en Vivo' : locale === 'fr' ? '📍 Voir Carte en Direct' : '📍 تتبع الخريطة حياً',
          },
          {
            id: `btn_cmr_${trip.id}`,
            title: locale === 'es' ? '📄 Descargar e-CMR' : locale === 'fr' ? '📄 Télécharger e-CMR' : '📄 تحميل بوليصة CMR',
          },
        ],
        auditEntity: { type: 'trip_order', id: trip.id },
      });

      clientNotified = true;
    }

    // B. Dispatch Mission Alert to Driver
    if (driver && driver.phone) {
      const driverMsg =
        `🚚 *مهمة نقل دولية جديدة | شحنة #${trip.id}*\n\n` +
        `مرحباً ${driver.name}، تم إسناد رحلة دولية جديدة إليك:\n` +
        `• المسار: ${trip.route_export || trip.route || 'مسار دولي'}\n` +
        `• الشاحنة: ${truck?.plate_number || 'N/A'}\n` +
        (trip.shipping_gps_url ? `• موقع التحميل (GPS): ${trip.shipping_gps_url}\n` : '') +
        (trip.unloading_gps_url ? `• موقع التفريغ (GPS): ${trip.unloading_gps_url}\n` : '');

      await sendWhatsAppInteractiveButtons({
        to: driver.phone,
        body: driverMsg,
        buttons: [
          { id: `btn_driver_start_${trip.id}`, title: '🚀 انطلقت في الطريق' },
          { id: `btn_driver_trip_${trip.id}`, title: '📍 تفاصيل التحميل' },
        ],
        auditEntity: { type: 'trip_order', id: trip.id },
      });

      driverNotified = true;
    }

    return { success: true, clientNotified, driverNotified };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('dispatchTripDepartureInteractive failure:', errorMsg);
    return { success: false, clientNotified: false, driverNotified: false, error: errorMsg };
  }
}

/**
 * 2. Dispatches Interactive Invoice Reminder with Embedded Payment Link
 */
export async function dispatchInteractiveInvoiceReminder(invoiceId: number): Promise<{
  success: boolean;
  notified: boolean;
  paymentUrl?: string;
  remainingBalance?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single<Invoice>();

    if (invErr || !invoice || !invoice.client_id) {
      return { success: false, notified: false, error: 'Invoice or client not found' };
    }

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single<Client>();

    if (!client || !client.phone) {
      return { success: false, notified: false, error: 'Client phone number not available' };
    }

    // Strict Decimal.js calculation
    const totalDec = new Decimal(invoice.ttc_amount || invoice.total_amount || 0);
    const paidDec = new Decimal(invoice.paid_amount || 0);
    const remainingDec = Decimal.max(0, totalDec.minus(paidDec));
    const currency = invoice.currency || 'MAD';
    const invNumber = invoice.invoice_number || `INV-${invoice.id}`;

    if (remainingDec.lessThanOrEqualTo(0)) {
      return { success: true, notified: false, error: 'Invoice is already fully settled' };
    }

    // Cryptographic token generation
    const { token } = generatePaymentLinkToken({
      invoiceId: invoice.id,
      invoiceNumber: invNumber,
      amount: remainingDec.toFixed(2),
      currency,
      expiresInDays: 30,
    });

    const paymentUrl = `${siteUrl}/pay/${encodeURIComponent(token)}`;
    const locale = inferClientLocale(client);

    let body = '';
    if (locale === 'es') {
      body =
        `💳 *Recordatorio de Factura Pendiente | Trans Bodanon*\n\n` +
        `Estimado/a *${client.name}*,\n` +
        `Le recordamos que tiene un saldo pendiente de pago :\n\n` +
        `• *Factura N° :* ${invNumber}\n` +
        `• *Importe Pendiente :* ${remainingDec.toFixed(2)} ${currency}\n` +
        `• *Fecha de Vencimiento :* ${invoice.due_date || 'Inmediato'}\n\n` +
        `Puede abonar el importe directamente con tarjeta o transferencia en nuestro portal seguro :\n${paymentUrl}`;
    } else if (locale === 'fr') {
      body =
        `💳 *Rappel de Facture Impayée | Trans Bodanon*\n\n` +
        `Bonjour *${client.name}*,\n` +
        `Nous vous rappelons que votre compte présente un solde à régulariser :\n\n` +
        `• *Facture N° :* ${invNumber}\n` +
        `• *Montant Restant Dû :* ${remainingDec.toFixed(2)} ${currency}\n` +
        `• *Date d'Échéance :* ${invoice.due_date || 'Immédiat'}\n\n` +
        `Réglez directement en ligne en toute sécurité par carte ou virement :\n${paymentUrl}`;
    } else {
      body =
        `💳 *تذكير بسداد فاتورة مستحقة | Trans Bodanon TMS*\n\n` +
        `مرحباً *${client.name}*،\n` +
        `نود تذكيركم بوجود رصيد مستحق الأداء للفاتورة التالية:\n\n` +
        `• *رقم الفاتورة:* ${invNumber}\n` +
        `• *المبلغ المتبقي:* ${remainingDec.toFixed(2)} ${currency}\n` +
        `• *تاريخ الاستحقاق:* ${invoice.due_date || 'فوري'}\n\n` +
        `يمكنكم السداد الفوري والآمن ببطاقتكم البنكية عبر الرابط المعتمد:\n${paymentUrl}`;
    }

    await sendWhatsAppInteractiveButtons({
      to: client.phone,
      body,
      buttons: [
        {
          id: `btn_pay_inv_${invoice.id}`,
          title: locale === 'es' ? '💳 Pagar en línea' : locale === 'fr' ? '💳 Payer en ligne' : '💳 سداد إلكتروني فوري',
        },
      ],
      auditEntity: { type: 'invoices', id: invoice.id },
    });

    return {
      success: true,
      notified: true,
      paymentUrl,
      remainingBalance: remainingDec.toFixed(2),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('dispatchInteractiveInvoiceReminder failure:', errorMsg);
    return { success: false, notified: false, error: errorMsg };
  }
}

