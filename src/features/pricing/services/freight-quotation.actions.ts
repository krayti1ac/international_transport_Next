'use server';

import { z } from 'zod';
import { recordAuditLog } from '@/lib/audit.server';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { buildFreightQuotation } from './dynamic-quotation-builder.service';
import {
  convertQuotationToTripOrder,
  storeQuotationInMemory,
  getQuotationFromMemory,
  listQuotationsFromMemory,
} from './quotation-to-trip-converter.service';
import type {
  CreateQuotationInput,
  FreightQuotation,
  QuotationConversionResult,
} from '../types/freight-quotation.types';

const CreateQuotationSchema = z.object({
  clientId: z.union([z.string(), z.number()]).optional(),
  clientName: z.string().min(2, 'اسم العميل مطلوب'),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  originCity: z.string().min(2, 'مدينة الانطلاق مطلوبة'),
  destinationCity: z.string().min(2, 'مدينة الوصول مطلوبة'),
  corridorType: z.enum(['european_maritime', 'african_overland']).optional(),
  cargoType: z.enum([
    'dry_box',
    'reefer_temperature_controlled',
    'mega_curtain',
    'hazardous_adr',
  ]),
  weightTons: z.number().positive().optional(),
  roadDistanceKm: z.number().positive().optional(),
  targetMarginPercent: z.number().min(5).max(60).optional(),
  currency: z.enum(['MAD', 'EUR', 'MRU', 'XOF']).optional(),
  selectedTier: z.enum(['floor', 'spot', 'expressPremium']).optional(),
  reeferSetpointTemp: z.number().optional(),
  validityDays: z.number().positive().optional(),
});

/**
 * Creates a formal Freight Quotation.
 */
export async function createFreightQuotationAction(
  rawInput: CreateQuotationInput
): Promise<{
  success: boolean;
  data?: FreightQuotation;
  error?: string;
}> {
  try {
    const parsed = CreateQuotationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const quotation = buildFreightQuotation(parsed.data as CreateQuotationInput);
    storeQuotationInMemory(quotation);

    // Record Immutable Audit Log
    try {
      await recordAuditLog({
        entityType: 'freight_quotation',
        entityId: quotation.quotationNumber,
        actionType: 'create',
        reason: `إنشاء عرض سعر فوري ${quotation.quotationNumber} للعميل ${quotation.clientName} بقيمة ${quotation.finalPrice} ${quotation.currency}`,
        newData: {
          quotationNumber: quotation.quotationNumber,
          clientName: quotation.clientName,
          route: `${quotation.originCity} ➔ ${quotation.destinationCity}`,
          finalPrice: quotation.finalPrice,
          currency: quotation.currency,
          tier: quotation.selectedTier,
        },
      });
    } catch {
      // Non-blocking
    }

    return { success: true, data: quotation };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إنشاء عرض السعر';
    return { success: false, error: message };
  }
}

/**
 * Retrieves a Freight Quotation by ID.
 */
export async function getFreightQuotationAction(
  id: string
): Promise<{
  success: boolean;
  data?: FreightQuotation;
  error?: string;
}> {
  try {
    const quotation = getQuotationFromMemory(id);
    if (!quotation) {
      return { success: false, error: 'عرض السعر غير موجود' };
    }
    return { success: true, data: quotation };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل جلب عرض السعر';
    return { success: false, error: message };
  }
}

/**
 * Lists all active quotations.
 */
export async function listFreightQuotationsAction(): Promise<{
  success: boolean;
  data: FreightQuotation[];
}> {
  try {
    let list = listQuotationsFromMemory();
    if (list.length === 0) {
      // Create seed demo quotation
      const demo1 = buildFreightQuotation({
        clientName: 'Agro Souss Export SARL',
        clientPhone: '+212661234567',
        originCity: 'Agadir',
        destinationCity: 'Perpignan',
        cargoType: 'reefer_temperature_controlled',
        weightTons: 22,
        currency: 'EUR',
      });
      storeQuotationInMemory(demo1);

      const demo2 = buildFreightQuotation({
        clientName: 'Comptoir Sahel Distribution',
        clientPhone: '+22245258900',
        originCity: 'Casablanca',
        destinationCity: 'Dakar',
        cargoType: 'dry_box',
        weightTons: 24,
        currency: 'MAD',
      });
      storeQuotationInMemory(demo2);

      list = [demo1, demo2];
    }

    return { success: true, data: list };
  } catch {
    return { success: true, data: [] };
  }
}

/**
 * Converts an accepted Freight Quotation into a live operational Trip Order.
 */
export async function convertQuotationToTripAction(
  quotationId: string
): Promise<{
  success: boolean;
  data?: QuotationConversionResult;
  error?: string;
}> {
  try {
    const quotation = getQuotationFromMemory(quotationId);
    if (!quotation) {
      return { success: false, error: 'عرض السعر المطلوب غير موجود' };
    }

    const result = await convertQuotationToTripOrder(quotation);
    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل تحويل عرض السعر إلى أمر شحن';
    return { success: false, error: message };
  }
}

/**
 * Dispatches formal Quotation via Meta WhatsApp Cloud API.
 */
export async function sendQuotationViaWhatsAppAction(params: {
  quotationId: string;
  recipientPhone: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { quotationId, recipientPhone } = params;
    const quotation = getQuotationFromMemory(quotationId);

    if (!quotation) {
      return { success: false, error: 'عرض السعر المطلوب غير موجود' };
    }

    const waMsg =
      `📋 *عرض سعر رسمي للشحن الدولي — Trans Bodanon TMS*\n` +
      `----------------------------------------\n` +
      `📌 رقم العرض: *${quotation.quotationNumber}*\n` +
      `🏢 العميل: *${quotation.clientName}*\n` +
      `🛣️ المسار: *${quotation.originCity} ➔ ${quotation.destinationCity}* (${quotation.totalDistanceKm} كم)\n` +
      `📦 نوع الحمولة: *${quotation.cargoType}* (${quotation.weightTons} طن)\n` +
      `💰 السعر الصافي: *${quotation.finalPrice} ${quotation.currency}*\n` +
      `⚖️ الضريبة على القيمة المضافة: *0.00 MAD (إعفاء م. 92-I-10° CGI)*\n` +
      `💵 *المبلغ الإجمالي المستحق: ${quotation.totalPriceWithVat} ${quotation.currency}*\n` +
      `⏱️ العرض صالح حتى: ${quotation.validUntil.slice(0, 10)}\n\n` +
      `✅ للاعتماد وتحويل العرض إلى أمر شحن فوري (CMR)، يرجى تأكيد الطلب.`;

    await sendWhatsAppCloudMessage({
      to: recipientPhone,
      message: waMsg,
      auditEntity: {
        type: 'freight_quotation',
        id: quotation.quotationNumber,
      },
    });

    // Update status
    quotation.status = 'SENT_TO_CLIENT';
    storeQuotationInMemory(quotation);

    return {
      success: true,
      message: `تم إرسال عرض السعر ${quotation.quotationNumber} عبر WhatsApp بنجاح إلى ${recipientPhone}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'فشل إرسال عرض السعر عبر WhatsApp';
    return { success: false, error: message };
  }
}

