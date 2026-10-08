'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type {
  PortNetGatePass,
  TirEpdDeclaration,
  CustomsPreCheckResult,
} from '../types';
import { getCustomsCertificateConfig } from './customs-mtls-signer.service';
import {
  transmitBadrDum,
  transmitPortNetManifest,
} from './portnet-badr-edi.service';
import { generateCustomsIdempotencyKey } from './customs-submission.service';
import { recordAuditLog } from '@/lib/audit.server';
import type {
  BadrDumData,
  PortNetManifestData,
  BadrClearanceReceipt,
} from '../types/customs-mtls.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Fetch complete trip details for customs documentation
 */
export async function getTripCustomsData(tripId: number): Promise<{
  success: boolean;
  trip?: any;
  portNet?: PortNetGatePass;
  tirEpd?: TirEpdDeclaration;
  readiness?: CustomsPreCheckResult;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch trip order with related truck, trailer, driver, client, company
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        *,
        truck:trucks(id, plate_number, model),
        trailer:trailers(id, plate_number, model),
        driver:drivers(id, name, passport_number, cin, phone),
        client:clients!trip_orders_client_id_fkey(id, name, ice, tax_id, address, city),
        client_import:clients!trip_orders_client_import_id_fkey(id, name, ice, tax_id, address, city)
      `)
      .eq('id', tripId)
      .single();

    if (tripErr) throw tripErr;
    if (!trip) throw new Error('الرحلة غير موجودة');

    // Extract carrier / company
    const carrierName = 'TRANS BODANON SARL';
    const carrierTirHolder = 'MA/042/2026'; // National TIR Holder code

    const cmrNumber = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;
    const mrnNumber = trip.cmr_export_number ? `MRN-MA-${trip.cmr_export_number}` : `MRN-MA-${trip.id}-DUM`;
    const sealNumber = `MA-DOUANE-${trip.id.toString().padStart(6, '0')}`;

    const grossWeight = new Decimal(trip.weight_export || trip.weight_import || 22000).toNumber();
    const goodsDesc = trip.goods_description_export || trip.goods_description_import || 'Marchandises Générales (TIR)';

    const consignor = trip.client?.name || 'Chargeur Maroc';
    const consignorIce = trip.client?.ice || '';
    const consignee = trip.client_import?.name || 'Destinataire Europe';
    const consigneeVat = trip.client_import?.tax_id || trip.client_import?.ice || '';

    const portNet: PortNetGatePass = {
      tripId: trip.id,
      cmrNumber,
      bookingReference: trip.ferry_localizador || `FR-${trip.id}-BKG`,
      ferryCompany: trip.ferry_company || 'FRS Iberia / Baleària',
      mrnNumber,
      portOfDeparture: 'TANGER MED PORT PASSAGER (MA)',
      portOfArrival: 'PUERTO DE ALGECIRAS (ES)',
      tractorPlate: trip.truck?.plate_number || 'T-MAROC',
      trailerPlate: trip.trailer?.plate_number || 'R-MAROC',
      driverName: trip.driver?.name || 'Conducteur Non Assigné',
      driverCinOrPassport: trip.driver?.passport_number || trip.driver?.cin || '',
      driverPhone: trip.driver?.phone,
      customsSealNumber: sealNumber,
      goodsDescription: goodsDesc,
      grossWeightKg: grossWeight,
      consignorName: consignor,
      consignorIce,
      consigneeName: consignee,
      consigneeAddress: trip.client_import?.address || 'Zone Industrielle, Espagne / UE',
      consigneeVatOrEori: consigneeVat,
      issueDate: new Date().toISOString().split('T')[0],
    };

    const tirEpd: TirEpdDeclaration = {
      tripId: trip.id,
      carnetTirNumber: `XF-${trip.id.toString().padStart(7, '0')}`,
      customsOfficeDeparture: 'MA000001', // Tanger Med Port Douane
      customsOfficeEntryEU: 'ES001101', // Algeciras Puerto
      mrnReference: mrnNumber,
      tractorPlate: trip.truck?.plate_number || '',
      trailerPlate: trip.trailer?.plate_number || '',
      driverFullName: trip.driver?.name || '',
      driverPassport: trip.driver?.passport_number || '',
      hsCode: '870423', // Code SH Transport Marchandises
      goodsDescription: goodsDesc,
      packageCount: 33, // Standard 33 Europallets
      packageType: 'PX', // Pallet
      grossWeightKg: grossWeight,
      customsSealNumber: sealNumber,
      carrierName,
      carrierTirHolderId: carrierTirHolder,
      declarationDate: new Date().toISOString().split('T')[0],
    };

    // Pre-check readiness
    const missingPortNet: string[] = [];
    if (!trip.truck?.plate_number) missingPortNet.push('رقم لوحة الشاحنة (Tracteur)');
    if (!trip.trailer?.plate_number) missingPortNet.push('رقم لوحة المقطورة (Remorque)');
    if (!trip.driver?.name) missingPortNet.push('اسم السائق');
    if (!trip.driver?.passport_number && !trip.driver?.cin) missingPortNet.push('جواز سفر / بطاقة تعريف السائق');
    if (!trip.ferry_localizador) missingPortNet.push('رقم حجز العبّارة (Booking Localizador)');

    const missingTirEpd: string[] = [];
    if (!trip.truck?.plate_number) missingTirEpd.push('لوحة رأس الشاحنة');
    if (!trip.trailer?.plate_number) missingTirEpd.push('لوحة المقطورة');
    if (!trip.driver?.passport_number) missingTirEpd.push('رقم جواز السفر الدولي للسائق');
    if (!grossWeight || grossWeight <= 0) missingTirEpd.push('الوزن الإجمالي للبضاعة');

    const readiness: CustomsPreCheckResult = {
      isReadyForPortNet: missingPortNet.length === 0,
      isReadyForTirEpd: missingTirEpd.length === 0,
      missingPortNetFields: missingPortNet,
      missingTirEpdFields: missingTirEpd,
    };

    return {
      success: true,
      trip,
      portNet,
      tirEpd,
      readiness,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب بيانات الجمارك والموانئ';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Submit customs declaration directly to PortNet or TIR-EPD with idempotency
 */
export async function submitDirectCustomsDeclaration(
  tripId: number,
  gateway: 'portnet' | 'tir_epd' = 'portnet',
  options?: { mode?: 'sandbox' | 'production'; force?: boolean }
) {
  const { submitCustomsDeclaration } = await import('./customs-submission.service');
  return await submitCustomsDeclaration(tripId, gateway, options);
}

/**
 * Server Action: Inspect X.509 Client Certificate health and expiration
 */
export async function getCustomsCertificateStatusAction() {
  try {
    const config = getCustomsCertificateConfig();
    return {
      success: true,
      issuerCN: config.issuerCN,
      subjectCN: config.subjectCN,
      serialNumber: config.serialNumber,
      validFrom: config.validFrom,
      validTo: config.validTo,
      daysUntilExpiry: config.daysUntilExpiry,
      isValid: config.isValid,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل فحص شهادة الربط الجمركي';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Submit official BADR DUM with XML-DSig signature and mTLS
 */
export async function submitBadrDumAction(
  tripId: number,
  options?: { force?: boolean }
): Promise<{
  success: boolean;
  receipt?: BadrClearanceReceipt;
  idempotentReplay?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const idempotencyKey = generateCustomsIdempotencyKey(tripId, 'badr');

    // 1. Idempotency Guard
    if (!options?.force) {
      const { data: existing } = await supabase
        .from('customs_submissions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('gateway', 'badr')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing && (existing.status === 'accepted' || existing.status === 'submitted')) {
        const cachedReceipt = existing.response_payload as BadrClearanceReceipt;
        return {
          success: true,
          receipt: cachedReceipt,
          idempotentReplay: true,
        };
      }
    }

    // 2. Fetch Trip Order Data
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        *,
        truck:trucks(id, plate_number),
        trailer:trailers(id, plate_number),
        driver:drivers(id, name, passport_number, cin),
        client:clients!trip_orders_client_id_fkey(id, name, ice),
        client_import:clients!trip_orders_client_import_id_fkey(id, name, ice)
      `)
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      throw new Error('تعذر العثور على ملف الرحلة لإصدار التصريح الجمركي DUM');
    }

    const grossWeight = new Decimal(trip.weight_export || trip.weight_import || 22000).toNumber();
    const customsVal = new Decimal(trip.price_export || trip.price || 45000).times(2.5).toNumber(); // Base customs value
    const goodsDesc = trip.goods_description_export || trip.goods_description_import || 'Marchandises Diverses';
    const bureauCode = trip.route?.toLowerCase().includes('guerguerat') || trip.route?.toLowerCase().includes('dakar')
      ? 'MA004900' // Guerguerat
      : 'MA003100'; // Tanger Med Port Passager

    const badrData: BadrDumData = {
      tripId: trip.id,
      referenceNumber: `DUM-REF-${trip.id}-${Date.now().toString().slice(-6)}`,
      regimeDouanier: '1000', // Exportation en simple sortie
      bureauDouanier: bureauCode,
      declarantAgrement: 'AGR-MA-TB-042',
      declarantName: 'TRANS BODANON TRANSIT SARL',
      carrierIce: '001928374650001',
      exporterIce: trip.client?.ice || '001234567890001',
      exporterName: trip.client?.name || 'Chargeur Marocain SARL',
      importerName: trip.client_import?.name || 'Destinataire International SA',
      importerCountry: 'ES',
      truckPlate: trip.truck?.plate_number || '12345-A-26',
      trailerPlate: trip.trailer?.plate_number || 'REM-001-B',
      cmrNumber: trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`,
      commodityCodeHs: '0702000000',
      goodsDescription: goodsDesc,
      grossWeightKg: grossWeight,
      netWeightKg: new Decimal(grossWeight).times(0.92).toNumber(),
      customsValueMad: customsVal,
      packagesCount: 33,
      ferryBookingRef: trip.ferry_localizador || undefined,
    };

    // 3. Transmit to BADR EDI Gateway
    const receipt = await transmitBadrDum(badrData);

    // 4. Record in customs_submissions
    await supabase.from('customs_submissions').upsert({
      trip_id: trip.id,
      company_id: trip.company_id || null,
      gateway: 'badr',
      idempotency_key: idempotencyKey,
      reference_number: badrData.referenceNumber,
      mrn_number: receipt.mrn,
      status: receipt.validationStatus === 'CLEARED_BAE' ? 'accepted' : 'submitted',
      response_payload: receipt,
      mode: process.env.CUSTOMS_API_MODE === 'production' ? 'production' : 'sandbox',
      submitted_at: new Date().toISOString(),
      accepted_at: receipt.validationStatus === 'CLEARED_BAE' ? new Date().toISOString() : null,
    }, { onConflict: 'company_id,idempotency_key' });

    // 5. Update trip_orders
    await supabase
      .from('trip_orders')
      .update({
        customs_status: receipt.validationStatus,
        customs_mrn: receipt.mrn,
        customs_declaration_number: receipt.declarationNumber,
        customs_channel: receipt.inspectionChannel,
        customs_bae_number: receipt.baeNumber || null,
        customs_bae_date: receipt.baeDate || null,
      })
      .eq('id', trip.id);

    // 6. Record Audit Log
    await recordAuditLog({
      entityType: 'trip_orders',
      entityId: trip.id,
      actionType: 'customs_push',
      reason: `Sovereign BADR DUM Declaration Submitted: MRN ${receipt.mrn} (Circuit: ${receipt.inspectionChannel})`,
      newData: { mrn: receipt.mrn, channel: receipt.inspectionChannel, status: receipt.validationStatus },
    });

    return {
      success: true,
      receipt,
      idempotentReplay: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل إرسال التصريح الجمركي DUM إلى نظام بدر';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Submit PortNet CUSCAR Cargo Manifest with XML-DSig
 */
export async function submitPortNetManifestAction(
  tripId: number,
  options?: { force?: boolean }
): Promise<{
  success: boolean;
  gatePassId?: string;
  referenceNumber?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const idempotencyKey = generateCustomsIdempotencyKey(tripId, 'portnet');

    // 1. Fetch Trip Order Data
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        *,
        truck:trucks(id, plate_number),
        trailer:trailers(id, plate_number),
        driver:drivers(id, name, passport_number, cin),
        client:clients!trip_orders_client_id_fkey(id, name, ice),
        client_import:clients!trip_orders_client_import_id_fkey(id, name, ice)
      `)
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      throw new Error('تعذر العثور على ملف الرحلة لإيداع مانيفست بورتنيت');
    }

    const grossWeight = new Decimal(trip.weight_export || trip.weight_import || 22000).toNumber();

    const manifestData: PortNetManifestData = {
      tripId: trip.id,
      referenceNumber: `PN-MAN-${trip.id}-${Date.now().toString().slice(-6)}`,
      voyageNumber: trip.ferry_localizador || `VOY-${trip.id}`,
      shippingLine: trip.ferry_company || 'Balearia / FRS Iberia',
      portOfLoading: 'MAPTM', // Tanger Med
      portOfDischarge: 'ESALG', // Algeciras
      truckPlate: trip.truck?.plate_number || '12345-A-26',
      trailerPlate: trip.trailer?.plate_number || 'REM-001-B',
      driverName: trip.driver?.name || 'Conducteur International',
      driverPassport: trip.driver?.passport_number || 'PA123456',
      driverCin: trip.driver?.cin || 'K123456',
      cmrNumber: trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`,
      mrnNumber: trip.customs_mrn || undefined,
      grossWeightKg: grossWeight,
      sealNumber: `MA-DOUANE-${trip.id.toString().padStart(6, '0')}`,
      goodsDescription: trip.goods_description_export || 'Fruits & Legumes Primeurs',
      ferryLocalizador: trip.ferry_localizador || `BKG-${trip.id}`,
      timestamp: new Date().toISOString(),
    };

    // 2. Transmit to PortNet
    const res = await transmitPortNetManifest(manifestData);

    // 3. Upsert into customs_submissions
    await supabase.from('customs_submissions').upsert({
      trip_id: trip.id,
      company_id: trip.company_id || null,
      gateway: 'portnet',
      idempotency_key: idempotencyKey,
      reference_number: manifestData.referenceNumber,
      mrn_number: trip.customs_mrn || undefined,
      barcode_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(res.gatePassId)}`,
      status: 'accepted',
      response_payload: res,
      mode: process.env.CUSTOMS_API_MODE === 'production' ? 'production' : 'sandbox',
      submitted_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'company_id,idempotency_key' });

    // 4. Record Audit Log
    await recordAuditLog({
      entityType: 'trip_orders',
      entityId: trip.id,
      actionType: 'customs_push',
      reason: `PortNet CUSCAR Manifest Deposited: Gate Pass ${res.gatePassId}`,
      newData: { gatePassId: res.gatePassId, referenceNumber: res.referenceNumber },
    });

    return {
      success: true,
      gatePassId: res.gatePassId,
      referenceNumber: res.referenceNumber,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل إيداع المانيفست على بوابة PortNet';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Get comprehensive customs compliance & clearance status for a trip
 */
export async function getTripCustomsComplianceStatus(tripId: number) {
  try {
    const supabase = await createClient();

    const [tripRes, submissionsRes] = await Promise.all([
      supabase
        .from('trip_orders')
        .select('id, customs_status, customs_mrn, customs_declaration_number, customs_channel, customs_bae_number, customs_bae_date')
        .eq('id', tripId)
        .maybeSingle(),
      supabase
        .from('customs_submissions')
        .select('*')
        .eq('trip_id', tripId)
        .order('id', { ascending: false }),
    ]);

    return {
      success: true,
      tripCustoms: tripRes.data,
      submissions: submissionsRes.data || [],
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل جلب حالة الامتثال الجمركي';
    return { success: false, error: errorMsg, submissions: [] };
  }
}

/**
 * Server Action: Get complete dashboard data for the Sovereign Customs Compliance Desk
 */
export async function getCustomsDeskDataAction(): Promise<{
  success: boolean;
  certificate: ReturnType<typeof getCustomsCertificateConfig>;
  trips: any[];
  stats: {
    totalTrips: number;
    clearedBaeCount: number;
    circuitVertCount: number;
    circuitOrangeCount: number;
    circuitRougeCount: number;
    totalLiquidationMad: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const certificate = getCustomsCertificateConfig();

    const { data: trips, error: tripsErr } = await supabase
      .from('trip_orders')
      .select(`
        id,
        status,
        route,
        corridor_type,
        departure_date,
        cmr_export_number,
        cmr_number,
        goods_description_export,
        weight_export,
        price_export,
        price,
        ferry_localizador,
        ferry_company,
        customs_status,
        customs_mrn,
        customs_declaration_number,
        customs_channel,
        customs_bae_number,
        customs_bae_date,
        truck:trucks(id, plate_number, model),
        trailer:trailers(id, plate_number, model),
        driver:drivers(id, name, passport_number, cin),
        client:clients!trip_orders_client_id_fkey(id, name, ice)
      `)
      .order('id', { ascending: false })
      .limit(50);

    if (tripsErr) throw tripsErr;

    // Strict Decimal.js calculations
    let totalLiquidationDec = new Decimal(0);
    let clearedBaeCount = 0;
    let circuitVertCount = 0;
    let circuitOrangeCount = 0;
    let circuitRougeCount = 0;

    const tripsList = trips || [];
    for (const t of tripsList) {
      if (t.customs_status === 'CLEARED_BAE' || t.customs_status === 'accepted') {
        clearedBaeCount++;
      }
      if (t.customs_channel === 'GREEN') {
        circuitVertCount++;
      } else if (t.customs_channel === 'ORANGE') {
        circuitOrangeCount++;
      } else if (t.customs_channel === 'RED') {
        circuitRougeCount++;
      }

      // 0.25% statistical tax + 50 MAD timbre on customs value
      const tripVal = new Decimal(t.price_export || t.price || 40000).times(2.5);
      const taxForTrip = tripVal.times(0.0025).plus(50);
      totalLiquidationDec = totalLiquidationDec.plus(taxForTrip);
    }

    return {
      success: true,
      certificate,
      trips: tripsList,
      stats: {
        totalTrips: tripsList.length,
        clearedBaeCount,
        circuitVertCount,
        circuitOrangeCount,
        circuitRougeCount,
        totalLiquidationMad: parseFloat(totalLiquidationDec.toFixed(2)),
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل تحميل بيانات منصة الامتثال الجمركي';
    return {
      success: false,
      certificate: getCustomsCertificateConfig(),
      trips: [],
      stats: {
        totalTrips: 0,
        clearedBaeCount: 0,
        circuitVertCount: 0,
        circuitOrangeCount: 0,
        circuitRougeCount: 0,
        totalLiquidationMad: 0,
      },
      error: errorMsg,
    };
  }
}


