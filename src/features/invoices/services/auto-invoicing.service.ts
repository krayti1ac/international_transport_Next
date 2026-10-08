
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { revalidatePath } from 'next/cache';
import type { Invoice, Client, TripOrder } from '@/types/database';
import type {
  TripInvoiceBreakdown,
  AutoInvoiceOptions,
  AutoInvoiceResult,
} from '../types';

export type {
  TripInvoiceBreakdown,
  AutoInvoiceOptions,
  AutoInvoiceResult,
};

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Standard legal clause for Moroccan VAT exemption on international freight.
 * CGI Article 92-I-10° (Exonération de la TVA pour les transports internationaux de marchandises).
 */
export const INTERNATIONAL_VAT_EXEMPTION_CLAUSE =
  "Exonération de la TVA en vertu de l'Article 92-I-10° du Code Général des Impôts (CGI) - Transport International de Marchandises";

/**
 * Checks whether a trip is classified as international transport based on corridor and routing.
 */
export function isInternationalTransport(trip: Partial<TripOrder>): boolean {
  if (trip.corridor_type === 'european_maritime' || trip.corridor_type === 'african_overland') {
    return true;
  }
  const route = (trip.route || trip.route_export || '').toLowerCase();
  const internationalKeywords = [
    'algeciras',
    'almeria',
    'motril',
    'valencia',
    'barcelona',
    'madrid',
    'perpignan',
    'dakar',
    'nouadhibou',
    'nouakchott',
    'guerguerat',
    'rosso',
    'senegal',
    'mauritania',
    'spain',
    'france',
    'espagne',
    'tanger med -> algeciras',
    'agadir -> dakar',
  ];
  return internationalKeywords.some((keyword) => route.includes(keyword));
}

/**
 * Calculates deterministic itemization and amounts for an auto-generated trip invoice using Decimal.js.
 */
export function calculateTripInvoiceBreakdown(
  trip: TripOrder,
  client?: Client | null,
  customsSubmission?: { mrn?: string | null; seal_numbers?: string[] | null } | null
): TripInvoiceBreakdown {
  // 1. Base Freight Amount
  const baseFreightDec = new Decimal(trip.price_export || trip.price || 0);

  // 2. Ferry Ticket & Transit Costs
  const ferryCostDec = new Decimal(trip.ferry_cost || 0);
  const transitAlmeriaDec = new Decimal(trip.transit_almeria_cost || 0);
  const marsaMarocDec = new Decimal(trip.marsa_maroc_cost || 0);
  const triptikDec = new Decimal(trip.triptik_cost || 0);
  const customsAndPortFeesDec = transitAlmeriaDec.plus(marsaMarocDec).plus(triptikDec);

  // Total Net HT is determined by the agreed freight price (exclusive of or inclusive of re-invoiced line items)
  const totalHtDec = baseFreightDec;

  // 3. Tax Scheme (International Exemption vs Domestic TVA)
  const isInternational = isInternationalTransport(trip);
  let isTaxExempt = false;
  let taxExemptionClause: string | undefined = undefined;
  let tvaRate = '0';
  let tvaAmountDec = new Decimal(0);
  let totalTtcDec = totalHtDec;

  if (isInternational) {
    isTaxExempt = true;
    taxExemptionClause = INTERNATIONAL_VAT_EXEMPTION_CLAUSE;
    tvaRate = '0';
    tvaAmountDec = new Decimal(0);
    totalTtcDec = totalHtDec;
  } else {
    // Domestic transport: evaluate client TVA configuration
    const invoiceWithTva = client ? client.invoice_with_tva !== false : true;
    if (invoiceWithTva) {
      tvaRate = client?.tva_rate || '20';
      const rateDec = new Decimal(tvaRate);
      tvaAmountDec = totalHtDec.times(rateDec).dividedBy(100);
      totalTtcDec = totalHtDec.plus(tvaAmountDec);
    } else {
      tvaRate = '0';
      tvaAmountDec = new Decimal(0);
      totalTtcDec = totalHtDec;
    }
  }

  // 4. Currency
  const currency = client?.currency || trip.price_type || 'MAD';

  // 5. Official Identifiers
  const mrn = customsSubmission?.mrn || trip.mrn_export_url || undefined;
  const scelleNumbers =
    customsSubmission?.seal_numbers && customsSubmission.seal_numbers.length > 0
      ? customsSubmission.seal_numbers
      : undefined;
  const ferryBooking = trip.ferry_localizador || trip.ferry_localizador_import || undefined;
  const cmrNumber = trip.cmr_export_number || trip.cmr_number || undefined;
  const clientIce = client?.ice ? client.ice.trim() : undefined;

  return {
    baseFreight: baseFreightDec.toFixed(2),
    ferryCost: ferryCostDec.toFixed(2),
    customsAndPortFees: customsAndPortFeesDec.toFixed(2),
    totalHt: totalHtDec.toFixed(2),
    tvaRate,
    tvaAmount: tvaAmountDec.toFixed(2),
    totalTtc: totalTtcDec.toFixed(2),
    currency,
    isTaxExempt,
    taxExemptionClause,
    mrn,
    scelleNumbers,
    ferryBooking,
    cmrNumber,
    clientIce,
  };
}

/**
 * Generates an official, sequential invoice numbering schema for a trip.
 */
export function formatAutoInvoiceNumber(tripId: number, companyId?: number | null): string {
  const year = new Date().getFullYear();
  const paddedId = String(tripId).padStart(4, '0');
  const compPrefix = companyId ? `C${companyId}-` : '';
  return `INV-${compPrefix}${year}-${paddedId}`;
}

/**
 * Builds formatted banking coordinates string for wire transfers.
 */
export function formatBankCoordinates(client?: Client | null): string {
  if (client?.default_bank_account) {
    return client.default_bank_account;
  }
  return 'ATTIJARIWAFA BANK - RIB: 007 780 0001234567890123 45 (SWIFT: BCMAMAMC)';
}

/**
 * Builds the encrypted self-service portal / tracking link for client settlement.
 */
export function buildClientPaymentPortalLink(
  tripId: number,
  clientId?: number | string | null,
  clientIce?: string | null,
  cmrNumber?: string | null
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
  const params = new URLSearchParams();
  if (clientId) params.set('client_id', String(clientId));
  if (clientIce) params.set('ice', clientIce);
  if (cmrNumber) params.set('cmr', cmrNumber);
  params.set('trip_id', String(tripId));

  return `${baseUrl}/portal/invoices?${params.toString()}`;
}

/**
 * Core Orchestrator: Automatically generates a legal invoice upon customs clearance or delivery.
 * Enforces strict Idempotency (never duplicates an existing invoice for the same trip).
 */
export async function autoGenerateInvoiceForTrip(
  tripId: number,
  options: AutoInvoiceOptions = {}
): Promise<AutoInvoiceResult> {
  try {
    const supabase = await createClient();

    // 1. Idempotency Check: check if invoice already exists for this trip_order_id
    const { data: existingInvoices, error: checkErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('trip_order_id', tripId);

    if (checkErr) {
      console.warn('Idempotency check query error:', checkErr);
    }

    if (existingInvoices && existingInvoices.length > 0 && !options.forceRecreate) {
      const existing = existingInvoices[0] as Invoice;
      const paymentLink = buildClientPaymentPortalLink(
        tripId,
        existing.client_id,
        undefined,
        undefined
      );
      return {
        success: true,
        invoice: existing,
        alreadyExisted: true,
        paymentLink,
      };
    }

    // 2. Fetch Trip Order, Client, and Customs Submission
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return {
        success: false,
        error: `الرحلة #${tripId} غير موجودة في قاعدة البيانات.`,
      };
    }

    const clientId = trip.client_id || trip.client_import_id;
    if (!clientId) {
      return {
        success: false,
        error: `لا يمكن توليد الفاتورة آلياً للرحلة #${tripId}: العميل المصدر غير محدد في أمر النقل.`,
      };
    }

    // Query Client and Customs Submission in parallel
    const [clientRes, customsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase
        .from('customs_submissions')
        .select('mrn, seal_numbers, portal_type, status')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const client = (clientRes.data as Client) || null;
    const customsSubmission = customsRes.data || null;

    // 3. Compute Itemized Financial Breakdown with Decimal.js
    const breakdown = calculateTripInvoiceBreakdown(
      trip as TripOrder,
      client,
      customsSubmission
    );

    // 4. Prepare Legal Invoice Record
    const invoiceNumber = formatAutoInvoiceNumber(tripId, trip.company_id);
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDays = options.paymentDueDays || 30;
    const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const bankInfo = formatBankCoordinates(client);
    const paymentLink = buildClientPaymentPortalLink(
      tripId,
      clientId,
      breakdown.clientIce,
      breakdown.cmrNumber
    );

    let paymentRef = '';
    if (breakdown.mrn) {
      paymentRef = `MRN: ${breakdown.mrn}`;
    } else if (breakdown.cmrNumber) {
      paymentRef = `CMR: ${breakdown.cmrNumber}`;
    } else {
      paymentRef = `TRIP #${tripId}`;
    }

    const invoicePayload: Partial<Invoice> = {
      company_id: trip.company_id || null,
      client_id: String(clientId),
      invoice_number: invoiceNumber,
      trip_order_id: tripId,
      total_amount: breakdown.totalTtc,
      paid_amount: '0.00',
      status: 'unpaid',
      issue_date: issueDate,
      due_date: dueDate,
      currency: breakdown.currency,
      input_mode: 'auto_customs',
      ht_amount: breakdown.totalHt,
      tva_rate: breakdown.tvaRate,
      tva_amount: breakdown.tvaAmount,
      ttc_amount: breakdown.totalTtc,
      route: trip.route || trip.route_export || 'Fret International',
      bank_info_text: bankInfo,
      payment_request_ref: paymentRef,
    };

    // 5. Insert Invoice into Database
    let createdInvoice: Invoice;

    if (existingInvoices && existingInvoices.length > 0 && options.forceRecreate) {
      const existingId = existingInvoices[0].id;
      const { data: updated, error: updErr } = await supabase
        .from('invoices')
        .update(invoicePayload)
        .eq('id', existingId)
        .select()
        .single();

      if (updErr) throw updErr;
      createdInvoice = updated as Invoice;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (insErr) throw insErr;
      createdInvoice = inserted as Invoice;
    }

    // 6. Link Invoice URL back to Trip Order
    await supabase
      .from('trip_orders')
      .update({
        facture_url: paymentLink,
      })
      .eq('id', tripId);

    // 7. Automated Dispatch (WhatsApp Cloud API)
    let notificationSent = false;
    const clientPhone = client?.phone;
    const recipientPhone = clientPhone || process.env.ADMIN_ALERT_PHONE || '212694585307';

    if (recipientPhone) {
      try {
        const clientDisplayName = client?.name || `عميل #${clientId}`;
        const taxStatusText = breakdown.isTaxExempt
          ? 'معفاة من الضريبة (مادة 92 CGI - نقل دولي)'
          : `خاضعة لـ TVA بنسبة ${breakdown.tvaRate}%`;

        const waText =
          `📄 *فاتورة نقل جديدة — Trans Bodanon TMS*\n` +
          `----------------------------------\n` +
          `🏢 العميل: *${clientDisplayName}*\n` +
          `🔢 رقم الفاتورة: *${invoiceNumber}*\n` +
          `🚛 الرحلة: *#${tripId} (${invoicePayload.route})*\n` +
          `💰 المبلغ الإجمالي: *${breakdown.totalTtc} ${breakdown.currency}*\n` +
          `⚖️ الوضع الجبائي: *${taxStatusText}*\n` +
          (breakdown.mrn ? `🛂 التصريح الجمركي: *MRN ${breakdown.mrn}*\n` : '') +
          (breakdown.ferryBooking ? `🚢 حجز العبارة: *${breakdown.ferryBooking}*\n` : '') +
          `📅 تاريخ الاستحقاق: *${dueDate}*\n` +
          `🏦 الحساب البنكي: *${bankInfo}*\n\n` +
          `🔗 *رابط كشف الحساب وبوابة السداد*:\n${paymentLink}`;

        await sendWhatsAppCloudMessage({
          to: recipientPhone,
          message: waText,
          auditEntity: {
            type: 'invoices',
            id: createdInvoice.id,
          },
        });
        notificationSent = true;
      } catch (waErr) {
        console.warn('Failed to send auto-invoicing WhatsApp message:', waErr);
      }
    }

    // 8. Record Immutable Audit Log
    try {
      await recordAuditLog({
        entityType: 'invoices',
        entityId: String(createdInvoice.id),
        actionType: 'create',
        reason: `توليد تلقائي للفاتورة القانونية #${invoiceNumber} بعد الحدث [${
          options.triggerEvent || 'customs_cleared'
        }] للرحلة #${tripId}`,
        newData: {
          invoiceId: createdInvoice.id,
          invoiceNumber,
          tripId,
          clientId,
          totalTtc: breakdown.totalTtc,
          currency: breakdown.currency,
          isTaxExempt: breakdown.isTaxExempt,
          mrn: breakdown.mrn,
          triggerEvent: options.triggerEvent || 'customs_cleared',
        },
      });
    } catch (auditErr) {
      console.warn('Failed to record auto-invoicing audit log:', auditErr);
    }

    // 9. Revalidate App Routes
    try {
      revalidatePath('/invoices');
      revalidatePath('/trips');
      revalidatePath(`/trips/${tripId}`);
      revalidatePath('/portal/invoices');
      revalidatePath('/dashboard');
    } catch {
      // Safe no-op outside Next.js request context
    }

    return {
      success: true,
      invoice: createdInvoice,
      alreadyExisted: false,
      paymentLink,
      notificationSent,
      details: breakdown,
    };
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : 'فشل غير متوقع في توليد الفاتورة التلقائية';
    return {
      success: false,
      error: errorMsg,
    };
  }
}
